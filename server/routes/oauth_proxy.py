"""
OAuth2 Proxy Endpoints for MCP Clients

Some MCP clients (like VS Code extension) derive OAuth endpoints from the base URL
instead of using explicit authorizationEndpoint/tokenEndpoint configurations.

This module provides proxy endpoints that redirect OAuth flows to Keycloak.
"""

from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse, JSONResponse
from server.config import settings
import httpx
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["oauth-proxy"])


@router.get("/mcp/authorize")
@router.get("/authorize")
async def oauth_authorize_proxy(request: Request):
    """
    Proxy OAuth2 authorization requests to Keycloak

    This allows MCP clients to use the gateway URL as the OAuth base URL
    while actually authenticating with Keycloak.
    """
    # Get all query parameters
    params = dict(request.query_params)

    # Build Keycloak authorization URL
    keycloak_auth_url = (
        f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
        "/protocol/openid-connect/auth"
    )

    logger.info(f"Proxying authorization request to Keycloak: {keycloak_auth_url}")
    logger.debug(f"Authorization params: {params}")

    # Redirect to Keycloak with all query parameters
    return RedirectResponse(
        url=f"{keycloak_auth_url}?{'&'.join(f'{k}={v}' for k, v in params.items())}",
        status_code=302
    )


@router.post("/mcp/token")
@router.get("/mcp/token")
@router.post("/token")
@router.get("/token")  # Some clients might use GET
async def oauth_token_proxy(request: Request):
    """
    Proxy OAuth2 token requests to Keycloak

    This allows MCP clients to exchange authorization codes for tokens
    using the gateway URL while actually getting tokens from Keycloak.
    """
    # Get request body (form data for token exchange)
    if request.method == "POST":
        form_data = await request.form()
        data = dict(form_data)
    else:
        data = dict(request.query_params)

    # Build Keycloak token URL
    keycloak_token_url = (
        f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
        "/protocol/openid-connect/token"
    )

    logger.info(f"Proxying token request to Keycloak: {keycloak_token_url}")
    logger.debug(f"Token request type: {data.get('grant_type')}")

    try:
        # Forward request to Keycloak
        async with httpx.AsyncClient() as client:
            response = await client.post(
                keycloak_token_url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )

        # Return Keycloak's response
        return JSONResponse(
            content=response.json(),
            status_code=response.status_code
        )

    except Exception as e:
        logger.error(f"Error proxying token request: {e}", exc_info=True)
        return JSONResponse(
            content={
                "error": "server_error",
                "error_description": f"Failed to proxy token request: {str(e)}"
            },
            status_code=500
        )


@router.get("/.well-known/openid-configuration")
async def openid_configuration_proxy():
    """
    Proxy OpenID Connect discovery document from Keycloak

    This allows MCP clients to discover OAuth2 endpoints from the gateway URL.
    """
    keycloak_discovery_url = (
        f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
        "/.well-known/openid-configuration"
    )

    logger.info(f"Proxying OpenID configuration from Keycloak: {keycloak_discovery_url}")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(keycloak_discovery_url)

        config = response.json()

        # Optionally rewrite URLs to point to gateway instead of Keycloak
        # (Some clients might expect all URLs to be under the same base)
        gateway_base = f"http://localhost:{settings.port}"

        # Keep Keycloak URLs but make them accessible through gateway
        # This is informational only - the proxy endpoints handle the actual redirects

        return JSONResponse(content=config)

    except Exception as e:
        logger.error(f"Error proxying OpenID configuration: {e}", exc_info=True)
        return JSONResponse(
            content={
                "error": "server_error",
                "error_description": f"Failed to proxy OpenID configuration: {str(e)}"
            },
            status_code=500
        )


@router.get("/.well-known/oauth-authorization-server")
async def oauth_authorization_server_metadata():
    """
    OAuth 2.0 Authorization Server Metadata (RFC 8414)

    VS Code MCP client checks this endpoint to discover OAuth2 capabilities.
    """
    # Use localhost:8080 for external access instead of internal keycloak:8080
    keycloak_base = f"http://localhost:8080/realms/{settings.keycloak_realm}"

    metadata = {
        "issuer": keycloak_base,
        "authorization_endpoint": f"{keycloak_base}/protocol/openid-connect/auth",
        "token_endpoint": f"{keycloak_base}/protocol/openid-connect/token",
        "token_endpoint_auth_methods_supported": [
            "client_secret_basic",
            "client_secret_post",
            "private_key_jwt",
            "none"  # For PKCE public clients
        ],
        "jwks_uri": f"{keycloak_base}/protocol/openid-connect/certs",
        "response_types_supported": [
            "code",
            "token",
            "id_token",
            "code token",
            "code id_token",
            "token id_token",
            "code token id_token"
        ],
        "grant_types_supported": [
            "authorization_code",
            "refresh_token",
            "client_credentials"
        ],
        "revocation_endpoint": f"{keycloak_base}/protocol/openid-connect/revoke",
        "revocation_endpoint_auth_methods_supported": [
            "client_secret_basic",
            "client_secret_post",
            "private_key_jwt"
        ],
        "introspection_endpoint": f"{keycloak_base}/protocol/openid-connect/token/introspect",
        "introspection_endpoint_auth_methods_supported": [
            "client_secret_basic",
            "client_secret_post",
            "private_key_jwt"
        ],
        "code_challenge_methods_supported": ["S256", "plain"],
        "scopes_supported": ["openid", "profile", "email", "mcp:tools"]
    }

    logger.info("Returning OAuth2 Authorization Server metadata")
    return JSONResponse(content=metadata)


@router.get("/.well-known/oauth-protected-resource")
async def oauth_protected_resource_metadata():
    """
    OAuth 2.0 Protected Resource Metadata (RFC 8707)

    MCP clients use this endpoint to discover OAuth2 configuration for the gateway.
    This follows the MCP specification for authorization:
    https://modelcontextprotocol.io/docs/tutorials/security/authorization

    Returns metadata about:
    - Authorization server (Keycloak)
    - Required scopes (mcp:tools)
    - Supported authentication methods
    - Public key algorithm (RS256)

    VS Code and other MCP clients use this for auto-discovery of OAuth2 endpoints.
    """
    # Use localhost:8080 for external access instead of internal keycloak:8080
    keycloak_base = f"http://localhost:8080/realms/{settings.keycloak_realm}"

    metadata = {
        "resource": settings.mcp_resource_server_url,
        "authorization_servers": [keycloak_base],
        "bearer_methods_supported": ["header"],
        "resource_signing_alg_values_supported": ["RS256"],
        "resource_documentation": "https://modelcontextprotocol.io/docs/tutorials/security/authorization",
        "scopes_supported": settings.mcp_required_scopes.split(),
        "resource_capabilities": ["mcp-protocol"],

        # Additional metadata for MCP clients
        "mcp_version": "2024-11-05",
        "public_clients_supported": True,  # Indicates support for PKCE
        "authorization_code_flow_supported": True
    }

    logger.info("Returning OAuth2 Protected Resource metadata for MCP client")
    return JSONResponse(content=metadata)


@router.get("/.well-known/oauth-protected-resource/mcp")
async def oauth_protected_resource_mcp_metadata():
    """
    OAuth 2.0 Protected Resource Metadata for /mcp endpoint

    Some clients may append the resource path to the well-known URL.
    """
    return await oauth_protected_resource_metadata()

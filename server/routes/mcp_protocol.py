"""
MCP Protocol Endpoint - Provides native MCP protocol support for MCP clients

This endpoint implements the MCP protocol using JSON-RPC over HTTP, allowing
MCP clients (VS Code, Claude Desktop, etc.) to connect to the gateway.

Supports OAuth2 authentication following the MCP specification:
https://modelcontextprotocol.io/docs/tutorials/security/authorization

Authentication modes:
1. Public clients (VS Code): Authorization Code Flow with PKCE + JWT validation
2. Confidential clients: Token introspection with client credentials
3. No authentication: When AUTH_ENABLED=false
"""

from fastapi import APIRouter, Request, Header, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
from server.mcp_aggregator import aggregator
from server.auth.mcp_client_auth import mcp_authenticator
from server.config import settings
from mcp.types import JSONRPCRequest, JSONRPCResponse, JSONRPCError
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["mcp-protocol"])

# Log authentication mode on startup
if settings.auth_enabled:
    logger.info("MCP authentication ENABLED")
    logger.info(f"  Mode: Public client (PKCE + JWT validation)")
    logger.info(f"  Keycloak: {settings.keycloak_url}/realms/{settings.keycloak_realm}")
    logger.info(f"  Required scopes: {settings.mcp_required_scopes}")
else:
    logger.info("MCP authentication DISABLED")


@router.get("/mcp")
async def mcp_discovery_endpoint():
    """
    OAuth discovery endpoint for MCP clients (GET request)

    Returns server capabilities and OAuth configuration when authentication is enabled.
    This allows clients like VS Code to discover OAuth settings before attempting connection.
    """
    capabilities = {
        "tools": {},
        "resources": {},
        "prompts": {}
    }

    if settings.auth_enabled:
        oauth_scopes = ["openid", "profile", "email"] + settings.mcp_required_scopes.split()

        capabilities["oauth"] = {
            "authorizationUrl": f"http://localhost:8080/realms/{settings.keycloak_realm}/protocol/openid-connect/auth",
            "tokenUrl": f"http://localhost:8080/realms/{settings.keycloak_realm}/protocol/openid-connect/token",
            "clientId": "vscode-mcp-client",
            "scopes": oauth_scopes
        }

    return JSONResponse(
        status_code=200,
        content={
            "protocolVersion": "2024-11-05",
            "capabilities": capabilities,
            "serverInfo": {
                "name": "secure-mcp-gateway",
                "version": "1.0.0"
            }
        }
    )


@router.post("/mcp")
async def mcp_endpoint(
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """
    MCP Protocol endpoint using JSON-RPC over HTTP with OAuth2 authentication

    This endpoint implements the MCP specification for OAuth2 authorization:
    https://modelcontextprotocol.io/docs/tutorials/security/authorization

    For public clients (VS Code, Claude Desktop):
    - Uses Authorization Code Flow with PKCE
    - Validates JWT tokens using JWKS (no client secret needed)
    - Token obtained via OAuth2 flow initiated by client

    VS Code MCP Configuration Example:
    {
      "servers": {
        "secure-gateway": {
          "transport": "http",
          "url": "http://localhost:8000/mcp",
          "auth": {
            "type": "oauth2",
            "flow": "authorizationCode",
            "authorizationEndpoint": "http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/auth",
            "tokenEndpoint": "http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/token",
            "clientId": "vscode-mcp-client",
            "scope": "mcp:tools",
            "pkce": true
          }
        }
      }
    }
    """
    try:
        # Parse JSON-RPC request first to check the method
        body = await request.json()
        method = body.get("method")
        params = body.get("params", {})
        request_id = body.get("id")

        logger.info(f"MCP RPC request from {request.client.host}: {method}")

        # Authenticate request if authentication is enabled
        # EXCEPT for:
        # 1. 'initialize' method - needed so VS Code can discover OAuth configuration
        # 2. notification methods (e.g., 'notifications/initialized') - MCP spec defines
        #    notifications as one-way messages that don't require authentication
        user_claims = None
        is_notification = method and method.startswith("notifications/")

        if settings.auth_enabled and method != "initialize" and not is_notification:
            try:
                # Authenticate using MCP client authenticator
                # This validates JWT tokens from public clients (VS Code)
                user_claims = await mcp_authenticator.authenticate_request(authorization)

                logger.info(
                    f"Authenticated MCP request: "
                    f"user={user_claims.get('preferred_username', user_claims.get('sub'))}, "
                    f"client={user_claims.get('azp', 'unknown')}"
                )
            except HTTPException as auth_error:
                # Return proper OAuth2 error response
                logger.warning(
                    f"Authentication failed from {request.client.host}: {auth_error.detail}"
                )
                return mcp_authenticator.build_oauth_error_response(
                    error="invalid_token",
                    error_description=str(auth_error.detail)
                )

        # Handle MCP protocol methods
        if method == "initialize":
            # Build capabilities response
            capabilities = {
                "tools": {},
                "resources": {},
                "prompts": {}
            }

            # Add OAuth configuration to capabilities if authentication is enabled
            if settings.auth_enabled:
                oauth_scopes = ["openid", "profile", "email"] + settings.mcp_required_scopes.split()

                capabilities["oauth"] = {
                    "authorizationUrl": f"http://localhost:8080/realms/{settings.keycloak_realm}/protocol/openid-connect/auth",
                    "tokenUrl": f"http://localhost:8080/realms/{settings.keycloak_realm}/protocol/openid-connect/token",
                    "clientId": "vscode-mcp-client",
                    "scopes": oauth_scopes
                }
                logger.info("Initialize response includes OAuth configuration for pre-registered client 'vscode-mcp-client'")

            result = {
                "protocolVersion": "2024-11-05",
                "capabilities": capabilities,
                "serverInfo": {
                    "name": "secure-mcp-gateway",
                    "version": "1.0.0"
                }
            }

        elif method == "tools/list":
            tools = await aggregator.handle_list_tools()
            result = {
                "tools": [
                    {
                        "name": tool.name,
                        "description": tool.description,
                        "inputSchema": tool.inputSchema
                    }
                    for tool in tools
                ]
            }

        elif method == "tools/call":
            tool_name = params.get("name")
            arguments = params.get("arguments", {})
            content_list = await aggregator.handle_call_tool(tool_name, arguments)

            # Format content according to MCP spec
            formatted_content = []
            for content in content_list:
                content_dict = {"type": content.type}
                # Only include text field if it's not None
                if hasattr(content, 'text') and content.text is not None:
                    content_dict["text"] = content.text
                formatted_content.append(content_dict)

            result = {"content": formatted_content}

        elif method == "resources/list":
            resources = await aggregator.handle_list_resources()
            formatted_resources = []
            for resource in resources:
                res_dict = {
                    "uri": resource.uri,
                    "name": resource.name if resource.name else ""
                }
                # Only include optional fields if they're not None
                if resource.description:
                    res_dict["description"] = resource.description
                if resource.mimeType:
                    res_dict["mimeType"] = resource.mimeType
                formatted_resources.append(res_dict)

            result = {"resources": formatted_resources}

        elif method == "resources/read":
            uri = params.get("uri")
            content = await aggregator.handle_read_resource(uri)
            result = {
                "contents": [
                    {
                        "uri": uri,
                        "text": content
                    }
                ]
            }

        elif method == "prompts/list":
            prompts = await aggregator.handle_list_prompts()
            formatted_prompts = []
            for prompt in prompts:
                prompt_dict = {"name": prompt.name}
                # Only include optional fields if they're not None
                if prompt.description:
                    prompt_dict["description"] = prompt.description
                if prompt.arguments:
                    # Convert PromptArgument objects to dicts
                    formatted_args = []
                    for arg in prompt.arguments:
                        arg_dict = {"name": arg.name, "required": arg.required}
                        if hasattr(arg, 'description') and arg.description:
                            arg_dict["description"] = arg.description
                        formatted_args.append(arg_dict)
                    prompt_dict["arguments"] = formatted_args
                formatted_prompts.append(prompt_dict)

            result = {"prompts": formatted_prompts}

        elif method == "prompts/get":
            prompt_name = params.get("name")
            arguments = params.get("arguments")
            messages = await aggregator.handle_get_prompt(prompt_name, arguments)

            result = {
                "messages": [
                    {
                        "role": msg.role,
                        "content": {
                            "type": msg.content.type,
                            "text": msg.content.text
                        }
                    }
                    for msg in messages
                ]
            }

        elif is_notification:
            # Handle MCP notifications (one-way messages, no response needed)
            # Examples: notifications/initialized, notifications/cancelled, etc.
            logger.info(f"Received notification: {method}")
            # Notifications don't return results, just acknowledge with 200 OK
            return JSONResponse(
                status_code=200,
                content={}
            )

        else:
            return JSONResponse(
                status_code=200,
                content={
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "error": {
                        "code": -32601,
                        "message": f"Method not found: {method}"
                    }
                }
            )

        # Return JSON-RPC success response
        return JSONResponse(
            status_code=200,
            content={
                "jsonrpc": "2.0",
                "id": request_id,
                "result": result
            }
        )

    except Exception as e:
        logger.error(f"Error handling MCP request: {e}", exc_info=True)
        return JSONResponse(
            status_code=200,
            content={
                "jsonrpc": "2.0",
                "id": body.get("id") if "body" in locals() else None,
                "error": {
                    "code": -32603,
                    "message": str(e)
                }
            }
        )

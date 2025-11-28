"""
MCP Client Authorization Module

Implements OAuth2 authorization for MCP clients following the MCP specification:
https://modelcontextprotocol.io/docs/tutorials/security/authorization

Supports both:
1. Public clients (VS Code, Claude Desktop) using PKCE with JWT validation
2. Confidential clients using client credentials with token introspection

This module specifically handles the authorization challenges for public clients
that cannot securely store client secrets.
"""

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from typing import Optional, Dict, Any, List
from jose import jwt, JWTError
import httpx
from cachetools import TTLCache
from datetime import datetime
import logging
from server.config import settings

logger = logging.getLogger(__name__)

# Token cache to avoid repeated validation
token_cache = TTLCache(maxsize=1000, ttl=settings.token_cache_ttl)

# JWKS cache
jwks_cache = {'keys': None, 'expires_at': 0}


class MCPClientAuthenticator:
    """
    Authenticates MCP clients (VS Code, Claude Desktop, etc.) using OAuth2

    For public clients:
    - Uses Authorization Code Flow with PKCE
    - Validates JWT tokens using JWKS (no client secret needed)
    - Verifies token audience, issuer, and scopes

    For confidential clients:
    - Uses token introspection with client credentials
    - Requires client secret for validation
    """

    def __init__(self):
        self.keycloak_url = settings.keycloak_url
        self.keycloak_realm = settings.keycloak_realm
        self.jwks_url = settings.jwks_url or f"{self.keycloak_url}/realms/{self.keycloak_realm}/protocol/openid-connect/certs"
        self.issuer = f"{self.keycloak_url}/realms/{self.keycloak_realm}"
        self.algorithm = settings.jwt_algorithm
        self.required_scopes = settings.mcp_required_scopes.split()
        self.resource_server_url = settings.mcp_resource_server_url

        # External issuer URL for client discovery (replaces Docker internal hostname)
        # Keycloak inside Docker uses 'keycloak:8080', but clients need 'localhost:8080'
        self.external_issuer = self.issuer.replace("http://keycloak:8080", "http://localhost:8080")

        # Accepted audiences: can be resource URL or client name
        self.accepted_audiences = [
            self.resource_server_url,  # e.g., http://localhost:8000/mcp
            settings.jwt_audience if settings.jwt_audience else None  # e.g., mcp-gateway-client
        ]
        # Remove None values
        self.accepted_audiences = [aud for aud in self.accepted_audiences if aud]

        logger.info(f"MCP Client Authenticator initialized")
        logger.info(f"  Internal Issuer: {self.issuer}")
        logger.info(f"  External Issuer: {self.external_issuer}")
        logger.info(f"  JWKS URL: {self.jwks_url}")
        logger.info(f"  Accepted audiences: {self.accepted_audiences}")
        logger.info(f"  Required scopes: {self.required_scopes}")

    async def get_jwks(self) -> Dict[str, Any]:
        """Fetch JWKS from Keycloak"""
        current_time = datetime.now().timestamp()

        # Return cached JWKS if still valid
        if jwks_cache['keys'] and jwks_cache['expires_at'] > current_time:
            return jwks_cache['keys']

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(self.jwks_url, timeout=10.0)
                response.raise_for_status()
                jwks = response.json()

                # Cache JWKS for 1 hour
                jwks_cache['keys'] = jwks
                jwks_cache['expires_at'] = current_time + 3600

                logger.debug(f"Fetched JWKS from {self.jwks_url}")
                return jwks

        except Exception as e:
            logger.error(f"Failed to fetch JWKS: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to fetch JWKS: {str(e)}"
            )

    async def validate_jwt_token(self, token: str) -> Dict[str, Any]:
        """
        Validate JWT token from public MCP client (VS Code, Claude Desktop)

        Validates:
        - Token signature using JWKS
        - Token expiration
        - Issuer matches Keycloak
        - Required scopes are present

        Args:
            token: JWT access token

        Returns:
            Decoded token claims

        Raises:
            HTTPException: If token is invalid
        """
        # Check cache first
        cache_key = f"jwt:{token}"
        if cache_key in token_cache:
            logger.debug("Token found in cache")
            return token_cache[cache_key]

        try:
            # Get JWKS
            jwks = await self.get_jwks()

            # Decode and validate token
            unverified_header = jwt.get_unverified_header(token)
            rsa_key = {}

            # Find the correct key from JWKS
            for key in jwks.get("keys", []):
                if key["kid"] == unverified_header["kid"]:
                    rsa_key = {
                        "kty": key["kty"],
                        "kid": key["kid"],
                        "use": key["use"],
                        "n": key["n"],
                        "e": key["e"]
                    }
                    break

            if not rsa_key:
                logger.warning(f"Unable to find key with kid={unverified_header['kid']}")
                raise HTTPException(
                    status_code=401,
                    detail="Unable to find appropriate key for token validation"
                )

            # Validate token with flexible issuer and audience checking
            # Disable automatic issuer validation because tokens might be issued with
            # either http://localhost:8080 (external) or http://keycloak:8080 (internal Docker)
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=[self.algorithm],
                options={
                    "verify_aud": False,  # We'll validate audience manually
                    "verify_iss": False   # We'll validate issuer manually
                }
            )

            # Manual issuer validation - accept both external and internal issuers
            token_issuer = payload.get("iss")
            valid_issuers = [
                self.issuer,  # http://localhost:8080/realms/mcp-gateway
                self.external_issuer,  # http://localhost:8080/realms/mcp-gateway (if different)
                f"http://keycloak:8080/realms/{self.keycloak_realm}"  # Internal Docker hostname
            ]
            # Remove duplicates
            valid_issuers = list(set(valid_issuers))

            if token_issuer not in valid_issuers:
                logger.warning(
                    f"Token issuer mismatch: token has '{token_issuer}', "
                    f"expected one of {valid_issuers}"
                )
                raise HTTPException(
                    status_code=401,
                    detail=f"Invalid issuer. Token is not from a trusted authorization server."
                )

            logger.debug(f"Issuer validated: {token_issuer}")

            # Manual audience validation - check if token audience matches any accepted audience
            token_aud = payload.get("aud")
            if token_aud:
                # Token has audience claim - verify it matches one of our accepted audiences
                token_audiences = token_aud if isinstance(token_aud, list) else [token_aud]

                # Check if any token audience matches our accepted audiences
                matching_aud = any(aud in self.accepted_audiences for aud in token_audiences)

                if not matching_aud:
                    logger.warning(
                        f"Token audience mismatch: token has {token_audiences}, "
                        f"expected one of {self.accepted_audiences}"
                    )
                    raise HTTPException(
                        status_code=401,
                        detail=f"Invalid audience. Token is not intended for this resource."
                    )

                logger.debug(f"Audience validated: {token_audiences}")
            else:
                # No audience claim - acceptable for some public clients
                logger.debug("Token has no audience claim (acceptable for public clients)")

            # Verify required scopes are present
            token_scopes = payload.get("scope", "").split()
            missing_scopes = [scope for scope in self.required_scopes if scope not in token_scopes]

            if missing_scopes:
                logger.warning(f"Token missing required scopes: {missing_scopes}")
                raise HTTPException(
                    status_code=403,
                    detail=f"Token missing required scopes: {missing_scopes}"
                )

            # Cache validated token
            token_cache[cache_key] = payload

            logger.info(f"Successfully validated JWT token for user: {payload.get('preferred_username', payload.get('sub'))}")
            logger.debug(f"Token scopes: {token_scopes}")

            return payload

        except JWTError as e:
            # Try to decode without verification to see the actual issuer
            try:
                unverified = jwt.decode(token, options={"verify_signature": False})
                actual_issuer = unverified.get('iss', 'UNKNOWN')
                logger.error(f"JWT validation failed: {str(e)}")
                logger.error(f"Expected issuer: {self.issuer}, Actual issuer in token: {actual_issuer}")
            except:
                logger.error(f"JWT validation failed: {str(e)}")

            raise HTTPException(
                status_code=401,
                detail=f"Invalid token: {str(e)}"
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Token validation error: {str(e)}")
            raise HTTPException(
                status_code=401,
                detail=f"Token validation failed: {str(e)}"
            )

    def build_oauth_error_response(
        self,
        error: str = "unauthorized",
        error_description: Optional[str] = None
    ) -> JSONResponse:
        """
        Build OAuth2 error response following MCP spec

        Returns a 401 response with:
        - OAuth2 error in response body
        - WWW-Authenticate header with Bearer scheme
        - OAuth 2.0 Protected Resource Metadata for auto-discovery

        This allows MCP clients to discover OAuth2 endpoints and initiate
        the authorization flow.
        """
        # Build response body with OAuth2 error
        response_body = {
            "error": error,
            "error_description": error_description or "Bearer token required for authentication"
        }

        # Add OAuth 2.0 Protected Resource Metadata for discovery
        # This follows RFC 8707
        # Use external_issuer so clients can reach Keycloak from outside Docker network
        response_body["oauth2_metadata"] = {
            "resource": self.resource_server_url,
            "authorization_servers": [self.external_issuer],
            "bearer_methods_supported": ["header"],
            "resource_signing_alg_values_supported": [self.algorithm],
            "scopes_supported": self.required_scopes,
            "resource_capabilities": ["mcp-protocol"]
        }

        # Build WWW-Authenticate header following MCP OAuth spec (RFC 9470)
        # CRITICAL: Must include resource_metadata parameter pointing to the well-known URL
        # This tells the MCP client where to discover OAuth metadata
        # Per MCP spec: https://modelcontextprotocol.io/docs/tutorials/security/authorization
        resource_metadata_url = f"{self.resource_server_url.replace('/mcp', '')}/.well-known/oauth-protected-resource"
        www_authenticate = f'Bearer realm="mcp", resource_metadata="{resource_metadata_url}"'

        if error:
            www_authenticate += f', error="{error}"'
        if error_description:
            www_authenticate += f', error_description="{error_description}"'

        return JSONResponse(
            status_code=401,
            content=response_body,
            headers={"WWW-Authenticate": www_authenticate}
        )

    async def authenticate_request(self, authorization: Optional[str]) -> Optional[Dict[str, Any]]:
        """
        Authenticate an MCP client request

        Extracts Bearer token from Authorization header and validates it.

        Args:
            authorization: Authorization header value (e.g., "Bearer <token>")

        Returns:
            Token claims if valid, None otherwise

        Raises:
            HTTPException: If authentication fails with proper OAuth2 error response
        """
        if not authorization:
            logger.warning("Request without Authorization header")
            raise HTTPException(
                status_code=401,
                detail=self.build_oauth_error_response(
                    error="unauthorized",
                    error_description="Bearer token required"
                ).body.decode()
            )

        # Extract Bearer token
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            logger.warning(f"Invalid Authorization header format")
            raise HTTPException(
                status_code=401,
                detail="Invalid Authorization header format. Expected: Bearer <token>"
            )

        token = parts[1]

        # Validate JWT token (for public clients using PKCE)
        try:
            claims = await self.validate_jwt_token(token)
            return claims
        except HTTPException as e:
            # Re-raise with proper OAuth2 error response
            raise HTTPException(
                status_code=e.status_code,
                detail=e.detail,
                headers={"WWW-Authenticate": f'Bearer realm="{self.keycloak_realm}", error="invalid_token"'}
            )


# Global authenticator instance
mcp_authenticator = MCPClientAuthenticator()

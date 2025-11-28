"""
Authentication modules for Secure MCP Gateway
"""

# JWT authentication (existing)
from server.auth.jwt_auth import (
    AuthService,
    get_current_user,
    get_optional_user,
    security,
    security_optional
)

# MCP OAuth2 authentication (new)
from server.auth.mcp_auth import (
    TokenIntrospectionVerifier,
    AccessToken,
    extract_bearer_token,
    build_oauth_discovery_response
)

__all__ = [
    # JWT auth
    "AuthService",
    "get_current_user",
    "get_optional_user",
    "security",
    "security_optional",
    # MCP OAuth2
    "TokenIntrospectionVerifier",
    "AccessToken",
    "extract_bearer_token",
    "build_oauth_discovery_response"
]

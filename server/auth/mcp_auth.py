"""
MCP Authentication - OAuth2 token introspection for MCP endpoints

This module implements token verification for MCP servers following OAuth 2.1 best practices.
It uses Keycloak's token introspection endpoint to validate access tokens.
"""
import asyncio
import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
import httpx
from cachetools import TTLCache

logger = logging.getLogger(__name__)


@dataclass
class AccessToken:
    """Represents a validated OAuth2 access token"""
    scopes: list[str]
    expires_at: datetime
    subject: str
    client_id: str
    username: Optional[str] = None

    @property
    def is_expired(self) -> bool:
        """Check if token has expired"""
        return datetime.now() >= self.expires_at


class TokenIntrospectionVerifier:
    """
    Verifies OAuth2 tokens using Keycloak's introspection endpoint

    This implementation follows MCP security best practices:
    - Uses token introspection instead of local JWT validation
    - Validates audience claims
    - Checks required scopes
    - Implements caching with TTL to reduce introspection calls
    """

    def __init__(
        self,
        introspection_url: str,
        client_id: str,
        client_secret: str,
        resource_server_url: str,
        required_scopes: Optional[list[str]] = None,
        cache_ttl: int = 300
    ):
        """
        Initialize the token verifier

        Args:
            introspection_url: Keycloak token introspection endpoint
            client_id: OAuth2 client ID for the MCP server
            client_secret: OAuth2 client secret
            resource_server_url: This server's URL (for audience validation)
            required_scopes: List of required OAuth2 scopes (default: ["mcp:tools"])
            cache_ttl: Token cache TTL in seconds (default: 300)
        """
        self.introspection_url = introspection_url
        self.client_id = client_id
        self.client_secret = client_secret
        self.resource_server_url = resource_server_url
        self.required_scopes = required_scopes or ["mcp:tools"]

        # Token cache to reduce introspection calls
        self.token_cache: TTLCache = TTLCache(maxsize=1000, ttl=cache_ttl)

        # HTTP client with timeout and connection limits
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0),
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5)
        )

        logger.info(
            f"TokenIntrospectionVerifier initialized: "
            f"introspection_url={introspection_url}, "
            f"resource_server_url={resource_server_url}, "
            f"required_scopes={required_scopes}"
        )

    async def verify_token(self, token: str) -> Optional[AccessToken]:
        """
        Verify an access token using Keycloak introspection

        Args:
            token: The access token to verify

        Returns:
            AccessToken if valid, None if invalid
        """
        # Check cache first
        if token in self.token_cache:
            cached_token = self.token_cache[token]
            if not cached_token.is_expired:
                logger.debug("Token found in cache and still valid")
                return cached_token
            else:
                # Remove expired token from cache
                del self.token_cache[token]

        try:
            # Introspect token with Keycloak
            logger.debug("Introspecting token with Keycloak")
            response = await self.client.post(
                self.introspection_url,
                auth=(self.client_id, self.client_secret),
                data={"token": token}
            )

            if response.status_code != 200:
                logger.warning(f"Token introspection failed with status {response.status_code}")
                return None

            introspection_result = response.json()

            # Check if token is active
            if not introspection_result.get("active", False):
                logger.warning("Token is not active")
                return None

            # Validate audience claim
            audience = introspection_result.get("aud")
            if not audience:
                logger.warning("Token missing 'aud' claim")
                return None

            # Audience can be a string or list
            if isinstance(audience, str):
                audience = [audience]

            if self.resource_server_url not in audience:
                logger.warning(
                    f"Token audience mismatch: expected {self.resource_server_url}, "
                    f"got {audience}"
                )
                return None

            # Parse scopes
            scope_str = introspection_result.get("scope", "")
            scopes = scope_str.split() if scope_str else []

            # Check required scopes
            if self.required_scopes:
                missing_scopes = set(self.required_scopes) - set(scopes)
                if missing_scopes:
                    logger.warning(f"Token missing required scopes: {missing_scopes}")
                    return None

            # Extract token information
            expires_at = datetime.fromtimestamp(introspection_result.get("exp", 0))
            subject = introspection_result.get("sub", "")
            client_id = introspection_result.get("client_id", "")
            username = introspection_result.get("username")

            # Create AccessToken
            access_token = AccessToken(
                scopes=scopes,
                expires_at=expires_at,
                subject=subject,
                client_id=client_id,
                username=username
            )

            # Cache the token
            self.token_cache[token] = access_token

            logger.info(
                f"Token verified successfully: subject={subject}, "
                f"client_id={client_id}, scopes={scopes}"
            )

            return access_token

        except httpx.HTTPError as e:
            logger.error(f"HTTP error during token introspection: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during token verification: {e}", exc_info=True)
            return None

    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()


def extract_bearer_token(authorization_header: Optional[str]) -> Optional[str]:
    """
    Extract bearer token from Authorization header

    Args:
        authorization_header: The Authorization header value

    Returns:
        The token if present and valid format, None otherwise
    """
    if not authorization_header:
        return None

    parts = authorization_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    return parts[1]


def build_oauth_discovery_response(
    issuer_url: str,
    resource_server_url: str,
    required_scopes: list[str]
) -> Dict[str, Any]:
    """
    Build OAuth2 discovery response for 401 challenges

    This helps clients discover the authorization server and required scopes.

    Args:
        issuer_url: OAuth2 issuer URL
        resource_server_url: This server's URL
        required_scopes: Required OAuth2 scopes

    Returns:
        Dictionary with OAuth2 metadata
    """
    return {
        "error": "unauthorized",
        "error_description": "Valid OAuth2 access token required",
        "oauth": {
            "issuer": issuer_url,
            "authorization_endpoint": f"{issuer_url}/protocol/openid-connect/auth",
            "token_endpoint": f"{issuer_url}/protocol/openid-connect/token",
            "introspection_endpoint": f"{issuer_url}/protocol/openid-connect/token/introspect",
            "resource_server": resource_server_url,
            "required_scopes": required_scopes
        }
    }

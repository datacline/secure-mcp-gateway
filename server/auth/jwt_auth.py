from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from typing import Optional, Dict, Any
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

security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)


class AuthService:
    """Authentication service for JWT validation"""

    def __init__(self):
        self.jwks_url = settings.jwks_url
        self.keycloak_url = settings.keycloak_url
        self.keycloak_realm = settings.keycloak_realm
        self.algorithm = settings.jwt_algorithm
        self.audience = settings.jwt_audience

        # Auto-configure JWKS URL from Keycloak if not explicitly set
        if not self.jwks_url and self.keycloak_url and self.keycloak_realm:
            self.jwks_url = (
                f"{self.keycloak_url}/realms/{self.keycloak_realm}/protocol/openid-connect/certs"
            )

    async def get_jwks(self) -> Dict[str, Any]:
        """Fetch JWKS from the authorization server"""
        current_time = datetime.now().timestamp()

        # Return cached JWKS if still valid
        if jwks_cache['keys'] and jwks_cache['expires_at'] > current_time:
            return jwks_cache['keys']

        if not self.jwks_url:
            raise HTTPException(
                status_code=500,
                detail="JWKS URL not configured"
            )

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(self.jwks_url, timeout=10.0)
                response.raise_for_status()
                jwks = response.json()

                # Cache JWKS for 1 hour
                jwks_cache['keys'] = jwks
                jwks_cache['expires_at'] = current_time + 3600

                return jwks

        except Exception as e:
            logger.error(f"Failed to fetch JWKS: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to fetch JWKS: {str(e)}"
            )

    async def validate_token(self, token: str) -> Dict[str, Any]:
        """
        Validate JWT token using JWKS

        Args:
            token: JWT token string

        Returns:
            Decoded token claims

        Raises:
            HTTPException: If token is invalid
        """
        # Check cache first
        if token in token_cache:
            return token_cache[token]

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
                raise HTTPException(
                    status_code=401,
                    detail="Unable to find appropriate key"
                )

            # Validate token
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=[self.algorithm],
                audience=self.audience,
                options={"verify_aud": self.audience is not None}
            )

            # Cache validated token
            token_cache[token] = payload

            return payload

        except JWTError as e:
            logger.error(f"JWT validation failed: {str(e)}")
            raise HTTPException(
                status_code=401,
                detail=f"Invalid token: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Token validation error: {str(e)}")
            raise HTTPException(
                status_code=401,
                detail=f"Token validation failed: {str(e)}"
            )

    async def introspect_token(self, token: str) -> Dict[str, Any]:
        """
        Introspect token via Keycloak (alternative to JWKS validation)

        Args:
            token: JWT token string

        Returns:
            Token introspection result

        Raises:
            HTTPException: If token is invalid
        """
        if not self.keycloak_url:
            raise HTTPException(
                status_code=500,
                detail="Keycloak URL not configured"
            )

        introspection_url = (
            f"{self.keycloak_url}/realms/{self.keycloak_realm}/"
            f"protocol/openid-connect/token/introspect"
        )

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    introspection_url,
                    data={"token": token},
                    timeout=10.0
                )
                response.raise_for_status()
                result = response.json()

                if not result.get("active"):
                    raise HTTPException(
                        status_code=401,
                        detail="Token is not active"
                    )

                return result

        except httpx.HTTPError as e:
            logger.error(f"Token introspection failed: {str(e)}")
            raise HTTPException(
                status_code=401,
                detail="Token introspection failed"
            )


# Global auth service instance
auth_service = AuthService()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> Dict[str, Any]:
    """
    FastAPI dependency to get current authenticated user from JWT token

    Args:
        credentials: HTTP Bearer token from request

    Returns:
        Decoded token claims with user information
    """
    if not settings.auth_enabled:
        # Return default user if auth is disabled
        return {
            "sub": "anonymous",
            "preferred_username": "anonymous",
            "roles": ["user"]
        }

    token = credentials.credentials

    # Validate token using JWKS
    try:
        payload = await auth_service.validate_token(token)

        # Extract user information
        return {
            "sub": payload.get("sub"),
            "preferred_username": payload.get("preferred_username", payload.get("sub")),
            "email": payload.get("email"),
            "roles": payload.get("realm_access", {}).get("roles", []),
            "groups": payload.get("groups", []),
            "claims": payload
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication failed: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail="Authentication failed"
        )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_optional)
) -> Optional[Dict[str, Any]]:
    """
    FastAPI dependency to optionally get authenticated user
    Returns None if no credentials provided

    Args:
        credentials: Optional HTTP Bearer token

    Returns:
        Decoded token claims or None
    """
    if not credentials:
        return None

    return await get_current_user(credentials)

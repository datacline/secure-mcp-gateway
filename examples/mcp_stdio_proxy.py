#!/usr/bin/env python3
"""
MCP Stdio Proxy - Bridges stdio transport to HTTP MCP endpoint with OAuth2 support

This script allows Claude Desktop (which only supports stdio transport) to connect
to the Secure MCP Gateway's HTTP endpoint by translating between the two transports.

Supports OAuth2 authentication using client credentials flow for secure connections.
"""
import sys
import json
import asyncio
import httpx
import logging
import os
from typing import Optional
from datetime import datetime, timedelta

# Configure logging to stderr (stdout is used for MCP communication)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# Gateway configuration
GATEWAY_URL = os.getenv("MCP_GATEWAY_URL", "http://localhost:8000/mcp")
REQUEST_TIMEOUT = 30.0

# OAuth2 configuration (optional)
OAUTH_ENABLED = os.getenv("MCP_OAUTH_ENABLED", "false").lower() == "true"
OAUTH_CLIENT_ID = os.getenv("MCP_OAUTH_CLIENT_ID")
OAUTH_CLIENT_SECRET = os.getenv("MCP_OAUTH_CLIENT_SECRET")
OAUTH_TOKEN_URL = os.getenv("MCP_OAUTH_TOKEN_URL")


class StdioToHttpProxy:
    """Proxy that translates MCP stdio transport to HTTP JSON-RPC with OAuth2 support"""

    def __init__(
        self,
        gateway_url: str,
        oauth_enabled: bool = False,
        oauth_client_id: Optional[str] = None,
        oauth_client_secret: Optional[str] = None,
        oauth_token_url: Optional[str] = None
    ):
        self.gateway_url = gateway_url
        self.client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT)

        # OAuth2 configuration
        self.oauth_enabled = oauth_enabled
        self.oauth_client_id = oauth_client_id
        self.oauth_client_secret = oauth_client_secret
        self.oauth_token_url = oauth_token_url

        # Token cache
        self.access_token: Optional[str] = None
        self.token_expires_at: Optional[datetime] = None

    async def get_access_token(self) -> Optional[str]:
        """
        Get a valid OAuth2 access token using client credentials flow

        Returns:
            Valid access token or None if OAuth is disabled or fetch fails
        """
        if not self.oauth_enabled:
            return None

        # Check if we have a valid cached token
        if self.access_token and self.token_expires_at:
            if datetime.now() < self.token_expires_at - timedelta(seconds=30):
                return self.access_token

        # Fetch new token using client credentials flow
        try:
            logger.info("Fetching new OAuth2 access token")
            response = await self.client.post(
                self.oauth_token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.oauth_client_id,
                    "client_secret": self.oauth_client_secret,
                    "scope": "mcp:tools"
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )

            if response.status_code != 200:
                logger.error(f"Failed to fetch access token: {response.status_code}")
                return None

            token_data = response.json()
            self.access_token = token_data.get("access_token")
            expires_in = token_data.get("expires_in", 300)  # Default 5 minutes
            self.token_expires_at = datetime.now() + timedelta(seconds=expires_in)

            logger.info(f"Access token obtained, expires in {expires_in}s")
            return self.access_token

        except Exception as e:
            logger.error(f"Error fetching access token: {e}", exc_info=True)
            return None

    async def handle_request(self, request: dict) -> dict:
        """
        Forward a JSON-RPC request to the HTTP gateway and return the response

        Args:
            request: JSON-RPC request object

        Returns:
            JSON-RPC response object
        """
        try:
            logger.info(f"Forwarding request: {request.get('method')} (id: {request.get('id')})")

            # Prepare headers
            headers = {"Content-Type": "application/json"}

            # Add OAuth2 token if enabled
            if self.oauth_enabled:
                access_token = await self.get_access_token()
                if access_token:
                    headers["Authorization"] = f"Bearer {access_token}"
                    logger.debug("Added OAuth2 Bearer token to request")
                else:
                    logger.warning("OAuth2 enabled but failed to get access token")

            # Send request to HTTP gateway
            response = await self.client.post(
                self.gateway_url,
                json=request,
                headers=headers
            )

            # Parse response
            result = response.json()
            logger.info(f"Received response for id: {result.get('id')}")

            return result

        except Exception as e:
            logger.error(f"Error forwarding request: {e}", exc_info=True)
            return {
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "error": {
                    "code": -32603,
                    "message": f"Internal error: {str(e)}"
                }
            }

    async def run(self):
        """
        Main loop: read JSON-RPC requests from stdin, forward to HTTP gateway,
        write responses to stdout
        """
        logger.info(f"MCP Stdio Proxy started, connecting to: {self.gateway_url}")

        try:
            # Read from stdin line by line
            loop = asyncio.get_event_loop()

            while True:
                # Read a line from stdin (blocking)
                line = await loop.run_in_executor(None, sys.stdin.readline)

                if not line:
                    # EOF reached
                    logger.info("EOF reached, exiting")
                    break

                line = line.strip()
                if not line:
                    continue

                try:
                    # Parse JSON-RPC request
                    request = json.loads(line)
                    logger.debug(f"Received request: {request.get('method')} (id: {request.get('id')})")

                    # Forward to HTTP gateway
                    response = await self.handle_request(request)

                    # Validate response has required JSON-RPC fields
                    if "jsonrpc" not in response:
                        logger.error(f"Response missing jsonrpc field: {response}")
                        response["jsonrpc"] = "2.0"

                    if "id" not in response and "id" in request:
                        logger.warning(f"Response missing id field, using request id: {request.get('id')}")
                        response["id"] = request.get("id")

                    # Write JSON-RPC response to stdout
                    response_line = json.dumps(response)
                    logger.debug(f"Sending response: {len(response_line)} bytes")
                    sys.stdout.write(response_line + "\n")
                    sys.stdout.flush()

                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON received: {e}, line: {line[:100]}")
                    error_response = {
                        "jsonrpc": "2.0",
                        "id": None,
                        "error": {
                            "code": -32700,
                            "message": "Parse error"
                        }
                    }
                    sys.stdout.write(json.dumps(error_response) + "\n")
                    sys.stdout.flush()
                except Exception as e:
                    logger.error(f"Error processing request: {e}", exc_info=True)
                    error_response = {
                        "jsonrpc": "2.0",
                        "id": request.get("id") if "request" in locals() else None,
                        "error": {
                            "code": -32603,
                            "message": f"Internal error: {str(e)}"
                        }
                    }
                    sys.stdout.write(json.dumps(error_response) + "\n")
                    sys.stdout.flush()

        except Exception as e:
            logger.error(f"Fatal error in main loop: {e}", exc_info=True)
            raise
        finally:
            await self.client.aclose()
            logger.info("Proxy shut down")


async def main():
    """Entry point"""
    # Initialize proxy with OAuth2 configuration
    proxy = StdioToHttpProxy(
        gateway_url=GATEWAY_URL,
        oauth_enabled=OAUTH_ENABLED,
        oauth_client_id=OAUTH_CLIENT_ID,
        oauth_client_secret=OAUTH_CLIENT_SECRET,
        oauth_token_url=OAUTH_TOKEN_URL
    )

    if OAUTH_ENABLED:
        logger.info(f"OAuth2 authentication enabled: client_id={OAUTH_CLIENT_ID}")
    else:
        logger.info("OAuth2 authentication disabled")

    await proxy.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)

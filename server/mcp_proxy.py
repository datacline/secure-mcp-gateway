import httpx
import time
from typing import Dict, Any, Optional, List
from server.config import mcp_config, settings
from server.audit.logger import audit_logger
import logging

logger = logging.getLogger(__name__)


class MCPProxy:
    """Proxy engine for forwarding requests to MCP servers"""

    def __init__(self):
        self.timeout = settings.proxy_timeout

    async def list_tools(
        self,
        mcp_server: str,
        user: str,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        List tools from an MCP server

        Args:
            mcp_server: MCP server name
            user: Authenticated user
            filters: Optional filters for tools

        Returns:
            Dict containing list of tools

        Raises:
            Exception: If request fails
        """
        start_time = time.time()

        try:
            # Get MCP server configuration
            server_config = mcp_config.get_server(mcp_server)
            if not server_config:
                raise ValueError(f"MCP server '{mcp_server}' not configured")

            if not server_config.get('enabled', True):
                raise ValueError(f"MCP server '{mcp_server}' is disabled")

            # Build request URL
            base_url = server_config['url']
            url = f"{base_url}/tools"

            # Make request to MCP server
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    url,
                    params=filters or {},
                    timeout=server_config.get('timeout', self.timeout)
                )

                duration_ms = int((time.time() - start_time) * 1000)

                response.raise_for_status()
                result = response.json()

                # Log successful request
                audit_logger.log_mcp_request(
                    user=user,
                    action="list_tools",
                    mcp_server=mcp_server,
                    status="success",
                    duration_ms=duration_ms,
                    response_status=response.status_code
                )

                return result

        except httpx.HTTPError as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = f"HTTP error: {str(e)}"

            audit_logger.log_mcp_request(
                user=user,
                action="list_tools",
                mcp_server=mcp_server,
                status="error",
                duration_ms=duration_ms,
                error=error_msg
            )

            raise Exception(error_msg)

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = str(e)

            audit_logger.log_mcp_request(
                user=user,
                action="list_tools",
                mcp_server=mcp_server,
                status="error",
                duration_ms=duration_ms,
                error=error_msg
            )

            raise

    async def invoke_tool(
        self,
        mcp_server: str,
        tool_name: str,
        user: str,
        parameters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Invoke a tool on an MCP server

        Args:
            mcp_server: MCP server name
            tool_name: Tool name to invoke
            user: Authenticated user
            parameters: Tool parameters

        Returns:
            Dict containing tool execution results

        Raises:
            Exception: If request fails
        """
        start_time = time.time()

        try:
            # Get MCP server configuration
            server_config = mcp_config.get_server(mcp_server)
            if not server_config:
                raise ValueError(f"MCP server '{mcp_server}' not configured")

            if not server_config.get('enabled', True):
                raise ValueError(f"MCP server '{mcp_server}' is disabled")

            # Build request URL
            base_url = server_config['url']
            url = f"{base_url}/tools/{tool_name}/invoke"

            # Make request to MCP server
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=parameters or {},
                    timeout=server_config.get('timeout', self.timeout)
                )

                duration_ms = int((time.time() - start_time) * 1000)

                response.raise_for_status()
                result = response.json()

                # Log successful invocation
                audit_logger.log_mcp_request(
                    user=user,
                    action="invoke_tool",
                    mcp_server=mcp_server,
                    tool_name=tool_name,
                    parameters=parameters,
                    status="success",
                    duration_ms=duration_ms,
                    response_status=response.status_code
                )

                return result

        except httpx.HTTPError as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = f"HTTP error: {str(e)}"

            audit_logger.log_mcp_request(
                user=user,
                action="invoke_tool",
                mcp_server=mcp_server,
                tool_name=tool_name,
                parameters=parameters,
                status="error",
                duration_ms=duration_ms,
                error=error_msg
            )

            raise Exception(error_msg)

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = str(e)

            audit_logger.log_mcp_request(
                user=user,
                action="invoke_tool",
                mcp_server=mcp_server,
                tool_name=tool_name,
                parameters=parameters,
                status="error",
                duration_ms=duration_ms,
                error=error_msg
            )

            raise

    async def get_server_info(self, mcp_server: str, user: str) -> Dict[str, Any]:
        """
        Get information about an MCP server

        Args:
            mcp_server: MCP server name
            user: Authenticated user

        Returns:
            Dict containing server information
        """
        start_time = time.time()

        try:
            server_config = mcp_config.get_server(mcp_server)
            if not server_config:
                raise ValueError(f"MCP server '{mcp_server}' not configured")

            base_url = server_config['url']
            url = f"{base_url}/info"

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    url,
                    timeout=server_config.get('timeout', self.timeout)
                )

                duration_ms = int((time.time() - start_time) * 1000)

                response.raise_for_status()
                result = response.json()

                audit_logger.log_mcp_request(
                    user=user,
                    action="get_server_info",
                    mcp_server=mcp_server,
                    status="success",
                    duration_ms=duration_ms,
                    response_status=response.status_code
                )

                return result

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = str(e)

            audit_logger.log_mcp_request(
                user=user,
                action="get_server_info",
                mcp_server=mcp_server,
                status="error",
                duration_ms=duration_ms,
                error=error_msg
            )

            raise

    def get_configured_servers(self) -> List[str]:
        """Get list of configured MCP servers"""
        return mcp_config.list_servers()

    def get_enabled_servers(self) -> Dict[str, dict]:
        """Get all enabled MCP servers"""
        return mcp_config.get_enabled_servers()


# Global MCP proxy instance
mcp_proxy = MCPProxy()

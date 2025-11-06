import httpx
import time
import os
import base64
from typing import Dict, Any, Optional, List, Tuple
from pathlib import Path
from server.config import mcp_config, settings, MCPAuthConfig, AuthLocation, AuthFormat
from server.audit.logger import audit_logger
import logging

logger = logging.getLogger(__name__)


class MCPProxy:
    """Proxy engine for forwarding requests to MCP servers"""

    def __init__(self):
        self.timeout = settings.proxy_timeout

    def _resolve_credential(self, credential_ref: str) -> str:
        """
        Resolve credential reference to actual value

        Supports:
        - env://VAR_NAME - Environment variable
        - file:///path/to/file - File path
        - vault://path/to/secret - Vault path (placeholder for future implementation)

        Args:
            credential_ref: Credential reference string

        Returns:
            Resolved credential value

        Raises:
            ValueError: If credential cannot be resolved
        """
        if credential_ref.startswith("env://"):
            var_name = credential_ref[6:]
            value = os.getenv(var_name)
            if not value:
                raise ValueError(f"Environment variable '{var_name}' not found")
            return value

        elif credential_ref.startswith("file://"):
            file_path = credential_ref[7:]
            try:
                with open(file_path, 'r') as f:
                    return f.read().strip()
            except Exception as e:
                raise ValueError(f"Failed to read credential from file '{file_path}': {str(e)}")

        elif credential_ref.startswith("vault://"):
            # Placeholder for Vault integration
            # In production, this would integrate with HashiCorp Vault or similar
            raise ValueError("Vault integration not yet implemented. Use env:// or file:// for now.")

        else:
            raise ValueError(f"Unknown credential reference format: {credential_ref}")

    def _format_credential(self, auth_config: MCPAuthConfig, credential: str) -> str:
        """
        Format credential based on auth configuration

        Args:
            auth_config: Authentication configuration
            credential: Raw credential value

        Returns:
            Formatted credential string
        """
        if auth_config.format == AuthFormat.RAW:
            return credential
        elif auth_config.format == AuthFormat.PREFIX:
            return f"{auth_config.prefix}{credential}"
        elif auth_config.format == AuthFormat.TEMPLATE:
            if not auth_config.template:
                raise ValueError("Template format requires 'template' field")
            return auth_config.template.format(credential=credential)
        else:
            return credential

    def _apply_authentication(
        self,
        auth_config: MCPAuthConfig,
        headers: Dict[str, str],
        params: Dict[str, Any],
        json_body: Optional[Dict[str, Any]] = None
    ) -> Tuple[Dict[str, str], Dict[str, Any], Optional[Dict[str, Any]]]:
        """
        Apply authentication to request based on configuration

        Args:
            auth_config: Authentication configuration
            headers: Request headers (will be modified)
            params: Query parameters (will be modified)
            json_body: JSON body (will be modified if needed)

        Returns:
            Tuple of (headers, params, json_body) with authentication applied
        """
        # Resolve credential
        if auth_config.credential_value:
            # Direct value (not recommended in production)
            credential = auth_config.credential_value
            logger.warning("Using direct credential_value is not recommended for production")
        elif auth_config.credential_ref:
            credential = self._resolve_credential(auth_config.credential_ref)
        else:
            # No credential configured
            return headers, params, json_body

        # Format credential
        formatted_credential = self._format_credential(auth_config, credential)

        # Apply based on location
        if auth_config.location == AuthLocation.HEADER:
            headers[auth_config.name] = formatted_credential
        elif auth_config.location == AuthLocation.QUERY:
            params[auth_config.name] = formatted_credential
        elif auth_config.location == AuthLocation.BODY:
            if json_body is None:
                json_body = {}
            json_body[auth_config.name] = formatted_credential

        return headers, params, json_body

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

            # Prepare request components
            headers = {}
            params = filters or {}

            # Apply authentication if configured
            auth_config = mcp_config.get_auth_config(mcp_server)
            if auth_config:
                headers, params, _ = self._apply_authentication(auth_config, headers, params)

            # Make request to MCP server
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    url,
                    headers=headers,
                    params=params,
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

            # Prepare request components
            headers = {}
            params = {}
            json_body = parameters or {}

            # Apply authentication if configured
            auth_config = mcp_config.get_auth_config(mcp_server)
            if auth_config:
                headers, params, json_body = self._apply_authentication(
                    auth_config, headers, params, json_body
                )

            # Make request to MCP server
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    headers=headers,
                    params=params,
                    json=json_body,
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

            # Prepare request components
            headers = {}
            params = {}

            # Apply authentication if configured
            auth_config = mcp_config.get_auth_config(mcp_server)
            if auth_config:
                headers, params, _ = self._apply_authentication(auth_config, headers, params)

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    url,
                    headers=headers,
                    params=params,
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

    async def invoke_tool_broadcast(
        self,
        tool_name: str,
        user: str,
        parameters: Optional[Dict[str, Any]] = None,
        mcp_servers: Optional[List[str]] = None,
        tags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Invoke a tool on multiple MCP servers and aggregate results

        This is the "broadcast and let LLM filter" pattern:
        - Calls the same tool on multiple servers
        - Returns all results for LLM to filter based on context

        Args:
            tool_name: Tool name to invoke
            user: Authenticated user
            parameters: Tool parameters
            mcp_servers: Specific server names to query (optional)
            tags: Server tags to filter by (optional)

        Returns:
            Dict containing results from all servers with success/error info
        """
        start_time = time.time()

        # Determine which servers to query
        target_servers = []
        if mcp_servers:
            target_servers = mcp_servers
        elif tags:
            target_servers = mcp_config.get_servers_by_tags(tags)
        else:
            # Default: query all servers that have this tool
            target_servers = mcp_config.get_servers_with_tool(tool_name)
            if not target_servers:
                # Fallback: query all enabled servers
                target_servers = list(mcp_config.get_enabled_servers().keys())

        if not target_servers:
            raise ValueError("No MCP servers available for broadcast")

        # Execute requests concurrently
        results = {}
        errors = {}

        async with httpx.AsyncClient() as client:
            tasks = []
            for server_name in target_servers:
                task = self._invoke_tool_single(
                    client, server_name, tool_name, user, parameters
                )
                tasks.append((server_name, task))

            # Gather all results (continue on errors)
            for server_name, task in tasks:
                try:
                    result = await task
                    results[server_name] = result
                except Exception as e:
                    errors[server_name] = str(e)
                    logger.warning(f"Failed to invoke {tool_name} on {server_name}: {e}")

        duration_ms = int((time.time() - start_time) * 1000)

        # Log broadcast request
        audit_logger.log_mcp_request(
            user=user,
            action="invoke_tool_broadcast",
            tool_name=tool_name,
            parameters=parameters,
            status="success" if results else "error",
            duration_ms=duration_ms,
            metadata={
                "target_servers": target_servers,
                "successful_servers": list(results.keys()),
                "failed_servers": list(errors.keys())
            }
        )

        return {
            "tool_name": tool_name,
            "total_servers": len(target_servers),
            "successful": len(results),
            "failed": len(errors),
            "results": results,
            "errors": errors,
            "execution_time_ms": duration_ms
        }

    async def _invoke_tool_single(
        self,
        client: httpx.AsyncClient,
        mcp_server: str,
        tool_name: str,
        user: str,
        parameters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Helper method to invoke tool on a single server (for broadcast)

        Args:
            client: HTTP client (reused across requests)
            mcp_server: MCP server name
            tool_name: Tool name
            user: User identifier
            parameters: Tool parameters

        Returns:
            Tool execution result
        """
        # Get server configuration
        server_config = mcp_config.get_server(mcp_server)
        if not server_config:
            raise ValueError(f"MCP server '{mcp_server}' not configured")

        if not server_config.get('enabled', True):
            raise ValueError(f"MCP server '{mcp_server}' is disabled")

        # Build request
        base_url = server_config['url']
        url = f"{base_url}/tools/{tool_name}/invoke"

        headers = {}
        params = {}
        json_body = parameters or {}

        # Apply authentication if configured
        auth_config = mcp_config.get_auth_config(mcp_server)
        if auth_config:
            headers, params, json_body = self._apply_authentication(
                auth_config, headers, params, json_body
            )

        # Make request
        response = await client.post(
            url,
            headers=headers,
            params=params,
            json=json_body,
            timeout=server_config.get('timeout', self.timeout)
        )

        response.raise_for_status()
        return response.json()


# Global MCP proxy instance
mcp_proxy = MCPProxy()

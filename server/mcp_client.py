"""
MCP Client implementation using the official MCP Python SDK
Based on LiteLLM's MCP client implementation
"""
import asyncio
import base64
import logging
from datetime import timedelta
from typing import Dict, Any, List, Optional, Callable, Awaitable, TypeVar

import httpx
from mcp import ClientSession
from mcp.client.sse import sse_client
from mcp.client.streamable_http import streamablehttp_client
from mcp.types import Tool as MCPTool

logger = logging.getLogger(__name__)

TSessionResult = TypeVar("TSessionResult")


class MCPHTTPClient:
    """
    MCP Client that supports SSE and Streamable HTTP transports to communicate
    with remote MCP servers following the MCP protocol specification.

    Supports:
    - SSE (Server-Sent Events) transport
    - Streamable HTTP transport
    - Authentication via Bearer token, Basic Auth, or API Key
    - Tool calling with error handling and result parsing
    """

    def __init__(
        self,
        url: str,
        timeout: float = 60.0,
        use_sse: bool = False,
        auth_headers: Optional[Dict[str, str]] = None,
        ssl_verify: bool = True,
    ):
        """
        Initialize MCP HTTP Client

        Args:
            url: Full URL to the MCP endpoint (e.g., "http://localhost:3000/mcp")
            timeout: Request timeout in seconds
            use_sse: If True, use SSE transport; otherwise use streamable HTTP
            auth_headers: Optional authentication headers to pass to the MCP server
            ssl_verify: Whether to verify SSL certificates
        """
        self.url = url
        self.timeout = timeout
        self.use_sse = use_sse
        self.auth_headers = auth_headers or {}
        self.ssl_verify = ssl_verify
        self._session: Optional[ClientSession] = None

    def _create_httpx_client_factory(self) -> Callable[..., httpx.AsyncClient]:
        """Create a custom httpx client factory with SSL configuration."""

        def factory(
            *,
            headers: Optional[Dict[str, str]] = None,
            timeout: Optional[httpx.Timeout] = None,
            auth: Optional[httpx.Auth] = None,
        ) -> httpx.AsyncClient:
            """Create an httpx.AsyncClient with custom configuration."""
            return httpx.AsyncClient(
                headers=headers,
                timeout=timeout,
                auth=auth,
                verify=self.ssl_verify,
                follow_redirects=True,
            )

        return factory

    async def run_with_session(
        self, operation: Callable[[ClientSession], Awaitable[TSessionResult]]
    ) -> TSessionResult:
        """
        Open a session, run the provided coroutine, and clean up.

        Args:
            operation: Async function that takes a ClientSession and returns a result

        Returns:
            Result from the operation
        """
        transport_ctx = None

        try:
            headers = self.auth_headers.copy()
            httpx_client_factory = self._create_httpx_client_factory()

            if self.use_sse:
                # Use SSE transport
                logger.debug(f"Connecting to MCP server via SSE: {self.url}")
                transport_ctx = sse_client(
                    url=self.url,
                    timeout=self.timeout,
                    headers=headers,
                    httpx_client_factory=httpx_client_factory,
                )
            else:
                # Use Streamable HTTP transport
                logger.debug(f"Connecting to MCP server via Streamable HTTP: {self.url}")
                transport_ctx = streamablehttp_client(
                    url=self.url,
                    timeout=timedelta(seconds=self.timeout),
                    headers=headers,
                    httpx_client_factory=httpx_client_factory,
                )

            if transport_ctx is None:
                raise RuntimeError("Failed to create transport context")

            async with transport_ctx as transport:
                read_stream, write_stream = transport[0], transport[1]
                session_ctx = ClientSession(read_stream, write_stream)
                async with session_ctx as session:
                    await session.initialize()
                    logger.debug("MCP session initialized successfully")
                    return await operation(session)

        except Exception as e:
            logger.error(f"MCP client run_with_session failed for {self.url}: {e}")
            raise

    async def list_tools(self) -> List[Dict[str, Any]]:
        """
        List available tools from the MCP server

        Returns:
            List of tool definitions in dictionary format

        Raises:
            Exception: If the connection or operation fails
        """
        logger.debug(f"Listing tools from MCP server: {self.url}")

        async def _list_tools_operation(session: ClientSession):
            result = await session.list_tools()
            return result.tools

        try:
            tools = await self.run_with_session(_list_tools_operation)

            # Convert Tool objects to dict format
            normalized_tools = []
            for tool in tools:
                normalized_tools.append({
                    "name": tool.name,
                    "description": tool.description or "",
                    "inputSchema": tool.inputSchema or {}
                })

            logger.info(f"Listed {len(normalized_tools)} tools from {self.url}: {[t['name'] for t in normalized_tools]}")
            return normalized_tools

        except asyncio.CancelledError:
            logger.warning("MCP client list_tools was cancelled")
            raise
        except Exception as e:
            error_type = type(e).__name__
            logger.error(
                f"MCP client list_tools failed - "
                f"Error Type: {error_type}, "
                f"Error: {str(e)}, "
                f"Server: {self.url}"
            )

            # Check if it's a stream/connection error
            if "BrokenResourceError" in error_type or "Broken" in error_type:
                logger.error(
                    "MCP client detected broken connection/stream during list_tools - "
                    "the MCP server may have crashed, disconnected, or timed out"
                )

            # Re-raise the exception instead of returning empty list
            raise

    async def call_tool(
        self,
        tool_name: str,
        arguments: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Call a tool on the MCP server

        Args:
            tool_name: Name of the tool to call
            arguments: Tool arguments

        Returns:
            Tool execution result with content and error status

        Raises:
            Exception: If the connection or operation fails
        """
        logger.info(f"Calling tool '{tool_name}' with arguments: {arguments}")

        async def _call_tool_operation(session: ClientSession):
            return await session.call_tool(
                name=tool_name,
                arguments=arguments or {}
            )

        try:
            tool_result = await self.run_with_session(_call_tool_operation)
            logger.info(f"Tool call '{tool_name}' completed successfully")

            # Return the result
            return {
                "content": tool_result.content,
                "isError": tool_result.isError if hasattr(tool_result, 'isError') else False
            }

        except asyncio.CancelledError:
            logger.warning("MCP client tool call was cancelled")
            raise
        except Exception as e:
            import traceback

            error_trace = traceback.format_exc()
            logger.debug(f"MCP client tool call traceback:\n{error_trace}")

            error_type = type(e).__name__
            logger.error(
                f"MCP client call_tool failed - "
                f"Error Type: {error_type}, "
                f"Error: {str(e)}, "
                f"Tool: {tool_name}, "
                f"Server: {self.url}"
            )

            # Check if it's a stream/connection error
            if "BrokenResourceError" in error_type or "Broken" in error_type:
                logger.error(
                    "MCP client detected broken connection/stream - "
                    "the MCP server may have crashed, disconnected, or timed out."
                )

            # Re-raise the exception
            raise

    async def list_resources(self) -> List[Dict[str, Any]]:
        """
        List available resources from the MCP server

        Returns:
            List of resource definitions in dictionary format

        Raises:
            Exception: If the connection or operation fails
        """
        logger.debug(f"Listing resources from MCP server: {self.url}")

        async def _list_resources_operation(session: ClientSession):
            result = await session.list_resources()
            return result.resources

        try:
            resources = await self.run_with_session(_list_resources_operation)

            # Convert Resource objects to dict format
            normalized_resources = []
            for resource in resources:
                normalized_resources.append({
                    "uri": resource.uri,
                    "name": resource.name,
                    "description": resource.description or "",
                    "mimeType": resource.mimeType if hasattr(resource, 'mimeType') else None
                })

            logger.info(f"Listed {len(normalized_resources)} resources from {self.url}")
            return normalized_resources

        except asyncio.CancelledError:
            logger.warning("MCP client list_resources was cancelled")
            raise
        except Exception as e:
            error_type = type(e).__name__
            logger.error(
                f"MCP client list_resources failed - "
                f"Error Type: {error_type}, "
                f"Error: {str(e)}, "
                f"Server: {self.url}"
            )

            if "BrokenResourceError" in error_type or "Broken" in error_type:
                logger.error(
                    "MCP client detected broken connection/stream during list_resources - "
                    "the MCP server may have crashed, disconnected, or timed out"
                )

            raise

    async def read_resource(self, uri: str) -> Dict[str, Any]:
        """
        Read a resource from the MCP server

        Args:
            uri: URI of the resource to read

        Returns:
            Resource content

        Raises:
            Exception: If the connection or operation fails
        """
        logger.info(f"Reading resource '{uri}' from MCP server")

        async def _read_resource_operation(session: ClientSession):
            return await session.read_resource(uri=uri)

        try:
            result = await self.run_with_session(_read_resource_operation)
            logger.info(f"Resource '{uri}' read successfully")

            return {
                "contents": result.contents
            }

        except asyncio.CancelledError:
            logger.warning("MCP client read_resource was cancelled")
            raise
        except Exception as e:
            error_type = type(e).__name__
            logger.error(
                f"MCP client read_resource failed - "
                f"Error Type: {error_type}, "
                f"Error: {str(e)}, "
                f"URI: {uri}, "
                f"Server: {self.url}"
            )

            if "BrokenResourceError" in error_type or "Broken" in error_type:
                logger.error(
                    "MCP client detected broken connection/stream - "
                    "the MCP server may have crashed, disconnected, or timed out."
                )

            raise

    async def list_prompts(self) -> List[Dict[str, Any]]:
        """
        List available prompts from the MCP server

        Returns:
            List of prompt definitions in dictionary format

        Raises:
            Exception: If the connection or operation fails
        """
        logger.debug(f"Listing prompts from MCP server: {self.url}")

        async def _list_prompts_operation(session: ClientSession):
            result = await session.list_prompts()
            return result.prompts

        try:
            prompts = await self.run_with_session(_list_prompts_operation)

            # Convert Prompt objects to dict format
            normalized_prompts = []
            for prompt in prompts:
                normalized_prompts.append({
                    "name": prompt.name,
                    "description": prompt.description or "",
                    "arguments": prompt.arguments if hasattr(prompt, 'arguments') else []
                })

            logger.info(f"Listed {len(normalized_prompts)} prompts from {self.url}")
            return normalized_prompts

        except asyncio.CancelledError:
            logger.warning("MCP client list_prompts was cancelled")
            raise
        except Exception as e:
            error_type = type(e).__name__
            logger.error(
                f"MCP client list_prompts failed - "
                f"Error Type: {error_type}, "
                f"Error: {str(e)}, "
                f"Server: {self.url}"
            )

            if "BrokenResourceError" in error_type or "Broken" in error_type:
                logger.error(
                    "MCP client detected broken connection/stream during list_prompts - "
                    "the MCP server may have crashed, disconnected, or timed out"
                )

            raise

    async def get_prompt(self, name: str, arguments: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Get a prompt from the MCP server

        Args:
            name: Name of the prompt to get
            arguments: Optional arguments for the prompt

        Returns:
            Prompt content

        Raises:
            Exception: If the connection or operation fails
        """
        logger.info(f"Getting prompt '{name}' with arguments: {arguments}")

        async def _get_prompt_operation(session: ClientSession):
            return await session.get_prompt(
                name=name,
                arguments=arguments or {}
            )

        try:
            result = await self.run_with_session(_get_prompt_operation)
            logger.info(f"Prompt '{name}' retrieved successfully")

            return {
                "messages": result.messages,
                "description": result.description if hasattr(result, 'description') else None
            }

        except asyncio.CancelledError:
            logger.warning("MCP client get_prompt was cancelled")
            raise
        except Exception as e:
            error_type = type(e).__name__
            logger.error(
                f"MCP client get_prompt failed - "
                f"Error Type: {error_type}, "
                f"Error: {str(e)}, "
                f"Prompt: {name}, "
                f"Server: {self.url}"
            )

            if "BrokenResourceError" in error_type or "Broken" in error_type:
                logger.error(
                    "MCP client detected broken connection/stream - "
                    "the MCP server may have crashed, disconnected, or timed out."
                )

            raise

    async def complete(self, ref: Dict[str, Any], argument: Dict[str, Any]) -> Dict[str, Any]:
        """
        Request completion from the MCP server

        Args:
            ref: Reference to the completion context
            argument: Argument for completion

        Returns:
            Completion result

        Raises:
            Exception: If the connection or operation fails
        """
        logger.info(f"Requesting completion with ref: {ref}, argument: {argument}")

        async def _complete_operation(session: ClientSession):
            return await session.complete(
                ref=ref,
                argument=argument
            )

        try:
            result = await self.run_with_session(_complete_operation)
            logger.info("Completion request successful")

            return {
                "completion": result.completion if hasattr(result, 'completion') else result
            }

        except asyncio.CancelledError:
            logger.warning("MCP client complete was cancelled")
            raise
        except Exception as e:
            error_type = type(e).__name__
            logger.error(
                f"MCP client complete failed - "
                f"Error Type: {error_type}, "
                f"Error: {str(e)}, "
                f"Server: {self.url}"
            )

            if "BrokenResourceError" in error_type or "Broken" in error_type:
                logger.error(
                    "MCP client detected broken connection/stream - "
                    "the MCP server may have crashed, disconnected, or timed out."
                )

            raise

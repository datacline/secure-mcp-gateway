"""
MCP Aggregator Server - Provides a single MCP endpoint that aggregates all configured MCP servers

This allows Claude Desktop (or other MCP clients) to connect to a single endpoint and access
all tools, resources, and prompts from multiple MCP servers with security and audit logging.
"""

import asyncio
from typing import Dict, Any, List, Optional
from mcp.server import Server
from mcp.types import Tool, Resource, Prompt, TextContent, PromptMessage, CallToolResult
from server.config import mcp_config
from server.mcp_proxy import mcp_proxy
from server.audit.logger import audit_logger
import logging

logger = logging.getLogger(__name__)


class MCPAggregatorServer:
    """Aggregates multiple MCP servers into a single MCP endpoint"""

    def __init__(self, server_name: str = "secure-mcp-gateway"):
        self.server = Server(server_name)
        self.user = "anonymous"  # Can be enhanced with authentication

        # Register MCP protocol handlers
        self.server.list_tools()(self.handle_list_tools)
        self.server.call_tool()(self.handle_call_tool)
        self.server.list_resources()(self.handle_list_resources)
        self.server.read_resource()(self.handle_read_resource)
        self.server.list_prompts()(self.handle_list_prompts)
        self.server.get_prompt()(self.handle_get_prompt)

        logger.info(f"MCP Aggregator Server initialized: {server_name}")

    async def handle_list_tools(self) -> List[Tool]:
        """
        Aggregate tools from all enabled MCP servers

        Returns:
            List of Tool objects from all enabled servers, including broadcast tools
        """
        logger.info("Aggregating tools from all enabled MCP servers")
        all_tools = []
        servers = mcp_config.get_enabled_servers()

        # Track tools by name to identify which can be broadcast
        tools_by_name: Dict[str, List[str]] = {}  # tool_name -> [server_name1, server_name2]

        for server_name, server_config in servers.items():
            try:
                logger.debug(f"Fetching tools from server: {server_name}")
                result = await mcp_proxy.list_tools(server_name, self.user)

                # Convert tools and add server prefix to avoid name collisions
                for tool in result.get("tools", []):
                    tool_name = tool['name']

                    # Prefix tool name with server name for uniqueness
                    # Use __ instead of :: for Claude Desktop compatibility
                    prefixed_name = f"{server_name}__{tool_name}"

                    # Create Tool object with prefixed name
                    mcp_tool = Tool(
                        name=prefixed_name,
                        description=f"[{server_name}] {tool.get('description', '')}",
                        inputSchema=tool.get('inputSchema', {})
                    )
                    all_tools.append(mcp_tool)

                    # Track for broadcast detection
                    if tool_name not in tools_by_name:
                        tools_by_name[tool_name] = []
                    tools_by_name[tool_name].append(server_name)

                logger.info(f"Added {len(result.get('tools', []))} tools from {server_name}")

            except Exception as e:
                logger.error(f"Failed to fetch tools from {server_name}: {e}")
                # Continue with other servers
                continue

        # Add broadcast tools for tools available on multiple servers
        broadcast_tools = self._generate_broadcast_tools(tools_by_name)
        all_tools.extend(broadcast_tools)

        logger.info(f"Total aggregated tools: {len(all_tools)} (including {len(broadcast_tools)} broadcast tools)")
        return all_tools

    def _generate_broadcast_tools(self, tools_by_name: Dict[str, List[str]]) -> List[Tool]:
        """
        Generate broadcast tools for tools that exist on multiple servers

        Args:
            tools_by_name: Mapping of tool names to server names

        Returns:
            List of broadcast Tool objects
        """
        broadcast_tools = []

        for tool_name, server_list in tools_by_name.items():
            if len(server_list) > 1:
                # This tool exists on multiple servers - create a broadcast version
                broadcast_tool = Tool(
                    name=f"broadcast__{tool_name}",
                    description=(
                        f"[BROADCAST] Call '{tool_name}' across multiple servers: {', '.join(server_list)}. "
                        f"Returns aggregated results from all {len(server_list)} servers. "
                        f"Use this when you need to gather data from multiple sources simultaneously."
                    ),
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "arguments": {
                                "type": "object",
                                "description": f"Arguments to pass to '{tool_name}' on each server"
                            },
                            "servers": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": f"Optional: specific servers to query (available: {', '.join(server_list)}). If omitted, queries all servers.",
                                "default": server_list
                            }
                        },
                        "required": []
                    }
                )
                broadcast_tools.append(broadcast_tool)
                logger.debug(f"Created broadcast tool: broadcast__{tool_name} for servers: {server_list}")

        # Also add broadcast tools based on server tags
        broadcast_tools.extend(self._generate_tag_based_broadcast_tools())

        return broadcast_tools

    def _generate_tag_based_broadcast_tools(self) -> List[Tool]:
        """
        Generate broadcast tools based on server tags

        Returns:
            List of tag-based broadcast Tool objects
        """
        tag_based_tools = []
        servers = mcp_config.get_enabled_servers()

        # Collect all unique tags
        all_tags = set()
        for server_name, server_config in servers.items():
            tags = server_config.get('tags', [])
            all_tags.update(tags)

        # Create a broadcast tool for each tag
        for tag in all_tags:
            servers_with_tag = [
                name for name, config in servers.items()
                if tag in config.get('tags', [])
            ]

            if len(servers_with_tag) > 1:
                # Create tag-based broadcast tool
                tag_tool = Tool(
                    name=f"broadcast__by_tag__{tag}",
                    description=(
                        f"[BROADCAST BY TAG] Execute a tool across all servers tagged with '{tag}': {', '.join(servers_with_tag)}. "
                        f"Useful for querying distributed systems with the same tag (e.g., logging, databases, monitoring)."
                    ),
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "tool_name": {
                                "type": "string",
                                "description": "Name of the tool to execute on each tagged server"
                            },
                            "arguments": {
                                "type": "object",
                                "description": "Arguments to pass to the tool on each server",
                                "default": {}
                            }
                        },
                        "required": ["tool_name"]
                    }
                )
                tag_based_tools.append(tag_tool)
                logger.debug(f"Created tag-based broadcast tool for tag '{tag}': {servers_with_tag}")

        return tag_based_tools

    async def handle_call_tool(self, name: str, arguments: dict) -> List[TextContent]:
        """
        Route tool calls to the appropriate MCP server or handle broadcast

        Args:
            name: Tool name in format "server_name__tool_name" or "broadcast__tool_name"
            arguments: Tool arguments

        Returns:
            List of TextContent with tool results
        """
        logger.info(f"Calling tool: {name} with arguments: {arguments}")
        import json

        # Check if this is a broadcast tool
        if name.startswith("broadcast__"):
            return await self._handle_broadcast_tool(name, arguments)

        # Parse server name and tool name
        if "__" not in name:
            error_msg = f"Invalid tool name format. Expected 'server__tool' or 'broadcast__tool', got '{name}'"
            logger.error(error_msg)
            return [TextContent(type="text", text=f"Error: {error_msg}")]

        server_name, tool_name = name.split("__", 1)

        try:
            # Call the tool through the proxy
            result = await mcp_proxy.invoke_tool(
                mcp_server=server_name,
                tool_name=tool_name,
                user=self.user,
                parameters=arguments
            )

            # Convert result to TextContent
            if isinstance(result, dict) and "content" in result:
                # Already has content from the MCP server
                return result["content"]
            else:
                # Wrap in TextContent
                return [TextContent(
                    type="text",
                    text=json.dumps(result, indent=2)
                )]

        except Exception as e:
            error_msg = f"Failed to call tool {name}: {str(e)}"
            logger.error(error_msg)
            return [TextContent(type="text", text=f"Error: {error_msg}")]

    async def _handle_broadcast_tool(self, name: str, arguments: dict) -> List[TextContent]:
        """
        Handle broadcast tool calls

        Args:
            name: Broadcast tool name (e.g., "broadcast__search_logs" or "broadcast__by_tag__logging")
            arguments: Tool arguments

        Returns:
            List of TextContent with aggregated results from all servers
        """
        import json

        try:
            # Check if it's a tag-based broadcast
            if name.startswith("broadcast__by_tag__"):
                # Extract tag name
                tag = name.replace("broadcast__by_tag__", "")
                tool_name = arguments.get("tool_name")
                tool_args = arguments.get("arguments", {})

                if not tool_name:
                    return [TextContent(
                        type="text",
                        text="Error: 'tool_name' is required for tag-based broadcast"
                    )]

                logger.info(f"Broadcasting tool '{tool_name}' to all servers with tag '{tag}'")

                # Get servers with this tag
                servers = mcp_config.get_enabled_servers()
                target_servers = [
                    name for name, config in servers.items()
                    if tag in config.get('tags', [])
                ]

                # Use mcp_proxy broadcast
                result = await mcp_proxy.invoke_tool_broadcast(
                    tool_name=tool_name,
                    user=self.user,
                    parameters=tool_args,
                    mcp_servers=target_servers,
                    tags=None
                )

            else:
                # Regular broadcast (tool name is in the broadcast__ prefix)
                actual_tool_name = name.replace("broadcast__", "")
                tool_args = arguments.get("arguments", {})
                target_servers = arguments.get("servers")  # Optional server filter

                logger.info(f"Broadcasting tool '{actual_tool_name}' to servers: {target_servers or 'all'}")

                # Use mcp_proxy broadcast
                result = await mcp_proxy.invoke_tool_broadcast(
                    tool_name=actual_tool_name,
                    user=self.user,
                    parameters=tool_args,
                    mcp_servers=target_servers,
                    tags=None
                )

            # Format broadcast results for AI consumption
            formatted_output = self._format_broadcast_results(result)

            return [TextContent(
                type="text",
                text=formatted_output
            )]

        except Exception as e:
            error_msg = f"Broadcast failed for {name}: {str(e)}"
            logger.error(error_msg)
            return [TextContent(type="text", text=f"Error: {error_msg}")]

    def _format_broadcast_results(self, broadcast_result: Dict[str, Any]) -> str:
        """
        Format broadcast results in a human-readable and AI-friendly format

        Args:
            broadcast_result: Result from mcp_proxy.invoke_tool_broadcast()

        Returns:
            Formatted string with results
        """
        import json

        output_lines = []
        output_lines.append("=" * 80)
        output_lines.append(f"BROADCAST RESULTS: {broadcast_result.get('tool_name', 'unknown')}")
        output_lines.append("=" * 80)
        output_lines.append(f"Total Servers: {broadcast_result.get('total_servers', 0)}")
        output_lines.append(f"Successful: {broadcast_result.get('successful', 0)}")
        output_lines.append(f"Failed: {broadcast_result.get('failed', 0)}")
        output_lines.append(f"Execution Time: {broadcast_result.get('execution_time_ms', 0)}ms")
        output_lines.append("")

        # Show results from each server
        results = broadcast_result.get('results', {})
        if results:
            output_lines.append("RESULTS BY SERVER:")
            output_lines.append("-" * 80)
            for server_name, server_result in results.items():
                output_lines.append(f"\n[{server_name}]")
                output_lines.append(json.dumps(server_result, indent=2))

        # Show errors
        errors = broadcast_result.get('errors', {})
        if errors:
            output_lines.append("\n")
            output_lines.append("ERRORS:")
            output_lines.append("-" * 80)
            for server_name, error_msg in errors.items():
                output_lines.append(f"\n[{server_name}] ERROR: {error_msg}")

        output_lines.append("\n" + "=" * 80)

        return "\n".join(output_lines)

    async def handle_list_resources(self) -> List[Resource]:
        """
        Aggregate resources from all enabled MCP servers

        Returns:
            List of Resource objects from all enabled servers
        """
        logger.info("Aggregating resources from all enabled MCP servers")
        all_resources = []
        servers = mcp_config.get_enabled_servers()

        for server_name, server_config in servers.items():
            try:
                logger.debug(f"Fetching resources from server: {server_name}")
                result = await mcp_proxy.list_resources(server_name, self.user)

                # Convert resources and add server prefix to URIs
                for resource in result.get("resources", []):
                    # Prefix URI with server name (use __ for compatibility)
                    prefixed_uri = f"{server_name}__{resource['uri']}"

                    # Create Resource object
                    mcp_resource = Resource(
                        uri=prefixed_uri,
                        name=f"[{server_name}] {resource.get('name', '')}",
                        description=resource.get('description'),
                        mimeType=resource.get('mimeType')
                    )
                    all_resources.append(mcp_resource)

                logger.info(f"Added {len(result.get('resources', []))} resources from {server_name}")

            except Exception as e:
                logger.error(f"Failed to fetch resources from {server_name}: {e}")
                continue

        logger.info(f"Total aggregated resources: {len(all_resources)}")
        return all_resources

    async def handle_read_resource(self, uri: str) -> str:
        """
        Route resource reads to the appropriate MCP server

        Args:
            uri: Resource URI in format "server_name::original_uri"

        Returns:
            Resource content as string
        """
        logger.info(f"Reading resource: {uri}")

        if "__" not in uri:
            error_msg = f"Invalid resource URI format. Expected 'server__uri', got '{uri}'"
            logger.error(error_msg)
            return error_msg

        server_name, original_uri = uri.split("__", 1)

        try:
            result = await mcp_proxy.read_resource(
                mcp_server=server_name,
                uri=original_uri,
                user=self.user
            )

            # Extract content from result
            contents = result.get("contents", [])
            if contents and len(contents) > 0:
                return contents[0].get("text", "")
            return ""

        except Exception as e:
            error_msg = f"Failed to read resource {uri}: {str(e)}"
            logger.error(error_msg)
            return error_msg

    async def handle_list_prompts(self) -> List[Prompt]:
        """
        Aggregate prompts from all enabled MCP servers

        Returns:
            List of Prompt objects from all enabled servers
        """
        logger.info("Aggregating prompts from all enabled MCP servers")
        all_prompts = []
        servers = mcp_config.get_enabled_servers()

        for server_name, server_config in servers.items():
            try:
                logger.debug(f"Fetching prompts from server: {server_name}")
                result = await mcp_proxy.list_prompts(server_name, self.user)

                # Convert prompts and add server prefix
                for prompt in result.get("prompts", []):
                    prefixed_name = f"{server_name}__{prompt['name']}"

                    mcp_prompt = Prompt(
                        name=prefixed_name,
                        description=f"[{server_name}] {prompt.get('description', '')}",
                        arguments=prompt.get('arguments', [])
                    )
                    all_prompts.append(mcp_prompt)

                logger.info(f"Added {len(result.get('prompts', []))} prompts from {server_name}")

            except Exception as e:
                logger.error(f"Failed to fetch prompts from {server_name}: {e}")
                continue

        logger.info(f"Total aggregated prompts: {len(all_prompts)}")
        return all_prompts

    async def handle_get_prompt(
        self,
        name: str,
        arguments: Optional[dict] = None
    ) -> List[PromptMessage]:
        """
        Route prompt requests to the appropriate MCP server

        Args:
            name: Prompt name in format "server_name::prompt_name"
            arguments: Prompt arguments

        Returns:
            List of PromptMessage objects
        """
        logger.info(f"Getting prompt: {name} with arguments: {arguments}")

        if "__" not in name:
            error_msg = f"Invalid prompt name format. Expected 'server__prompt', got '{name}'"
            logger.error(error_msg)
            return [PromptMessage(
                role="user",
                content=TextContent(type="text", text=f"Error: {error_msg}")
            )]

        server_name, prompt_name = name.split("__", 1)

        try:
            result = await mcp_proxy.get_prompt(
                mcp_server=server_name,
                name=prompt_name,
                user=self.user,
                arguments=arguments
            )

            # Convert messages to PromptMessage objects
            messages = []
            for msg in result.get("messages", []):
                messages.append(PromptMessage(
                    role=msg.get("role", "user"),
                    content=TextContent(
                        type="text",
                        text=msg.get("content", {}).get("text", "")
                    )
                ))

            return messages

        except Exception as e:
            error_msg = f"Failed to get prompt {name}: {str(e)}"
            logger.error(error_msg)
            return [PromptMessage(
                role="user",
                content=TextContent(type="text", text=f"Error: {error_msg}")
            )]

    def get_server(self) -> Server:
        """Get the MCP Server instance"""
        return self.server


# Global aggregator instance
aggregator = MCPAggregatorServer("secure-mcp-gateway")

"""
Gateway Tool Discovery

Generic tool discovery from backend MCP servers.
No vendor-specific logic - purely configuration-driven.
"""
from typing import List, Dict, Any, Optional
from server.config import mcp_config
import logging

logger = logging.getLogger(__name__)


def discover_gateway_tools() -> List[Dict[str, Any]]:
    """
    Discover all tools from backend MCP servers (generic approach).

    Aggregates tools by name across all servers. When multiple servers
    provide the same tool, the gateway will broadcast to all of them.

    Returns:
        List of tool definitions in standard MCP format
    """
    tools_map: Dict[str, Dict[str, Any]] = {}

    for server_name, config in mcp_config.servers.items():
        if not config.get('enabled', True):
            continue

        # Get tools for this server
        server_tools = config.get('tools', [])
        server_metadata = config.get('metadata', {})
        server_type = config.get('type', 'unknown')

        # Handle wildcard (all tools)
        if '*' in server_tools:
            logger.warning(
                f"Server '{server_name}' declares tools: ['*']. "
                "Dynamic tool discovery not yet implemented. "
                "Please declare tools explicitly in configuration."
            )
            continue

        # Process each tool
        for tool_name in server_tools:
            if tool_name not in tools_map:
                # First time seeing this tool - create entry
                tools_map[tool_name] = {
                    "name": tool_name,
                    "servers": [],
                    "server_metadata": {},
                    "server_types": set()
                }

            # Add server to this tool's list
            tools_map[tool_name]["servers"].append(server_name)
            tools_map[tool_name]["server_metadata"][server_name] = server_metadata
            tools_map[tool_name]["server_types"].add(server_type)

    # Build final tool list with enhanced descriptions
    tools = []
    for tool_name, tool_data in tools_map.items():
        server_count = len(tool_data["servers"])

        # Build description from server metadata
        description = _build_tool_description(tool_name, tool_data)

        # Generic input schema (accepts any parameters)
        input_schema = {
            "type": "object",
            "properties": {},
            "additionalProperties": True  # Allow any parameters
        }

        tools.append({
            "name": tool_name,
            "description": description,
            "inputSchema": input_schema
        })

    logger.info(f"Discovered {len(tools)} tools from {len(mcp_config.servers)} servers")
    return tools


def _build_tool_description(tool_name: str, tool_data: Dict[str, Any]) -> str:
    """
    Build tool description from server metadata.

    Args:
        tool_name: Name of the tool
        tool_data: Tool metadata including servers and their metadata

    Returns:
        Rich description string for the tool
    """
    servers = tool_data["servers"]
    server_metadata = tool_data["server_metadata"]
    server_types = tool_data["server_types"]

    # Start with basic description
    description = f"Execute '{tool_name}' tool"

    # Add server count info
    if len(servers) == 1:
        server_name = servers[0]
        meta = server_metadata.get(server_name, {})
        server_desc = meta.get("description", server_name)
        description += f" on {server_desc}."
    else:
        description += f" across {len(servers)} backend servers.\n\n"
        description += "**Available data sources:**\n"

        for server_name in servers:
            meta = server_metadata.get(server_name, {})
            server_desc = meta.get("description", server_name)

            # Add cluster/region info if available
            cluster = meta.get("cluster", "")
            region = meta.get("region", "")
            data_sources = meta.get("data_sources", [])

            line = f"- **{server_name}**: {server_desc}"

            if cluster:
                line += f" (cluster: {cluster}"
                if region:
                    line += f", region: {region}"
                line += ")"

            if data_sources:
                line += f"\n  - Data: {', '.join(data_sources)}"

            description += line + "\n"

        description += "\n**How it works:**\n"
        description += f"When you invoke this tool, the gateway automatically queries all {len(servers)} servers concurrently. "
        description += "Results are returned grouped by server name, allowing the AI to analyze and correlate data across multiple sources.\n"

        description += "\n**Response format:**\n"
        description += "Results are structured as: `{results: {server_name: result, ...}, metadata: {...}}`"

    return description


def get_servers_for_tool(tool_name: str) -> List[str]:
    """
    Get list of server names that provide a specific tool.

    Args:
        tool_name: Name of the tool

    Returns:
        List of server names that provide this tool
    """
    servers = []

    for server_name, config in mcp_config.servers.items():
        if not config.get('enabled', True):
            continue

        server_tools = config.get('tools', [])

        if tool_name in server_tools or '*' in server_tools:
            servers.append(server_name)

    return servers


def get_tool_info(tool_name: str) -> Optional[Dict[str, Any]]:
    """
    Get detailed information about a specific tool.

    Args:
        tool_name: Name of the tool

    Returns:
        Tool information dict or None if tool not found
    """
    tools = discover_gateway_tools()

    for tool in tools:
        if tool["name"] == tool_name:
            return tool

    return None

"""
Standard MCP Protocol Endpoints

Implements the Model Context Protocol specification for tools:
- GET /tools - List available tools
- POST /tools/{tool_name}/invoke - Invoke a tool

This makes the gateway act as a standard MCP server that AI agents
like Claude Desktop and Cursor can connect to directly.
"""
from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from server.auth import get_optional_user
from server.mcp_proxy import mcp_proxy
from server.gateway_tools import discover_gateway_tools, get_servers_for_tool
from server.config import settings
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["mcp-standard"])


# Conditional dependency based on auth settings
async def get_user_conditional(
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
) -> Dict[str, Any]:
    """Get user with conditional authentication based on settings"""
    if not settings.auth_enabled:
        return {
            "sub": "anonymous",
            "preferred_username": "anonymous",
            "roles": ["admin"],
            "groups": []
        }

    if user is None:
        # Auth is enabled but no credentials provided
        raise HTTPException(status_code=401, detail="Authentication required")

    return user


class Tool(BaseModel):
    """MCP Tool definition"""
    name: str
    description: str
    inputSchema: Dict[str, Any]


class ToolsListResponse(BaseModel):
    """Response for tools/list endpoint"""
    tools: List[Tool]


@router.get("/tools", response_model=ToolsListResponse)
async def list_tools(
    user: Dict[str, Any] = Depends(get_user_conditional)
):
    """
    List all available tools (Standard MCP endpoint).

    This endpoint aggregates tools from all configured backend MCP servers.
    When a tool exists on multiple servers, it will be invoked on ALL
    servers automatically when called.

    Returns:
        List of available tools with their schemas
    """
    try:
        tools = discover_gateway_tools()

        logger.info(f"Listed {len(tools)} tools for user {user.get('preferred_username', 'anonymous')}")

        return ToolsListResponse(tools=tools)

    except Exception as e:
        logger.error(f"Failed to list tools: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to discover tools: {str(e)}"
        )


@router.post("/tools/{tool_name}/invoke")
async def invoke_tool(
    tool_name: str,
    arguments: Dict[str, Any] = Body(default={}),
    user: Dict[str, Any] = Depends(get_user_conditional)
):
    """
    Invoke a tool (Standard MCP endpoint).

    Automatically broadcasts the tool invocation to ALL backend servers
    that provide this tool. Results are returned in a generic format
    with each server's response tagged by server name.

    Args:
        tool_name: Name of the tool to invoke
        arguments: Tool parameters/arguments
        user: Authenticated user (or anonymous if auth disabled)

    Returns:
        Tool execution results from all backend servers

    Response Format:
        {
            "content": [
                {
                    "type": "text",
                    "text": "Summary of results"
                },
                {
                    "type": "resource",
                    "resource": {
                        "uri": "gateway://results/{tool_name}",
                        "mimeType": "application/json",
                        "text": "Detailed JSON results"
                    }
                }
            ],
            "isError": false
        }
    """
    username = user.get("preferred_username", "anonymous")

    try:
        # Find servers that provide this tool
        target_servers = get_servers_for_tool(tool_name)

        if not target_servers:
            raise HTTPException(
                status_code=404,
                detail=f"Tool '{tool_name}' not found on any backend server"
            )

        logger.info(
            f"Invoking tool '{tool_name}' on {len(target_servers)} servers "
            f"for user '{username}'"
        )

        # Broadcast to all servers with this tool
        result = await mcp_proxy.invoke_tool_broadcast(
            tool_name=tool_name,
            user=username,
            parameters=arguments,
            mcp_servers=target_servers
        )

        # Format response in standard MCP format
        successful = result.get('successful', 0)
        failed = result.get('failed', 0)
        total = result.get('total_servers', 0)

        # Build summary text
        summary = f"Successfully executed '{tool_name}' on {successful}/{total} servers"
        if failed > 0:
            summary += f" ({failed} failed)"

        # Build detailed results as JSON resource
        detailed_results = {
            "tool": tool_name,
            "parameters": arguments,
            "results": result.get('results', {}),
            "errors": result.get('errors', {}),
            "metadata": result.get('metadata', {}),
            "execution_time_ms": result.get('execution_time_ms', 0)
        }

        # Return in standard MCP content format
        response = {
            "content": [
                {
                    "type": "text",
                    "text": summary
                },
                {
                    "type": "resource",
                    "resource": {
                        "uri": f"gateway://results/{tool_name}",
                        "mimeType": "application/json",
                        "text": json.dumps(detailed_results, indent=2)
                    }
                }
            ],
            "isError": failed > 0 and successful == 0  # Only error if ALL failed
        }

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to invoke tool '{tool_name}': {str(e)}")
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Error: {str(e)}"
                }
            ],
            "isError": True
        }


@router.get("/")
async def mcp_server_info():
    """
    MCP server information endpoint.

    Returns basic information about this MCP gateway server.
    """
    tools = discover_gateway_tools()

    return {
        "name": "Secure MCP Gateway",
        "version": "2.0.0",
        "description": "Enterprise MCP Gateway with authentication, policy enforcement, and multi-server broadcast capabilities",
        "protocol_version": "2024-11-05",
        "capabilities": {
            "tools": {
                "available": len(tools)
            },
            "broadcast": True,
            "authentication": settings.auth_enabled,
            "policy_enforcement": True
        }
    }

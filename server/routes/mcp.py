from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from server.auth import get_current_user, get_optional_user
from server.mcp_proxy import mcp_proxy
from server.policies.policy_engine import policy_engine
from server.audit.logger import audit_logger
from server.config import settings

router = APIRouter(prefix="/mcp", tags=["mcp"])


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
        from server.auth import get_current_user as required_user
        # This will be called by FastAPI's dependency injection
        raise HTTPException(status_code=401, detail="Authentication required")

    return user


class InvokeToolRequest(BaseModel):
    """Request model for invoking a tool"""
    tool_name: str
    parameters: Optional[Dict[str, Any]] = None


class InvokeToolResponse(BaseModel):
    """Response model for tool invocation"""
    success: bool
    tool_name: str
    mcp_server: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time_ms: Optional[int] = None


class ListToolsResponse(BaseModel):
    """Response model for listing tools"""
    mcp_server: str
    tools: List[Dict[str, Any]]
    count: int


@router.get("/list-tools", response_model=ListToolsResponse)
async def list_tools(
    mcp_server: str = Query(..., description="MCP server name"),
    user: Dict[str, Any] = Depends(get_user_conditional)
):
    """
    List tools from an MCP server

    Args:
        mcp_server: MCP server name
        user: Authenticated user from JWT

    Returns:
        ListToolsResponse with tools
    """
    username = user.get("preferred_username", "unknown")
    groups = user.get("groups", [])

    # Build resource identifier: mcp:server_name:*
    resource = f"mcp:{mcp_server}:*"

    # Check permission
    is_allowed, reason = policy_engine.check_permission(
        username,
        resource,
        "list_tools",
        groups=groups
    )

    if not is_allowed:
        audit_logger.log_mcp_request(
            user=username,
            action="list_tools",
            mcp_server=mcp_server,
            status="denied",
            policy_decision=reason
        )
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: {reason}"
        )

    try:
        # Proxy request to MCP server
        result = await mcp_proxy.list_tools(mcp_server, username)

        return ListToolsResponse(
            mcp_server=mcp_server,
            tools=result.get("tools", []),
            count=len(result.get("tools", []))
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list tools: {str(e)}"
        )


@router.post("/invoke", response_model=InvokeToolResponse)
async def invoke_tool(
    request: InvokeToolRequest,
    mcp_server: str = Query(..., description="MCP server name"),
    user: Dict[str, Any] = Depends(get_user_conditional)
):
    """
    Invoke a tool on an MCP server

    Args:
        request: Tool invocation request
        mcp_server: MCP server name
        user: Authenticated user from JWT

    Returns:
        InvokeToolResponse with results
    """
    username = user.get("preferred_username", "unknown")
    groups = user.get("groups", [])
    tool_name = request.tool_name

    # Build resource identifier: mcp:server_name:tool_name
    resource = f"mcp:{mcp_server}:{tool_name}"

    # Check permission
    is_allowed, reason = policy_engine.check_permission(
        username,
        resource,
        "invoke_tool",
        groups=groups
    )

    if not is_allowed:
        audit_logger.log_mcp_request(
            user=username,
            action="invoke_tool",
            mcp_server=mcp_server,
            tool_name=tool_name,
            parameters=request.parameters,
            status="denied",
            policy_decision=reason
        )
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: {reason}"
        )

    try:
        # Proxy request to MCP server
        result = await mcp_proxy.invoke_tool(
            mcp_server=mcp_server,
            tool_name=tool_name,
            user=username,
            parameters=request.parameters
        )

        return InvokeToolResponse(
            success=True,
            tool_name=tool_name,
            mcp_server=mcp_server,
            result=result,
            execution_time_ms=result.get("execution_time_ms")
        )

    except Exception as e:
        return InvokeToolResponse(
            success=False,
            tool_name=tool_name,
            mcp_server=mcp_server,
            error=str(e)
        )


@router.get("/servers")
async def list_servers(
    user: Dict[str, Any] = Depends(get_user_conditional)
):
    """
    List configured MCP servers

    Args:
        user: Authenticated user from JWT

    Returns:
        Dict with configured servers
    """
    servers = mcp_proxy.get_enabled_servers()

    return {
        "servers": [
            {
                "name": name,
                "url": config["url"],
                "type": config.get("type", "http"),
                "enabled": config.get("enabled", True)
            }
            for name, config in servers.items()
        ],
        "count": len(servers)
    }


@router.get("/server/{mcp_server}/info")
async def get_server_info(
    mcp_server: str,
    user: Dict[str, Any] = Depends(get_user_conditional)
):
    """
    Get information about a specific MCP server

    Args:
        mcp_server: MCP server name
        user: Authenticated user from JWT

    Returns:
        Server information
    """
    username = user.get("preferred_username", "unknown")

    try:
        result = await mcp_proxy.get_server_info(mcp_server, username)
        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get server info: {str(e)}"
        )

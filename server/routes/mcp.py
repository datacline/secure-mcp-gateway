import logging
logger = logging.getLogger(__name__)
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from server.auth import get_current_user, get_optional_user
from server.mcp_proxy import mcp_proxy
from server.audit.logger import audit_logger
from server.config import settings

# MCP routes - updated to show all servers (enabled and disabled)
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


class InvokeBroadcastRequest(BaseModel):
    """Request model for broadcast tool invocation"""
    tool_name: str
    parameters: Optional[Dict[str, Any]] = None
    mcp_servers: Optional[List[str]] = None  # Specific servers to query
    tags: Optional[List[str]] = None  # Query servers by tags


class InvokeBroadcastResponse(BaseModel):
    """Response model for broadcast tool invocation"""
    tool_name: str
    total_servers: int
    successful: int
    failed: int
    results: Dict[str, Any]  # server_name -> result
    errors: Dict[str, str]  # server_name -> error message
    execution_time_ms: int


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
    tool_name = request.tool_name


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


@router.get("/list-resources")
async def list_resources(
    mcp_server: str = Query(..., description="MCP server name"),
    user: Dict[str, Any] = Depends(get_user_conditional)
):
    """
    List resources from an MCP server

    Args:
        mcp_server: MCP server name
        user: Authenticated user from JWT

    Returns:
        Dict with resources list
    """
    username = user.get("preferred_username", "unknown")


    try:
        # Proxy request to MCP server
        result = await mcp_proxy.list_resources(mcp_server, username)

        return {
            "mcp_server": mcp_server,
            "resources": result.get("resources", []),
            "count": len(result.get("resources", []))
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list resources: {str(e)}"
        )


@router.get("/read-resource")
async def read_resource(
    mcp_server: str = Query(..., description="MCP server name"),
    uri: str = Query(..., description="Resource URI to read"),
    user: Dict[str, Any] = Depends(get_user_conditional)
):
    """
    Read a resource from an MCP server

    Args:
        mcp_server: MCP server name
        uri: Resource URI to read
        user: Authenticated user from JWT

    Returns:
        Resource content
    """
    username = user.get("preferred_username", "unknown")


    try:
        # Proxy request to MCP server
        result = await mcp_proxy.read_resource(mcp_server, uri, username)

        return {
            "mcp_server": mcp_server,
            "uri": uri,
            "contents": result.get("contents", [])
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read resource: {str(e)}"
        )


@router.get("/list-prompts")
async def list_prompts(
    mcp_server: str = Query(..., description="MCP server name"),
    user: Dict[str, Any] = Depends(get_user_conditional)
):
    """
    List prompts from an MCP server

    Args:
        mcp_server: MCP server name
        user: Authenticated user from JWT

    Returns:
        Dict with prompts list
    """
    username = user.get("preferred_username", "unknown")


    try:
        # Proxy request to MCP server
        result = await mcp_proxy.list_prompts(mcp_server, username)

        return {
            "mcp_server": mcp_server,
            "prompts": result.get("prompts", []),
            "count": len(result.get("prompts", []))
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list prompts: {str(e)}"
        )


@router.get("/get-prompt")
async def get_prompt(
    mcp_server: str = Query(..., description="MCP server name"),
    name: str = Query(..., description="Prompt name"),
    user: Dict[str, Any] = Depends(get_user_conditional)
):
    """
    Get a prompt from an MCP server

    Args:
        mcp_server: MCP server name
        name: Prompt name
        user: Authenticated user from JWT

    Returns:
        Prompt content
    """
    username = user.get("preferred_username", "unknown")


    try:
        # Proxy request to MCP server
        result = await mcp_proxy.get_prompt(mcp_server, name, username, arguments=None)

        return {
            "mcp_server": mcp_server,
            "name": name,
            "messages": result.get("messages", []),
            "description": result.get("description")
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get prompt: {str(e)}"
        )


@router.get("/servers")
async def list_servers(
    user: Dict[str, Any] = Depends(get_user_conditional)
):
    """
    List all configured MCP servers (both enabled and disabled)

    Args:
        user: Authenticated user from JWT

    Returns:
        Dict with all configured servers
    """
    servers = mcp_proxy.get_all_servers()

    return {
        "servers": [
            {
                "name": name,
                "url": config["url"],
                "type": config.get("type", "http"),
                "enabled": config.get("enabled", True),
                "description": config.get("description", ""),
                "tags": config.get("tags", [])
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


@router.post("/invoke-broadcast", response_model=InvokeBroadcastResponse)
async def invoke_tool_broadcast(
    request: InvokeBroadcastRequest,
    user: Dict[str, Any] = Depends(get_user_conditional)
):
    """
    Invoke a tool on multiple MCP servers and return all results.

    This endpoint implements the "broadcast and let LLM filter" pattern:
    - Calls the same tool on multiple servers (based on tags or explicit list)
    - Returns ALL results to the caller (typically an LLM)
    - The LLM filters/processes results based on user query context

    Use cases:
    - Query logs from multiple clusters (campaign-cluster, event-cluster)
    - Search data across distributed systems
    - Aggregate information from multiple sources

    Args:
        request: Broadcast invocation request with tool name, params, and server filters
        user: Authenticated user from JWT

    Returns:
        InvokeBroadcastResponse with results from all servers

    Example:
        POST /mcp/invoke-broadcast
        {
            "tool_name": "get_logs",
            "parameters": {"query": "campaign failure"},
            "tags": ["elk-logs"]  // Query all servers with "elk-logs" tag
        }

        Response includes results from all matching servers for LLM to process.
    """
    username = user.get("preferred_username", "unknown")
    tool_name = request.tool_name

    # For broadcast, check permission against wildcard resource
    # This allows user to query multiple servers if they have broad access
    resource = f"mcp:*:{tool_name}"


    try:
        # Broadcast to multiple servers
        result = await mcp_proxy.invoke_tool_broadcast(
            tool_name=tool_name,
            user=username,
            parameters=request.parameters,
            mcp_servers=request.mcp_servers,
            tags=request.tags
        )

        return InvokeBroadcastResponse(**result)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Broadcast invocation failed: {str(e)}"
        )


class UpdateServerRequest(BaseModel):
    """Request model for updating server configuration"""
    enabled: Optional[bool] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    timeout: Optional[int] = None


@router.patch("/server/{mcp_server}")
async def update_server(
    mcp_server: str,
    request: UpdateServerRequest,
    user: Dict[str, Any] = Depends(get_user_conditional)
):
    """
    Update MCP server configuration
    
    Args:
        mcp_server: MCP server name
        request: Update request with fields to change
        user: Authenticated user from JWT
        
    Returns:
        Updated server configuration
    """
    from server.config import mcp_config
    
    username = user.get("preferred_username", "unknown")
    
    # Check if server exists
    server = mcp_config.get_server(mcp_server)
    if not server:
        raise HTTPException(
            status_code=404,
            detail=f"Server '{mcp_server}' not found"
        )
    
    # Prepare update data
    update_data = {}
    if request.enabled is not None:
        update_data['enabled'] = request.enabled
    if request.description is not None:
        update_data['description'] = request.description
    if request.tags is not None:
        update_data['tags'] = request.tags
    if request.timeout is not None:
        update_data['timeout'] = request.timeout
    
    # Update server
    success = mcp_config.update_server(mcp_server, **update_data)
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update server '{mcp_server}'"
        )
    
    # Log the update
    logger.info(f"Server {mcp_server} updated by {username}: {update_data}")
    
    # Reload mcp_proxy configuration
    mcp_proxy.reload_config()
    
    # Return updated configuration
    updated_server = mcp_config.get_server(mcp_server)
    return {
        "success": True,
        "server": {
            "name": mcp_server,
            "url": updated_server["url"],
            "type": updated_server.get("type", "http"),
            "enabled": updated_server.get("enabled", True),
            "description": updated_server.get("description", ""),
            "tags": updated_server.get("tags", []),
            "timeout": updated_server.get("timeout", 30)
        }
    }

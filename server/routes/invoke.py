from fastapi import APIRouter, HTTPException
from datetime import datetime
import json
from server.models import ToolInvokeRequest, ToolInvokeResponse
from server.db import db
from server.sandbox.runner import sandbox_runner
from server.audit.logger import audit_logger

router = APIRouter(prefix="/api/invoke", tags=["invoke"])


@router.post("/", response_model=ToolInvokeResponse)
async def invoke_tool(request: ToolInvokeRequest):
    """
    Invoke a registered tool

    Args:
        request: Tool invocation request with tool name and parameters

    Returns:
        ToolInvokeResponse with execution results
    """
    tool_name = request.tool_name
    parameters = request.parameters
    user = request.user

    # Check if tool exists
    tool = db.get_tool(tool_name)
    if not tool:
        audit_logger.log_tool_invocation(
            tool_name, user, "failure",
            parameters=parameters,
            error="Tool not found"
        )
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")

    # Check permission

    try:
        # Parse tool configuration
        environment = json.loads(tool.environment) if tool.environment else None

        # Execute tool in sandbox
        result = sandbox_runner.execute(
            tool_path=tool.path,
            parameters=parameters,
            environment=environment,
            timeout=tool.timeout
        )

        # Create response
        response = ToolInvokeResponse(
            tool_name=tool_name,
            status=result['status'],
            output=result.get('output'),
            error=result.get('error'),
            execution_time=result['execution_time'] / 1000.0,  # Convert to seconds
            timestamp=datetime.utcnow()
        )

        # Log execution
        audit_logger.log_tool_invocation(
            tool_name=tool_name,
            user=user,
            status=result['status'],
            parameters=parameters,
            output=result.get('output'),
            error=result.get('error'),
            execution_time=result['execution_time']
        )

        if result['status'] != 'success':
            raise HTTPException(status_code=500, detail=result.get('error', 'Tool execution failed'))

        return response

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Failed to invoke tool: {str(e)}"
        audit_logger.log_tool_invocation(
            tool_name=tool_name,
            user=user,
            status="failure",
            parameters=parameters,
            error=error_msg
        )
        raise HTTPException(status_code=500, detail=error_msg)

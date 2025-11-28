from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List
import json
from server.models import (
    RegisterToolRequest,
    RegisterToolResponse,
    Tool,
    ToolManifest
)
from server.db import db
from server.manifest_parser import ManifestParser
from server.audit.logger import audit_logger

router = APIRouter(prefix="/api/tools", tags=["tools"])


@router.post("/register", response_model=RegisterToolResponse)
async def register_tool(request: RegisterToolRequest, user: str = "anonymous"):
    """
    Register a new tool from manifest

    Args:
        request: Tool registration request with manifest
        user: Username (can be extracted from auth middleware)

    Returns:
        RegisterToolResponse with tool ID and status
    """
    manifest = request.manifest


    try:
        # Validate manifest
        is_valid, error_msg = ManifestParser.validate_manifest(manifest)
        if not is_valid:
            audit_logger.log_tool_registration(manifest.name, user, "failure", error_msg)
            raise HTTPException(status_code=400, detail=error_msg)

        # Check if tool already exists
        existing_tool = db.get_tool(manifest.name)
        if existing_tool:
            audit_logger.log_tool_registration(manifest.name, user, "failure", "Tool already exists")
            raise HTTPException(status_code=409, detail=f"Tool '{manifest.name}' already exists")

        # Create tool in database
        tool_data = {
            "name": manifest.name,
            "version": manifest.version,
            "description": manifest.description,
            "path": manifest.path,
            "permissions": [p.value for p in manifest.permissions],
            "parameters": manifest.parameters,
            "environment": manifest.environment,
            "timeout": manifest.timeout
        }

        tool = db.create_tool(tool_data)

        # Log success
        audit_logger.log_tool_registration(manifest.name, user, "success")

        return RegisterToolResponse(
            tool_id=tool.id,
            name=tool.name,
            message=f"Tool '{tool.name}' registered successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Failed to register tool: {str(e)}"
        audit_logger.log_tool_registration(manifest.name, user, "failure", error_msg)
        raise HTTPException(status_code=500, detail=error_msg)


@router.post("/register-from-file")
async def register_tool_from_file(file: UploadFile = File(...), user: str = "anonymous"):
    """
    Register a tool from uploaded manifest file (YAML/JSON)

    Args:
        file: Uploaded manifest file
        user: Username

    Returns:
        RegisterToolResponse
    """
    try:
        # Read file content
        content = await file.read()
        content_str = content.decode('utf-8')

        # Determine format from filename
        format = "yaml" if file.filename.endswith(('.yaml', '.yml')) else "json"

        # Parse manifest
        manifest = ManifestParser.parse_string(content_str, format)

        # Use the register_tool endpoint logic
        request = RegisterToolRequest(manifest=manifest)
        return await register_tool(request, user)

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse manifest: {str(e)}")


@router.get("/", response_model=List[Tool])
async def list_tools(user: str = "anonymous"):
    """
    List all registered tools

    Args:
        user: Username

    Returns:
        List of Tool objects
    """
    try:
        # Get all tools from database
        tools_db = db.get_all_tools()

        # Convert to response models
        tools = []
        for tool_db in tools_db:
            tools.append(Tool(
                id=tool_db.id,
                name=tool_db.name,
                version=tool_db.version,
                description=tool_db.description,
                path=tool_db.path,
                permissions=json.loads(tool_db.permissions),
                parameters=json.loads(tool_db.parameters) if tool_db.parameters else None,
                environment=json.loads(tool_db.environment) if tool_db.environment else None,
                timeout=tool_db.timeout,
                created_at=tool_db.created_at,
                updated_at=tool_db.updated_at,
                is_active=tool_db.is_active
            ))

        return tools

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list tools: {str(e)}")


@router.get("/{tool_name}", response_model=Tool)
async def get_tool(tool_name: str, user: str = "anonymous"):
    """
    Get details of a specific tool

    Args:
        tool_name: Name of the tool
        user: Username

    Returns:
        Tool object
    """
    try:
        tool_db = db.get_tool(tool_name)

        if not tool_db:
            raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")

        return Tool(
            id=tool_db.id,
            name=tool_db.name,
            version=tool_db.version,
            description=tool_db.description,
            path=tool_db.path,
            permissions=json.loads(tool_db.permissions),
            parameters=json.loads(tool_db.parameters) if tool_db.parameters else None,
            environment=json.loads(tool_db.environment) if tool_db.environment else None,
            timeout=tool_db.timeout,
            created_at=tool_db.created_at,
            updated_at=tool_db.updated_at,
            is_active=tool_db.is_active
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tool: {str(e)}")


@router.delete("/{tool_name}")
async def delete_tool(tool_name: str, user: str = "anonymous"):
    """
    Delete a tool

    Args:
        tool_name: Name of the tool
        user: Username

    Returns:
        Success message
    """
    try:
        success = db.delete_tool(tool_name)

        if not success:
            audit_logger.log_tool_deletion(tool_name, user, "failure", "Tool not found")
            raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")

        audit_logger.log_tool_deletion(tool_name, user, "success")

        return {"message": f"Tool '{tool_name}' deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Failed to delete tool: {str(e)}"
        audit_logger.log_tool_deletion(tool_name, user, "failure", error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

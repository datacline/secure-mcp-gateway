from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class PermissionLevel(str, Enum):
    READ = "read"
    WRITE = "write"
    EXECUTE = "execute"
    ADMIN = "admin"


class ToolManifest(BaseModel):
    """Tool manifest schema for registration"""
    name: str = Field(..., description="Unique tool name")
    version: str = Field(default="1.0.0", description="Tool version")
    description: str = Field(..., description="Tool description")
    path: str = Field(..., description="Path to tool executable or script")
    permissions: List[PermissionLevel] = Field(default=[PermissionLevel.EXECUTE], description="Required permissions")
    parameters: Optional[Dict[str, Any]] = Field(default=None, description="Tool parameters schema")
    environment: Optional[Dict[str, str]] = Field(default=None, description="Environment variables")
    timeout: int = Field(default=30, description="Execution timeout in seconds")

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Tool name cannot be empty")
        return v.strip()

    @field_validator('path')
    @classmethod
    def validate_path(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Tool path cannot be empty")
        return v.strip()


class Tool(BaseModel):
    """Tool database model"""
    id: Optional[int] = None
    name: str
    version: str
    description: str
    path: str
    permissions: List[str]
    parameters: Optional[Dict[str, Any]] = None
    environment: Optional[Dict[str, str]] = None
    timeout: int = 30
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True

    class Config:
        from_attributes = True


class ToolInvokeRequest(BaseModel):
    """Request model for tool invocation"""
    tool_name: str = Field(..., description="Name of the tool to invoke")
    parameters: Optional[Dict[str, Any]] = Field(default=None, description="Tool parameters")
    user: str = Field(default="anonymous", description="User invoking the tool")


class ToolInvokeResponse(BaseModel):
    """Response model for tool invocation"""
    tool_name: str
    status: str
    output: Optional[str] = None
    error: Optional[str] = None
    execution_time: float
    timestamp: datetime


class RegisterToolRequest(BaseModel):
    """Request model for tool registration"""
    manifest: ToolManifest


class RegisterToolResponse(BaseModel):
    """Response model for tool registration"""
    tool_id: int
    name: str
    message: str

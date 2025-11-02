#!/usr/bin/env python3
"""
Simple Mock MCP Server for testing
Run with: python tests/mock_mcp_server/server.py
"""
from fastapi import FastAPI
import uvicorn

app = FastAPI(title="Mock MCP Server")


@app.get("/tools")
async def list_tools():
    """List available tools"""
    return {
        "tools": [
            {
                "name": "calculator",
                "description": "Perform basic calculations"
            },
            {
                "name": "echo",
                "description": "Echo back the input"
            },
            {
                "name": "sqlite_reader",
                "description": "Read from SQLite databases"
            }
        ]
    }


@app.post("/tools/{tool_name}/invoke")
async def invoke_tool(tool_name: str, parameters: dict = None):
    """Invoke a tool"""
    if tool_name == "echo":
        return {
            "result": {
                "echoed": parameters or {}
            },
            "execution_time_ms": 5
        }
    elif tool_name == "calculator":
        return {
            "result": {
                "answer": 42
            },
            "execution_time_ms": 10
        }
    else:
        return {
            "result": {
                "message": f"Tool {tool_name} executed successfully"
            },
            "execution_time_ms": 15
        }


@app.get("/info")
async def info():
    """Server information"""
    return {
        "name": "Mock MCP Server",
        "version": "1.0.0",
        "description": "Simple mock MCP server for testing"
    }


@app.get("/health")
async def health():
    """Health check"""
    return {"status": "healthy"}


if __name__ == "__main__":
    print("🚀 Starting Mock MCP Server on http://localhost:3000")
    uvicorn.run(app, host="0.0.0.0", port=3000)

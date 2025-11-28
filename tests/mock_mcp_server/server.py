#!/usr/bin/env python3
"""
Mock MCP Server implementing proper MCP protocol with Streamable HTTP transport
Run with: python tests/mock_mcp_server/server.py
"""
import uvicorn
from mcp.server import Server
from mcp.server.streamable_http import create_streamable_http_app
from mcp.types import Tool, TextContent

# Create MCP server instance
mcp_server = Server("mock-mcp-server")


@mcp_server.list_tools()
async def handle_list_tools() -> list[Tool]:
    """List available tools"""
    return [
        Tool(
            name="calculator",
            description="Perform basic calculations",
            inputSchema={
                "type": "object",
                "properties": {
                    "operation": {
                        "type": "string",
                        "enum": ["add", "subtract", "multiply", "divide"],
                        "description": "The operation to perform"
                    },
                    "a": {
                        "type": "number",
                        "description": "First number"
                    },
                    "b": {
                        "type": "number",
                        "description": "Second number"
                    }
                },
                "required": ["operation", "a", "b"]
            }
        ),
        Tool(
            name="echo",
            description="Echo back the input",
            inputSchema={
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "Message to echo"
                    }
                },
                "required": ["message"]
            }
        ),
        Tool(
            name="get_logs",
            description="Get mock application logs",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query for logs"
                    },
                    "limit": {
                        "type": "number",
                        "description": "Number of logs to return",
                        "default": 10
                    }
                }
            }
        ),
        Tool(
            name="search_data",
            description="Search mock data",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query"
                    }
                },
                "required": ["query"]
            }
        )
    ]


@mcp_server.call_tool()
async def handle_call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Handle tool invocations"""

    if name == "echo":
        message = arguments.get("message", "")
        return [
            TextContent(
                type="text",
                text=f"Echo: {message}"
            )
        ]

    elif name == "calculator":
        operation = arguments.get("operation")
        a = arguments.get("a", 0)
        b = arguments.get("b", 0)

        result = 0
        if operation == "add":
            result = a + b
        elif operation == "subtract":
            result = a - b
        elif operation == "multiply":
            result = a * b
        elif operation == "divide":
            result = a / b if b != 0 else "Error: Division by zero"

        return [
            TextContent(
                type="text",
                text=f"Result: {result}"
            )
        ]

    elif name == "get_logs":
        query = arguments.get("query", "")
        limit = arguments.get("limit", 10)

        mock_logs = [
            f"[INFO] Log entry {i}: {query}" for i in range(limit)
        ]

        return [
            TextContent(
                type="text",
                text="\n".join(mock_logs)
            )
        ]

    elif name == "search_data":
        query = arguments.get("query", "")
        return [
            TextContent(
                type="text",
                text=f"Search results for '{query}': Found 5 items"
            )
        ]

    else:
        return [
            TextContent(
                type="text",
                text=f"Unknown tool: {name}"
            )
        ]


if __name__ == "__main__":
    print("🚀 Starting Mock MCP Server (Streamable HTTP) on http://localhost:3000")
    print("📡 MCP endpoint available at: http://localhost:3000/mcp")

    # Create and run the app using streamable HTTP transport
    app = create_streamable_http_app(mcp_server, "/mcp")
    uvicorn.run(app, host="0.0.0.0", port=3000)

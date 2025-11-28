#!/usr/bin/env python3
"""
Mock MCP Server for Docker - implementing proper MCP protocol with SSE transport
"""
import asyncio
import uvicorn
from mcp.server import Server
from mcp.server.sse import SseServerTransport
from mcp.types import Tool, TextContent, Resource, Prompt, PromptMessage
from starlette.applications import Starlette
from starlette.routing import Route

# Create MCP server instance
mcp_server = Server("mock-mcp-server-docker")


@mcp_server.list_tools()
async def handle_list_tools() -> list[Tool]:
    """List available tools"""
    return [
        Tool(
            name="get_logs",
            description="Get mock application logs",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query for logs"
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

    if name == "get_logs":
        query = arguments.get("query", "")
        return [
            TextContent(
                type="text",
                text=f"Mock logs for query: {query}"
            )
        ]

    elif name == "search_data":
        query = arguments.get("query", "")
        return [
            TextContent(
                type="text",
                text=f"Mock search results for: {query}"
            )
        ]

    else:
        return [
            TextContent(
                type="text",
                text=f"Unknown tool: {name}"
            )
        ]


@mcp_server.list_resources()
async def handle_list_resources() -> list[Resource]:
    """List available resources"""
    return [
        Resource(
            uri="mock://resource1",
            name="Mock Resource 1",
            description="A mock resource for testing",
            mimeType="text/plain"
        ),
        Resource(
            uri="mock://resource2",
            name="Mock Resource 2",
            description="Another mock resource",
            mimeType="application/json"
        )
    ]


@mcp_server.read_resource()
async def handle_read_resource(uri: str) -> str:
    """Read a resource"""
    if uri == "mock://resource1":
        return "This is the content of mock resource 1"
    elif uri == "mock://resource2":
        return '{"data": "Mock resource 2 content", "type": "json"}'
    else:
        return f"Unknown resource: {uri}"


@mcp_server.list_prompts()
async def handle_list_prompts() -> list[Prompt]:
    """List available prompts"""
    return [
        Prompt(
            name="greeting",
            description="A simple greeting prompt",
            arguments=[]
        ),
        Prompt(
            name="summarize",
            description="Summarize text",
            arguments=[
                {"name": "text", "description": "Text to summarize", "required": True}
            ]
        )
    ]


@mcp_server.get_prompt()
async def handle_get_prompt(name: str, arguments: dict | None) -> list[PromptMessage]:
    """Get a prompt"""
    if name == "greeting":
        return [
            PromptMessage(
                role="user",
                content=TextContent(type="text", text="Hello! How can I help you today?")
            )
        ]
    elif name == "summarize":
        text = arguments.get("text", "") if arguments else ""
        return [
            PromptMessage(
                role="user",
                content=TextContent(
                    type="text",
                    text=f"Please summarize the following text:\n\n{text}"
                )
            )
        ]
    else:
        return [
            PromptMessage(
                role="user",
                content=TextContent(type="text", text=f"Unknown prompt: {name}")
            )
        ]


if __name__ == "__main__":
    # Create SSE transport
    sse = SseServerTransport("/mcp")

    # Create ASGI app with routes
    async def handle_sse(request):
        async with sse.connect_sse(request.scope, request.receive, request._send) as (read_stream, write_stream):
            await mcp_server.run(read_stream, write_stream, mcp_server.create_initialization_options())

    async def handle_messages(request):
        async with sse.connect_messages(request.scope, request.receive, request._send) as (read_stream, write_stream):
            await mcp_server.run(read_stream, write_stream, mcp_server.create_initialization_options())

    app = Starlette(
        routes=[
            Route("/mcp/sse", handle_sse, methods=["GET"]),
            Route("/mcp/message", handle_messages, methods=["POST"]),
        ]
    )

    uvicorn.run(app, host="0.0.0.0", port=3000)

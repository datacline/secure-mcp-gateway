#!/usr/bin/env python3
"""
Test script to verify MCP protocol implementation using Streamable HTTP
"""
import asyncio
import sys
from server.mcp_client import MCPHTTPClient


async def test_mcp_server():
    """Test connection to mock MCP server"""
    print("=" * 60)
    print("Testing MCP Protocol Implementation (Streamable HTTP)")
    print("=" * 60)

    # Test server URL
    url = "http://localhost:3000/mcp"

    print(f"\n1. Creating MCP HTTP Client for {url}")
    client = MCPHTTPClient(url=url)

    try:
        print("\n2. Establishing MCP session...")
        async with client.session() as mcp_session:
            print("   ✓ Session initialized successfully")

            print("\n3. Listing available tools...")
            tools = await mcp_session.list_tools()

            print(f"   ✓ Found {len(tools)} tools:")
            for tool in tools:
                print(f"     - {tool['name']}: {tool['description']}")

            if tools:
                print("\n4. Testing tool invocation...")
                # Test the first tool
                test_tool = tools[0]
                tool_name = test_tool['name']

                # Prepare test arguments based on tool
                if tool_name == "echo":
                    args = {"message": "Hello from MCP Gateway!"}
                elif tool_name == "calculator":
                    args = {"operation": "add", "a": 5, "b": 3}
                elif tool_name == "get_logs":
                    args = {"query": "test", "limit": 5}
                elif tool_name == "search_data":
                    args = {"query": "test search"}
                else:
                    args = {}

                print(f"   Calling tool: {tool_name}")
                print(f"   Arguments: {args}")

                result = await mcp_session.call_tool(tool_name, args)
                print(f"   ✓ Tool invocation successful!")
                print(f"   Result: {result}")

        print("\n" + "=" * 60)
        print("✓ All tests passed successfully!")
        print("=" * 60)
        return True

    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Main test function"""
    print("\nMake sure the mock MCP server is running:")
    print("  python tests/mock_mcp_server/server.py\n")

    success = await test_mcp_server()

    if success:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

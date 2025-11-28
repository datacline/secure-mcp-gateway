# Claude Desktop Integration Guide

This guide explains how to connect Claude Desktop to the Secure MCP Gateway to access all configured MCP servers (GitHub, Notion, etc.) through a single aggregated endpoint.

## Overview

The Secure MCP Gateway provides an MCP protocol aggregator endpoint at `/mcp` that combines all configured MCP servers into a single connection point. This allows Claude Desktop to access tools, resources, and prompts from multiple MCP servers simultaneously.

## How It Works

1. **Tool Aggregation**: The gateway fetches tools from all enabled MCP servers and prefixes them with the server name to avoid naming collisions (e.g., `github__create_repository`, `notion__API-post-search`)

2. **Automatic Routing**: When you call a tool through the aggregator, it automatically routes the request to the appropriate backend MCP server based on the prefix

3. **Security & Audit**: All requests go through the gateway's security policies and audit logging

## Configuration

### 1. Locate Claude Desktop Configuration File

The configuration file location varies by operating system:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### 2. Install Python Dependencies for Stdio Proxy

The stdio proxy script requires Python dependencies. Install them:

```bash
cd /path/to/secure-mcp-gateway
pip3 install httpx
```

Or install all dependencies:
```bash
pip3 install -r requirements.txt
```

### 3. Add Gateway Configuration

**Important**: Claude Desktop currently only supports **stdio transport**, not HTTP transport. To connect to the gateway's HTTP endpoint, we use a stdio proxy script (`mcp_stdio_proxy.py`) that bridges the two transports.

Add the following configuration to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "secure-mcp-gateway": {
      "command": "python3",
      "args": [
        "/Users/amitsinha/codebases/secure-mcp-gateway/mcp_stdio_proxy.py"
      ]
    }
  }
}
```

**⚠️ Update the path**: Replace `/Users/amitsinha/codebases/secure-mcp-gateway/mcp_stdio_proxy.py` with the absolute path to where you cloned this repository.

If you already have other MCP servers configured, add the `secure-mcp-gateway` entry to your existing `mcpServers` object:

```json
{
  "mcpServers": {
    "secure-mcp-gateway": {
      "command": "python3",
      "args": [
        "/path/to/secure-mcp-gateway/mcp_stdio_proxy.py"
      ]
    },
    "other-server": {
      "command": "npx",
      "args": ["some-mcp-server"]
    }
  }
}
```

### 4. Test the Stdio Proxy (Optional)

Before configuring Claude Desktop, you can test the stdio proxy to ensure it's working:

```bash
# Make sure the gateway is running
curl http://localhost:8000/health

# Test the stdio proxy with a simple request
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | python3 mcp_stdio_proxy.py
```

You should see a JSON response with the gateway's server info.

### 5. Restart Claude Desktop

After saving the configuration file, completely quit and restart Claude Desktop for the changes to take effect.

## Verification

Once configured, Claude Desktop will automatically connect to the gateway on startup. You can verify the connection by:

1. Open Claude Desktop
2. Start a new conversation
3. Ask Claude to list available tools
4. You should see tools from all enabled MCP servers with prefixes like:
   - `github__create_repository`
   - `github__create_pull_request`
   - `notion__API-post-search`
   - `notion__API-retrieve-a-page`

## Using Tools

When using tools through Claude Desktop, simply reference them by their full name including the server prefix:

**Example conversation:**
```
User: Search my Notion workspace for documents about "strategy"

Claude will automatically use: notion__API-post-search

User: Create a new GitHub repository called "my-project"

Claude will automatically use: github__create_repository
```

Claude will automatically select and invoke the appropriate tools based on your requests.

## Currently Configured MCP Servers

The gateway is currently configured with the following MCP servers:

### GitHub MCP Server
- **Tools**: Repository management, issues, pull requests, commits, branches, releases, code search
- **Authentication**: Configured via `GITHUB_MCP_PAT` environment variable
- **Endpoint**: `http://host.docker.internal:3000`

### Notion MCP Server
- **Tools**: Search workspace, retrieve pages, query databases, manage users
- **Authentication**: Configured via `NOTION_MCP_BEARER_TOKEN` environment variable
- **Endpoint**: `http://host.docker.internal:8081/mcp`
- **Note**: Requires Notion integration to have access to pages/databases

## Troubleshooting

### Claude Desktop Can't Connect

1. **Verify gateway is running**:
   ```bash
   curl http://localhost:8000/health
   ```
   Should return: `{"status":"healthy",...}`

2. **Test MCP endpoint**:
   ```bash
   curl -X POST http://localhost:8000/mcp \
     -H 'Content-Type: application/json' \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
   ```
   Should return a valid JSON-RPC response with gateway info

3. **Check Claude Desktop logs**: Look for connection errors or authentication issues

### No Tools Appearing

1. **Verify MCP servers are enabled** in `mcp_servers.yaml`
2. **Check backend MCP servers are running**:
   - GitHub MCP: Should be running on port 3000
   - Notion MCP: Should be running on port 8081
3. **Check gateway logs**:
   ```bash
   docker-compose logs mcp-gateway
   ```

### Tool Calls Failing

1. **Authentication issues**: Verify environment variables are set correctly:
   - `GITHUB_MCP_PAT` - GitHub personal access token
   - `NOTION_TOKEN` - Notion integration token
   - `NOTION_MCP_BEARER_TOKEN` - Notion MCP server bearer token

2. **Backend server issues**: Check if the backend MCP server is accessible:
   ```bash
   # Test GitHub MCP
   curl http://localhost:3000/health

   # Test Notion MCP
   curl http://localhost:8081/mcp
   ```

3. **Permission issues**: For Notion, ensure your integration has access to the pages/databases you're trying to access

## Advanced Configuration

### Custom Gateway URL

If your gateway is running on a different host or port, you need to modify the `mcp_stdio_proxy.py` script:

1. Open `mcp_stdio_proxy.py`
2. Find the line: `GATEWAY_URL = "http://localhost:8000/mcp"`
3. Change it to your gateway URL: `GATEWAY_URL = "http://your-gateway-host:8000/mcp"`
4. Save the file

The Claude Desktop configuration remains the same (using the stdio proxy script).

### Adding Authentication (Future)

When authentication is enabled on the gateway (`AUTH_ENABLED=true`), you'll need to modify the `mcp_stdio_proxy.py` script to include authentication headers. Edit the `handle_request` method to add headers to the HTTP request:

```python
response = await self.client.post(
    self.gateway_url,
    json=request,
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer YOUR_TOKEN_HERE"
    }
)
```

## Testing the Integration

You can test the integration manually before configuring Claude Desktop:

```bash
# Initialize connection
curl -X POST http://localhost:8000/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'

# List all available tools
curl -X POST http://localhost:8000/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# Call a tool (example: Notion search)
curl -X POST http://localhost:8000/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"notion::API-post-search","arguments":{}}}'
```

## Support

For issues or questions:
- Check the [MCP Protocol Documentation](https://modelcontextprotocol.io)
- Review gateway logs: `docker-compose logs mcp-gateway`
- Check audit logs: `audit.json` in the gateway directory

# VS Code MCP Integration Guide

## Overview

The MCP Gateway now supports direct connection from VS Code via the native MCP protocol endpoint at `/mcp`.

## Changes Made

### New Files

1. **`McpProtocolController.java`** - Implements JSON-RPC over HTTP for MCP clients
   - `GET /mcp` - Discovery endpoint
   - `POST /mcp` - Main protocol endpoint
   - Handles: initialize, tools/list, tools/call, resources/list, resources/read, prompts/list, prompts/get

2. **Updated `McpProxyService.java`** - Added aggregation methods:
   - `listAllTools()` - Aggregates tools from all servers
   - `listAllResources()` - Aggregates resources from all servers
   - `listAllPrompts()` - Aggregates prompts from all servers
   - `findToolServer()` - Finds which server provides a tool
   - `findPromptServer()` - Finds which server provides a prompt
   - `parseResourceUri()` - Parses mcp:// URIs

## VS Code Configuration

### Option 1: Simple HTTP Transport (No Auth)

For development with `AUTH_ENABLED=false`:

```json
{
  "mcpServers": {
    "secure-mcp-gateway": {
      "url": "http://localhost:8000/mcp",
      "transport": {
        "type": "http"
      }
    }
  }
}
```

### Option 2: With OAuth2 (Production)

For production with `AUTH_ENABLED=true`:

```json
{
  "mcpServers": {
    "secure-mcp-gateway": {
      "url": "http://localhost:8000/mcp",
      "transport": {
        "type": "http",
        "auth": {
          "type": "oauth2",
          "flow": "authorizationCode",
          "authorizationEndpoint": "http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/auth",
          "tokenEndpoint": "http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/token",
          "clientId": "vscode-mcp-client",
          "scope": "openid profile email mcp:tools",
          "pkce": true
        }
      }
    }
  }
}
```

## How to Configure VS Code

1. **Install MCP Extension** (if not already installed)
   - Search for "MCP" in VS Code extensions
   - Or use the Continue extension which has MCP support

2. **Open Settings**
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "Preferences: Open User Settings (JSON)"

3. **Add MCP Configuration**
   ```json
   {
     "mcp.servers": {
       "secure-mcp-gateway": {
         "url": "http://localhost:8000/mcp",
         "transport": {
           "type": "http"
         }
       }
     }
   }
   ```

4. **Reload VS Code**
   - Press `Cmd+Shift+P` / `Ctrl+Shift+P`
   - Type "Developer: Reload Window"

## Supported MCP Methods

The gateway implements all core MCP protocol methods:

| Method | Description | Status |
|--------|-------------|--------|
| `initialize` | Initialize connection | ✅ Working |
| `tools/list` | List all available tools | ✅ Working |
| `tools/call` | Execute a tool | ✅ Working |
| `resources/list` | List all resources | ✅ Working |
| `resources/read` | Read a resource | ✅ Working |
| `prompts/list` | List all prompts | ✅ Working |
| `prompts/get` | Get a prompt | ✅ Working |
| `notifications/*` | Handle notifications | ✅ Working |

## How It Works

### Tool Aggregation

When VS Code calls `tools/list`, the gateway:
1. Queries all enabled MCP servers
2. Aggregates their tools
3. Adds `_server` metadata to each tool
4. Returns combined list

When VS Code calls `tools/call`:
1. Finds which server provides the tool (using `_server` metadata)
2. Routes the request to that server
3. Returns the result

### Resource URIs

Resources use the format: `mcp://<server-name>/path/to/resource`

Example:
- `mcp://notion/pages/123` → Routes to Notion server
- `mcp://github/repos/myrepo` → Routes to GitHub server

## Testing

### 1. Start the Gateway

```bash
cd server-java
make dev
```

### 2. Test Discovery Endpoint

```bash
curl http://localhost:8000/mcp
```

Expected response:
```json
{
  "protocolVersion": "2024-11-05",
  "capabilities": {
    "tools": {},
    "resources": {},
    "prompts": {}
  },
  "serverInfo": {
    "name": "secure-mcp-gateway",
    "version": "2.0.0"
  }
}
```

### 3. Test Initialize

```bash
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {}
  }'
```

### 4. Test Tools List

```bash
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

## Troubleshooting

### 404 Error on /mcp

**Problem**: VS Code logs show `404 status sending message to http://localhost:8000/mcp`

**Solution**: 
- ✅ Fixed! The `/mcp` endpoint is now implemented
- Restart your Spring Boot application
- Verify with: `curl http://localhost:8000/mcp`

### Connection Refused

**Problem**: Cannot connect to gateway

**Solution**:
1. Ensure gateway is running: `make dev`
2. Check port 8000 is accessible: `netstat -an | grep 8000`
3. Try: `curl http://localhost:8000/actuator/health`

### Authentication Errors (when AUTH_ENABLED=true)

**Problem**: 401 Unauthorized

**Solution**:
1. Ensure Keycloak is running
2. Verify OAuth2 configuration in VS Code settings
3. Check client is registered in Keycloak
4. For testing, disable auth: `AUTH_ENABLED=false make dev`

## Architecture

```
VS Code MCP Client
        ↓
    GET/POST /mcp
        ↓
McpProtocolController (JSON-RPC handler)
        ↓
McpProxyService (Aggregation & Routing)
        ↓
    ┌───┴───┐
    ↓       ↓
Notion   GitHub   (Individual MCP Servers)
```

## Comparison with REST Endpoints

The gateway now supports TWO ways to access MCP servers:

### 1. Native MCP Protocol (for MCP clients like VS Code)
- Endpoint: `POST /mcp`
- Protocol: JSON-RPC 2.0
- Aggregates all servers automatically
- Use: VS Code, Claude Desktop, MCP clients

### 2. REST API (for custom integrations)
- Endpoints: `/mcp/list-tools`, `/mcp/invoke`, etc.
- Protocol: REST/JSON
- Requires specifying server name
- Use: Custom apps, webhooks, scripts

## Next Steps

1. ✅ Configure VS Code with `vscode-mcp-config.json`
2. ✅ Test connection
3. ✅ Use MCP tools in VS Code AI features
4. 🔄 Enable OAuth2 for production

## Files to Review

- `McpProtocolController.java` - Protocol implementation
- `McpProxyService.java` - Aggregation logic
- `vscode-mcp-config.json` - Example VS Code config
- `application.yaml` - Gateway configuration

---

**Status**: ✅ VS Code MCP integration complete!  
**Date**: Jan 25, 2026

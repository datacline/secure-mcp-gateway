# Known Issue: Notion MCP Server Protocol Compatibility

## Issue

After successful initialization, subsequent requests to the Notion MCP server may fail with:
```
Unknown media type returned: text/plain; charset=utf-8
```

## Root Cause

The Notion MCP server appears to have a compatibility issue with the Java MCP SDK's Streamable-HTTP transport:

1. ✅ Initialization works fine (JSON-RPC over HTTP)
2. ✅ SSE stream connection established
3. ❌ Subsequent requests (like `tools/list`) return `text/plain` instead of JSON

This suggests the Notion server might be:
- Sending error messages as plain text
- Not fully implementing the Streamable-HTTP protocol
- Expecting a different communication pattern

## Temporary Workaround

### Option 1: Disable Notion Server

Until this is resolved, disable the Notion server:

```yaml
# mcp_servers.yaml
notion:
  enabled: false
```

### Option 2: Wait for Protocol Fixes

This appears to be a protocol compatibility issue between:
- **Java MCP SDK** (v0.15.0) using Streamable-HTTP
- **Notion MCP Server** implementation

Possible solutions:
1. Update Notion MCP server to latest version
2. Wait for Java SDK to add better error handling
3. Use SSE transport instead of Streamable-HTTP (requires code changes)

### Option 3: Try SSE Transport (Advanced)

The Java SDK supports SSE transport which might be more compatible:

```java
// In McpHttpClient.java, replace HttpClientStreamableHttpTransport with:
var transport = HttpClientSseClientTransport.builder(url)
    .asyncHttpRequestCustomizer((builder, method, endpoint, body, context) -> {
        authHeaders.forEach((key, value) -> builder.header(key, value));
        return Mono.just(builder);
    })
    .build();
```

## Debugging Steps

### 1. Check Notion MCP Server Version

```bash
npx @modelcontextprotocol/server-notion --version
```

Update to latest:
```bash
npx -y @modelcontextprotocol/server-notion@latest --transport http --port 8081
```

### 2. Capture What's Being Sent

Enable trace logging in application.yaml:
```yaml
logging:
  level:
    io.modelcontextprotocol: TRACE
```

### 3. Test Notion Server Directly

Test if the Notion server properly handles tools/list:

```bash
# Initialize session
INIT_RESPONSE=$(curl -s -X POST http://localhost:8081/mcp \
  -H "Authorization: Bearer $NOTION_MCP_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"initialize",
    "params":{
      "protocolVersion":"2025-06-18",
      "capabilities":{},
      "clientInfo":{"name":"test","version":"1.0"}
    }
  }')

echo "Init response: $INIT_RESPONSE"

# Try tools/list
curl -s -X POST http://localhost:8081/mcp \
  -H "Authorization: Bearer $NOTION_MCP_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":2,
    "method":"tools/list",
    "params":{}
  }'
```

### 4. Check Notion Server Logs

Look at the Notion MCP server output for errors when the Java client connects.

## Current Status

✅ **Working:**
- Authentication (Bearer token)
- Initial connection
- Protocol negotiation
- Session establishment

❌ **Not Working:**
- Tools listing after initialization
- Ongoing SSE communication

## Alternative: Use the Default Mock Server

While this is being investigated, use the default mock server which works perfectly:

```bash
curl "http://localhost:8000/mcp/list-tools?mcp_server=default"
```

## Reporting the Issue

This seems to be either:
1. A bug in the Notion MCP server implementation
2. A compatibility issue with the Java SDK's Streamable-HTTP transport
3. Missing configuration for Notion server

Consider:
- Opening an issue on `@modelcontextprotocol/server-notion` GitHub
- Checking if there's a newer version of the Notion MCP server
- Asking in MCP community channels about Notion + Java SDK compatibility

## Related Links

- [MCP Java Client Documentation](https://modelcontextprotocol.io/sdk/java/mcp-client)
- [MCP Specification](https://modelcontextprotocol.io/specification)
- [Notion MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/notion)

## Updates

- 2026-01-25: Issue identified with Notion server returning text/plain for tools/list
- Authentication and initialization working correctly
- Investigating SSE transport as alternative

# Fix for Notion MCP Server Compatibility

## Root Cause

The issue was NOT with authentication (which was working perfectly), but with the **MCP Java SDK version**.

### The Problem

- **Java SDK version**: 0.17.0
- **Python SDK version**: 1.10.1+

The Notion MCP server works perfectly with the Python implementation because the Python SDK is much newer and handles HTTP 202 Accepted responses correctly.

### Specific Issue

According to the Java SDK release notes for version 0.17.2:

> "Fixes a client-side issue with servers that process client-initiated notifications with a 202 Accepted HTTP Header"

This is EXACTLY what was happening:
1. ✅ Initialize → Success (GET request)
2. ✅ Send `notifications/initialized` → Success (POST)
3. ❌ Server responds with 202 Accepted (text/plain)
4. ❌ SDK 0.17.0 fails to handle this correctly
5. ❌ Subsequent `tools/list` request fails with "Unknown media type text/plain"

## The Solution

Upgraded MCP Java SDK from `0.17.0` to `0.17.2` (released Jan 22, 2025).

### Changed File

`pom.xml`:
```xml
<dependency>
    <groupId>io.modelcontextprotocol.sdk</groupId>
    <artifactId>mcp</artifactId>
    <version>0.17.2</version>  <!-- Updated from 0.17.0 -->
</dependency>
```

## How to Test

1. Update dependencies:
```bash
cd server-java
./mvnw clean install
```

2. Restart the application:
```bash
make dev
```

3. Test Notion server:
```bash
curl "http://localhost:8000/mcp/list-tools?mcp_server=notion"
```

## Expected Behavior

Now you should see:
```json
{
  "tools": [
    {
      "name": "search_pages",
      "description": "Search pages in Notion",
      "inputSchema": {...}
    },
    ...
  ]
}
```

Instead of:
```
Unknown media type returned: text/plain; charset=utf-8
```

## Why Python Worked

The Python implementation was already using a much newer SDK version (`mcp>=1.10.1`), which had this fix built in from the start.

## Authentication Was Never the Issue

The logs clearly showed authentication was working:
```
Auth Headers:
  Authorization: Bearer a4b0d5810d299aca76167aa6cc4db01f1405acf25ed46ed90aced536e931a67f
```

The real issue was the SDK's inability to handle the server's HTTP 202 response for the initialization notification.

## Key Takeaway

✅ **Authentication system**: Working perfectly  
✅ **Credential formatting**: Working perfectly  
✅ **Bearer prefix application**: Working perfectly  
❌ **SDK version**: Was outdated (0.17.0 → 0.17.2)  

This is a common issue when integrating with rapidly evolving protocols like MCP - always check for the latest SDK versions first!

# Troubleshooting: Notion MCP Server Connection Issues

## Error: "Unknown media type returned: text/plain; charset=utf-8"

This error occurs when the MCP SDK receives an unexpected response format during initialization.

## Root Causes and Solutions

### 1. Missing or Incorrect Bearer Token

**Symptoms:**
```
Caused by: java.lang.RuntimeException: Client failed to initialize by explicit API call
Caused by: java.lang.RuntimeException: Unknown media type returned: text/plain; charset=utf-8
```

**Diagnosis:**
Check if the environment variable is set in the terminal where you're running the application:

```bash
# Should output your token, not empty
echo $NOTION_MCP_BEARER_TOKEN
```

**Solutions:**

#### Option A: Export in the same terminal
```bash
# Export the token
export NOTION_MCP_BEARER_TOKEN="your-token-here"

# Verify it's set
echo $NOTION_MCP_BEARER_TOKEN

# Start the application in the SAME terminal
cd server-java
make dev
```

#### Option B: Use .env file (Spring Boot doesn't auto-load .env)
Spring Boot doesn't automatically load `.env` files. You need to either:

1. **Use a tool like `dotenv`:**
```bash
# Install dotenv
npm install -g dotenv-cli

# Run with dotenv
dotenv -e .env -- ./mvnw spring-boot:run
```

2. **Or source the .env file manually:**
```bash
# Source the .env file
export $(cat .env | xargs)

# Then run
make dev
```

3. **Or set variables in application.yaml (not recommended for secrets):**
```yaml
gateway:
  mcp-servers-config: mcp_servers.yaml
```

And in `mcp_servers.yaml`, use a hardcoded token (INSECURE):
```yaml
notion:
  auth:
    method: bearer
    # Don't use env:// if the variable isn't set
    credential_ref: "Bearer your-actual-token-here"
```

### 2. Notion MCP Server Not Running

**Diagnosis:**
```bash
# Test if server is accessible
curl http://localhost:8081/mcp

# Should return 401 with JSON error, not connection refused
```

**Solution:**
Start the Notion MCP server:
```bash
npx -y @modelcontextprotocol/server-notion --transport http --port 8081
```

### 3. Wrong URL or Port

**Diagnosis:**
Check if you're using the correct URL in `mcp_servers.yaml`:

```yaml
notion:
  url: http://localhost:8081/mcp  # Should be localhost, not 0.0.0.0
```

**Solution:**
Update `mcp_servers.yaml`:
```yaml
notion:
  url: http://localhost:8081/mcp  # Changed from 0.0.0.0
```

### 4. Token Format Issues

The Notion MCP server expects the token in a specific format.

**Check token format:**
```bash
# Token should start with something like "mcp_" or similar
echo $NOTION_MCP_BEARER_TOKEN | head -c 20
```

**Configuration in mcp_servers.yaml:**
```yaml
notion:
  auth:
    method: bearer
    location: header
    name: Authorization
    format: prefix
    prefix: "Bearer "  # Note the space after Bearer
    credential_ref: env://NOTION_MCP_BEARER_TOKEN
```

**IMPORTANT:** The environment variable should contain ONLY the token, without the "Bearer " prefix. The gateway automatically applies the prefix based on the configuration.

```bash
# CORRECT - Token only
export NOTION_MCP_BEARER_TOKEN="mcp_Abc123XYZ..."

# WRONG - Don't include Bearer in the token
# export NOTION_MCP_BEARER_TOKEN="Bearer mcp_Abc123XYZ..."  # This creates "Bearer Bearer ..."
```

The full header will be automatically constructed as: `Authorization: Bearer {your-token}`

## Debugging Steps

### 1. Enable Debug Logging

Update `application.yaml`:
```yaml
logging:
  level:
    com.datacline.mcpgateway: DEBUG
    io.modelcontextprotocol: DEBUG
```

Restart and check logs for:
- "Applying authentication for server: notion"
- "Adding header: Authorization"
- "Customizing HTTP request"

### 2. Test Authentication Manually

```bash
# Replace YOUR_TOKEN with your actual token
curl -v -X POST http://localhost:8081/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"initialize",
    "params":{
      "protocolVersion":"2024-11-05",
      "capabilities":{},
      "clientInfo":{"name":"test","version":"1.0"}
    }
  }'
```

**Expected:**
- Status: 200 OK
- Content-Type: application/json
- Body: JSON-RPC response with server capabilities

**If you get 401:**
- Token is incorrect or not in the right format
- Token has expired

### 3. Check What the Gateway is Sending

Look for these debug logs:
```
DEBUG c.d.m.service.McpProxyService - Applying authentication for server: notion, method: BEARER
DEBUG c.d.m.service.McpProxyService - Added auth header: Authorization for server: notion
DEBUG c.d.m.client.McpHttpClient - Customizing HTTP request for POST http://localhost:8081/mcp
DEBUG c.d.m.client.McpHttpClient - Adding header: Authorization = Bearer mcp_...
```

### 4. Verify Environment Variable is Available

Add this temporary debug code to McpProxyService.java:
```java
String credential = resolveCredential(authConfig.credentialRef());
LOG.info("Resolved credential for {}: {}", serverEntry.name(), 
         credential != null ? "***" + credential.substring(Math.max(0, credential.length() - 4)) : "NULL");
```

## Quick Fix: Disable Notion Temporarily

If you can't get authentication working and need to test other features:

```yaml
# mcp_servers.yaml
notion:
  enabled: false  # Disable it
```

## Common Mistakes

1. **Setting token in a different terminal**
   - Environment variables are per-terminal session
   - Must export in the same terminal where you run the app

2. **Using wrong credential_ref format**
   ```yaml
   # WRONG
   credential_ref: $NOTION_MCP_BEARER_TOKEN
   
   # CORRECT
   credential_ref: env://NOTION_MCP_BEARER_TOKEN
   ```

3. **Missing space after "Bearer"**
   ```yaml
   # WRONG
   prefix: "Bearer"
   
   # CORRECT
   prefix: "Bearer "  # Note the space
   ```

4. **Using 0.0.0.0 instead of localhost**
   ```yaml
   # WRONG
   url: http://0.0.0.0:8081/mcp
   
   # CORRECT
   url: http://localhost:8081/mcp
   ```

## Test After Fixes

```bash
# 1. Verify token is set
echo $NOTION_MCP_BEARER_TOKEN

# 2. Restart application
make dev

# 3. Test the connection
curl "http://localhost:8000/mcp/list-tools?mcp_server=notion"

# Should return JSON with tools, not an error
```

## Still Not Working?

1. Check Notion MCP server logs for errors
2. Capture network traffic with `tcpdump` or Wireshark
3. Try the default mock server to verify gateway is working:
   ```bash
   curl "http://localhost:8000/mcp/list-tools?mcp_server=default"
   ```

## Related Files

- `server-java/mcp_servers.yaml` - Server configuration
- `server-java/src/main/java/com/datacline/mcpgateway/service/McpProxyService.java` - Auth logic
- `server-java/src/main/java/com/datacline/mcpgateway/client/McpHttpClient.java` - HTTP client
- `server-java/src/main/resources/application.yaml` - Logging configuration

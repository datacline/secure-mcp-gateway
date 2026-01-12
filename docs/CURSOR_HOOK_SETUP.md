# Cursor Hook Integration Guide

This guide explains how to set up the Cursor `beforeMCPExecution` hook to enforce security policies via the MCP Gateway.

## Overview

The hook script (`mcp-gateway-hook.sh`) intercepts all MCP tool execution requests and checks them against your security policies before allowing them to execute. This ensures:

- **Policy Enforcement**: Only approved tools/actions are executed
- **Audit Trail**: All decisions are logged by the gateway
- **User Notification**: Users receive clear messages when execution is denied

## Architecture

```
Cursor Client (beforeMCPExecution hook)
    ↓
mcp-gateway-hook.sh (reads stdin, calls gateway API)
    ↓
SaaS Gateway API (/api/v1/check-mcp-policy)
    ↓
Policy Evaluation Engine
    ↓
Response: {permission: "allow"|"deny", continue: bool, userMessage: "..."}
    ↓
Hook script outputs decision back to Cursor
```

## Quick Start (5 minutes)

### 1. Install the Hook Script

```bash
# Create .cursor directory if it doesn't exist
mkdir -p ~/.cursor

# Copy the hook script
cp examples/mcp-gateway-hook.sh ~/.cursor/mcp-gateway-hook.sh

# Make it executable
chmod +x ~/.cursor/mcp-gateway-hook.sh
```

### 2. Configure Environment Variables

Set these environment variables in your shell profile (`.bashrc`, `.zshrc`, etc.):

```bash
# Gateway API endpoint (provided by your SaaS administrator)
export MCP_GATEWAY_API_URL="https://api.yourdomain.com/api/v1/check-mcp-policy"

# Unique API key for your account/device
export MCP_GATEWAY_API_KEY="sk-your-unique-api-key-here"

# Optional: Allow execution if gateway is unreachable (default: false)
# export MCP_GATEWAY_FAIL_OPEN=true

# Optional: Enable debug logging
# export MCP_GATEWAY_DEBUG=true
```

Or edit the script directly (lines 42-50) and hardcode these values.

### 3. Configure Cursor Hook

Edit or create `~/.cursor/hooks.json`:

```json
{
  "beforeMCPExecution": "~/.cursor/mcp-gateway-hook.sh"
}
```

If the file doesn't exist, create it with the above content.

### 4. Verify Installation

Restart Cursor and try using an MCP tool. You should see:
- If allowed: Tool executes normally
- If denied: Error message from the policy ("Access denied by policy enforcement")

Check debug logs:

```bash
export MCP_GATEWAY_DEBUG=true
# Then use Cursor and check stderr output
```

## Configuration Options

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MCP_GATEWAY_API_URL` | Yes | `https://api.yoursaas.com/api/v1/check-mcp-policy` | Gateway API endpoint |
| `MCP_GATEWAY_API_KEY` | Yes | (empty) | API key for authentication |
| `MCP_GATEWAY_TIMEOUT` | No | 5 | Request timeout in seconds |
| `MCP_GATEWAY_FAIL_OPEN` | No | false | Allow execution if gateway unavailable |
| `MCP_GATEWAY_DEBUG` | No | false | Enable debug logging to stderr |

### Fail-Open Behavior (NFR-3)

For high availability, you can set `MCP_GATEWAY_FAIL_OPEN=true`:

```bash
export MCP_GATEWAY_FAIL_OPEN=true
```

This ensures that if the gateway API is unreachable:
- Network failures → Allow execution
- Timeouts → Allow execution
- Invalid responses → Allow execution
- HTTP errors → Allow execution

**Note**: Invalid configuration (missing API key) still denies execution.

## API Response Format

The gateway API must return JSON in this format:

### Allow Response
```json
{
  "permission": "allow",
  "continue": true
}
```

### Deny Response
```json
{
  "permission": "deny",
  "continue": false,
  "userMessage": "This tool is not approved for your role"
}
```

The `userMessage` is displayed to the user in Cursor when execution is denied.

## Implementation in Backend

To implement the `/api/v1/check-mcp-policy` endpoint on the SaaS gateway:

### Endpoint Requirements

**URL**: `POST /api/v1/check-mcp-policy`

**Authentication**: `X-API-Key` header

**Request Body** (MCP execution context):
```json
{
  "tool_name": "string",
  "mcp_server": "string",
  "parameters": {},
  "user_id": "string",
  "device_id": "string"
}
```

**Response** (see above format)

### Example Implementation (Python/FastAPI)

```python
from fastapi import APIRouter, HTTPException, Header
from typing import Dict, Any, Optional
from server.audit.logger import audit_logger

router = APIRouter(prefix="/api/v1", tags=["policy"])

@router.post("/check-mcp-policy")
async def check_mcp_policy(
    request: Dict[str, Any],
    x_api_key: str = Header(...)
) -> Dict[str, Any]:
    """
    Policy check endpoint for Cursor hook integration
    
    Args:
        request: MCP execution request
        x_api_key: API key for authentication
    
    Returns:
        Policy decision: {permission: "allow"|"deny", continue: bool, userMessage: "..."}
    """
    
    # Authenticate API key
    user = authenticate_api_key(x_api_key)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    # Extract execution context
    tool_name = request.get("tool_name")
    mcp_server = request.get("mcp_server")
    parameters = request.get("parameters", {})
    
    # Evaluate policy
    allowed = evaluate_policy(
        user=user,
        tool_name=tool_name,
        mcp_server=mcp_server,
        parameters=parameters
    )
    
    # Audit log
    audit_logger.log_policy_check(
        user=user.username,
        tool_name=tool_name,
        mcp_server=mcp_server,
        decision="allow" if allowed else "deny"
    )
    
    # Return decision
    if allowed:
        return {
            "permission": "allow",
            "continue": True
        }
    else:
        return {
            "permission": "deny",
            "continue": False,
            "userMessage": "This tool is not approved for your role"
        }
```

## Troubleshooting

### "curl: command not found"
```bash
# macOS
brew install curl

# Ubuntu/Debian
sudo apt-get install curl

# CentOS/RHEL
sudo yum install curl
```

### "jq: command not found"
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# CentOS/RHEL
sudo yum install jq
```

### Hook not executing
- Verify `~/.cursor/hooks.json` exists and is valid JSON
- Check that script is executable: `ls -la ~/.cursor/mcp-gateway-hook.sh` should show `x` permissions
- Enable debug: `export MCP_GATEWAY_DEBUG=true`

### "Invalid API key" errors
- Verify `MCP_GATEWAY_API_KEY` is set correctly
- Check that the key hasn't expired or been revoked
- Ensure the key matches your account/device

### "Gateway is unreachable"
- Verify `MCP_GATEWAY_API_URL` is correct and accessible
- Check network connectivity: `curl -H "X-API-Key: test" https://your-api/api/v1/check-mcp-policy`
- Check firewall rules
- Set `MCP_GATEWAY_FAIL_OPEN=true` for development/testing

### All policies being denied
- Check policy configuration on the backend
- Verify user/device information is being passed correctly
- Review audit logs on the gateway

## Performance (NFR-2)

The script is optimized for low latency:

- **Timeout**: Default 5 seconds (configurable via `MCP_GATEWAY_TIMEOUT`)
- **Fail-Open**: Prevents blocking if gateway is slow
- **Direct HTTP**: Uses curl for minimal overhead

Expected latency: **50-200ms** under normal conditions

## Security (NFR-1)

- **HTTPS/TLS**: All communication encrypted by default
- **API Key**: Unique per customer/device via `X-API-Key` header
- **No Credentials in Logs**: Sensitive data is never logged
- **Timeout Protection**: Prevents infinite hangs
- **Graceful Degradation**: Fail-open option prevents complete lockout

## Testing

### Manual Test

```bash
# Test with a simple payload
cat <<'EOF' | bash ~/.cursor/mcp-gateway-hook.sh
{
  "tool_name": "test_tool",
  "mcp_server": "test_server",
  "parameters": {}
}
EOF
```

### Test Fail-Open

```bash
export MCP_GATEWAY_FAIL_OPEN=true
export MCP_GATEWAY_API_URL="http://invalid-url-that-does-not-exist"
# Should allow execution despite unreachable gateway
```

### Test Deny

```bash
export MCP_GATEWAY_FAIL_OPEN=false
export MCP_GATEWAY_API_URL="http://invalid-url-that-does-not-exist"
# Should deny execution when gateway is unreachable
```

## Advanced Configuration

### Custom Headers

Edit the script to add additional headers (lines ~200):

```bash
curl -s -w "\n%{http_code}" \
  --max-time "$GATEWAY_TIMEOUT" \
  -X POST "$GATEWAY_API_URL" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $GATEWAY_API_KEY" \
  -H "X-Device-ID: $DEVICE_ID" \
  -H "X-Custom-Header: custom-value" \
  -d "$payload"
```

### Multiple Gateway Endpoints

For fallback/redundancy (edit script):

```bash
# Try primary endpoint first
# If it fails, try backup endpoint
```

See the [MCP Authorization Architecture](MCP_AUTHORIZATION_ARCHITECTURE.md) for more details on policy configuration.

## See Also

- [MCP Protocol Implementation](MCP_PROTOCOL_IMPLEMENTATION.md)
- [VS Code MCP OAuth Setup](VSCODE_MCP_OAUTH_SETUP.md)
- [Claude Desktop Configuration](CLAUDE_DESKTOP_CONFIG.md)

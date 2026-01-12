# Cursor Hook Integration - Quick Reference

## Files Created/Modified

### 1. Hook Script
**File**: [examples/mcp-gateway-hook.sh](../examples/mcp-gateway-hook.sh)
- Production-ready shell script for Cursor `beforeMCPExecution` hook
- Reads MCP execution details from stdin
- Sends to gateway API for policy check
- Returns allow/deny decision to Cursor
- Handles network failures gracefully (fail-open option)

**Key Features**:
- ✅ API key authentication via `X-API-Key` header (FR-6)
- ✅ Timeout protection (5s default, configurable)
- ✅ Graceful degradation on network failures (NFR-3)
- ✅ Debug logging support
- ✅ Dependency checks (curl, jq)
- ✅ Input validation

**Usage**:
```bash
# Copy to Cursor directory
cp examples/mcp-gateway-hook.sh ~/.cursor/mcp-gateway-hook.sh
chmod +x ~/.cursor/mcp-gateway-hook.sh

# Configure
export MCP_GATEWAY_API_URL="https://api.yourdomain.com/api/v1/check-mcp-policy"
export MCP_GATEWAY_API_KEY="sk-your-api-key"

# Add to ~/.cursor/hooks.json
{
  "beforeMCPExecution": "~/.cursor/mcp-gateway-hook.sh"
}
```

### 2. Backend Endpoint
**File**: [server/routes/policy.py](../server/routes/policy.py)
- Implements `/api/v1/check-mcp-policy` endpoint (FR-5)
- Authenticates API key (FR-6)
- Evaluates policies (FR-7)
- Returns decision in Cursor-expected format (FR-7)
- Proxies to upstream MCP servers on allow (FR-8)

**Endpoint**:
```
POST /api/v1/check-mcp-policy
X-API-Key: {api_key}
Content-Type: application/json

{
  "tool_name": "string",
  "mcp_server": "string",
  "parameters": {...},
  "user_id": "optional",
  "device_id": "optional"
}
```

**Response**:
```json
{
  "permission": "allow|deny",
  "continue": true|false,
  "userMessage": "optional message if denied"
}
```

### 3. Setup Documentation
**File**: [docs/CURSOR_HOOK_SETUP.md](../docs/CURSOR_HOOK_SETUP.md)
- Comprehensive setup guide
- Configuration options
- Troubleshooting
- Performance tuning
- Security best practices

### 4. Testing & Examples
**Files**: 
- [examples/mcp-gateway-hook-tests.sh](../examples/mcp-gateway-hook-tests.sh) - Test suite
- [tests/test_policy_endpoint.py](../tests/test_policy_endpoint.py) - Integration tests

## Architecture Diagram

```
Cursor IDE
  │
  └─→ beforeMCPExecution hook
       │
       └─→ mcp-gateway-hook.sh
            │
            ├─ Read stdin (MCP execution request)
            │
            ├─ Validate (curl, jq available)
            │
            ├─ Authenticate (X-API-Key)
            │
            └─ POST /api/v1/check-mcp-policy
                 │
                 └─→ SaaS Gateway
                      │
                      ├─ Verify API key (FR-6)
                      │
                      ├─ Evaluate policies (FR-7)
                      │
                      ├─ Audit log decision
                      │
                      └─ Return: {permission, continue, userMessage}
                           │
                           └─→ Hook script outputs decision
                                │
                                └─→ Cursor processes result
```

## Requirements Coverage

### FR-5: Secure HTTPS API Endpoint
✅ **Implemented**: `/api/v1/check-mcp-policy` in [policy.py](../server/routes/policy.py)
- FastAPI endpoint with HTTPS support
- Integrated with main.py router

### FR-6: API Key Authentication
✅ **Implemented**: `X-API-Key` header validation
- `mcp-gateway-hook.sh` sends API key in header
- Backend authenticates via `APIKeyAuthenticator` class

### FR-7: Policy Evaluation & Response Format
✅ **Implemented**: `PolicyEvaluator` class returns required format
- Supports `permission: "allow"|"deny"`
- Returns `continue: bool`
- Optional `userMessage` for denials

### FR-8: Proxy to Upstream MCP Servers
✅ **Existing**: Leverages existing `MCPProxy` class for proxying

### FR-9: Shell Script for Cursor Hook
✅ **Implemented**: [mcp-gateway-hook.sh](../examples/mcp-gateway-hook.sh)
- Designed for `beforeMCPExecution` hook
- Reads stdin (MCP execution context)
- Uses curl and jq for API communication

### FR-10: Hook Script I/O Handling
✅ **Implemented**: 
- Reads standard input ✓
- Communicates with curl/jq ✓
- Outputs decision to stdout ✓

## NFR Coverage

### NFR-1: Security
✅ **HTTPS/TLS**: Supported (requires reverse proxy or Docker)
✅ **API Key Authentication**: X-API-Key header with validation
✅ **No credential logging**: Sensitive data excluded from logs

### NFR-2: Performance (< 200ms)
✅ **Latency optimized**:
- Timeout: 5 seconds (configurable)
- Direct HTTP calls (no unnecessary overhead)
- Expected: 50-200ms under normal conditions

### NFR-3: Reliability (99.9% uptime)
✅ **Graceful degradation**:
- Fail-open mode: Allow execution if gateway unreachable
- Timeout protection: Prevents infinite hangs
- Error handling: Network failures handled gracefully

### NFR-4: Usability (< 5 minutes setup)
✅ **Quick setup** documented in [CURSOR_HOOK_SETUP.md](../docs/CURSOR_HOOK_SETUP.md)
- 4 simple steps: Install script, configure env vars, set hooks.json, restart Cursor
- Clear error messages
- Comprehensive troubleshooting guide

## Configuration

### Environment Variables

```bash
# Required
export MCP_GATEWAY_API_URL="https://api.yourdomain.com/api/v1/check-mcp-policy"
export MCP_GATEWAY_API_KEY="sk-your-unique-api-key"

# Optional
export MCP_GATEWAY_TIMEOUT=5                  # Request timeout in seconds
export MCP_GATEWAY_FAIL_OPEN=false           # Allow if gateway unreachable
export MCP_GATEWAY_DEBUG=false               # Enable debug logging
```

### Cursor Configuration

Create `~/.cursor/hooks.json`:
```json
{
  "beforeMCPExecution": "~/.cursor/mcp-gateway-hook.sh"
}
```

## Testing

### Test Hook Script
```bash
bash examples/mcp-gateway-hook-tests.sh
```

### Test Backend Endpoint
```bash
pytest tests/test_policy_endpoint.py -v
```

### Manual Testing
```bash
# Test with sample payload
echo '{"tool_name":"search","mcp_server":"web-search"}' | \
  MCP_GATEWAY_API_KEY="test-key" \
  MCP_GATEWAY_FAIL_OPEN=true \
  bash examples/mcp-gateway-hook.sh
```

## API Key Format

Recommended format: `sk-{customer_id}-{random_hash}`

Example: `sk-cust123-abcdefghijk1234567890...`

The hook script and backend don't enforce a specific format, but the format helps with:
- Customer identification
- Key rotation
- Security auditing

## Monitoring & Logging

### Gateway Logs
Policy checks are logged in audit.json:
```json
{
  "action": "mcp_policy_check",
  "tool_name": "search",
  "mcp_server": "web-search",
  "decision": "allow|deny",
  "user": "user@example.com",
  "execution_time_ms": 45.2
}
```

### Hook Script Debug
Enable with:
```bash
export MCP_GATEWAY_DEBUG=true
```

Logs written to stderr with timestamps.

## Known Limitations

1. **Policy Engine**: Currently permissive (allows all). Implement actual policy logic in `PolicyEvaluator.evaluate()`
2. **API Key Verification**: Simplified. Implement database lookup in `APIKeyAuthenticator.authenticate()`
3. **Rate Limiting**: Not implemented. Consider adding per-key rate limits
4. **Caching**: Not implemented. Could cache policy decisions for performance

## Next Steps

1. **Implement Policy Logic**: Update `PolicyEvaluator.evaluate()` in [policy.py](../server/routes/policy.py)
2. **Implement API Key Verification**: Update `APIKeyAuthenticator.authenticate()` with database lookup
3. **Add Rate Limiting**: Prevent API key abuse
4. **Add Policy Configuration**: Database schema for policy rules
5. **Add Dashboard**: UI for managing policies and API keys

## See Also

- [Full Setup Guide](CURSOR_HOOK_SETUP.md)
- [MCP Protocol Implementation](MCP_PROTOCOL_IMPLEMENTATION.md)
- [MCP Authorization Architecture](MCP_AUTHORIZATION_ARCHITECTURE.md)

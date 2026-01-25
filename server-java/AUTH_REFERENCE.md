# Authentication Configuration Reference

This guide explains how authentication works in the MCP Gateway and how to properly configure credentials.

## How Authentication Works

The gateway uses a flexible authentication system that matches the Python implementation:

1. **Read credential** from environment/file/vault
2. **Format credential** based on auth config (raw/prefix/template)
3. **Apply to request** in the specified location (header/query/body)

## Configuration Format

```yaml
servers:
  your-server:
    auth:
      method: bearer          # Authentication method
      location: header        # Where to put the credential
      name: Authorization     # Header/query/body parameter name
      format: prefix          # How to format the credential
      prefix: "Bearer "       # Prefix to add (note the space!)
      credential_ref: env://TOKEN_VAR  # Where to get the credential
```

## Authentication Methods

| Method | Description | Example Use Case |
|--------|-------------|-----------------|
| `bearer` | Bearer token auth | OAuth2, API tokens |
| `api_key` | API key auth | REST APIs |
| `basic` | Basic auth | Username/password |
| `oauth2` | OAuth2 | Third-party integrations |
| `custom` | Custom format | Special auth schemes |
| `none` | No auth | Public APIs |

## Credential Formats

### 1. RAW (No Formatting)

The credential is used as-is:

```yaml
auth:
  format: raw
  credential_ref: env://API_KEY
```

**Environment:**
```bash
export API_KEY="abc123xyz"
```

**Result:**
```
Authorization: abc123xyz
```

### 2. PREFIX (Add Prefix)

A prefix is added before the credential:

```yaml
auth:
  format: prefix
  prefix: "Bearer "  # Note the space!
  credential_ref: env://TOKEN
```

**Environment:**
```bash
# CORRECT - Token only
export TOKEN="abc123xyz"

# WRONG - Don't include prefix
# export TOKEN="Bearer abc123xyz"  # ❌ Creates "Bearer Bearer abc123xyz"
```

**Result:**
```
Authorization: Bearer abc123xyz
```

### 3. TEMPLATE (Custom Format)

Use a template with `{credential}` placeholder:

```yaml
auth:
  format: template
  template: "Token {credential}"
  credential_ref: env://TOKEN
```

**Environment:**
```bash
export TOKEN="abc123xyz"
```

**Result:**
```
Authorization: Token abc123xyz
```

## Credential References

### Environment Variables

```yaml
credential_ref: env://VAR_NAME
```

**Usage:**
```bash
export VAR_NAME="your-secret-here"
```

**Important:** Export ONLY the raw credential. The gateway will apply formatting.

### File-based

```yaml
credential_ref: file:///path/to/token.txt
```

**File content:**
```
your-secret-token-here
```

**Important:** File should contain only the raw token, no prefix.

### Vault (Future)

```yaml
credential_ref: vault://kv/path/to/secret?v=3
```

Currently not implemented.

## Common Examples

### Bearer Token (Most Common)

```yaml
notion:
  auth:
    method: bearer
    location: header
    name: Authorization
    format: prefix
    prefix: "Bearer "
    credential_ref: env://NOTION_TOKEN
```

```bash
# Set token (no "Bearer " prefix)
export NOTION_TOKEN="mcp_abc123"
```

Result: `Authorization: Bearer mcp_abc123`

### API Key Header

```yaml
openai:
  auth:
    method: api_key
    location: header
    name: X-API-Key
    format: raw
    credential_ref: env://OPENAI_API_KEY
```

```bash
export OPENAI_API_KEY="sk-abc123"
```

Result: `X-API-Key: sk-abc123`

### API Key Query Parameter

```yaml
weather-api:
  auth:
    method: api_key
    location: query
    name: apikey
    format: raw
    credential_ref: env://WEATHER_API_KEY
```

```bash
export WEATHER_API_KEY="abc123"
```

Result: URL with `?apikey=abc123`

### Basic Authentication

```yaml
legacy-system:
  auth:
    method: basic
    location: header
    name: Authorization
    format: prefix
    prefix: "Basic "
    credential_ref: env://BASIC_AUTH_B64
```

```bash
# Create base64 encoded "username:password"
export BASIC_AUTH_B64=$(echo -n "user:pass" | base64)
```

Result: `Authorization: Basic dXNlcjpwYXNz`

### Custom Header Format

```yaml
custom-api:
  auth:
    method: custom
    location: header
    name: X-Custom-Auth
    format: template
    template: "CustomToken {credential}"
    credential_ref: env://CUSTOM_TOKEN
```

```bash
export CUSTOM_TOKEN="abc123"
```

Result: `X-Custom-Auth: CustomToken abc123`

## Common Mistakes

### ❌ Including Prefix in Environment Variable

**Wrong:**
```bash
# Don't do this
export TOKEN="Bearer abc123"
```

```yaml
auth:
  format: prefix
  prefix: "Bearer "
  credential_ref: env://TOKEN
```

**Result:** `Authorization: Bearer Bearer abc123` ❌

**Correct:**
```bash
export TOKEN="abc123"  # Just the token
```

**Result:** `Authorization: Bearer abc123` ✅

### ❌ Missing Space in Prefix

**Wrong:**
```yaml
auth:
  prefix: "Bearer"  # Missing space
```

**Result:** `Authorization: Bearerabc123` ❌

**Correct:**
```yaml
auth:
  prefix: "Bearer "  # Note the space!
```

**Result:** `Authorization: Bearer abc123` ✅

### ❌ Wrong Credential Reference Format

**Wrong:**
```yaml
credential_ref: $TOKEN  # Shell syntax
credential_ref: ${TOKEN}  # Shell syntax
credential_ref: TOKEN  # Missing protocol
```

**Correct:**
```yaml
credential_ref: env://TOKEN  # Proper format
```

## Debugging Authentication

### Enable Debug Logging

```yaml
# application.yaml
logging:
  level:
    com.datacline.mcpgateway.service: DEBUG
```

### Look for These Logs

```
DEBUG c.d.m.service.McpProxyService - Applying authentication for server: notion, method: BEARER
DEBUG c.d.m.service.McpProxyService - Formatted credential for server: notion, header: Authorization, value length: 35
DEBUG c.d.m.service.McpProxyService - Added auth header: Authorization for server: notion
DEBUG c.d.m.client.McpHttpClient - Adding header: Authorization = Bearer abc...
```

### Test Authentication Manually

```bash
# Check if token is set
echo $YOUR_TOKEN_VAR

# Test the MCP server directly
curl -v -H "Authorization: Bearer $YOUR_TOKEN_VAR" \
  http://localhost:8081/mcp
```

## Security Best Practices

1. **Never commit tokens** - Use environment variables or secure vaults
2. **Use .gitignore** - Ensure `.env` files are ignored
3. **Rotate tokens regularly** - Update tokens periodically
4. **Use minimal permissions** - Grant only necessary access
5. **Use file:// for production** - Store tokens in secure files
6. **Plan for vault integration** - Use vault:// when available

## Related Files

- `mcp_servers.yaml` - Server and auth configuration
- `McpProxyService.java` - Auth implementation
- `.env.example` - Example environment variables
- `NOTION_SETUP.md` - Notion-specific setup
- `TROUBLESHOOTING.md` - Troubleshooting guide

## Summary

**Golden Rule:** Environment variables should contain ONLY the raw credential. The gateway will format it according to the auth configuration.

```bash
# ✅ CORRECT
export TOKEN="abc123"

# ❌ WRONG
export TOKEN="Bearer abc123"
```

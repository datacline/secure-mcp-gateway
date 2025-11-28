# MCP Client Authorization Architecture

## Overview

The Secure MCP Gateway implements OAuth2 authorization for MCP clients following the [MCP specification](https://modelcontextprotocol.io/docs/tutorials/security/authorization). This document describes the architecture and implementation details.

## Architecture Components

### 1. MCP Client Authenticator (`server/auth/mcp_client_auth.py`)

**Purpose**: Validates OAuth2 tokens from MCP clients (VS Code, Claude Desktop, etc.)

**Key Features**:
- JWT validation using JWKS (JSON Web Key Set)
- Support for public clients using PKCE
- Token caching for performance
- Scope validation
- Issuer verification

**Authentication Flow**:
```
1. Client sends Bearer token in Authorization header
2. Authenticator extracts token
3. Fetches JWKS from Keycloak (cached for 1 hour)
4. Validates JWT signature using public key
5. Verifies issuer, expiration, and scopes
6. Returns token claims if valid
```

**Code Structure**:
```python
class MCPClientAuthenticator:
    - get_jwks(): Fetches public keys from Keycloak
    - validate_jwt_token(): Validates JWT tokens
    - build_oauth_error_response(): Creates RFC-compliant error responses
    - authenticate_request(): Main authentication entry point
```

### 2. MCP Protocol Endpoint (`server/routes/mcp_protocol.py`)

**Purpose**: Handles MCP JSON-RPC requests with OAuth2 authentication

**Key Features**:
- Supports MCP protocol version 2024-11-05
- OAuth2 authentication integration
- JSON-RPC 2.0 request/response handling
- Tool, resource, and prompt aggregation

**Request Flow**:
```
1. Receive POST /mcp request
2. Authenticate request (if AUTH_ENABLED=true)
3. Parse JSON-RPC request
4. Route to appropriate handler (tools/list, tools/call, etc.)
5. Return JSON-RPC response
```

### 3. OAuth2 Discovery Endpoints (`server/routes/oauth_proxy.py`)

**Purpose**: Provides OAuth2 metadata for auto-discovery by MCP clients

**Endpoints**:

1. **`/.well-known/oauth-protected-resource`** (RFC 8707)
   - Returns Protected Resource Metadata
   - Tells clients about authorization server
   - Specifies required scopes and capabilities

2. **`/.well-known/oauth-authorization-server`** (RFC 8414)
   - Returns Authorization Server Metadata
   - Provides OAuth2 endpoint URLs
   - Lists supported flows and methods

3. **`/authorize`** and **`/token`** proxies
   - Proxy OAuth2 requests to Keycloak
   - Simplifies client configuration
   - Handles redirects transparently

## Authentication Modes

### Mode 1: Public Client (VS Code, Claude Desktop)

**Flow**: Authorization Code with PKCE

**Steps**:
1. Client discovers OAuth endpoints via `/.well-known/oauth-protected-resource`
2. Client generates PKCE code_verifier and code_challenge
3. Client redirects user to Keycloak authorization endpoint
4. User authenticates and grants consent
5. Keycloak redirects back with authorization code
6. Client exchanges code for JWT access token (with code_verifier)
7. Client includes token in `Authorization: Bearer <token>` header
8. Gateway validates JWT using JWKS (no client secret needed)

**Configuration**:
```bash
AUTH_ENABLED=true
MCP_AUTH_ENABLED=false  # Disables token introspection
JWT_AUDIENCE=mcp-gateway-client
MCP_REQUIRED_SCOPES=mcp:tools
```

**Why PKCE?**
- Public clients cannot securely store secrets
- PKCE prevents authorization code interception attacks
- Code verifier proves client initiated the flow

### Mode 2: Confidential Client (Optional)

**Flow**: Token Introspection with Client Credentials

**Steps**:
1. Client authenticates with client_id and client_secret
2. Obtains access token from Keycloak
3. Sends token to gateway
4. Gateway introspects token with Keycloak using client credentials
5. Keycloak validates token and returns claims

**Configuration**:
```bash
AUTH_ENABLED=true
MCP_AUTH_ENABLED=true
MCP_OAUTH_CLIENT_ID=confidential-client
MCP_OAUTH_CLIENT_SECRET=secret123
```

**Note**: This mode is not used for VS Code but available for server-to-server scenarios.

### Mode 3: No Authentication

**Configuration**:
```bash
AUTH_ENABLED=false
```

**Use Case**: Development and testing only. Not recommended for production.

## Token Validation Details

### JWT Token Structure

```json
{
  "exp": 1234567890,
  "iat": 1234567890,
  "jti": "token-id",
  "iss": "http://localhost:8080/realms/mcp-gateway",
  "aud": "mcp-gateway-client",
  "sub": "user-uuid",
  "typ": "Bearer",
  "azp": "vscode-mcp-client",
  "scope": "openid profile email mcp:tools",
  "preferred_username": "testuser",
  "email": "testuser@example.com"
}
```

### Validation Steps

1. **Signature Verification**:
   - Fetch JWKS from Keycloak
   - Find key matching token's `kid` (key ID)
   - Verify RS256 signature using public key

2. **Claims Validation**:
   - `iss`: Must match Keycloak issuer URL
   - `exp`: Token must not be expired
   - `scope`: Must include required scopes (`mcp:tools`)
   - `aud`: Optional for public clients (not enforced)

3. **Scope Verification**:
   - Extract scopes from token's `scope` claim
   - Verify required scopes are present
   - Return 403 if scopes missing

### Why Audience Validation is Optional

The MCP spec allows flexibility for public clients:
- Different clients may use different client_ids
- PKCE provides security without relying on audience
- Scope validation is more important for access control
- Issuer verification ensures token is from trusted source

## Security Considerations

### 1. PKCE Security

**Problem**: Authorization code interception
**Solution**: PKCE code_verifier and code_challenge

```
1. Client generates random code_verifier (43-128 chars)
2. Client creates code_challenge = BASE64URL(SHA256(code_verifier))
3. Client sends code_challenge with authorization request
4. Keycloak stores code_challenge
5. Client exchanges code with code_verifier
6. Keycloak verifies SHA256(code_verifier) == code_challenge
```

### 2. Token Caching

**Purpose**: Avoid repeated JWKS fetches and JWT validation

**Implementation**:
- Token cache: 1000 tokens, TTL = token_cache_ttl (default: 300s)
- JWKS cache: 1 hour TTL
- Cache key: `"jwt:{token}"` to avoid collisions

**Security**:
- Cache respects token expiration
- Invalid tokens never cached
- Cache cleared on gateway restart

### 3. JWKS Rotation

**Keycloak Key Rotation**:
- Keycloak can have multiple active keys
- Gateway fetches all keys from JWKS endpoint
- Token's `kid` identifies which key to use
- Old tokens remain valid during rotation period

**Cache Strategy**:
- JWKS cached for 1 hour
- Automatically refreshed on cache miss
- No manual intervention needed for key rotation

### 4. Scope-Based Access Control

**Scope Hierarchy**:
```
mcp:tools      - Access to all MCP tools
mcp:tools:read  - Read-only access (future enhancement)
mcp:admin      - Administrative access (future enhancement)
```

**Current Implementation**:
- Only `mcp:tools` scope required
- All authenticated users have same permissions
- Future: Implement fine-grained scopes per tool/resource

## Error Handling

### OAuth2 Error Responses

Following RFC 6750 (Bearer Token Usage):

**401 Unauthorized**:
```json
{
  "error": "invalid_token",
  "error_description": "Token expired or invalid",
  "oauth2_metadata": {
    "resource": "http://localhost:8000/mcp",
    "authorization_servers": ["http://localhost:8080/realms/mcp-gateway"],
    ...
  }
}
```

**Headers**:
```
WWW-Authenticate: Bearer realm="mcp-gateway", error="invalid_token", error_description="Token expired"
```

**403 Forbidden** (scope missing):
```json
{
  "error": "insufficient_scope",
  "error_description": "Token missing required scopes: mcp:tools"
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `unauthorized` | No token provided | Include Authorization header |
| `invalid_token` | Token expired or invalid signature | Re-authenticate to get new token |
| `insufficient_scope` | Missing required scopes | Grant mcp:tools scope in Keycloak |
| `Unable to find appropriate key` | JWKS doesn't have token's key | Check Keycloak key configuration |

## Performance Optimizations

### 1. Token Caching

**Before**: Every request validates token with JWKS
**After**: Validated tokens cached for TTL duration

**Impact**:
- 100x faster for cached tokens
- Reduced load on Keycloak
- Lower latency for clients

### 2. JWKS Caching

**Before**: Fetch JWKS on every token validation
**After**: Cache JWKS for 1 hour

**Impact**:
- Reduced network calls to Keycloak
- Faster token validation
- Supports key rotation gracefully

### 3. Scope Validation

**Implementation**: String split and comparison
**Complexity**: O(n) where n = number of scopes
**Impact**: Negligible (scopes typically 1-5)

## Monitoring and Logging

### Log Levels

**INFO**: Successful authentication and key events
```
Authenticated MCP request from 127.0.0.1: user=testuser, client=vscode-mcp-client
```

**WARNING**: Authentication failures and missing tokens
```
Authentication failed from 127.0.0.1: Invalid token: signature verification failed
```

**ERROR**: System errors (JWKS fetch failures, etc.)
```
Failed to fetch JWKS: Connection refused
```

**DEBUG**: Detailed validation steps (disabled in production)
```
Token found in cache
Fetched JWKS from http://keycloak:8080/realms/mcp-gateway/protocol/openid-connect/certs
```

### Metrics to Monitor

1. **Authentication Success Rate**: Successful / Total auth attempts
2. **Token Cache Hit Rate**: Cache hits / Total validations
3. **JWKS Fetch Failures**: Count of JWKS fetch errors
4. **Average Token Validation Time**: Time to validate token
5. **401 Error Rate**: Unauthorized requests / Total requests

## Configuration Reference

### Environment Variables

```bash
# Authentication
AUTH_ENABLED=true                    # Enable/disable authentication
KEYCLOAK_URL=http://localhost:8080   # Keycloak base URL
KEYCLOAK_REALM=mcp-gateway           # Keycloak realm name
JWKS_URL=http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/certs
JWT_ALGORITHM=RS256                  # Signature algorithm
JWT_AUDIENCE=mcp-gateway-client      # Expected audience (optional for public clients)
TOKEN_CACHE_TTL=300                  # Token cache TTL in seconds

# MCP OAuth2
MCP_AUTH_ENABLED=false               # Token introspection (for confidential clients)
MCP_RESOURCE_SERVER_URL=http://localhost:8000/mcp
MCP_REQUIRED_SCOPES=mcp:tools        # Space-separated required scopes
```

### Keycloak Client Configuration

```yaml
Client ID: vscode-mcp-client
Client Type: Public
Standard Flow: Enabled
Direct Access Grants: Disabled
Redirect URIs: http://127.0.0.1:*
PKCE: Required (automatic for public clients)
Scopes: openid, profile, email, mcp:tools
```

## Testing

### Manual Testing

1. **Test OAuth Discovery**:
```bash
curl http://localhost:8000/.well-known/oauth-protected-resource
```

2. **Test Token Validation** (with valid token):
```bash
curl -X POST http://localhost:8000/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

3. **Test Without Token** (should return 401):
```bash
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Automated Testing

See `tests/test_mcp_implementation.py` for integration tests.

## Future Enhancements

1. **Token Refresh**: Automatic token refresh before expiration
2. **Fine-Grained Scopes**: Per-tool and per-resource scopes
3. **Rate Limiting**: Per-user and per-client rate limits
4. **Audit Logging**: Detailed access logs for compliance
5. **Multi-Tenancy**: Support for multiple realms/tenants
6. **Dynamic Client Registration**: RFC 7591 support

## References

- [MCP Specification - Authorization](https://modelcontextprotocol.io/docs/tutorials/security/authorization)
- [RFC 6749 - OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749)
- [RFC 7636 - PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 6750 - Bearer Token Usage](https://datatracker.ietf.org/doc/html/rfc6750)
- [RFC 8707 - Resource Metadata](https://datatracker.ietf.org/doc/html/rfc8707)
- [RFC 8414 - Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)

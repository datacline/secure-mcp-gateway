# MCP Gateway Server

FastAPI-based gateway server for proxying and managing access to Model Context Protocol (MCP) servers.

## Architecture

```
AI Agent (with JWT/OAuth2) → Gateway (Auth + Audit) → Pre-built MCP Server → Tools
```

The gateway is a **pure proxy** - MCP servers are pre-built and registered with the gateway for secure access.

## Project Structure

```
server/
├── main.py                    # FastAPI application entry point
├── models.py                  # Pydantic data models
├── config.py                  # Configuration management
├── auth/                      # Authentication modules
│   ├── jwt_auth.py            # JWT authentication & validation
│   └── mcp_auth.py            # OAuth2 token introspection
├── routes/
│   ├── mcp.py                 # Legacy REST API endpoints
│   ├── mcp_standard.py        # Standard MCP protocol (Claude Desktop)
│   ├── mcp_protocol.py        # MCP JSON-RPC endpoint
│   └── oauth_proxy.py         # OAuth2 discovery endpoints
├── audit/
│   └── logger.py              # Structured audit logging
├── mcp_proxy.py               # MCP server proxy engine
├── mcp_client.py              # MCP client for server communication
├── mcp_aggregator.py          # Tool aggregation across servers
└── db.py                      # Database layer (SQLAlchemy)
```

## API Endpoints

All endpoints require `Authorization: Bearer <token>` header when authentication is enabled.

### MCP Proxy Endpoints

#### List Tools
```http
GET /mcp/list-tools?mcp_server={server_name}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "mcp_server": "prod-server",
  "tools": [
    {
      "name": "sqlite_reader",
      "description": "Query SQLite databases"
    }
  ],
  "count": 1
}
```

#### Invoke Tool
```http
POST /mcp/invoke?mcp_server={server_name}
Authorization: Bearer <token>
Content-Type: application/json

{
  "tool_name": "sqlite_reader",
  "parameters": {
    "database": "data.db",
    "query": "SELECT * FROM users"
  }
}
```

**Response:**
```json
{
  "success": true,
  "tool_name": "sqlite_reader",
  "mcp_server": "prod-server",
  "result": {
    "rows": [...],
    "count": 10
  },
  "execution_time_ms": 45
}
```

#### Invoke Tool (Broadcast)
```http
POST /mcp/invoke-broadcast
Authorization: Bearer <token>
Content-Type: application/json

{
  "tool_name": "get_logs",
  "parameters": {
    "query": "campaign failure",
    "timeframe": "24h"
  },
  "tags": ["elk-logs"],           // Optional: filter by tags
  "mcp_servers": ["server1", "server2"]  // Optional: specific servers
}
```

**Response:**
```json
{
  "tool_name": "get_logs",
  "total_servers": 3,
  "successful": 3,
  "failed": 0,
  "execution_time_ms": 1250,
  "results": {
    "campaign-cluster-node1": {
      "logs": [
        {"timestamp": "2024-01-15T10:30:00Z", "message": "Campaign failed", "level": "error"}
      ]
    },
    "event-cluster-node1": {
      "logs": [
        {"timestamp": "2024-01-15T10:29:50Z", "message": "Event service timeout", "level": "error"}
      ]
    }
  },
  "errors": {}
}
```

#### List Servers
```http
GET /mcp/servers
Authorization: Bearer <token>
```

#### Get Server Info
```http
GET /mcp/server/{server_name}/info
Authorization: Bearer <token>
```

### Standard MCP Protocol Endpoints

The gateway implements standard MCP protocol endpoints compatible with Claude Desktop and Cursor:

#### `GET /tools`
Lists all tools aggregated from backend servers.

**Response:**
```json
{
  "tools": [
    {
      "name": "search_logs",
      "description": "Execute 'search_logs' tool across multiple backend servers...",
      "inputSchema": {
        "type": "object",
        "properties": {},
        "additionalProperties": true
      }
    }
  ]
}
```

#### `POST /tools/{tool_name}/invoke`
Invokes a tool with automatic broadcast to all servers that provide it.

**Request:**
```json
{
  "query": "error AND campaign",
  "timeframe": "1h"
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Successfully executed 'search_logs' on 2/2 servers"
    },
    {
      "type": "resource",
      "resource": {
        "uri": "gateway://results/search_logs",
        "mimeType": "application/json",
        "text": "{\"results\": {...}, \"metadata\": {...}}"
      }
    }
  ],
  "isError": false
}
```

### System Endpoints

- `GET /` - API information
- `GET /health` - Health check
- `GET /config` - Configuration info

## Configuration

### Environment Variables

See `.env.example` in the project root for all configuration options:

```bash
# Authentication
AUTH_ENABLED=true
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=mcp-gateway
JWT_ALGORITHM=RS256

# OAuth2 for MCP Clients
MCP_AUTH_ENABLED=true
MCP_OAUTH_CLIENT_ID=tes-mcp-client
MCP_OAUTH_CLIENT_SECRET=your_secret_here
MCP_RESOURCE_SERVER_URL=http://localhost:8000/mcp

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/mcp_gateway

# Audit
AUDIT_LOG_FILE=audit.json
AUDIT_TO_STDOUT=true
```

### MCP Servers Configuration

Edit `mcp_servers.yaml` in the project root to configure MCP servers.

#### Basic Configuration

```yaml
servers:
  # Server without authentication
  prod-server:
    url: https://mcp.production.example.com
    type: http
    timeout: 60
    enabled: true
    description: "Production MCP server"
    auth: null

  # API Key authentication
  salesforce-prod:
    url: https://mcp.salesforce.example.com
    type: http
    timeout: 60
    enabled: true
    description: "Salesforce MCP server"
    auth:
      method: api_key
      location: header
      name: X-API-Key
      format: raw
      credential_ref: env://SALESFORCE_API_KEY

  # Bearer token authentication
  internal-api:
    url: https://api.internal.example.com
    type: http
    timeout: 30
    enabled: true
    description: "Internal API MCP server"
    auth:
      method: bearer
      location: header
      name: Authorization
      format: prefix
      prefix: "Bearer "
      credential_ref: env://INTERNAL_API_TOKEN
```

#### Authentication Options

**Credential References:**
- `env://VAR_NAME` - Read from environment variable
- `file:///path/to/file` - Read from file (first line, trimmed)
- `vault://path/to/secret` - Read from HashiCorp Vault (future feature)

**Authentication Methods:**
- `api_key` - API key authentication
- `bearer` - Bearer token authentication
- `basic` - Basic authentication (Base64 encoded)
- `oauth2` - OAuth2 token authentication
- `custom` - Custom authentication format
- `none` - No authentication

**Locations:**
- `header` - Add to request headers (most common)
- `query` - Add to query parameters
- `body` - Add to request body (JSON)

**Formats:**
- `raw` - Use credential as-is
- `prefix` - Add a prefix (e.g., "Bearer ", "ApiKey ")
- `template` - Use a template string with `{credential}` placeholder

## Broadcast Tools and Patterns

The gateway automatically creates **broadcast tools** for querying multiple MCP servers simultaneously.

### How Broadcast Tools Work

When a tool exists on **multiple servers**, the gateway automatically generates:

**1. Tool-Based Broadcast** (`broadcast__<tool_name>`):
```
If "search_logs" exists on: prod-elk-1, prod-elk-2, staging-elk
Gateway creates: broadcast__search_logs (queries all 3 servers)
```

**2. Tag-Based Broadcast** (`broadcast__by_tag__<tag>`):
```
Servers tagged with "logging": prod-elk-1, prod-elk-2, staging-elk
Gateway creates: broadcast__by_tag__logging
```

### Example Configuration

```yaml
servers:
  prod-elk-1:
    url: https://elk-prod-1.example.com
    type: http
    timeout: 60
    enabled: true
    tags:
      - logging
      - production
      - elk-cluster
    auth:
      method: bearer
      location: header
      name: Authorization
      format: prefix
      prefix: "Bearer "
      credential_ref: env://ELK_API_TOKEN

  prod-elk-2:
    url: https://elk-prod-2.example.com
    type: http
    timeout: 60
    enabled: true
    tags:
      - logging
      - production
      - elk-cluster
    auth:
      method: bearer
      location: header
      name: Authorization
      format: prefix
      prefix: "Bearer "
      credential_ref: env://ELK_API_TOKEN
```

This automatically creates:
- `broadcast__search_logs` - Query all ELK servers
- `broadcast__by_tag__logging` - Execute any tool across logging servers
- `broadcast__by_tag__production` - Execute any tool across production servers
- `broadcast__by_tag__elk_cluster` - Execute any tool across ELK cluster

### Best Practices for Tagging

**1. Use Consistent Tags**
```yaml
# Good
tags: ["logging", "production", "us-west"]

# Bad
tags: ["logs", "prod"]  # inconsistent
```

**2. Group by Function and Environment**
```yaml
tags:
  - "database"      # Function
  - "production"    # Environment
  - "postgres"      # Technology
  - "us-west-1"     # Region
```

**3. Separate Environments**
```yaml
# Production
tags: ["logging", "production"]

# Staging
tags: ["logging", "staging"]
```

## Standard MCP Integration

The gateway implements the **standard Model Context Protocol (MCP)**, making it compatible with AI agents like **Claude Desktop** and **Cursor**.

### How It Works

1. **Gateway as MCP Server**: The gateway exposes standard MCP endpoints
2. **Tool Aggregation**: Tools from all backend servers are aggregated by name
3. **Automatic Broadcast**: When a tool exists on multiple servers, the gateway automatically queries all of them
4. **Generic Results**: Raw results are returned tagged by server name - the AI agent handles semantic filtering

### Configure Claude Desktop

Create or update `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "enterprise-gateway": {
      "url": "http://localhost:8000",
      "transport": "http"
    }
  }
}
```

Then restart Claude Desktop. The gateway's tools will appear in Claude's tool list.

### Configure Cursor

Add to your Cursor MCP settings:

```json
{
  "mcp": {
    "servers": {
      "enterprise-gateway": {
        "url": "http://localhost:8000",
        "description": "Enterprise MCP Gateway",
        "enabled": true
      }
    }
  }
}
```

### Example: Real-World Usage

**Configuration:**
```yaml
servers:
  elasticsearch-campaign-us:
    url: https://elk-campaign-us.example.com
    type: elasticsearch-mcp
    tools: ["search_logs", "get_indices", "query_data"]
    metadata:
      description: "Campaign marketing data - US region"

  elasticsearch-events:
    url: https://elk-events.example.com
    type: elasticsearch-mcp
    tools: ["search_logs", "get_indices", "query_data"]
    metadata:
      description: "User event tracking and service logs"
```

**User asks Claude**:
> "Are there any event service errors that led to campaign failure in the last hour?"

**Claude automatically**:
1. Calls `search_logs` with query parameters
2. Gateway broadcasts to both Elasticsearch clusters
3. Claude receives results from both clusters
4. Claude analyzes temporal correlation and responds with intelligent analysis

## Authentication

The gateway supports two authentication methods:

### 1. OAuth2 for MCP Clients

For interactive MCP clients (VS Code, Claude Desktop) that support OAuth2.

**Setup:**

1. Enable OAuth authentication in `.env`:
   ```bash
   MCP_AUTH_ENABLED=true
   MCP_OAUTH_CLIENT_ID=tes-mcp-client
   MCP_OAUTH_CLIENT_SECRET=your_secret_here
   MCP_RESOURCE_SERVER_URL=http://localhost:8000/mcp
   ```

2. Configure Keycloak client for your MCP client

3. Restart gateway:
   ```bash
   docker-compose restart mcp-gateway
   ```

**OAuth Discovery Endpoints:**
- `GET /.well-known/oauth-authorization-server` - Authorization server metadata (RFC 8414)
- `GET /.well-known/oauth-protected-resource` - Protected resource metadata (RFC 8707)
- `GET /.well-known/openid-configuration` - OpenID Connect discovery

See [../docs/OAUTH2_SETUP.md](../docs/OAUTH2_SETUP.md) for complete configuration.

### 2. JWT Tokens for API Access

For programmatic access via REST API or CLI.

**With Keycloak:**
```bash
# Get token from Keycloak
TOKEN=$(curl -X POST "http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser" \
  -d "password=testpass" \
  -d "grant_type=password" \
  -d "client_id=mcp-gateway-client" \
  | jq -r '.access_token')

# Use token
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/mcp/servers
```

**Development (No Auth):**
```bash
# Disable authentication in .env
AUTH_ENABLED=false
MCP_AUTH_ENABLED=false

# Restart services
docker-compose restart mcp-gateway
```

## Audit Logging

All operations are logged in structured JSON format:

```json
{
  "timestamp": "2025-01-15T10:30:45.123456Z",
  "level": "INFO",
  "logger": "audit",
  "event_type": "mcp_request",
  "user": "dev@example.com",
  "action": "invoke_tool",
  "mcp_server": "prod-server",
  "tool_name": "sqlite_reader",
  "parameters": {"database": "data.db"},
  "status": "success",
  "duration_ms": 45,
  "response_status": 200
}
```

Logs are written to:
- **File**: `audit.json` (configurable via `AUDIT_LOG_FILE`)
- **Stdout**: When `AUDIT_TO_STDOUT=true`
- **Database**: `audit_logs` table

## Popular MCP Servers Configuration

### Figma MCP Server

**1. Get Figma API Token:**
- Go to [Figma Account Settings](https://www.figma.com/settings)
- Scroll to "Personal access tokens"
- Click "Create new token"
- Copy the token

**2. Configure in `mcp_servers.yaml`:**
```yaml
servers:
  figma:
    url: "https://api.figma.com/v1"
    type: "http"
    timeout: 30
    enabled: true
    auth:
      method: "bearer"
      location: "header"
      name: "Authorization"
      format: "prefix"
      prefix: "Bearer "
      credential_ref: "env://FIGMA_API_TOKEN"
    tags:
      - "design"
      - "collaboration"
```

**3. Set Environment Variable:**
```bash
# .env
FIGMA_API_TOKEN=your_figma_token_here
```

### GitHub MCP Server

**1. Create GitHub Personal Access Token:**
- Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
- Click "Generate new token (classic)"
- Select scopes: `repo`, `read:org`, `read:user`
- Generate and copy the token

**2. Configure in `mcp_servers.yaml`:**
```yaml
servers:
  github:
    url: "https://api.github.com"
    type: "http"
    timeout: 30
    enabled: true
    auth:
      method: "bearer"
      location: "header"
      name: "Authorization"
      format: "prefix"
      prefix: "Bearer "
      credential_ref: "env://GITHUB_TOKEN"
    tags:
      - "version-control"
      - "collaboration"
```

**3. Set Environment Variable:**
```bash
# .env
GITHUB_TOKEN=ghp_your_github_token_here
```

**Common GitHub MCP Tools:**
- `list_repositories` - List user/org repositories
- `get_repository` - Get repository details
- `create_issue` - Create a new issue
- `list_pull_requests` - List PRs
- `get_file_contents` - Read file from repository

### Notion MCP Server

```yaml
servers:
  notion:
    url: "http://localhost:3001"
    type: "http"
    timeout: 30
    enabled: true
    auth:
      method: "bearer"
      location: "header"
      name: "Authorization"
      format: "prefix"
      prefix: "Bearer "
      credential_ref: "env://NOTION_API_KEY"
```

## Development

### Running Tests

```bash
pytest tests/
```

### Extending the Gateway

- **Custom authentication**: Modify `server/auth/jwt_auth.py` or `server/auth/mcp_auth.py`
- **Custom audit handlers**: Extend `server/audit/logger.py`
- **Database migration**: Update `DATABASE_URL` in `.env` (supports PostgreSQL, MySQL, SQLite)

### Adding a New MCP Server

1. Ensure the MCP server is running and accessible
2. Register it (see CLI documentation)
3. Test access:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:8000/mcp/list-tools?mcp_server=my-server"
   ```

## Security Best Practices

1. **Always enable authentication in production**
   ```bash
   AUTH_ENABLED=true
   ```

2. **Use HTTPS for MCP server URLs**
   ```yaml
   prod-server:
     url: https://mcp.example.com  # Not http://
   ```

3. **Monitor audit logs regularly**
   ```bash
   tail -f audit.json | jq 'select(.status == "denied")'
   ```

4. **Use environment variables for secrets**
   ```yaml
   auth:
     credential_ref: env://API_KEY  # Not hardcoded
   ```

5. **Enable database persistence for audit logs**
   ```bash
   DATABASE_URL=postgresql://user:pass@localhost:5432/mcp_gateway
   ```

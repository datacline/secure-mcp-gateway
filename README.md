# Secure MCP Gateway

A secure gateway for proxying and managing access to Model Context Protocol (MCP) servers with JWT authentication, RBAC policy enforcement, and comprehensive auditing capabilities.

## Overview

The Secure MCP Gateway acts as a **security and governance layer** between AI agents and MCP servers. It does not manage or execute tools itself - instead, it provides:

- **Authentication** - JWT/Keycloak token validation with JWKS
- **Authorization** - YAML-based RBAC policies with Casbin
- **Proxying** - Secure forwarding of requests to pre-built MCP servers
- **Auditing** - Structured JSON logs of all operations

## Architecture

```
AI Agent (with JWT) → Gateway (Auth + Policy + Audit) → Pre-built MCP Server → Tools
```

The gateway is a **pure proxy** - MCP servers are pre-built and registered with the gateway for secure access.

## Features

- **JWT Authentication** - Keycloak integration with JWKS validation and token caching
- **RBAC Policy Engine** - Flexible, YAML-based policies using Casbin
- **MCP Server Proxy** - Forward requests to configured MCP servers
- **Structured Audit Logging** - JSON-formatted logs to file and/or stdout
- **Container Ready** - Docker and docker-compose support
- **CLI Tool** - Easy management with `datacline` command and Makefile

## Project Structure

```
secure-mcp-gateway/
├── server/
│   ├── main.py                 # FastAPI application entry point
│   ├── models.py               # Pydantic data models
│   ├── config.py               # Configuration management
│   ├── auth.py                 # JWT authentication & validation
│   ├── mcp_proxy.py            # MCP server proxy engine
│   ├── routes/
│   │   └── mcp.py              # MCP proxy API endpoints
│   ├── policies/
│   │   └── policy_engine.py    # Casbin RBAC engine
│   ├── sandbox/
│   │   └── runner.py           # Tool execution (legacy)
│   ├── audit/
│   │   └── logger.py           # Structured audit logging
│   └── db.py                   # Database layer (SQLAlchemy)
├── cli/
│   └── datacline.py            # CLI management tool
├── policies/
│   └── policy.yaml             # RBAC policy configuration
├── examples/                   # Example configurations
├── tests/
├── Dockerfile
├── docker-compose.yml
├── mcp_servers.yaml            # MCP server registry
├── .env.example
├── requirements.txt
└── README.md
```

## Quick Start

### First Time Setup

```bash
# Clone the repository
git clone https://github.com/datacline/secure-mcp-gateway.git
cd secure-mcp-gateway

# Copy environment file
cp .env.example .env

# One command to set everything up (takes ~2 minutes first time)
make
```

This automatically:
1. Builds Docker images
2. Starts all services (Gateway, Keycloak, PostgreSQL, Mock MCP Server)
3. Configures Keycloak with realm, client, and test users
4. Verifies everything is working

Services will be available at:

| Service | URL | Credentials |
|---------|-----|-------------|
| MCP Gateway | http://localhost:8000 | Requires JWT token |
| Keycloak Admin | http://localhost:8080 | admin / admin |
| PostgreSQL | localhost:5432 | mcp_user / mcp_password |
| Mock MCP Server | http://localhost:3000 | No auth |

**Test Users** (created automatically by `make`):

| Username | Password | Purpose |
|----------|----------|---------|
| testuser | testpass | Regular user for testing |
| admin | admin123 | Admin user |

### Common Commands

**Development:**
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart a service
docker-compose restart mcp-gateway
```

**Testing:**
```bash
# Test authentication with Keycloak
make test-auth
```

**Cleanup:**
```bash
# Clean restart (removes all data)
make clean && make

# Re-configure Keycloak
make keycloak-setup
```

**Help:**
```bash
# Show all available commands
make help
```

### 2. Register a Pre-built MCP Server

```bash
# Register an MCP server without authentication
python cli/datacline.py register-mcp prod-server https://mcp.example.com

# Register with options
python cli/datacline.py register-mcp dev-server http://localhost:3000 \
  --type http \
  --timeout 30 \
  --enabled

# Register with API key authentication
python cli/datacline.py register-mcp salesforce-prod https://mcp.salesforce.example.com \
  --auth-method api_key \
  --auth-location header \
  --auth-name X-API-Key \
  --auth-format raw \
  --credential-ref env://SALESFORCE_API_KEY

# Register with Bearer token authentication
python cli/datacline.py register-mcp internal-api https://api.internal.example.com \
  --auth-method bearer \
  --auth-location header \
  --auth-name Authorization \
  --auth-format prefix \
  --auth-prefix "Bearer " \
  --credential-ref env://INTERNAL_API_TOKEN
```

This updates `mcp_servers.yaml`:

```yaml
servers:
  prod-server:
    url: https://mcp.example.com
    type: http
    timeout: 60
    enabled: true
    auth: null

  salesforce-prod:
    url: https://mcp.salesforce.example.com
    type: http
    timeout: 60
    enabled: true
    auth:
      method: api_key
      location: header
      name: X-API-Key
      format: raw
      credential_ref: env://SALESFORCE_API_KEY
```

### 3. List Available MCP Servers

```bash
python cli/datacline.py list-servers --token <your-jwt-token>
```

### 4. List Tools from an MCP Server

```bash
python cli/datacline.py list-tools prod-server --token <your-jwt-token>
```

### 5. Invoke a Tool

```bash
# With inline parameters
python cli/datacline.py invoke prod-server my_tool \
  --params '{"key": "value"}' \
  --token <your-jwt-token>

# With parameters from file
python cli/datacline.py invoke prod-server my_tool \
  --params-file params.json \
  --token <your-jwt-token>
```

### 6. Broadcast Invocation (Query Multiple Servers)

The broadcast pattern allows you to query multiple MCP servers simultaneously and aggregate results. This implements the **"broadcast and let LLM filter"** pattern where:
- The gateway calls the same tool on multiple servers concurrently
- ALL results are returned to the caller (typically an LLM like Claude)
- The LLM filters and processes results based on the user's query context

**Use cases:**
- Query logs from multiple ELK clusters (campaign-cluster, event-cluster)
- Search data across distributed systems
- Aggregate information from multiple sources

```bash
# Query all servers with "elk-logs" tag
python cli/datacline.py invoke-broadcast get_logs \
  --tags elk-logs \
  --params '{"query":"error"}' \
  --token <jwt>

# Query specific servers by name
python cli/datacline.py invoke-broadcast get_logs \
  --servers campaign-node1,event-node1,event-node2 \
  --params '{"query":"campaign failure"}' \
  --token <jwt>

# Query all enabled servers (default behavior)
python cli/datacline.py invoke-broadcast get_logs \
  --params '{"query":"service errors"}' \
  --token <jwt>

# Full output format (complete results)
python cli/datacline.py invoke-broadcast get_logs \
  --tags elk-logs \
  --format full

# JSON output for programmatic use
python cli/datacline.py invoke-broadcast get_logs \
  --tags elk-logs \
  --format json
```

**Example scenario from your diagram:**

```yaml
# mcp_servers.yaml configuration
servers:
  campaign-cluster-node1:
    url: https://elk-campaign-1.example.com
    tags: ["elk-logs", "campaign"]
    tools: ["get_logs"]

  campaign-cluster-node2:
    url: https://elk-campaign-2.example.com
    tags: ["elk-logs", "campaign"]
    tools: ["get_logs"]

  event-cluster-node1:
    url: https://elk-event-1.example.com
    tags: ["elk-logs", "events"]
    tools: ["get_logs"]
```

```bash
# AI Chat asks: "Are there any event service errors that led to campaign failure?"
# Gateway broadcasts to all elk-logs servers
python cli/datacline.py invoke-broadcast get_logs \
  --tags elk-logs \
  --params '{"query":"campaign failure OR event service error", "timeframe":"24h"}'

# Results returned:
# - campaign-cluster-node1: [campaign logs...]
# - campaign-cluster-node2: [campaign logs...]
# - event-cluster-node1: [event logs...]
#
# LLM receives ALL results and filters based on query context
```

## Standard MCP Integration

The gateway implements the **standard Model Context Protocol (MCP)**, making it compatible with AI agents like **Claude Desktop** and **Cursor**. These agents can connect to the gateway as a single MCP server and automatically discover all tools from your backend servers.

### How It Works

1. **Gateway as MCP Server**: The gateway exposes standard MCP endpoints (`GET /tools`, `POST /tools/{name}/invoke`)
2. **Tool Aggregation**: Tools from all backend servers are aggregated by name
3. **Automatic Broadcast**: When a tool exists on multiple servers, the gateway automatically queries all of them
4. **Generic Results**: Raw results are returned tagged by server name - the AI agent handles semantic filtering

### Architecture

```
Claude Desktop / Cursor
    ↓
  Connects to: http://localhost:8000 (Gateway as MCP server)
    ↓
  Discovers tools: ["search_logs", "query_metrics", ...]
    ↓
  Invokes: search_logs
    ↓
Gateway automatically broadcasts to ALL servers with "search_logs":
    ├─→ elasticsearch-campaign-us
    ├─→ elasticsearch-campaign-eu
    └─→ elasticsearch-events
    ↓
Returns aggregated results to AI agent
    ↓
Claude/Cursor filters and correlates based on user query
```

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

**Your Configuration** ([mcp_servers.yaml](mcp_servers.yaml)):
```yaml
servers:
  elasticsearch-campaign-us:
    url: https://elk-campaign-us.example.com
    type: elasticsearch-mcp
    tools: ["search_logs", "get_indices", "query_data"]
    metadata:
      description: "Campaign marketing data - US region"
      data_sources: ["marketing_campaigns", "ad_performance"]

  elasticsearch-events:
    url: https://elk-events.example.com
    type: elasticsearch-mcp
    tools: ["search_logs", "get_indices", "query_data"]
    metadata:
      description: "User event tracking and service logs"
      data_sources: ["user_events", "service_logs"]
```

**Claude Desktop discovers**:
- `search_logs` - Available across 2 servers
- `get_indices` - Available across 2 servers
- `query_data` - Available across 2 servers

**User asks Claude**:
> "Are there any event service errors that led to campaign failure in the last hour?"

**Claude automatically**:
1. Calls `search_logs` with query parameters
2. Gateway broadcasts to both Elasticsearch clusters
3. Claude receives results from both clusters
4. Claude analyzes temporal correlation: event error at 10:29:50 → campaign failure at 10:30:00
5. Claude responds with intelligent analysis

**No manual server selection required!** The gateway and Claude handle everything.

### Standard MCP Endpoints

The gateway implements these standard MCP protocol endpoints:

#### `GET /tools`
Lists all tools aggregated from backend servers.

**Response**:
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

**Request**:
```json
{
  "query": "error AND campaign",
  "timeframe": "1h"
}
```

**Response**:
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

### Benefits

✅ **Zero configuration in AI agent** - Just add gateway URL
✅ **Automatic tool discovery** - AI sees all available tools
✅ **Transparent broadcast** - No need to specify which servers to query
✅ **Smart filtering** - AI handles semantic aggregation
✅ **Standard protocol** - Works with any MCP-compatible client
✅ **Vendor agnostic** - Add any MCP server without code changes

### Example Configurations

See the [examples/](examples/) directory for complete configurations:
- [claude_desktop_config.json](examples/claude_desktop_config.json) - Claude Desktop setup
- [cursor_mcp_config.json](examples/cursor_mcp_config.json) - Cursor setup
- [mcp_servers_complete.yaml](examples/mcp_servers_complete.yaml) - Multi-vendor server configuration

## API Endpoints

All endpoints require `Authorization: Bearer <token>` header (when auth is enabled).

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
    "campaign-cluster-node2": {
      "logs": [
        {"timestamp": "2024-01-15T10:29:55Z", "message": "Campaign processing started", "level": "info"}
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

### System Endpoints

- `GET /` - API information
- `GET /health` - Health check
- `GET /config` - Configuration info

## Configuration

### Environment Variables

See [.env.example](.env.example) for all configuration options:

```bash
# Authentication
AUTH_ENABLED=true
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=mcp-gateway
JWT_ALGORITHM=RS256

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/mcp_gateway

# Policies
POLICY_FILE=policies/policy.yaml

# Audit
AUDIT_LOG_FILE=audit.json
AUDIT_TO_STDOUT=true
```

### MCP Servers Configuration

Edit `mcp_servers.yaml` to configure MCP servers:

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

  # API Key authentication (raw format)
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

  # Custom authentication with template
  custom-api:
    url: https://custom.example.com
    type: http
    timeout: 30
    enabled: true
    description: "Custom API with special auth format"
    auth:
      method: custom
      location: header
      name: X-Custom-Auth
      format: template
      template: "CustomToken {credential}"
      credential_ref: env://CUSTOM_API_TOKEN

  # File-based credential
  file-auth:
    url: https://file-based.example.com
    type: http
    timeout: 30
    enabled: true
    description: "MCP server with file-based auth"
    auth:
      method: api_key
      location: header
      name: X-API-Key
      format: raw
      credential_ref: file:///etc/secrets/api_key.txt
```

#### Authentication Configuration Options

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
```

### Policy Configuration

Define RBAC policies in `policies/policy.yaml`:

```yaml
# Role definitions
roles:
  admin:
    permissions:
      - resource: "*"
        actions: ["*"]

  developer:
    permissions:
      - resource: "mcp:dev-server:*"
        actions: ["list_tools", "invoke_tool"]

  analyst:
    permissions:
      - resource: "mcp:*:read_only_tool"
        actions: ["invoke_tool"]

# User-to-role mappings
user_roles:
  admin@example.com:
    - admin
  dev@example.com:
    - developer

# Custom rules
rules:
  - name: "Block dangerous tools in production"
    condition:
      mcp_server: "prod-server"
      tool_name_pattern: ".*delete.*|.*drop.*"
    action: deny
    priority: 100

# Default policy
default_policy: deny
```

**Resource Format:** `mcp:{server_name}:{tool_name}`

**Examples:**
- `mcp:prod-server:*` - All tools on prod-server
- `mcp:*:sqlite_reader` - sqlite_reader tool on any server
- `mcp:*:*` - All tools on all servers

## CLI Commands

```bash
# Server Management
datacline serve                           # Start gateway server
datacline serve --port 8080 --no-auth    # Start with custom settings

# MCP Server Registration
datacline register-mcp <name> <url>                    # Register MCP server
datacline register-mcp prod https://mcp.example.com    # Example (no auth)
datacline list-servers --token <jwt>                   # List registered servers

# Register MCP server with authentication
datacline register-mcp salesforce-prod https://mcp.salesforce.example.com \
  --auth-method api_key \
  --auth-location header \
  --auth-name X-API-Key \
  --auth-format raw \
  --credential-ref env://SALESFORCE_API_KEY

# Register with Bearer token
datacline register-mcp internal-api https://api.internal.example.com \
  --auth-method bearer \
  --credential-ref env://INTERNAL_API_TOKEN

# Register with custom template format
datacline register-mcp custom-api https://custom.example.com \
  --auth-method custom \
  --auth-format template \
  --auth-template "CustomToken {credential}" \
  --credential-ref env://CUSTOM_TOKEN

# MCP Operations (requires auth token)
datacline list-tools <server> --token <jwt>                      # List tools
datacline invoke <server> <tool> --params '{}' --token <jwt>    # Invoke tool
datacline invoke <server> <tool> --params-file params.json      # With file

# Broadcast invocation (query multiple servers)
datacline invoke-broadcast <tool> --tags <tags> --params '{}'   # By tags
datacline invoke-broadcast <tool> --servers <s1,s2> --params '{}' # By server names
datacline invoke-broadcast <tool> --format json                  # JSON output
```

## Authentication

### Getting a JWT Token

#### With Keycloak (Production)

```bash
# Get token from Keycloak
TOKEN=$(curl -X POST "http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=user" \
  -d "password=password" \
  -d "grant_type=password" \
  -d "client_id=mcp-gateway-client" \
  | jq -r '.access_token')

# Use token
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/mcp/servers
```

#### Development (No Auth)

```bash
# Start server without authentication
datacline serve --no-auth
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
  "policy_decision": "allowed by user permission",
  "duration_ms": 45,
  "response_status": 200
}
```

Logs are written to:
- File: `audit.json` (configurable)
- Stdout: When `AUDIT_TO_STDOUT=true`
- Database: `audit_logs` table

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

3. **Follow principle of least privilege**
   ```yaml
   # Give users only what they need
   analyst:
     permissions:
       - resource: "mcp:prod-server:read_only_tool"
         actions: ["invoke_tool"]
   ```

4. **Use deny rules for dangerous operations**
   ```yaml
   rules:
     - name: "Block destructive operations"
       condition:
         tool_name_pattern: ".*delete.*|.*drop.*|.*truncate.*"
       action: deny
       priority: 100
   ```

5. **Monitor audit logs regularly**
   ```bash
   tail -f audit.json | jq 'select(.status == "denied")'
   ```

## Development

### Running Tests

```bash
pytest tests/
```

### Adding a New MCP Server

1. Ensure the MCP server is running and accessible
2. Register it with the gateway:
   ```bash
   datacline register-mcp my-server http://localhost:3000
   ```
3. Configure policies in `policies/policy.yaml`
4. Test access:
   ```bash
   datacline list-tools my-server --token <jwt>
   ```

### Extending the Gateway

- **Custom authentication**: Modify [server/auth.py](server/auth.py)
- **Custom policies**: Edit [policies/policy.yaml](policies/policy.yaml)
- **Custom audit handlers**: Extend [server/audit/logger.py](server/audit/logger.py)
- **Database migration**: Update `DATABASE_URL` in `.env` (supports PostgreSQL, MySQL, SQLite)

## Troubleshooting

### Services Won't Start

```bash
# Check service status
docker-compose ps

# Check logs for errors
docker-compose logs -f

# Clean restart (removes all data)
make clean && make init
```

### Authentication Issues

```bash
# Check if auth is enabled
curl http://localhost:8000/config

# Re-run Keycloak setup
make keycloak-setup

# Verify Keycloak is healthy
curl http://localhost:8080

# Test authentication
make test-auth
```

### Policy Denials

```bash
# Check audit logs for policy decisions
tail -f audit.json | jq 'select(.event_type == "policy_violation")'

# Verify user roles
# Edit policies/policy.yaml and restart gateway
docker-compose restart mcp-gateway
```

### MCP Server Connection Issues

```bash
# Test MCP server directly
curl http://localhost:3000/tools

# Check server configuration
cat mcp_servers.yaml

# View gateway logs
docker-compose logs mcp-gateway
```

### Port Conflicts

If ports 8000, 8080, or 5432 are already in use, edit `docker-compose.yml`:

```yaml
ports:
  - "8001:8000"  # Change 8000 to 8001 for gateway
  - "8081:8080"  # Change 8080 to 8081 for Keycloak
```

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

See [LICENSE](LICENSE) file for details.

## Support

- Issues: [GitHub Issues](https://github.com/datacline/secure-mcp-gateway/issues)
- Documentation: This README
- Examples: See `examples/` directory

## Roadmap

- [ ] Support for gRPC MCP servers
- [ ] Rate limiting per user/server
- [ ] WebSocket support for streaming responses
- [ ] Prometheus metrics integration
- [ ] OpenTelemetry tracing
- [ ] Multi-tenancy support
- [ ] Policy approval workflows

---

**Built for secure AI agent interactions with Model Context Protocol servers**

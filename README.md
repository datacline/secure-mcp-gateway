# Secure MCP Gateway

A secure gateway for proxying and managing access to Model Context Protocol (MCP) servers with JWT/OAuth2 authentication and comprehensive auditing capabilities.

## Overview

The Secure MCP Gateway acts as a **security and governance layer** between AI agents and MCP servers:

- **Authentication** - JWT/Keycloak token validation with JWKS
- **Proxying** - Secure forwarding of requests to pre-built MCP servers
- **Auditing** - Structured JSON logs of all operations

```
AI Agent (with JWT/OAuth2) → Gateway (Auth + Audit) → Pre-built MCP Server → Tools
```

## Features

- JWT Authentication with Keycloak integration
- OAuth2 Support for MCP clients (VS Code, Claude Desktop)
- MCP Server Proxy with tool aggregation
- Structured Audit Logging
- Docker and docker-compose ready
- CLI Tool for easy management

## Project Structure

```
secure-mcp-gateway/
├── server/          # Gateway server (see server/README.md)
├── cli/             # CLI management tool (see cli/README.md)
├── frontend/        # Web UI (see frontend/README.md)
├── docs/            # Additional documentation
└── examples/        # Example configurations
```

## Quick Start

```bash
# Clone the repository
git clone https://github.com/datacline/secure-mcp-gateway.git
cd secure-mcp-gateway

# Copy environment file
cp .env.example .env

# One command to set everything up
make
```

This automatically:
1. Builds Docker images
2. Starts all services (Gateway, Keycloak, PostgreSQL, Mock MCP Server)
3. Configures Keycloak with realm, client, and test users
4. Verifies everything is working

## Services

After setup, services are available at:

| Service | URL | Credentials |
|---------|-----|-------------|
| MCP Gateway | http://localhost:8000 | Requires JWT token |
| Keycloak Admin | http://localhost:8080 | admin / admin |
| PostgreSQL | localhost:5432 | mcp_user / mcp_password |
| Frontend UI | http://localhost:5173 | testuser / testpass |

**Test Users**:

| Username | Password | Purpose |
|----------|----------|---------|
| testuser | testpass | Regular user for testing |
| admin | admin123 | Admin user |

## Common Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Test authentication
make test-auth

# Clean restart (removes all data)
make clean && make

# Show all available commands
make help
```

BROADCAST RESULTS: search_logs
Total Servers: 2
Successful: 2
Failed: 0
Execution Time: 1247ms

RESULTS BY SERVER:
--------------------------------------------------------------------------------

[prod-elk-1]
{
  "hits": 145,
  "logs": [
    {"timestamp": "2025-01-20T15:30:00Z", "message": "Auth token expired", ...},
    ...
  ]
}

[prod-elk-2]
{
  "hits": 89,
  "logs": [
    {"timestamp": "2025-01-20T15:29:50Z", "message": "Invalid credentials", ...},
    ...
  ]
}
```

**Claude Analyzes and Responds**:
> "I found 234 authentication errors across your production servers in the last hour.
> The spike started at 15:29:50 on prod-elk-2 with 'Invalid credentials' errors,
> followed by token expiration errors on prod-elk-1 at 15:30:00. This suggests
> a cascading authentication failure starting from the credential service."

#### Benefits for AI Agents

✅ **Automatic Discovery**: No need to configure broadcast tools - they're auto-generated
✅ **Intelligent Filtering**: AI agent receives all results and filters based on user intent
✅ **Concurrent Execution**: Gateway queries all servers in parallel
✅ **Error Resilience**: Failed servers don't block successful results
✅ **Context Awareness**: AI agent can correlate data across distributed systems

#### When to Use Broadcast Tools

**Use broadcast tools when**:
- Searching logs across multiple clusters
- Checking health/status across distributed databases
- Querying metrics from multiple monitoring systems
- Finding data that could be on any of several servers

**Use single-server tools when**:
- You know exactly which server has the data
- The tool is unique to one server
- You want to minimize latency and cost

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


# Audit
AUDIT_LOG_FILE=audit.json
AUDIT_TO_STDOUT=true
```

### MCP Servers Configuration

Edit `mcp_servers.yaml` to configure MCP servers. The gateway supports automatic **broadcast tool generation** for servers that share the same tools or tags.

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
```

#### Configuration for Broadcast Tools

To enable broadcast functionality, configure multiple servers with **tags** to group related servers:

```yaml
servers:
  # Production ELK Cluster - Node 1
  prod-elk-1:
    url: https://elk-prod-1.example.com
    type: http
    timeout: 60
    enabled: true
    description: "Production ELK cluster - Node 1"
    tags:
      - logging          # Tag for broadcast grouping
      - production       # Environment tag
      - elk-cluster      # System type tag
    auth:
      method: bearer
      location: header
      name: Authorization
      format: prefix
      prefix: "Bearer "
      credential_ref: env://ELK_API_TOKEN

  # Production ELK Cluster - Node 2
  prod-elk-2:
    url: https://elk-prod-2.example.com
    type: http
    timeout: 60
    enabled: true
    description: "Production ELK cluster - Node 2"
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

  # Staging ELK Server
  staging-elk:
    url: https://elk-staging.example.com
    type: http
    timeout: 60
    enabled: true
    description: "Staging ELK server"
    tags:
      - logging
      - staging
      - elk-cluster
    auth:
      method: bearer
      location: header
      name: Authorization
      format: prefix
      prefix: "Bearer "
      credential_ref: env://ELK_API_TOKEN

  # Production Database Cluster - Primary
  prod-db-primary:
    url: https://db-prod-primary.example.com
    type: http
    timeout: 30
    enabled: true
    description: "Production database - Primary"
    tags:
      - database
      - production
      - postgres
    auth:
      method: bearer
      location: header
      name: Authorization
      format: prefix
      prefix: "Bearer "
      credential_ref: env://DB_API_TOKEN

  # Production Database Cluster - Replica
  prod-db-replica:
    url: https://db-prod-replica.example.com
    type: http
    timeout: 30
    enabled: true
    description: "Production database - Replica"
    tags:
      - database
      - production
      - postgres
    auth:
      method: bearer
      location: header
      name: Authorization
      format: prefix
      prefix: "Bearer "
      credential_ref: env://DB_API_TOKEN
```

#### How Broadcast Tools Are Generated

Based on the configuration above, the gateway automatically creates:

**1. Tool-Based Broadcast** (if same tool exists on multiple servers):
```
If all ELK servers provide "search_logs" tool:
  → Gateway creates: broadcast__search_logs

If all DB servers provide "check_health" tool:
  → Gateway creates: broadcast__check_health
```

**2. Tag-Based Broadcast** (for each tag with 2+ servers):
```
Tag "logging" → broadcast__by_tag__logging
  - Servers: prod-elk-1, prod-elk-2, staging-elk

Tag "production" → broadcast__by_tag__production
  - Servers: prod-elk-1, prod-elk-2, prod-db-primary, prod-db-replica

Tag "database" → broadcast__by_tag__database
  - Servers: prod-db-primary, prod-db-replica

Tag "elk-cluster" → broadcast__by_tag__elk_cluster
  - Servers: prod-elk-1, prod-elk-2, staging-elk
```

#### AI Agent Tool Discovery

When Claude Desktop or VS Code connects to the gateway, they discover:

```
Regular Tools (single server):
  ✓ prod-elk-1__search_logs
  ✓ prod-elk-2__search_logs
  ✓ staging-elk__search_logs
  ✓ prod-db-primary__check_health
  ✓ prod-db-replica__check_health

Broadcast Tools (auto-generated):
  ✓ broadcast__search_logs              (queries all ELK servers)
  ✓ broadcast__check_health             (queries all DB servers)
  ✓ broadcast__by_tag__logging          (any tool across logging servers)
  ✓ broadcast__by_tag__production       (any tool across production servers)
  ✓ broadcast__by_tag__database         (any tool across database servers)
  ✓ broadcast__by_tag__elk_cluster      (any tool across ELK cluster)
```

#### Best Practices for Broadcast Configuration

**1. Use Consistent Tags**
```yaml
# Good - consistent tagging scheme
tags: ["logging", "production", "us-west"]
tags: ["logging", "staging", "us-east"]

# Bad - inconsistent tags
tags: ["logs", "prod"]
tags: ["logging-system", "production-env"]
```

**2. Group by Function and Environment**
```yaml
tags:
  - "database"      # Function
  - "production"    # Environment
  - "postgres"      # Technology
  - "us-west-1"     # Region
```

**3. Enable Broadcast for Distributed Systems**
```yaml
# Multi-region logging
servers:
  logs-us-west:
    tags: ["logging", "production", "us-west"]
  logs-us-east:
    tags: ["logging", "production", "us-east"]
  logs-eu-central:
    tags: ["logging", "production", "eu-central"]

# Creates: broadcast__by_tag__logging (queries all 3 regions)
```

**4. Separate Production and Non-Production**
```yaml
# Production
tags: ["logging", "production"]

# Staging
tags: ["logging", "staging"]

# Development
tags: ["logging", "development"]

# This allows AI agents to filter:
# - "Search production logs only" → uses production tag
# - "Search all logs" → uses logging tag (all environments)
```

#### Example: Complete Multi-Region Setup

```yaml
servers:
  # US West Region
  elk-us-west-1:
    url: https://elk-us-west-1.example.com
    type: http
    timeout: 60
    enabled: true
    tags: ["logging", "production", "us-west", "elk"]
    auth:
      method: bearer
      location: header
      name: Authorization
      format: prefix
      prefix: "Bearer "
      credential_ref: env://ELK_API_TOKEN

  # US East Region
  elk-us-east-1:
    url: https://elk-us-east-1.example.com
    type: http
    timeout: 60
    enabled: true
    tags: ["logging", "production", "us-east", "elk"]
    auth:
      method: bearer
      location: header
      name: Authorization
      format: prefix
      prefix: "Bearer "
      credential_ref: env://ELK_API_TOKEN

  # EU Central Region
  elk-eu-central-1:
    url: https://elk-eu-central-1.example.com
    type: http
    timeout: 60
    enabled: true
    tags: ["logging", "production", "eu-central", "elk"]
    auth:
      method: bearer
      location: header
      name: Authorization
      format: prefix
      prefix: "Bearer "
      credential_ref: env://ELK_API_TOKEN
```

**AI Agent Usage Examples:**
```
User: "Search for errors in US regions only"
Claude uses: broadcast__by_tag__us_west + broadcast__by_tag__us_east

User: "Search for errors across all production servers"
Claude uses: broadcast__by_tag__production

User: "Search logs in EU only"
Claude uses: elk-eu-central-1__search_logs (single server)
```

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

## Popular MCP Servers Configuration

### Figma MCP Server

Configure Figma MCP server for design file access and collaboration.

**1. Get Figma API Token:**
- Go to [Figma Account Settings](https://www.figma.com/settings)
- Scroll to "Personal access tokens"
- Click "Create new token"
- Copy the token (shown only once)

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

**4. Verify Connection:**

```bash
curl -X POST http://localhost:8000/mcp \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {"server": "figma"},
    "id": 1
  }'
```

### GitHub MCP Server

Configure GitHub MCP server for repository access, issues, and pull requests.

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

**4. Verify Connection:**

```bash
curl -X POST http://localhost:8000/mcp \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {"server": "github"},
    "id": 1
  }'
```

**Common GitHub MCP Tools:**
- `list_repositories` - List user/org repositories
- `get_repository` - Get repository details
- `create_issue` - Create a new issue
- `list_pull_requests` - List PRs
- `get_file_contents` - Read file from repository
## Next Steps

### Using the Gateway

- **Server Package**: See [server/README.md](server/README.md) for:
  - API endpoints documentation
  - Configuration options
  - MCP server registration
  - Broadcast tools and patterns
  - Authentication setup

- **CLI Tool**: See [cli/README.md](cli/README.md) for:
  - Command reference
  - Usage examples
  - MCP operations

- **Frontend**: See [frontend/README.md](frontend/README.md) for:
  - UI setup and usage
  - Authentication configuration

### Additional Documentation

- [docs/OAUTH2_SETUP.md](docs/OAUTH2_SETUP.md) - OAuth2 configuration for MCP clients
- [docs/CLAUDE_DESKTOP_CONFIG.md](docs/CLAUDE_DESKTOP_CONFIG.md) - Claude Desktop setup
- [examples/](examples/) - Example configurations

## Troubleshooting

### Services Won't Start

```bash
# Check service status
docker-compose ps

# Check logs
docker-compose logs -f

# Clean restart
make clean && make
```

### Authentication Issues

```bash
# Re-run Keycloak setup
make keycloak-setup

# Test authentication
make test-auth
```

### Port Conflicts

Edit `docker-compose.yml` to change ports:

```yaml
ports:
  - "8001:8000"  # Gateway
  - "8081:8080"  # Keycloak
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests if applicable
4. Submit a pull request

## License

See [LICENSE](LICENSE) file for details.

## Support

- [GitHub Issues](https://github.com/datacline/secure-mcp-gateway/issues)
- Documentation in `docs/`
- Examples in `examples/`

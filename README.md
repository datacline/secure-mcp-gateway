# Secure MCP Gateway

A secure gateway for proxying and managing access to Model Context Protocol (MCP) servers with JWT/OAuth2 authentication and comprehensive auditing capabilities.

## Overview

The Secure MCP Gateway acts as a **security and governance layer** between AI agents and MCP servers. It does not manage or execute tools itself - instead, it provides:

- **Authentication** - JWT/Keycloak token validation with JWKS
- **Proxying** - Secure forwarding of requests to pre-built MCP servers
- **Auditing** - Structured JSON logs of all operations

## Architecture

```
AI Agent (with JWT/OAuth2) → Gateway (Auth + Audit) → Pre-built MCP Server → Tools
```

The gateway is a **pure proxy** - MCP servers are pre-built and registered with the gateway for secure access.

## Features

- **JWT Authentication** - Keycloak integration with JWKS validation and token caching
- **OAuth2 Support** - Full OAuth 2.0/2.1 support for MCP clients (VS Code, Claude Desktop)
- **MCP Server Proxy** - Forward requests to configured MCP servers
- **Structured Audit Logging** - JSON-formatted logs to file and/or stdout
- **Container Ready** - Docker and docker-compose support
- **CLI Tool** - Easy management with `datacline` command and Makefile

## Project Structure

```
secure-mcp-gateway/
├── server/
│   ├── main.py                    # FastAPI application entry point
│   ├── models.py                  # Pydantic data models
│   ├── config.py                  # Configuration management
│   ├── auth/                      # Authentication modules
│   │   ├── jwt_auth.py            # JWT authentication & validation
│   │   └── mcp_auth.py            # OAuth2 token introspection
│   ├── routes/
│   │   ├── mcp.py                 # Legacy REST API endpoints
│   │   ├── mcp_standard.py        # Standard MCP protocol (Claude Desktop)
│   │   ├── mcp_protocol.py        # MCP JSON-RPC endpoint
│   │   └── oauth_proxy.py         # OAuth2 discovery endpoints
│   ├── audit/
│   │   └── logger.py              # Structured audit logging
│   ├── mcp_proxy.py               # MCP server proxy engine
│   ├── mcp_client.py              # MCP client for server communication
│   ├── mcp_aggregator.py          # Tool aggregation across servers
│   └── db.py                      # Database layer (SQLAlchemy)
├── cli/
│   └── datacline.py               # CLI management tool
├── docs/
│   ├── OAUTH2_SETUP.md            # OAuth2 configuration guide
│   ├── CLAUDE_DESKTOP_CONFIG.md   # Claude Desktop setup
│   └── MCP_PROTOCOL_IMPLEMENTATION.md  # MCP protocol details
├── examples/                      # Example configurations
├── tests/
├── Dockerfile
├── docker-compose.yml
├── mcp_servers.yaml               # MCP server registry
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

### Broadcast Tools for AI Agents

The gateway automatically creates **broadcast tools** that AI agents can use to query multiple MCP servers simultaneously. This is perfect for distributed systems where the same tool exists across multiple servers.

#### How Broadcast Tools Work

When the gateway discovers that a tool exists on **multiple servers**, it automatically generates two types of broadcast tools:

**1. Tool-Based Broadcast** (`broadcast__<tool_name>`):
```
If "search_logs" exists on: prod-elk-1, prod-elk-2, staging-elk
Gateway creates: broadcast__search_logs

AI agent sees:
  - prod-elk-1__search_logs (single server)
  - prod-elk-2__search_logs (single server)
  - staging-elk__search_logs (single server)
  - broadcast__search_logs (ALL servers) ← New!
```

**2. Tag-Based Broadcast** (`broadcast__by_tag__<tag>`):
```
Servers tagged with "logging": prod-elk-1, prod-elk-2, staging-elk
Gateway creates: broadcast__by_tag__logging

AI agent can execute ANY tool across all "logging" servers
```

#### Example: AI Agent Usage

**Configuration** ([mcp_servers.yaml](mcp_servers.yaml)):
```yaml
servers:
  prod-elk-1:
    url: https://elk-prod-1.example.com
    tags: ["logging", "production"]

  prod-elk-2:
    url: https://elk-prod-2.example.com
    tags: ["logging", "production"]

  staging-elk:
    url: https://elk-staging.example.com
    tags: ["logging", "staging"]
```

**AI Agent Discovers These Tools**:
```
Regular tools:
  - prod-elk-1__search_logs
  - prod-elk-2__search_logs
  - staging-elk__search_logs

Broadcast tools (auto-generated):
  - broadcast__search_logs          ← Queries all 3 servers
  - broadcast__by_tag__logging      ← Execute any tool across logging servers
  - broadcast__by_tag__production   ← Execute any tool across production servers
```

**User Asks Claude Desktop**:
> "Search for authentication errors across all production log servers in the last hour"

**Claude Automatically Uses**:
```json
{
  "tool": "broadcast__search_logs",
  "arguments": {
    "arguments": {
      "query": "authentication error",
      "time_range": "1h"
    },
    "servers": ["prod-elk-1", "prod-elk-2"]  // Filters to production only
  }
}
```

**Claude Receives Aggregated Results**:
```
================================================================================
BROADCAST RESULTS: search_logs
================================================================================
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
================================================================================
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

### Notion MCP Server

Already configured in the project. See [mcp_servers.yaml](mcp_servers.yaml) for the complete configuration.

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

# Register with tags for broadcast functionality
datacline register-mcp prod-elk-1 https://elk-prod-1.example.com \
  --tags "logging,production,elk-cluster" \
  --auth-method bearer \
  --credential-ref env://ELK_API_TOKEN

# Register multi-region servers with tags
datacline register-mcp elk-us-west-1 https://elk-us-west-1.example.com \
  --tags "logging,production,us-west,elk" \
  --auth-method bearer \
  --credential-ref env://ELK_API_TOKEN

datacline register-mcp elk-us-east-1 https://elk-us-east-1.example.com \
  --tags "logging,production,us-east,elk" \
  --auth-method bearer \
  --credential-ref env://ELK_API_TOKEN

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

The gateway supports two authentication methods:

### 1. OAuth2 for MCP Clients (VS Code, Claude Desktop)

For interactive MCP clients that support OAuth2, the gateway provides full OAuth 2.0/2.1 support with PKCE.

**Quick Setup:**

1. Enable OAuth authentication in `.env`:
   ```bash
   MCP_AUTH_ENABLED=true
   MCP_OAUTH_CLIENT_ID=tes-mcp-client
   MCP_OAUTH_CLIENT_SECRET=your_secret_here
   MCP_RESOURCE_SERVER_URL=http://localhost:8000/mcp
   ```

2. Configure Keycloak client for your MCP client (VS Code, etc.)

3. Restart gateway:
   ```bash
   docker-compose restart mcp-gateway
   ```

**📖 Complete guide:** See [docs/OAUTH2_SETUP.md](docs/OAUTH2_SETUP.md) for detailed configuration instructions.

**OAuth Discovery Endpoints:**
- `GET /.well-known/oauth-authorization-server` - Authorization server metadata (RFC 8414)
- `GET /.well-known/oauth-protected-resource` - Protected resource metadata (RFC 8707)
- `GET /.well-known/openid-configuration` - OpenID Connect discovery

### 2. JWT Tokens for API Access

For programmatic access via REST API or CLI:

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
4. Test access:
   ```bash
   datacline list-tools my-server --token <jwt>
   ```

### Extending the Gateway

- **Custom authentication**: Modify [server/auth.py](server/auth.py)
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

---

**Built for secure AI agent interactions with Model Context Protocol servers**

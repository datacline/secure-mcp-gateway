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

- 🔐 **JWT Authentication** - Keycloak integration with JWKS validation and token caching
- 🛡️ **RBAC Policy Engine** - Flexible, YAML-based policies using Casbin
- 🔄 **MCP Server Proxy** - Forward requests to configured MCP servers
- 📝 **Structured Audit Logging** - JSON-formatted logs to file and/or stdout
- 🐳 **Container Ready** - Docker and docker-compose support
- 🛠️ **CLI Tool** - Easy management with `datacline` command

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

## Installation

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/secure-mcp-gateway.git
cd secure-mcp-gateway

# Start the entire stack (Gateway + Keycloak + PostgreSQL + Mock MCP Server)
docker-compose up
```

The gateway will be available at `http://localhost:8000`
Keycloak admin console at `http://localhost:8080` (admin/admin)

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/secure-mcp-gateway.git
cd secure-mcp-gateway

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Start the server
python cli/datacline.py serve
```

## Quick Start

### 1. Start the Gateway

```bash
# Using CLI
python cli/datacline.py serve

# Or with options
python cli/datacline.py serve --host 0.0.0.0 --port 8000 --no-auth
```

### 2. Register a Pre-built MCP Server

```bash
# Register an MCP server
python cli/datacline.py register-mcp prod-server https://mcp.example.com

# Register with options
python cli/datacline.py register-mcp dev-server http://localhost:3000 \
  --type http \
  --timeout 30 \
  --enabled
```

This updates `mcp_servers.yaml`:

```yaml
servers:
  prod-server:
    url: https://mcp.example.com
    type: http
    timeout: 60
    enabled: true
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
  prod-server:
    url: https://mcp.production.example.com
    type: http
    timeout: 60
    enabled: true
    description: "Production MCP server"

  dev-server:
    url: http://dev-mcp.internal:3000
    type: http
    timeout: 30
    enabled: true
    description: "Development MCP server"
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
datacline register-mcp prod https://mcp.example.com    # Example
datacline list-servers --token <jwt>                   # List registered servers

# MCP Operations (requires auth token)
datacline list-tools <server> --token <jwt>                      # List tools
datacline invoke <server> <tool> --params '{}' --token <jwt>    # Invoke tool
datacline invoke <server> <tool> --params-file params.json      # With file
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

### Authentication Issues

```bash
# Check if auth is enabled
curl http://localhost:8000/config

# Test without auth
datacline serve --no-auth

# Verify Keycloak is running
curl http://localhost:8080/health
```

### Policy Denials

```bash
# Check audit logs for policy decisions
tail -f audit.json | jq 'select(.event_type == "policy_violation")'

# Verify user roles
# Edit policies/policy.yaml and restart gateway
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

- Issues: [GitHub Issues](https://github.com/yourusername/secure-mcp-gateway/issues)
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

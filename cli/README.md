# MCP Gateway CLI (datacline)

Command-line interface for managing and interacting with the Secure MCP Gateway.

## Installation

The CLI is already included in the project. No additional installation required.

## Usage

```bash
python cli/datacline.py <command> [options]
```

Or create an alias:
```bash
alias datacline="python $(pwd)/cli/datacline.py"
```

## Commands

### Server Management

#### Start Gateway Server
```bash
datacline serve
```

**Options:**
- `--port PORT` - Port to run on (default: 8000)
- `--host HOST` - Host to bind to (default: 0.0.0.0)
- `--no-auth` - Disable authentication

**Examples:**
```bash
# Start on default port (8000)
datacline serve

# Start on custom port
datacline serve --port 8080

# Start without authentication (development)
datacline serve --no-auth
```

### MCP Server Registration

#### Register MCP Server
```bash
datacline register-mcp <name> <url> [options]
```

**Options:**
- `--type TYPE` - Server type (default: http)
- `--timeout SECONDS` - Request timeout (default: 60)
- `--enabled` - Enable server immediately
- `--description TEXT` - Server description
- `--tags TAGS` - Comma-separated tags for broadcast grouping
- `--auth-method METHOD` - Authentication method (api_key, bearer, basic, oauth2, custom, none)
- `--auth-location LOCATION` - Auth location (header, query, body)
- `--auth-name NAME` - Auth header/parameter name
- `--auth-format FORMAT` - Auth format (raw, prefix, template)
- `--auth-prefix PREFIX` - Auth prefix (e.g., "Bearer ")
- `--auth-template TEMPLATE` - Auth template with {credential} placeholder
- `--credential-ref REF` - Credential reference (env://VAR, file:///path)

**Examples:**

```bash
# Register server without authentication
datacline register-mcp prod-server https://mcp.example.com

# Register with options
datacline register-mcp dev-server http://localhost:3000 \
  --type http \
  --timeout 30 \
  --enabled \
  --description "Development MCP server"

# Register with API key authentication
datacline register-mcp salesforce-prod https://mcp.salesforce.example.com \
  --auth-method api_key \
  --auth-location header \
  --auth-name X-API-Key \
  --auth-format raw \
  --credential-ref env://SALESFORCE_API_KEY

# Register with Bearer token authentication
datacline register-mcp internal-api https://api.internal.example.com \
  --auth-method bearer \
  --auth-location header \
  --auth-name Authorization \
  --auth-format prefix \
  --auth-prefix "Bearer " \
  --credential-ref env://INTERNAL_API_TOKEN

# Register with custom template format
datacline register-mcp custom-api https://custom.example.com \
  --auth-method custom \
  --auth-location header \
  --auth-name X-Custom-Auth \
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
```

### MCP Operations

All MCP operations require authentication token (unless `AUTH_ENABLED=false`).

#### List Registered Servers
```bash
datacline list-servers --token <your-jwt-token>
```

**Example:**
```bash
TOKEN=$(curl -X POST "http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser" \
  -d "password=testpass" \
  -d "grant_type=password" \
  -d "client_id=mcp-gateway-client" \
  | jq -r '.access_token')

datacline list-servers --token $TOKEN
```

#### List Tools from an MCP Server
```bash
datacline list-tools <server_name> --token <your-jwt-token>
```

**Example:**
```bash
datacline list-tools prod-server --token $TOKEN
```

#### Invoke a Tool
```bash
datacline invoke <server_name> <tool_name> --params <json> --token <your-jwt-token>
```

**Options:**
- `--params JSON` - Tool parameters as JSON string
- `--params-file FILE` - Tool parameters from JSON file
- `--token TOKEN` - JWT authentication token

**Examples:**

```bash
# With inline parameters
datacline invoke prod-server my_tool \
  --params '{"key": "value"}' \
  --token $TOKEN

# With parameters from file
datacline invoke prod-server my_tool \
  --params-file params.json \
  --token $TOKEN

# Example params.json
{
  "database": "data.db",
  "query": "SELECT * FROM users LIMIT 10"
}
```

#### Broadcast Invocation (Query Multiple Servers)

The broadcast pattern allows you to query multiple MCP servers simultaneously and aggregate results.

```bash
datacline invoke-broadcast <tool_name> [options]
```

**Options:**
- `--params JSON` - Tool parameters as JSON string
- `--params-file FILE` - Tool parameters from JSON file
- `--tags TAGS` - Comma-separated tags to filter servers
- `--servers SERVERS` - Comma-separated server names
- `--format FORMAT` - Output format (summary, full, json)
- `--token TOKEN` - JWT authentication token

**Examples:**

```bash
# Query all servers with "elk-logs" tag
datacline invoke-broadcast get_logs \
  --tags elk-logs \
  --params '{"query":"error"}' \
  --token $TOKEN

# Query specific servers by name
datacline invoke-broadcast get_logs \
  --servers campaign-node1,event-node1,event-node2 \
  --params '{"query":"campaign failure"}' \
  --token $TOKEN

# Query all enabled servers (default behavior)
datacline invoke-broadcast get_logs \
  --params '{"query":"service errors"}' \
  --token $TOKEN

# Full output format (complete results)
datacline invoke-broadcast get_logs \
  --tags elk-logs \
  --params '{"query":"error"}' \
  --format full \
  --token $TOKEN

# JSON output for programmatic use
datacline invoke-broadcast get_logs \
  --tags elk-logs \
  --params '{"query":"error"}' \
  --format json \
  --token $TOKEN
```

## Use Cases

### 1. Register Multiple MCP Servers for Distributed Systems

**Scenario**: You have multiple ELK clusters across regions and want to query them all simultaneously.

```bash
# Register US West cluster
datacline register-mcp elk-us-west-1 https://elk-us-west-1.example.com \
  --tags "logging,production,us-west,elk" \
  --auth-method bearer \
  --credential-ref env://ELK_API_TOKEN

# Register US East cluster
datacline register-mcp elk-us-east-1 https://elk-us-east-1.example.com \
  --tags "logging,production,us-east,elk" \
  --auth-method bearer \
  --credential-ref env://ELK_API_TOKEN

# Register EU Central cluster
datacline register-mcp elk-eu-central-1 https://elk-eu-central-1.example.com \
  --tags "logging,production,eu-central,elk" \
  --auth-method bearer \
  --credential-ref env://ELK_API_TOKEN

# Query all production logs
datacline invoke-broadcast search_logs \
  --tags production \
  --params '{"query":"error", "timeframe":"1h"}' \
  --token $TOKEN

# Query only US regions
datacline invoke-broadcast search_logs \
  --servers elk-us-west-1,elk-us-east-1 \
  --params '{"query":"error", "timeframe":"1h"}' \
  --token $TOKEN
```

### 2. Development Workflow

```bash
# Start gateway without auth for development
datacline serve --no-auth

# Register local development server
datacline register-mcp dev-server http://localhost:3000 \
  --description "Local development MCP server" \
  --enabled

# Test tools without authentication
datacline list-tools dev-server

# Invoke a tool
datacline invoke dev-server test_tool \
  --params '{"test": true}'
```

### 3. Production Setup with Multiple Services

```bash
# Register Salesforce MCP server
datacline register-mcp salesforce-prod https://mcp.salesforce.example.com \
  --tags "crm,production" \
  --auth-method api_key \
  --auth-name X-API-Key \
  --credential-ref env://SALESFORCE_API_KEY

# Register GitHub MCP server
datacline register-mcp github-prod https://api.github.com \
  --tags "version-control,production" \
  --auth-method bearer \
  --credential-ref env://GITHUB_TOKEN

# Register Notion MCP server
datacline register-mcp notion-prod http://localhost:3001 \
  --tags "documentation,production" \
  --auth-method bearer \
  --credential-ref env://NOTION_API_KEY

# List all registered servers
datacline list-servers --token $TOKEN
```

## Authentication

### Getting a JWT Token

```bash
# Get token from Keycloak
TOKEN=$(curl -X POST "http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser" \
  -d "password=testpass" \
  -d "grant_type=password" \
  -d "client_id=mcp-gateway-client" \
  | jq -r '.access_token')

# Use token in commands
datacline list-servers --token $TOKEN
```

### Development Mode (No Authentication)

```bash
# Set in .env
AUTH_ENABLED=false

# Restart gateway
docker-compose restart mcp-gateway

# Now commands work without --token
datacline list-servers
datacline list-tools prod-server
```

## Troubleshooting

### Command Not Found

If `datacline` command is not found:

```bash
# Use full path
python /path/to/secure-mcp-gateway/cli/datacline.py <command>

# Or create an alias
alias datacline="python /path/to/secure-mcp-gateway/cli/datacline.py"

# Add to .bashrc or .zshrc for persistence
echo 'alias datacline="python /path/to/secure-mcp-gateway/cli/datacline.py"' >> ~/.bashrc
```

### Authentication Errors

```bash
# Check if auth is enabled
curl http://localhost:8000/config

# Get a fresh token
TOKEN=$(curl -X POST "http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser" \
  -d "password=testpass" \
  -d "grant_type=password" \
  -d "client_id=mcp-gateway-client" \
  | jq -r '.access_token')

# Use the token
datacline list-servers --token $TOKEN
```

### Server Connection Issues

```bash
# Test if gateway is running
curl http://localhost:8000/health

# Check logs
docker-compose logs mcp-gateway

# Verify server is registered
cat mcp_servers.yaml
```

## Output Formats

### Summary Format (Default)
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
{...}

[prod-elk-2]
{...}
```

### JSON Format
```json
{
  "tool_name": "search_logs",
  "total_servers": 2,
  "successful": 2,
  "failed": 0,
  "execution_time_ms": 1247,
  "results": {
    "prod-elk-1": {...},
    "prod-elk-2": {...}
  },
  "errors": {}
}
```

### Full Format
Shows complete results including all metadata and details from each server.

## Tips

1. **Save your token to a variable** to avoid typing it repeatedly:
   ```bash
   TOKEN=$(curl -X POST "http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/token" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "username=testuser" \
     -d "password=testpass" \
     -d "grant_type=password" \
     -d "client_id=mcp-gateway-client" \
     | jq -r '.access_token')
   ```

2. **Use environment variables for credentials**:
   ```bash
   export SALESFORCE_API_KEY="your-key-here"
   export GITHUB_TOKEN="your-token-here"
   ```

3. **Create shell functions for common operations**:
   ```bash
   # Add to .bashrc or .zshrc
   mcp-list() {
     datacline list-servers --token $TOKEN
   }

   mcp-tools() {
     datacline list-tools "$1" --token $TOKEN
   }

   mcp-invoke() {
     datacline invoke "$1" "$2" --params "$3" --token $TOKEN
   }
   ```

4. **Use JSON files for complex parameters**:
   ```bash
   # Create params.json
   {
     "query": "error AND (status:500 OR status:502)",
     "timeframe": "24h",
     "limit": 100,
     "fields": ["timestamp", "message", "level", "service"]
   }

   # Use in command
   datacline invoke prod-server search_logs --params-file params.json --token $TOKEN
   ```

5. **Pipe output to jq for JSON processing**:
   ```bash
   datacline invoke-broadcast get_logs \
     --tags production \
     --params '{"query":"error"}' \
     --format json \
     --token $TOKEN | jq '.results | keys'
   ```

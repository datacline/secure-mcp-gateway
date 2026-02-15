# Secure MCP Gateway - Enterprise-Grade Security & Management for Model Context Protocol Servers

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-brightgreen.svg)](https://www.docker.com/)
[![MCP](https://img.shields.io/badge/MCP-2024--11--05-orange.svg)](https://modelcontextprotocol.io)
[![Java](https://img.shields.io/badge/Java-21-red.svg)](https://openjdk.org/)
[![Go](https://img.shields.io/badge/Go-1.21-blue.svg)](https://golang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

> **Production-ready security gateway for Model Context Protocol (MCP) servers** with authentication, policy-based access control, tool filtering, and comprehensive audit logging for AI agents, Claude Desktop, VS Code, and custom LLM applications.

## 🌟 What is Secure MCP Gateway?

Secure MCP Gateway is an **enterprise-grade security and management layer** for [Model Context Protocol](https://modelcontextprotocol.io) servers, enabling organizations to safely expose MCP tools to AI agents, LLMs, and users while maintaining complete control over access, permissions, and compliance.

### Why Use This Gateway?

**Without the Gateway:**
```
AI Agent → MCP Server → Unrestricted Tool Access ❌
```
- No authentication
- No authorization
- No audit trail
- No policy enforcement
- No tool filtering
- No centralized management

**With Secure MCP Gateway:**
```
AI Agent → Gateway (Auth + Policy + Audit) → Controlled MCP Access ✅
```
- ✅ **JWT/OAuth2 Authentication** - Keycloak integration
- ✅ **Policy-Based Access Control** - Fine-grained permissions per tool
- ✅ **MCP Groups** - Organize servers by team/role
- ✅ **Tool Filtering** - Restrict which tools users can access
- ✅ **Audit Logging** - Complete compliance trail
- ✅ **STDIO to HTTP Conversion** - Use any MCP server
- ✅ **Web UI** - Easy management interface
- ✅ **Multi-Tenancy** - Isolate access by user/team

## 🎯 Key Features

### 🔐 Enterprise Security
- **JWT Authentication** with JWKS validation
- **OAuth2/OIDC** integration (Keycloak, Auth0, Okta)
- **Policy Engine** for fine-grained access control
- **Role-Based Access Control (RBAC)**
- **Tool-level permissions** - Control access to individual MCP tools
- **Audit logging** to database, files, and stdout

### 🚀 MCP Server Management
- **MCP Groups** - Organize multiple servers into logical collections
- **STDIO to HTTP Conversion** - Run local MCP servers as HTTP endpoints
- **Tool Configuration** - Show/hide specific tools per group
- **Server Discovery** - Auto-detect and register MCP servers
- **Health Checks** - Monitor server availability
- **Failover Support** - Automatic retry and error handling

### 📊 Policy-Based Tool Filtering
- **Policy Precedence** - Security policies override group configurations
- **Unified Policy Format** - Supports enhanced and unified policies
- **Dynamic Filtering** - Tools filtered based on user context
- **UI Integration** - Frontend shows only policy-allowed tools
- **Mismatch Detection** - Warns when configurations violate policies

### 🎨 Management UI
- **Web Dashboard** - Manage servers, groups, and policies
- **Real-time Monitoring** - View active connections and requests
- **User Management** - Create users, assign roles
- **Policy Editor** - Visual policy creation and testing
- **Audit Viewer** - Search and analyze audit logs

### 🔧 Developer Experience
- **Docker Compose** - One-command setup
- **Hot Reload** - Development mode with auto-restart
- **API Documentation** - Comprehensive REST API docs
- **CLI Tool** - Command-line management interface
- **Examples** - Sample configurations for common use cases
- **VS Code Integration** - Use with VS Code MCP extension

## 📖 Table of Contents

- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Use Cases](#-use-cases)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [MCP Groups](#-mcp-groups)
- [Policy Management](#-policy-management)
- [API Reference](#-api-reference)
- [Client Integration](#-client-integration)
- [Security](#-security)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Git
- (Optional) Node.js 18+ for frontend development
- (Optional) Java 21+ for backend development
- (Optional) Go 1.21+ for policy engine development

### One-Command Setup

```bash
# Clone the repository
git clone https://github.com/datacline/secure-mcp-gateway.git
cd secure-mcp-gateway

# Start all services (Gateway, Keycloak, PostgreSQL, Policy Engine, Frontend)
docker-compose up -d

# Wait 30 seconds for services to initialize, then test
curl http://localhost:8000/actuator/health
```

### Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| **Gateway API** | http://localhost:8000 | JWT token required |
| **Web UI** | http://localhost:5173 | testuser / testpass |
| **Keycloak Admin** | http://localhost:8080 | admin / admin |
| **Policy Engine** | http://localhost:9000 | Internal service |

### Test with Claude Desktop

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "secure-gateway": {
      "url": "http://localhost:8000/mcp/group/1/mcp",
      "transport": {
        "type": "http"
      }
    }
  }
}
```

### Test with VS Code

Install the MCP extension and configure:

```json
{
  "mcp.servers": [
    {
      "name": "Secure Gateway",
      "url": "http://localhost:8000/mcp/group/1/mcp"
    }
  ]
}
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Secure MCP Gateway                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │   Frontend   │  │  Java Gateway│  │  Policy Engine  │   │
│  │  (React/TS)  │  │ (Spring Boot)│  │     (Go)        │   │
│  │  Port 5173   │  │  Port 8000   │  │   Port 9000     │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
│         │                  │                   │            │
│         └──────────────────┴───────────────────┘            │
│                            │                                │
│  ┌──────────────────────────┼──────────────────────────┐   │
│  │                          │                          │   │
│  │  ┌────────────────┐  ┌───┴────────────┐  ┌────────┴─┐  │
│  │  │  Keycloak      │  │  PostgreSQL    │  │  STDIO   │  │
│  │  │  (Auth)        │  │  (Database)    │  │  Proxy   │  │
│  │  │  Port 8080     │  │  Port 5432     │  │ Port 8081│  │
│  │  └────────────────┘  └────────────────┘  └──────────┘  │
│  └─────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼──────────┐
│  Group: Team1  │  │  Group: Team2  │  │  Group: Team3   │
│ /mcp/group/1/  │  │ /mcp/group/2/  │  │ /mcp/group/3/   │
│      mcp       │  │      mcp       │  │      mcp        │
└────────────────┘  └────────────────┘  └─────────────────┘
       │                   │                    │
   ┌───┴────┐         ┌────┴────┐         ┌────┴────┐
   │ GitHub │         │ Notion  │         │  AWS    │
   │ Slack  │         │ Gmail   │         │ Docker  │
   │ Jira   │         │ Drive   │         │ K8s     │
   └────────┘         └─────────┘         └─────────┘
```

### Components

- **Java Gateway** (Spring Boot) - Core proxy, authentication, MCP protocol
- **Policy Engine** (Go) - Policy evaluation, access control decisions
- **Frontend** (React/TypeScript) - Web UI for management
- **Keycloak** - Identity provider, OAuth2/OIDC
- **PostgreSQL** - Data storage (servers, groups, policies, audit logs)
- **STDIO Proxy** - Converts STDIO MCP servers to HTTP

## 💼 Use Cases

### 1. Enterprise AI Agent Platform
**Challenge**: Deploy Claude Desktop to 1,000 employees with access to internal tools (GitHub, Jira, Confluence) while ensuring:
- Only authorized users access sensitive tools
- Developers can't delete production resources
- All actions are audited for compliance

**Solution**:
```yaml
# Create groups by department
Engineering Group:
  - GitHub MCP (read/write code)
  - Jira MCP (create issues)
  - Slack MCP (send messages)

Management Group:
  - Notion MCP (view reports)
  - Calendar MCP (schedule)
  - Gmail MCP (read-only)

# Apply policies
Policy: "engineering-read-only"
  Resources: github:*
  Tools: [list_repos, get_pr, search_code]  # No delete/force-push

Policy: "management-view-only"
  Resources: notion:*
  Tools: [get_page, search_pages]  # No create/update
```

### 2. Multi-Tenant SaaS Application
**Challenge**: SaaS platform wants to offer AI assistants to customers, each with their own MCP servers and data isolation.

**Solution**:
- Create separate groups per customer
- Apply tenant-specific policies
- Isolate audit logs by tenant
- Custom gateway URLs per customer

### 3. Development Team Tool Hub
**Challenge**: 50 developers need access to 20+ MCP servers, but configuration is complex and error-prone.

**Solution**:
- One central gateway with all servers
- VS Code connects to `http://gateway/mcp/group/dev/mcp`
- Developers get auto-configured access to approved tools
- IT team manages servers centrally

### 4. Compliance & Audit Requirements
**Challenge**: Financial services company needs complete audit trail of all AI agent actions for SOC2/GDPR compliance.

**Solution**:
- All MCP tool invocations logged to database
- Audit logs include: user, timestamp, tool, arguments, result
- Export audit logs to SIEM systems
- Policy violations automatically blocked and logged

### 5. Gradual MCP Server Rollout
**Challenge**: Want to test new MCP server with beta users before company-wide release.

**Solution**:
```yaml
Beta Group (10 users):
  - New Experimental MCP Server
  - Policy: Allow all tools, log everything

Production Group (All users):
  - Stable MCP Servers only
  - Policy: Strict access control
```

## 📦 Installation

### Method 1: Docker Compose (Recommended)

```bash
# Clone repository
git clone https://github.com/datacline/secure-mcp-gateway.git
cd secure-mcp-gateway

# Configure environment (optional)
cp .env.example .env
nano .env  # Edit as needed

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f mcp-gateway-java
```

### Method 2: Individual Services

#### Java Gateway
```bash
cd server-java
./mvnw clean install
docker build -t mcp-gateway-java .
docker run -p 8000:8000 -e POLICY_ENGINE_URL=http://host.docker.internal:9000 mcp-gateway-java
```

#### Policy Engine
```bash
cd policy-engine-go
go build -o policy-engine
./policy-engine
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Method 3: Development Mode

```bash
# Terminal 1: Java Gateway
cd server-java
./mvnw spring-boot:run

# Terminal 2: Policy Engine
cd policy-engine-go
go run main.go

# Terminal 3: Frontend
cd frontend
npm run dev

# Terminal 4: Keycloak (Docker)
docker-compose up -d keycloak postgres
```

## ⚙️ Configuration

### Environment Variables

```bash
# Gateway Configuration
SERVER_PORT=8000
GATEWAY_HOST=localhost
POLICY_ENGINE_URL=http://localhost:9000

# Database
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/mcp_gateway
SPRING_DATASOURCE_USERNAME=mcp_user
SPRING_DATASOURCE_PASSWORD=mcp_password

# Authentication
AUTH_ENABLED=true
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=mcp-gateway
SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI=http://localhost:8080/realms/mcp-gateway

# MCP Servers
MCP_SERVERS_CONFIG=/app/mcp_servers.yaml
MIGRATE_YAML_TO_DB=true

# Audit Logging
AUDIT_LOG_FILE=/app/logs/audit.json
AUDIT_TO_STDOUT=true
AUDIT_TO_DATABASE=true

# External Credentials
GITHUB_MCP_PAT=your_github_token
NOTION_TOKEN=your_notion_token
```

### MCP Server Configuration

**File**: `server-java/mcp_servers.yaml`

```yaml
servers:
  - name: github
    url: https://api.github.com/mcp
    type: http
    auth_method: bearer
    credential: ${GITHUB_MCP_PAT}
    description: GitHub MCP Server

  - name: notion
    url: http://localhost:8081/mcp
    type: http
    auth_method: bearer
    credential: ${NOTION_TOKEN}
    description: Notion MCP Server

  - name: local-filesystem
    type: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/directory"]
    description: Local filesystem access
```

## 🎭 MCP Groups

MCP Groups allow you to organize multiple MCP servers into logical collections that act as a single unified endpoint.

### Creating a Group

**Via Web UI:**
1. Navigate to http://localhost:5173/mcp-servers
2. Click "Create Group"
3. Add servers and configure tools
4. Use the generated gateway URL

**Via API:**
```bash
curl -X POST http://localhost:8000/mcp/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Engineering Team",
    "description": "Development tools",
    "serverNames": ["github", "slack", "jira"]
  }'

# Response includes: gateway_url: "http://localhost:8000/mcp/group/1/mcp"
```

### Configuring Tools

Restrict which tools are exposed from each server:

```bash
curl -X PUT http://localhost:8000/mcp/groups/1/servers/github/tools \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "tools": ["create_issue", "list_repos", "get_pr"]
  }'
```

### Policy Integration

**Groups enforce policy restrictions automatically:**

```
Server has:     50 tools
Policy allows:  10 tools
Group config:   5 tools

Result:         5 tools (intersection)
```

**Formula**: `Available Tools = Server Tools ∩ Policy-Allowed ∩ Group-Configured`

See [server-java/MCP_GROUPS_COMPLETE_GUIDE.md](server-java/MCP_GROUPS_COMPLETE_GUIDE.md) for complete documentation.

## 🛡️ Policy Management

### Policy Structure

Policies use the Unified Policy format:

```json
{
  "policy_id": "engineering-github-access",
  "name": "Engineering GitHub Access",
  "description": "Allow engineers to manage code but not delete repos",
  "status": "active",
  "priority": 100,
  "policy_rules": [
    {
      "rule_id": "github-allow",
      "description": "Allow code management tools",
      "actions": [{"type": "allow"}],
      "conditions": {
        "user_roles": ["engineer", "senior-engineer"]
      }
    }
  ],
  "resources": [
    {"resource_type": "mcp_server", "resource_id": "github"},
    {"resource_type": "tool", "resource_id": "github:create_issue"},
    {"resource_type": "tool", "resource_id": "github:list_repos"},
    {"resource_type": "tool", "resource_id": "github:create_pr"},
    {"resource_type": "tool", "resource_id": "github:merge_pr"}
  ]
}
```

### Creating Policies

**Via Web UI:**
1. Navigate to Policy Engine UI (http://localhost:9000)
2. Create new unified policy
3. Add resources (servers and tools)
4. Set conditions and actions

**Via API:**
```bash
curl -X POST http://localhost:9000/api/v1/unified/policies \
  -H "Content-Type: application/json" \
  -d @policy.json
```

### Policy Precedence

1. **Active policies only** - Draft/suspended policies ignored
2. **Most restrictive wins** - Intersection of all applicable policies
3. **Policy > Group** - Policy restrictions override group configurations
4. **Fail-safe** - On error, deny all access

## 🔌 API Reference

### Group Management

```bash
# List all groups
GET /mcp/groups

# Get group by ID
GET /mcp/groups/{id}

# Create group
POST /mcp/groups
Body: {"name": "Team", "serverNames": ["github"]}

# Update group
PUT /mcp/groups/{id}
Body: {"serverNames": ["github", "slack"]}

# Delete group
DELETE /mcp/groups/{id}

# Configure tools for server in group
PUT /mcp/groups/{id}/servers/{serverName}/tools
Body: {"tools": ["create_issue", "list_repos"]}

# Get policy-allowed tools
GET /mcp/servers/{serverName}/policy-allowed-tools
```

### MCP Protocol Endpoints

```bash
# Group gateway (MCP protocol)
POST /mcp/group/{id}/mcp
Body: {"jsonrpc": "2.0", "method": "tools/list", "id": 1}

# Individual server (MCP protocol)
POST /mcp/{serverName}
Body: {"jsonrpc": "2.0", "method": "tools/list", "id": 1}
```

### Server Management

```bash
# List MCP servers
GET /mcp/servers

# Get server details
GET /mcp/servers/{name}

# Register new server
POST /mcp/servers
Body: {"name": "github", "url": "...", "type": "http"}

# Update server
PUT /mcp/servers/{name}

# Delete server
DELETE /mcp/servers/{name}

# Convert STDIO to HTTP
POST /mcp/servers/{name}/convert-to-http
```

See [server-java/README.md](server-java/README.md) for complete API documentation.

## 🖥️ Client Integration

### Claude Desktop

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "engineering-tools": {
      "url": "http://localhost:8000/mcp/group/1/mcp",
      "transport": {
        "type": "http"
      }
    }
  }
}
```

### VS Code MCP Extension

**.vscode/mcp.json**:
```json
{
  "servers": [
    {
      "name": "Secure Gateway",
      "url": "http://localhost:8000/mcp/group/1/mcp"
    }
  ]
}
```

### Custom Application

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(
  new URL("http://localhost:8000/mcp/group/1/mcp")
);

const client = new Client({
  name: "my-app",
  version: "1.0.0",
}, {
  capabilities: {}
});

await client.connect(transport);

// List available tools
const result = await client.request({
  method: "tools/list"
}, ListToolsResultSchema);

// Call a tool
const response = await client.request({
  method: "tools/call",
  params: {
    name: "create_issue",
    arguments: {
      title: "Bug report",
      body: "Description here"
    }
  }
}, CallToolResultSchema);
```

## 🔒 Security

### Authentication Flow

1. **User logs in** to Keycloak (or OAuth2 provider)
2. **Receives JWT token** with user info and roles
3. **Includes token** in requests: `Authorization: Bearer <token>`
4. **Gateway validates** token signature using JWKS
5. **Policy engine evaluates** user's permissions
6. **Request allowed/denied** based on policy

### Security Best Practices

✅ **DO**:
- Enable authentication in production (`AUTH_ENABLED=true`)
- Use HTTPS in production
- Rotate secrets regularly
- Review audit logs
- Apply least-privilege policies
- Use environment variables for secrets

❌ **DON'T**:
- Commit secrets to git
- Disable authentication in production
- Use default passwords
- Grant wildcard permissions without policies
- Expose gateway directly to internet without firewall

### Audit Logging

All tool invocations are logged with:
- **User**: Who invoked the tool
- **Timestamp**: When it was invoked
- **Tool**: Which tool was called
- **Arguments**: What parameters were passed
- **Result**: Success/failure and response
- **Duration**: How long it took

**Example audit log**:
```json
{
  "timestamp": "2026-02-14T19:30:00Z",
  "user": "john.doe",
  "action": "mcp.tool.call",
  "server": "github",
  "tool": "create_issue",
  "arguments": {
    "title": "Bug report",
    "repository": "my-repo"
  },
  "result": "success",
  "duration_ms": 234,
  "ip": "192.168.1.100"
}
```

## 🔍 Troubleshooting

### Gateway Won't Start

```bash
# Check Docker logs
docker-compose logs -f mcp-gateway-java

# Common issues:
# 1. Port 8000 already in use
docker-compose down
lsof -ti:8000 | xargs kill -9
docker-compose up -d

# 2. Database connection failed
docker-compose up -d postgres
docker-compose restart mcp-gateway-java

# 3. Policy engine not reachable
# Ensure POLICY_ENGINE_URL=http://host.docker.internal:9000
```

### Policy Filtering Not Working

```bash
# 1. Check Policy Engine connection
docker logs mcp-gateway-java | grep "Policy Engine client initialized"
# Should show: http://host.docker.internal:9000

# 2. Verify policies exist
curl http://localhost:9000/api/v1/unified/resources/mcp_server/github/policies?active=true

# 3. Check debug endpoint
curl http://localhost:8000/mcp/servers/github/tool-availability-debug?group_id=1

# 4. View gateway logs
docker logs mcp-gateway-java | grep "Policy"
```

### MCP Server Connection Failed

```bash
# 1. Test server directly
curl -X POST http://mcp-server-url/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# 2. Check authentication
# Ensure bearer token is set in mcp_servers.yaml

# 3. For STDIO servers, convert to HTTP
# Use the Web UI or:
curl -X POST http://localhost:8000/mcp/servers/my-stdio-server/convert-to-http
```

### Frontend Shows All Tools Despite Policy

```bash
# 1. Check browser console for errors
# 2. Verify frontend is calling correct endpoint
# Should be: /mcp/servers/{name}/policy-allowed-tools
# NOT: /mcp/servers/{name}/tools

# 3. Clear browser cache
# 4. Rebuild frontend
cd frontend && npm run build
```

See [server-java/TROUBLESHOOTING.md](server-java/TROUBLESHOOTING.md) for more solutions.

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup

```bash
# Fork and clone your fork
git clone https://github.com/YOUR_USERNAME/secure-mcp-gateway.git
cd secure-mcp-gateway

# Create feature branch
git checkout -b feature/amazing-feature

# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Make your changes...

# Run tests
cd server-java && ./mvnw test
cd ../policy-engine-go && go test ./...
cd ../frontend && npm test

# Commit with descriptive message
git commit -m "Add amazing feature"

# Push to your fork
git push origin feature/amazing-feature

# Open Pull Request on GitHub
```

### Code Style

- **Java**: Follow Spring Boot conventions, use Lombok
- **Go**: Use `gofmt`, follow standard Go conventions
- **TypeScript**: ESLint + Prettier (run `npm run lint`)
- **Documentation**: Update relevant README files

### Testing

- **Unit tests**: Required for new features
- **Integration tests**: For API endpoints
- **Manual testing**: Test with real MCP servers
- **Policy testing**: Verify policy enforcement works

## 📚 Documentation

- **[Server README](server-java/README.md)** - Java Gateway documentation
- **[MCP Groups Guide](server-java/MCP_GROUPS_COMPLETE_GUIDE.md)** - Complete groups workflow
- **[Policy Engine](policy-engine-go/README.md)** - Policy management
- **[Frontend](frontend/README.md)** - Web UI documentation
- **[VS Code Integration](server-java/VSCODE_INTEGRATION.md)** - VS Code setup
- **[Quick Start](server-java/QUICKSTART.md)** - Getting started guide
- **[Troubleshooting](server-java/TROUBLESHOOTING.md)** - Common issues

## 🗺️ Roadmap

### Current Version (v1.0)
- ✅ JWT/OAuth2 authentication
- ✅ MCP Groups
- ✅ Policy-based access control
- ✅ STDIO to HTTP conversion
- ✅ Web UI
- ✅ Audit logging

### Planned Features (v1.1)
- 🔄 Rate limiting per user/group
- 🔄 Caching layer for tool responses
- 🔄 Webhook support for audit events
- 🔄 Multi-region deployment
- 🔄 Grafana/Prometheus metrics
- 🔄 SAML authentication support

### Future (v2.0)
- 🔮 AI-powered policy recommendations
- 🔮 Tool usage analytics and insights
- 🔮 Custom MCP server templates
- 🔮 Marketplace for MCP servers
- 🔮 Mobile app for management

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification
- [Anthropic](https://anthropic.com) - Claude and MCP development
- [Spring Boot](https://spring.io/projects/spring-boot) - Java framework
- [Keycloak](https://www.keycloak.org) - Identity and access management
- [React](https://react.dev) - Frontend framework

## 📞 Support & Community

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/datacline/secure-mcp-gateway/issues)
- **Discussions**: [GitHub Discussions](https://github.com/datacline/secure-mcp-gateway/discussions)
- **Email**: support@datacline.com

## 🔑 Keywords

`MCP gateway`, `Model Context Protocol`, `AI agent security`, `Claude MCP`, `LLM tools`, `MCP server proxy`, `OAuth2 MCP`, `MCP authentication`, `policy-based access control`, `MCP groups`, `tool filtering`, `STDIO to HTTP`, `enterprise AI`, `MCP management`, `secure AI agents`, `AI compliance`, `MCP audit logging`, `VS Code MCP`, `Claude Desktop`, `MCP server management`, `multi-tenant MCP`, `RBAC for AI`, `AI tool governance`

---

**Made with ❤️ for the MCP community**

**Star ⭐ this repo if you find it useful!**

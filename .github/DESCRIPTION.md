# Secure MCP Gateway

**Enterprise-grade security and management for Model Context Protocol (MCP) servers**

A production-ready security gateway that provides authentication, policy-based access control, tool filtering, and audit logging for MCP servers used by AI agents, Claude Desktop, VS Code, and custom LLM applications.

## Key Features

- 🔐 JWT/OAuth2 authentication with Keycloak integration
- 🛡️ Policy-based access control with fine-grained permissions
- 🎯 MCP Groups for organizing servers by team/role
- 🔧 Tool filtering - control which MCP tools users can access
- 📊 Complete audit logging for compliance
- 🔄 STDIO to HTTP conversion for any MCP server
- 🎨 Web UI for easy management
- 🚀 Docker Compose one-command setup

## Quick Start

```bash
git clone https://github.com/datacline/secure-mcp-gateway.git
cd secure-mcp-gateway
docker-compose up -d
```

Visit http://localhost:5173 for the web UI (testuser / testpass)

## Use Cases

- **Enterprise AI Deployment** - Secure Claude Desktop for hundreds of employees
- **Multi-Tenant SaaS** - Isolate MCP server access per customer
- **Compliance** - Complete audit trail for SOC2/GDPR
- **Development Teams** - Centralized MCP server management
- **Policy Enforcement** - Control access to sensitive tools

## Documentation

- [Complete README](../README.md)
- [MCP Groups Guide](../server-java/MCP_GROUPS_COMPLETE_GUIDE.md)
- [Quick Start](../server-java/QUICKSTART.md)
- [API Reference](../server-java/README.md)

## Technologies

- Java 21 + Spring Boot (Gateway)
- Go 1.21 (Policy Engine)
- TypeScript + React (Frontend)
- PostgreSQL (Database)
- Keycloak (Authentication)
- Docker (Deployment)

## License

MIT License

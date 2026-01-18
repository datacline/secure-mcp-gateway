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

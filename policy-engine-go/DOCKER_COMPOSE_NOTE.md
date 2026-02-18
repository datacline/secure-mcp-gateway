# Docker Compose Location

⚠️ **Note:** The Policy Engine is now part of the unified docker-compose setup.

## To start the Policy Engine along with all services:

```bash
cd ../server-java
docker-compose up -d
```

This will start:
- PostgreSQL Database
- Keycloak (Authentication)
- STDIO Proxy Service
- **Policy Engine** (port 9000)
- Java MCP Gateway (port 8000)
- Mock MCP Server (port 3000)

## Standalone Usage (Legacy)

If you need to run the Policy Engine standalone for development:

```bash
# From this directory (policy-engine-go)
docker-compose up -d
```

However, note that the Java Gateway expects the Policy Engine to be available, so running standalone is only useful for:
- Policy Engine development
- Testing policy APIs independently
- Running the Policy Engine on a separate machine

## Service Communication

When running via the unified docker-compose (recommended):
- Policy Engine is accessible at `http://policy-engine:9000` (internal)
- Policy Engine is accessible at `http://localhost:9000` (from host)

## Environment Variables

The unified setup uses the same environment variables as standalone:
- `PORT`: Service port (default: 9000)
- `POLICY_DIR`: Directory containing policy files (default: /app/policies)
- `DEBUG`: Enable debug logging (default: false)

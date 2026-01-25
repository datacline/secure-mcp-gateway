# Quick Start Guide - Java/Spring Boot MCP Gateway

Get the Java MCP Gateway running in 5 minutes!

## Prerequisites Check

```bash
# Verify Java 21
java -version
# Should show: openjdk version "21.x.x"

# Verify Maven
mvn -version
# Should show: Apache Maven 3.9.x

# Verify Docker
docker --version
```

If Java 21 is not installed:

```bash
# Using SDKMAN (recommended)
curl -s "https://get.sdkman.io" | bash
sdk install java 21.0.1-tem
sdk use java 21.0.1-tem
```

## Option 1: Development Mode (Fastest)

Start the server with live reload:

```bash
cd server-java

# Copy MCP server config
cp ../mcp_servers.yaml .

# Start in dev mode
make dev
# Or: ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

**That's it!** The server is running on http://localhost:8000

### Test it:

```bash
# Health check
curl http://localhost:8000/actuator/health

# List MCP servers
curl http://localhost:8000/mcp/servers

# Actuator endpoints
open http://localhost:8000/actuator

# H2 Database Console
open http://localhost:8000/h2-console
```

## Option 2: Docker Compose (Production-like)

Run the full stack with PostgreSQL and Keycloak:

```bash
cd server-java

# Copy config
cp ../mcp_servers.yaml .

# Initialize and start everything
make init

# Or manually:
docker-compose up -d
```

**Services:**
- Gateway: http://localhost:8000
- Keycloak: http://localhost:8080 (admin/admin)
- PostgreSQL: localhost:5432

### Test it:

```bash
# Get auth token
TOKEN=$(curl -X POST "http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser" \
  -d "password=testpass" \
  -d "grant_type=password" \
  -d "client_id=mcp-gateway-client" \
  | jq -r '.access_token')

# List servers
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/mcp/servers
```

## Option 3: Production JAR

Build and run optimized JAR:

```bash
cd server-java

# Build
./mvnw clean package

# Run
java -jar target/mcp-gateway-*.jar

# Or with custom settings
java -jar target/mcp-gateway-*.jar \
  --spring.profiles.active=prod \
  --server.port=8080
```

## Basic MCP Operations

### 1. List Available Servers

```bash
curl http://localhost:8000/mcp/servers | jq
```

### 2. List Tools from a Server

```bash
curl "http://localhost:8000/mcp/list-tools?mcp_server=default" | jq
```

### 3. Invoke a Tool

```bash
curl -X POST http://localhost:8000/mcp/invoke?mcp_server=default \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "get_logs",
    "parameters": {}
  }' | jq
```

### 4. List Resources

```bash
curl "http://localhost:8000/mcp/list-resources?mcp_server=default" | jq
```

### 5. Broadcast to Multiple Servers

```bash
curl -X POST http://localhost:8000/mcp/invoke-broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "health_check",
    "parameters": {},
    "tags": ["production"]
  }' | jq
```

## Configuration

### Configure MCP Servers

Edit `mcp_servers.yaml`:

```yaml
servers:
  my-server:
    url: http://localhost:3000/mcp
    type: http
    enabled: true
    description: "My custom server"
    tags: ["dev"]
    tools: ["*"]
```

### Environment Variables

Create `.env` file:

```bash
# Server
SERVER_PORT=8000

# Database (for production)
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/mcp_gateway
SPRING_DATASOURCE_USERNAME=mcp_user
SPRING_DATASOURCE_PASSWORD=mcp_password

# Authentication
AUTH_ENABLED=false
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=mcp-gateway

# MCP Configuration
MCP_SERVERS_CONFIG=mcp_servers.yaml
```

## Common Commands

```bash
# Development
make dev              # Start dev mode
make dev-debug        # Start with debugger (port 5005)

# Building
make build            # Build application
make build-skip-tests # Build without tests

# Testing
make test             # Run tests
make test-coverage    # Run with coverage

# Docker
make docker           # Build Docker image
make docker-up        # Start all services
make docker-down      # Stop services
make docker-logs      # View logs

# Database
make db-console       # Open H2 console
make db-migrate       # Run migrations
make db-reset         # Reset database

# Monitoring
make health           # Check health
make metrics          # Show metrics
make info             # Show app info
```

## Development Workflow

### 1. Start Dev Mode

```bash
cd server-java
make dev
```

The application will:
- Start on port 8000
- Use H2 in-memory database
- Auto-reload on code changes
- Disable authentication
- Enable debug logging

### 2. Make Code Changes

Edit any Java file - the application will automatically reload!

### 3. Run Tests

```bash
# In another terminal
make test
```

### 4. Check Code Quality

```bash
make lint
make fmt
```

## Troubleshooting

### Port 8000 already in use

```bash
# Find and kill process
lsof -ti:8000 | xargs kill -9

# Or use different port
SERVER_PORT=8001 make dev
```

### Database connection error

```bash
# Reset database
make db-reset

# Or use H2 in-memory (dev profile)
SPRING_PROFILES_ACTIVE=dev make dev
```

### Authentication issues

```bash
# Disable auth for testing
AUTH_ENABLED=false make dev

# Or check Keycloak
curl http://localhost:8080
```

### Build failures

```bash
# Clean and rebuild
make clean
make build

# Update dependencies
make deps
```

## Next Steps

1. **Read the docs**: See [README.md](README.md) for detailed documentation
2. **Configure servers**: Edit `mcp_servers.yaml` to add your MCP servers
3. **Enable auth**: Set `AUTH_ENABLED=true` and configure Keycloak
4. **Deploy**: Use Docker Compose or build production JAR
5. **Monitor**: Check `/actuator` endpoints for metrics and health

## Getting Help

- Check logs: `make docker-logs`
- Health check: `curl http://localhost:8000/actuator/health`
- Metrics: `curl http://localhost:8000/actuator/metrics`
- GitHub Issues: [Report a bug](https://github.com/your-repo/issues)

## Example: Full Integration Test

```bash
# Start everything
cd server-java
make init

# Wait for services (30 seconds)
sleep 30

# Get token
TOKEN=$(curl -X POST "http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/token" \
  -d "username=admin" \
  -d "password=admin" \
  -d "grant_type=password" \
  -d "client_id=mcp-gateway-client" \
  | jq -r '.access_token')

# List servers
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/mcp/servers | jq

# List tools
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/mcp/list-tools?mcp_server=default" | jq

# Invoke tool
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/mcp/invoke?mcp_server=default \
  -H "Content-Type: application/json" \
  -d '{"tool_name": "get_logs", "parameters": {}}' | jq

# Success!
```

Ready to go! 🚀

# Secure MCP Gateway - Java/Spring Boot Implementation

A high-performance Java implementation of the Secure MCP Gateway using Spring Boot framework.

## Overview

This is a complete implementation of the Secure MCP Gateway in Java using Spring Boot with WebFlux, providing:

- 🚀 **Reactive & Non-blocking** - Built on Spring WebFlux for high concurrency
- 💾 **Efficient Resource Usage** - Optimized memory footprint
- 🔗 **High Throughput** - Handles thousands of concurrent connections
- ✅ **Production Ready** - Full Spring Boot ecosystem support
- 🔌 **MCP Protocol Compliant** - Compatible with all MCP clients

## Prerequisites

- **Java 21** (LTS) - Required
- **Maven 3.9+** - For building
- **Docker** - For containerized deployment (optional)

### Installing Java 21

#### Using SDKMAN (Recommended)
```bash
curl -s "https://get.sdkman.io" | bash
sdk install java 21.0.1-tem
sdk use java 21.0.1-tem
```

#### Using Homebrew (macOS)
```bash
brew install openjdk@21
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
```

#### Verify Java Version
```bash
java -version
# Should show: openjdk version "21.x.x"
```

## Project Structure

```
server-java/
├── src/
│   ├── main/
│   │   ├── java/com/datacline/mcpgateway/
│   │   │   ├── config/              # Configuration classes
│   │   │   ├── model/               # JPA Entity models
│   │   │   ├── repository/          # Spring Data repositories
│   │   │   ├── service/             # Business logic services
│   │   │   ├── controller/          # REST controllers
│   │   │   └── client/              # HTTP clients
│   │   └── resources/
│   │       ├── application.yaml     # Spring Boot configuration
│   │       └── db/migration/        # Flyway migrations
│   └── test/                        # Tests
├── pom.xml                          # Maven dependencies
├── docker-compose.yml               # Docker services
├── Dockerfile                       # Production Docker image
└── README.md                        # This file
```

## Quick Start

### Option 1: Development Mode (Live Reload)

```bash
cd server-java

# Start in dev mode
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# Or use the Makefile
make dev
```

The application starts on **http://localhost:8000** with:
- Live reload with Spring Boot DevTools
- H2 console at http://localhost:8000/h2-console
- Actuator endpoints at http://localhost:8000/actuator
- Auth disabled for easy testing

### Option 2: Docker Compose (Recommended)

```bash
cd server-java

# Start all services (Gateway + Keycloak + PostgreSQL)
make docker-up
# Or: docker-compose up -d

# View logs
make docker-logs
# Or: docker-compose logs -f mcp-gateway-java

# Stop services
make docker-down
# Or: docker-compose down
```

Services:
- **Gateway**: http://localhost:8000
- **Keycloak**: http://localhost:8080 (admin/admin)
- **PostgreSQL**: localhost:5432

### Option 3: Production Build

```bash
# Build JAR
./mvnw clean package

# Run JAR
java -jar target/mcp-gateway-*.jar

# Or with profile
java -jar target/mcp-gateway-*.jar --spring.profiles.active=prod
```

## Configuration

### Environment Variables

Copy and customize `.env.example`:

```bash
cp .env.example .env
```

Key variables:

```bash
# Server
SERVER_PORT=8000

# Database
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/mcp_gateway
SPRING_DATASOURCE_USERNAME=mcp_user
SPRING_DATASOURCE_PASSWORD=mcp_password

# Authentication
AUTH_ENABLED=true
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=mcp-gateway

# MCP Configuration
MCP_SERVERS_CONFIG=mcp_servers.yaml
```

### Spring Profiles

- **dev** - Development mode (H2, debug logging)
- **test** - Testing mode (in-memory H2)
- **docker** - Docker deployment (PostgreSQL, auth enabled)
- **prod** - Production mode (optimized settings)

Activate profile:
```bash
# Via environment
export SPRING_PROFILES_ACTIVE=dev

# Via command line
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# Via application properties
spring.profiles.active=dev
```

## API Endpoints

### MCP Operations

```bash
# List tools from an MCP server
GET /mcp/list-tools?mcp_server=default

# Invoke a tool
POST /mcp/invoke?mcp_server=default
{
  "tool_name": "get_logs",
  "parameters": {}
}

# List resources
GET /mcp/list-resources?mcp_server=default

# Read resource
GET /mcp/read-resource?mcp_server=default&uri=file:///path

# List prompts
GET /mcp/list-prompts?mcp_server=default

# Get prompt
GET /mcp/get-prompt?mcp_server=default&name=prompt_name

# List servers
GET /mcp/servers

# Broadcast to multiple servers
POST /mcp/invoke-broadcast
{
  "tool_name": "get_logs",
  "parameters": {},
  "mcp_servers": ["server1", "server2"],
  "tags": ["production"]
}
```

### Health & Monitoring

```bash
# Health check
GET /actuator/health

# Metrics
GET /actuator/metrics

# Prometheus metrics
GET /actuator/prometheus

# Application info
GET /actuator/info
```

## Development

### Running Tests

```bash
# Run all tests
make test
# Or: ./mvnw test

# Run with coverage
make test-coverage
# Or: ./mvnw verify jacoco:report

# Integration tests
make test-integration
# Or: ./mvnw verify
```

### Code Quality

```bash
# Format code
make fmt

# Run linters
make lint

# Check dependencies
make deps
```

### Database Management

```bash
# Access H2 console (dev mode)
make db-console
# Opens: http://localhost:8000/h2-console

# Run migrations
make db-migrate

# Reset database
make db-reset
```

## Docker Deployment

### Build Image

```bash
# Build JVM Docker image
make docker
# Or: docker build -t mcp-gateway-java:latest .

# Test the image
docker run -p 8000:8000 \
  -e SPRING_PROFILES_ACTIVE=dev \
  mcp-gateway-java:latest
```

### Docker Compose

```bash
# Start all services
make docker-up

# View logs
make docker-logs-gateway

# Stop services
make docker-down

# Clean volumes
make docker-clean
```

## Authentication

The gateway supports OAuth2/OIDC authentication via Keycloak:

### Setup Keycloak

1. Start Keycloak: `make docker-up`
2. Access: http://localhost:8080
3. Login: admin/admin
4. Configure realm: `mcp-gateway`

### Enable Authentication

```bash
# Via environment
export AUTH_ENABLED=true
export KEYCLOAK_URL=http://localhost:8080
export KEYCLOAK_REALM=mcp-gateway

# Via Spring profile
SPRING_PROFILES_ACTIVE=docker
```

### Obtain Token

```bash
# Get access token
TOKEN=$(curl -X POST \
  http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/token \
  -d "client_id=mcp-gateway-client" \
  -d "grant_type=password" \
  -d "username=user" \
  -d "password=password" \
  | jq -r .access_token)

# Use token
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/mcp/list-tools?mcp_server=default
```

## MCP Server Configuration

Edit `mcp_servers.yaml` to configure MCP servers:

```yaml
servers:
  my-server:
    url: http://localhost:3000/mcp
    type: http
    timeout: 60
    enabled: true
    description: "My custom MCP server"
    tags: ["production", "critical"]
    tools: ["*"]  # All tools
    auth:
      method: bearer
      location: header
      name: Authorization
      format: prefix
      prefix: "Bearer "
      credential_ref: env://MY_SERVER_TOKEN
```

### Credential References

- `env://VAR_NAME` - Environment variable
- `file:///path/to/file` - File content
- `vault://path` - Vault integration (coming soon)

## Performance Tuning

### JVM Options

```bash
# Production settings
export JAVA_OPTS="-Xmx512m -Xms256m -XX:+UseG1GC"

# High throughput
export JAVA_OPTS="-Xmx1g -Xms1g -XX:+UseParallelGC"

# Low latency
export JAVA_OPTS="-Xmx512m -Xms512m -XX:+UseZGC"
```

### Spring Boot Settings

```yaml
# Connection pool
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5

# WebFlux
spring:
  webflux:
    max-in-memory-size: 10MB
```

## Troubleshooting

### Application won't start

```bash
# Check Java version
java -version

# Clean and rebuild
make clean
make build

# Check logs
make docker-logs-gateway
```

### Database connection issues

```bash
# Verify PostgreSQL is running
docker ps | grep postgres

# Check connection
psql -h localhost -U mcp_user -d mcp_gateway

# Reset database
make db-reset
```

### Authentication issues

```bash
# Check Keycloak is running
curl http://localhost:8080

# Verify realm configuration
# Visit: http://localhost:8080/admin

# Disable auth for testing
export AUTH_ENABLED=false
```

## Makefile Commands

```bash
make help              # Show all commands
make dev              # Start in dev mode
make dev-debug        # Start with debugger
make build            # Build application
make test             # Run tests
make docker           # Build Docker image
make docker-up        # Start all services
make docker-down      # Stop services
make docker-logs      # View logs
make health           # Check health
make metrics          # Show metrics
make info             # Show app info
```

## Migration from Python Version

The Java implementation is 100% API compatible with the Python version. Simply:

1. Update client configuration to point to Java gateway
2. Use same MCP server configuration files
3. Same authentication mechanism (Keycloak)
4. Same API endpoints and responses

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## License

See [LICENSE](../LICENSE) for details.

## Resources

- [Spring Boot Documentation](https://spring.io/projects/spring-boot)
- [Spring WebFlux Guide](https://docs.spring.io/spring-framework/reference/web/webflux.html)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Project Documentation](../docs/)

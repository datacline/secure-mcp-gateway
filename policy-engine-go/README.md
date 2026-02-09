## Policy Engine (Go)

A high-performance policy evaluation engine written in Go for the MCP Gateway. Evaluates access control, data protection, and compliance policies in real-time.

### 🎯 NEW: Modular Architecture

The Policy Engine now supports **multiple deployment modes** with a modular, service-oriented architecture:

- ✅ **Combined Mode** - All-in-one deployment (default)
- ✅ **Evaluation Mode** - High-throughput, read-only evaluation service
- ✅ **Management Mode** - CRUD-only administrative service
- ✅ **Split Mode** - Separate evaluation and management services

**📖 Documentation**:
- **[START HERE](START_HERE.md)** - Quick start guide for all modes
- **[ARCHITECTURE](ARCHITECTURE.md)** - Complete architecture overview
- **[DEPLOYMENT_GUIDE](DEPLOYMENT_GUIDE.md)** - Step-by-step deployment instructions
- **[FINAL_SUMMARY](FINAL_SUMMARY.md)** - Complete reorganization summary

**💡 Quick Comparison**:

| Mode | Use Case | Command |
|------|----------|---------|
| Combined | Development, small deployments | `docker-compose up -d` |
| Evaluation | High-traffic production (scalable) | `make docker-run-evaluation` |
| Management | Admin control plane | `make docker-run-management` |
| Split | Production, multi-region | `make docker-run-split` |

## Features

- ✅ **Fast & Lightweight** - Built in Go for maximum performance
- ✅ **Flexible Policy Language** - YAML-based policy definitions
- ✅ **Multiple Condition Types** - User, time, resource, rate, data, and tool conditions
- ✅ **Rich Operators** - Equality, comparison, regex matching, contains, and more
- ✅ **Action Types** - Allow, deny, redact, rate limit, require approval, modify, log only
- ✅ **Priority-based Evaluation** - Rules evaluated by priority
- ✅ **Audit Mode** - Non-blocking policy evaluation for testing
- ✅ **Hot Reload** - Reload policies without restarting
- ✅ **REST API** - Simple HTTP API for integration
- ✅ **Docker Ready** - Containerized deployment

## Quick Start

### Using Docker Compose

```bash
# Start the policy engine
docker-compose up -d

# Check health
curl http://localhost:9000/health

# Evaluate a policy
curl -X POST http://localhost:9000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "user": "john.doe",
    "tool": "delete_database",
    "resource": "production_db"
  }'
```

### Local Development

```bash
# Install dependencies
go mod download

# Run the server
go run cmd/server/main.go

# Or build and run
go build -o policy-engine cmd/server/main.go
./policy-engine
```

## Architecture

```
┌─────────────────┐
│  MCP Gateway    │
│   (Java/Python) │
└────────┬────────┘
         │ HTTP
         ↓
┌─────────────────┐
│ Policy Engine   │
│    (Go)         │
├─────────────────┤
│ • Evaluator     │
│ • Rule Matcher  │
│ • Policy Loader │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Policy Files    │
│   (YAML)        │
└─────────────────┘
```

## Policy Schema

### Policy Structure

```yaml
id: my-policy
name: My Policy
description: Policy description
version: 1
enabled: true
enforcement: blocking  # or audit_only

rules:
  - id: rule-1
    description: Rule description
    priority: 100
    conditions:
      - type: user
        operator: eq
        field: ""
        value: "admin"
    actions:
      - type: allow
```

### Condition Types

- **user** - User-based conditions (username, roles, groups)
- **time** - Time-based conditions (hour, day, date)
- **resource** - Resource-based conditions (resource name, type)
- **tool** - Tool-based conditions (tool name, category)
- **data** - Data-based conditions (request parameters, payload)
- **rate** - Rate-based conditions (request count, frequency)

### Operators

- **eq** - Equal to
- **neq** - Not equal to
- **in** - In list
- **not_in** - Not in list
- **gt** - Greater than
- **lt** - Less than
- **gte** - Greater than or equal
- **lte** - Less than or equal
- **matches** - Regex pattern match
- **contains** - String contains

### Actions

- **allow** - Allow the request
- **deny** - Block the request
- **require_approval** - Require manual approval
- **redact** - Redact sensitive data from response
- **rate_limit** - Apply rate limiting
- **log_only** - Log but don't block
- **modify** - Modify request parameters

## API Endpoints

### POST /api/v1/evaluate

Evaluate a single request against policies.

**Request:**
```json
{
  "user": "john.doe",
  "tool": "search_database",
  "resource": "customer_data",
  "parameters": {
    "query": "SELECT * FROM customers"
  },
  "context": {
    "ip_address": "192.168.1.100",
    "session_id": "abc123"
  }
}
```

**Response:**
```json
{
  "policy_id": "data-access-policy",
  "matched": true,
  "matched_rules": ["rule-1", "rule-2"],
  "action": "allow",
  "should_block": false,
  "message": "",
  "timestamp": "2026-01-26T06:00:00Z"
}
```

### POST /api/v1/evaluate/batch

Evaluate multiple requests in a single call.

**Request:**
```json
{
  "requests": [
    {
      "user": "john",
      "tool": "tool1"
    },
    {
      "user": "jane",
      "tool": "tool2"
    }
  ]
}
```

**Response:**
```json
{
  "results": [
    {
      "matched": true,
      "action": "allow",
      ...
    },
    {
      "matched": true,
      "action": "deny",
      ...
    }
  ]
}
```

### POST /api/v1/reload

Reload policies from disk without restarting.

**Response:**
```json
{
  "status": "reloaded",
  "count": 5
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "policy-engine"
}
```

## Example Policies

### 1. Deny Sensitive Tools

```yaml
id: deny-sensitive-tools
name: Deny Sensitive Tool Access
rules:
  - id: block-admin-tools
    priority: 200
    conditions:
      - type: user
        operator: not_in
        field: ""
        value: ["admin", "root"]
      - type: tool
        operator: in
        field: ""
        value: ["delete_database", "shutdown_system"]
    actions:
      - type: deny
        params:
          message: "Admin privileges required"
```

### 2. Redact Sensitive Data

```yaml
id: redact-pii
name: Redact Personal Information
rules:
  - id: redact-ssn
    priority: 100
    conditions:
      - type: data
        operator: contains
        field: response
        value: "ssn"
    actions:
      - type: redact
        params:
          fields: ["ssn", "social_security_number"]
```

### 3. Rate Limiting

```yaml
id: rate-limit
name: Rate Limiting
rules:
  - id: limit-expensive-tools
    priority: 100
    conditions:
      - type: tool
        operator: in
        field: ""
        value: ["search_large_dataset", "run_analysis"]
    actions:
      - type: rate_limit
        params:
          limit: 10
          window: 3600
```

### 4. Time-based Access

```yaml
id: business-hours
name: Business Hours Only
rules:
  - id: after-hours-block
    priority: 150
    conditions:
      - type: time
        operator: gt
        field: hour
        value: 18
      - type: tool
        operator: matches
        field: ""
        value: ".*_pii$"
    actions:
      - type: deny
        params:
          message: "PII access restricted outside business hours"
```

## Integration with MCP Gateway

### Java Integration

Add to your `pom.xml`:
```xml
<dependency>
    <groupId>com.squareup.okhttp3</groupId>
    <artifactId>okhttp</artifactId>
</dependency>
```

Example usage:
```java
// Call policy engine before executing tool
PolicyRequest request = new PolicyRequest(username, toolName, resource);
PolicyResult result = policyEngineClient.evaluate(request);

if (result.shouldBlock()) {
    throw new PolicyViolationException(result.getMessage());
}

// Proceed with tool execution
```

### Python Integration

```python
import httpx

# Evaluate policy
response = httpx.post("http://policy-engine:9000/api/v1/evaluate", json={
    "user": username,
    "tool": tool_name,
    "resource": resource
})

result = response.json()
if result["should_block"]:
    raise PolicyViolationError(result["message"])
```

## Configuration

### Environment Variables

- `PORT` - Server port (default: 9000)
- `POLICY_DIR` - Policy directory (default: /app/policies)
- `DEBUG` - Enable debug logging (default: false)

### Docker Volumes

Mount your policy files:
```yaml
volumes:
  - ./custom-policies:/app/policies:ro
```

## Development

### Build

```bash
# Build binary
go build -o policy-engine cmd/server/main.go

# Build Docker image
docker build -t policy-engine:latest .
```

### Test

```bash
# Run tests
go test ./...

# Test with coverage
go test -cover ./...
```

### Lint

```bash
# Install golangci-lint
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Run linter
golangci-lint run
```

## Performance

- **Latency**: < 5ms per evaluation (typical)
- **Throughput**: > 10,000 evaluations/second
- **Memory**: < 50MB typical usage
- **Startup**: < 1 second

## Deployment

### Standalone

```bash
docker run -d \
  -p 9000:9000 \
  -v $(pwd)/policies:/app/policies:ro \
  policy-engine:latest
```

### With MCP Gateway

Update `docker-compose.yml` in the gateway:

```yaml
services:
  policy-engine:
    build: ./policy-engine-go
    ports:
      - "9000:9000"
    volumes:
      - ./policies:/app/policies:ro

  mcp-gateway-java:
    environment:
      POLICY_ENGINE_URL: http://policy-engine:9000
    depends_on:
      - policy-engine
```

## Troubleshooting

### Policies not loading

Check logs:
```bash
docker-compose logs policy-engine
```

Verify policy syntax:
```bash
# Validate YAML
yamllint policies/*.yaml
```

### Performance issues

Enable debug logging:
```bash
DEBUG=true docker-compose up
```

Check metrics:
```bash
curl http://localhost:9000/metrics
```

## License

Same as MCP Gateway

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

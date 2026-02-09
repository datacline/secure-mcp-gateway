# Quick Start Guide

Get the Policy Engine running in 5 minutes!

## Prerequisites

- Docker and Docker Compose
- OR Go 1.21+ (for local development)

## Option 1: Docker (Recommended)

```bash
# 1. Navigate to policy engine directory
cd policy-engine-go

# 2. Start the service
docker-compose up -d

# 3. Verify it's running
curl http://localhost:9000/health
# Expected: {"status":"healthy","service":"policy-engine"}

# 4. Test policy evaluation
curl -X POST http://localhost:9000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "user": "john.doe",
    "tool": "search_database",
    "resource": "customer_data"
  }'

# Expected: Policy evaluation result (allow/deny)
```

## Option 2: Local Development

```bash
# 1. Install dependencies
go mod download

# 2. Run the server
POLICY_DIR=./policies PORT=9000 go run cmd/server/main.go

# 3. In another terminal, test
curl http://localhost:9000/health
```

## Test with Examples

### 1. Allow Request (default)

```bash
curl -X POST http://localhost:9000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "user": "admin",
    "tool": "read_data"
  }'
```

Result: `action: "allow", should_block: false`

### 2. Deny Request (sensitive tool)

```bash
curl -X POST http://localhost:9000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "user": "guest",
    "tool": "delete_database"
  }'
```

Result: `action: "deny", should_block: true`

### 3. Rate Limit

```bash
curl -X POST http://localhost:9000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "user": "john",
    "tool": "search_large_dataset"
  }'
```

Result: `action: "rate_limit"` with params

## Add Custom Policies

1. Create a new YAML file in `policies/` directory:

```yaml
# policies/my-policy.yaml
id: my-policy
name: My Custom Policy
version: 1
enabled: true
enforcement: blocking

rules:
  - id: my-rule
    priority: 100
    conditions:
      - type: user
        operator: eq
        field: ""
        value: "blocked-user"
    actions:
      - type: deny
        params:
          message: "User is blocked"
```

2. Reload policies (no restart needed):

```bash
curl -X POST http://localhost:9000/api/v1/reload
```

3. Test your new policy:

```bash
curl -X POST http://localhost:9000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "user": "blocked-user",
    "tool": "any_tool"
  }'
```

## Integration with MCP Gateway

### Java Gateway

1. Add environment variable to gateway:
```yaml
environment:
  POLICY_ENGINE_URL: http://policy-engine:9000
```

2. Gateway will automatically check policies before tool execution

### Python Gateway

1. Add to `.env`:
```bash
POLICY_ENGINE_URL=http://policy-engine:9000
POLICY_ENGINE_ENABLED=true
```

2. Gateway will automatically check policies

## View Logs

```bash
# Follow logs
docker-compose logs -f policy-engine

# View last 100 lines
docker-compose logs --tail=100 policy-engine
```

## Stop the Service

```bash
docker-compose down
```

## Next Steps

1. Read [README.md](README.md) for complete documentation
2. See [INTEGRATION.md](INTEGRATION.md) for gateway integration
3. Review example policies in `policies/` directory
4. Customize policies for your use case

## Common Commands

```bash
# Build
make build

# Run locally
make run

# Test
make test

# Docker build
make docker-build

# Docker run
make docker-run

# Clean
make clean
```

## Need Help?

- Check [README.md](README.md) for detailed docs
- Review example policies in `policies/`
- See [INTEGRATION.md](INTEGRATION.md) for integration guide
- Check logs: `docker-compose logs policy-engine`

## Success!

You now have a running Policy Engine that can:
- ✅ Evaluate access control policies
- ✅ Block/allow requests based on rules
- ✅ Apply rate limiting
- ✅ Redact sensitive data
- ✅ Integrate with MCP Gateway

Start customizing policies in the `policies/` directory!

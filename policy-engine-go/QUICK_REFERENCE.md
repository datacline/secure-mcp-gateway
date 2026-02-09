# Policy Engine - Quick Reference Card

## 🚀 Start

```bash
cd policy-engine-go
docker-compose up -d
curl http://localhost:9000/health
```

## 📋 CRUD Operations

### Create Policy
```bash
curl -X POST http://localhost:9000/api/v1/policies \
  -H "Content-Type: application/json" \
  -d '{"name":"My Policy","enabled":true,"rules":[...]}'
```

### List Policies
```bash
curl http://localhost:9000/api/v1/policies
```

### Get Policy
```bash
curl http://localhost:9000/api/v1/policies/my-policy-id
```

### Update Policy
```bash
curl -X PUT http://localhost:9000/api/v1/policies/my-policy-id \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated","rules":[...]}'
```

### Delete Policy
```bash
curl -X DELETE http://localhost:9000/api/v1/policies/my-policy-id
```

### Enable/Disable
```bash
curl -X POST http://localhost:9000/api/v1/policies/my-policy-id/enable
curl -X POST http://localhost:9000/api/v1/policies/my-policy-id/disable
```

### Validate
```bash
curl -X POST http://localhost:9000/api/v1/policies/validate \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","rules":[...]}'
```

## 🔍 Evaluation

### Evaluate Single Request
```bash
curl -X POST http://localhost:9000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{"user":"john","tool":"delete_db","resource":"prod"}'
```

### Batch Evaluate
```bash
curl -X POST http://localhost:9000/api/v1/evaluate/batch \
  -H "Content-Type: application/json" \
  -d '{"requests":[{"user":"john","tool":"tool1"},...]}'
```

## 📝 Policy Structure

```yaml
id: my-policy
name: My Policy Name
enabled: true
enforcement: blocking  # or audit_only
rules:
  - id: rule1
    priority: 100
    conditions:
      - type: user|tool|resource|time|data|rate
        operator: eq|neq|in|gt|lt|matches|contains
        field: ""
        value: "something"
    actions:
      - type: allow|deny|redact|rate_limit|log_only
        params: {}
```

## 🎯 Common Patterns

### Block Users
```yaml
conditions:
  - type: user
    operator: in
    value: ["blocked1", "blocked2"]
actions:
  - type: deny
```

### Time Restrictions
```yaml
conditions:
  - type: time
    operator: gt
    field: hour
    value: 18
actions:
  - type: deny
```

### Regex Matching
```yaml
conditions:
  - type: tool
    operator: matches
    value: "delete_.*|drop_.*"
actions:
  - type: deny
```

### Redact Data
```yaml
conditions:
  - type: tool
    operator: eq
    value: "get_user_data"
actions:
  - type: redact
    params:
      fields: ["ssn", "credit_card"]
```

## 🧪 Testing

```bash
# Run automated tests
./test-crud.sh

# Or manually test each operation
curl http://localhost:9000/api/v1/policies          # List
curl -X POST .../policies -d @policy.json           # Create
curl .../policies/my-policy                         # Get
curl -X PUT .../policies/my-policy -d @update.json  # Update
curl -X DELETE .../policies/my-policy               # Delete
```

## 📚 Documentation

| File | Description |
|------|-------------|
| `DONE.md` | ⭐ **START HERE** - Completion summary |
| `QUICKSTART.md` | Get running in 5 minutes |
| `API_CRUD.md` | Complete CRUD API documentation |
| `INTEGRATION.md` | Integration with MCP Gateway |
| `README.md` | Full documentation |
| `COMPLETE_OVERVIEW.md` | Comprehensive overview |

## 🐳 Docker Commands

```bash
# Start
docker-compose up -d

# Logs
docker-compose logs -f policy-engine

# Stop
docker-compose down

# Rebuild
docker-compose up -d --build
```

## 🔧 Makefile Commands

```bash
make build        # Build binary
make run          # Run locally
make test         # Run tests
make test-crud    # Test CRUD API
make docker-run   # Start with Docker
make docker-stop  # Stop Docker
make clean        # Clean artifacts
```

## 🎓 Next Steps

1. ✅ Read `DONE.md` for complete overview
2. ✅ Run `./test-crud.sh` to see it in action
3. ✅ Create your first custom policy
4. ✅ Integrate with MCP Gateway (see `INTEGRATION.md`)
5. ✅ Deploy to production

## 💡 Tips

- Start policies in `audit_only` mode to test
- Use `validate` endpoint before creating
- Higher priority = more important (200 vs 100)
- Disable instead of delete (keeps history)
- Use descriptive rule IDs
- Add comments in `description` fields

## ✅ Everything Works!

- Policy evaluation: ✅
- CRUD operations: ✅
- File persistence: ✅
- Hot reload: ✅
- Docker deployment: ✅
- Client library: ✅
- Documentation: ✅
- Test scripts: ✅

**Ready for production!** 🎉

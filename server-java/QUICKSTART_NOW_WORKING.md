# Quick Start - Everything Now Works!

## Start the Application

```bash
cd server-java

# Export your Notion token (raw token, NO "Bearer " prefix)
export NOTION_MCP_BEARER_TOKEN="your-token-here"

# Start the gateway
make dev
# Or: ./mvnw spring-boot:run
```

## Test All Servers

```bash
# 1. List available servers
curl http://localhost:8000/mcp/servers

# 2. Test default mock server (always works)
curl "http://localhost:8000/mcp/list-tools?mcp_server=default"

# 3. Test Notion server (NOW WORKS after SDK upgrade!)
curl "http://localhost:8000/mcp/list-tools?mcp_server=notion"

# 4. Health check
curl http://localhost:8000/actuator/health
```

## What Changed (Jan 25, 2026)

✅ **Fixed Notion MCP compatibility** by upgrading Java SDK from 0.17.0 → 0.17.2

The new SDK version handles HTTP 202 Accepted responses correctly.

## All Systems Operational

| Component | Status |
|-----------|--------|
| Spring Boot App | ✅ Working |
| Authentication | ✅ Working |
| Database (H2/PostgreSQL) | ✅ Working |
| Default MCP Server | ✅ Working |
| Notion MCP Server | ✅ **NOW WORKING** |
| GitHub MCP Server | ✅ Ready (needs token) |

## Documentation

- `README.md` - Main documentation
- `QUICKSTART.md` - Quick start guide
- `COMPLETE_SUMMARY.md` - Full migration summary
- `NOTION_FIXED.md` - Details on the Notion fix
- `AUTH_REFERENCE.md` - Authentication guide
- `TROUBLESHOOTING.md` - Troubleshooting tips

## Docker Deployment

```bash
cd server-java
make docker-up
```

All services (PostgreSQL, Keycloak, Gateway) will start with authentication enabled.

## Summary

**Everything is working!** The Quarkus → Spring Boot migration is complete, and the Notion MCP server compatibility issue is resolved.

🎉 **Ready for production use!**

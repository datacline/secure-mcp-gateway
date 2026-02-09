# Quick Start: Docker Compose with Environment Variables

## TL;DR

```bash
cd server-java

# Create .env file from template
cp .env.docker .env

# Edit .env and add your tokens (if needed)
nano .env

# Start everything
docker-compose up --build
```

## Step-by-Step

### 1. Create Environment File

```bash
cd server-java
cp .env.docker .env
```

### 2. Edit `.env` File (Optional)

Only needed if you're using external MCP servers:

```bash
# Edit with your favorite editor
nano .env
# or
vim .env
# or
code .env
```

**For Notion:**
```bash
NOTION_MCP_BEARER_TOKEN=your-token-here
```

**For GitHub:**
```bash
GITHUB_MCP_PAT=ghp_yourtoken
```

**For local development (no external services):**
Leave `.env` as-is with empty values. The gateway will work with the built-in mock MCP server.

### 3. Start Docker Compose

```bash
docker-compose up --build
```

This will start:
- ✅ PostgreSQL database
- ✅ Keycloak (auth server, if needed)
- ✅ MCP Gateway (Java)
- ✅ Mock MCP Server (for testing)

### 4. Verify It's Running

```bash
# Check health
curl http://localhost:8000/actuator/health

# List MCP servers
curl http://localhost:8000/mcp/servers

# List tools (from default mock server)
curl "http://localhost:8000/mcp/list-tools?mcp_server=default"
```

## What Gets Configured

Docker Compose automatically sets these from `.env`:

```yaml
✅ AUTH_ENABLED (default: false)
✅ NOTION_MCP_BEARER_TOKEN (if you set it)
✅ GITHUB_MCP_PAT (if you set it)
✅ FIGMA_API_TOKEN (if you set it)
```

Everything else (database, Keycloak URLs, etc.) is pre-configured in `docker-compose.yml`.

## Common Issues

### Issue 1: "type clob does not exist"

**Fix:** Rebuild after the PostgreSQL fix:
```bash
docker-compose down -v
docker-compose up --build
```

### Issue 2: "Connection refused to localhost:8081"

**Cause:** Notion MCP server not running on your host

**Fix 1:** Start Notion MCP server:
```bash
cd /path/to/notion-mcp-server
npm start
```

**Fix 2:** Or disable Notion in `mcp_servers.yaml`:
```yaml
notion:
  enabled: false
```

### Issue 3: Environment variables not working

**Check 1:** Ensure `.env` is in the right place:
```bash
ls -la .env
# Should show: .env in server-java directory
```

**Check 2:** Verify format (no spaces):
```bash
# ✅ Correct
NOTION_TOKEN=abc123

# ❌ Wrong
NOTION_TOKEN = abc123
```

**Check 3:** Recreate containers:
```bash
docker-compose down
docker-compose up --build
```

## Stop Everything

```bash
# Stop but keep data
docker-compose down

# Stop and delete all data (fresh start)
docker-compose down -v
```

## View Logs

```bash
# All services
docker-compose logs -f

# Just the gateway
docker-compose logs -f mcp-gateway-java

# Just PostgreSQL
docker-compose logs -f postgres
```

## Summary

**Minimal Setup (No External Services):**
```bash
cd server-java
cp .env.docker .env
docker-compose up --build
```

**With External Services (Notion, GitHub, etc.):**
```bash
cd server-java
cp .env.docker .env
# Edit .env and add tokens
docker-compose up --build
```

That's it! 🎉

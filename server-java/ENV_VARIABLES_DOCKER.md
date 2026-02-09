# Environment Variables for Docker Compose

## Quick Start

The easiest way to set environment variables for Docker Compose is to create a `.env` file in the same directory as `docker-compose.yml`.

### 1. Create `.env` File

```bash
cd server-java
cp .env.example .env
```

### 2. Edit `.env` File

The `.env` file will be automatically loaded by Docker Compose. Here's what you need:

```bash
# .env file for docker-compose

# ============================================================================
# Authentication (optional - default is false)
# ============================================================================
AUTH_ENABLED=false

# ============================================================================
# External MCP Server Credentials
# ============================================================================
# Notion MCP Server (if using)
NOTION_MCP_BEARER_TOKEN=your-notion-token-here

# GitHub MCP Server (if using)
GITHUB_MCP_PAT=your-github-token-here

# Figma MCP Server (if using)
FIGMA_API_TOKEN=your-figma-token-here

# ============================================================================
# Other optional variables
# ============================================================================
# These already have defaults in docker-compose.yml, only override if needed
# SERVER_PORT=8000
# KEYCLOAK_URL=http://keycloak:8080
# KEYCLOAK_REALM=mcp-gateway
```

### 3. Start Docker Compose

```bash
docker-compose up --build
```

Docker Compose will automatically:
1. Read variables from `.env` file
2. Substitute them in `docker-compose.yml`
3. Pass them to containers

---

## How It Works

### In `docker-compose.yml`

Variables are referenced using `${VARIABLE_NAME:-default_value}` syntax:

```yaml
environment:
  AUTH_ENABLED: ${AUTH_ENABLED:-false}
  GITHUB_MCP_PAT: ${GITHUB_MCP_PAT:-}
  NOTION_TOKEN: ${NOTION_TOKEN:-}
```

- `${AUTH_ENABLED:-false}` means: Use `AUTH_ENABLED` from `.env`, or `false` if not set
- `${GITHUB_MCP_PAT:-}` means: Use `GITHUB_MCP_PAT` from `.env`, or empty string if not set

### Variables Already Set in `docker-compose.yml`

These are **hardcoded** and don't need to be in `.env`:

```yaml
environment:
  SERVER_PORT: 8000
  SPRING_PROFILES_ACTIVE: docker
  SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/mcp_gateway
  SPRING_DATASOURCE_USERNAME: mcp_user
  SPRING_DATASOURCE_PASSWORD: mcp_password
  KEYCLOAK_URL: http://keycloak:8080
  KEYCLOAK_REALM: mcp-gateway
  MCP_SERVERS_CONFIG: /app/mcp_servers.yaml
  AUDIT_TO_STDOUT: 'true'
  AUDIT_TO_DATABASE: 'true'
```

---

## Common Scenarios

### Scenario 1: Development with Notion MCP

**`.env` file:**
```bash
AUTH_ENABLED=false
NOTION_MCP_BEARER_TOKEN=a4b0d5810d299aca76167aa6cc4db01f1405acf25ed46ed90aced536e931a67f
```

**Start:**
```bash
docker-compose up
```

### Scenario 2: Production with OAuth Enabled

**`.env` file:**
```bash
AUTH_ENABLED=true
NOTION_MCP_BEARER_TOKEN=your-notion-token
GITHUB_MCP_PAT=ghp_yourGitHubToken
```

**Start:**
```bash
docker-compose up --build
```

### Scenario 3: Override Default Port

**`.env` file:**
```bash
SERVER_PORT=9000
```

**Update `docker-compose.yml`:**
```yaml
environment:
  SERVER_PORT: ${SERVER_PORT:-8000}  # Add this line
ports:
  - "${SERVER_PORT:-8000}:${SERVER_PORT:-8000}"  # Update this
```

---

## Alternative: Export Environment Variables

If you don't want to use a `.env` file, you can export variables in your shell:

```bash
# Export variables
export AUTH_ENABLED=false
export NOTION_MCP_BEARER_TOKEN="your-token-here"
export GITHUB_MCP_PAT="your-github-token"

# Start docker-compose (will read exported variables)
docker-compose up
```

**Note:** This only works in the current shell session.

---

## Alternative: Inline Environment Variables

You can also set variables inline when running docker-compose:

```bash
AUTH_ENABLED=false \
NOTION_MCP_BEARER_TOKEN="your-token" \
docker-compose up
```

---

## Verify Environment Variables

### Check what variables are being used:

```bash
docker-compose config
```

This shows the final configuration after variable substitution.

### Check variables inside the running container:

```bash
# Connect to container
docker exec -it mcp-gateway-java sh

# Print environment variables
env | grep -E '(AUTH|NOTION|GITHUB|KEYCLOAK)'
```

---

## Security Best Practices

### 1. Never Commit `.env` File

The `.env` file is already in `.gitignore`, but make sure:

```bash
# Check .gitignore
cat .gitignore | grep .env

# Should show:
.env
```

### 2. Use Different `.env` Files for Different Environments

```bash
# Development
.env.dev

# Production
.env.prod

# Staging
.env.staging
```

Specify which one to use:

```bash
docker-compose --env-file .env.prod up
```

### 3. Use Docker Secrets for Production

For production, consider using Docker Secrets instead of environment variables:

```yaml
secrets:
  notion_token:
    external: true

services:
  mcp-gateway-java:
    secrets:
      - notion_token
```

---

## Required vs Optional Variables

### Required (Must Set in `.env` or Export)

If you're using these services, you **must** provide credentials:

- `NOTION_MCP_BEARER_TOKEN` - If using Notion MCP server
- `GITHUB_MCP_PAT` - If using GitHub MCP server
- `FIGMA_API_TOKEN` - If using Figma MCP server

### Optional (Have Defaults)

These are **optional** and have sensible defaults:

- `AUTH_ENABLED` - Default: `false`
- `SERVER_PORT` - Default: `8000` (set in docker-compose.yml)
- `KEYCLOAK_URL` - Default: `http://keycloak:8080` (set in docker-compose.yml)
- All other variables in docker-compose.yml

---

## Example `.env` File

Here's a complete example for development:

```bash
# .env
# MCP Gateway Environment Variables for Docker Compose

# ============================================================================
# Authentication
# ============================================================================
AUTH_ENABLED=false

# ============================================================================
# MCP Server Credentials
# ============================================================================
# Notion
NOTION_MCP_BEARER_TOKEN=a4b0d5810d299aca76167aa6cc4db01f1405acf25ed46ed90aced536e931a67f

# GitHub (uncomment if using)
# GITHUB_MCP_PAT=ghp_yourPersonalAccessToken

# Figma (uncomment if using)
# FIGMA_API_TOKEN=your-figma-token

# ============================================================================
# Optional Overrides
# ============================================================================
# Uncomment to override defaults from docker-compose.yml
# SERVER_PORT=8000
# LOGGING_LEVEL_ROOT=DEBUG
```

---

## Troubleshooting

### Problem: Variables Not Being Picked Up

**Solution 1:** Ensure `.env` is in the same directory as `docker-compose.yml`
```bash
ls -la | grep -E '(\.env|docker-compose)'
```

**Solution 2:** Recreate containers (don't just restart)
```bash
docker-compose down
docker-compose up --build
```

**Solution 3:** Check if variables are being substituted
```bash
docker-compose config | grep -i notion
```

### Problem: Environment Variable is Empty in Container

**Check 1:** Verify `.env` file format (no spaces around `=`)
```bash
# ✅ Correct
NOTION_TOKEN=abc123

# ❌ Wrong (spaces)
NOTION_TOKEN = abc123
```

**Check 2:** Check if variable is actually passed to container
```bash
docker inspect mcp-gateway-java | grep -A 5 Env
```

### Problem: Need to Pass Variable from Host

Use the `${VARIABLE}` syntax **without** a default:
```yaml
environment:
  MY_SECRET: ${MY_SECRET}  # Must be exported in shell
```

Then export before running:
```bash
export MY_SECRET="my-secret-value"
docker-compose up
```

---

## Summary

**Best Practice for Docker Compose:**

1. ✅ Create `.env` file from `.env.example`
2. ✅ Set only the variables you need (credentials, overrides)
3. ✅ Add `.env` to `.gitignore` (already done)
4. ✅ Run `docker-compose up`

**The `.env` file is automatically loaded by Docker Compose** - no need to export or specify it!

---

**Created**: Jan 25, 2026  
**For**: MCP Gateway Java/Spring Boot Docker Compose deployment

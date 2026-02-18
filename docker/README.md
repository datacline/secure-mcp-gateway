# Docker Configuration Files

This directory contains Docker-related configuration files for the Secure MCP Gateway.

## Files

### init-policies-db.sql

**Purpose:** Automatically creates database tables for Policy Engine storage

**When it runs:** Automatically when the PostgreSQL container is **first initialized**

**What it creates:**
- `policies` table - Main policy storage
- `policy_resources` table - Resource bindings
- `policy_audit` table - Change tracking
- Indexes for performance
- Triggers for auto-updating timestamps

**How it works:**
The official PostgreSQL Docker image automatically executes any `.sql` files in `/docker-entrypoint-initdb.d/` directory when the database is first created.

In `docker-compose.yml`, this file is mounted as:
```yaml
volumes:
  - ../docker/init-policies-db.sql:/docker-entrypoint-initdb.d/02-init-policies.sql:ro
```

**Important notes:**
- ✅ Runs automatically on first database creation
- ✅ Idempotent (safe to run multiple times due to `IF NOT EXISTS`)
- ✅ Read-only mount (`:ro` flag)
- ⚠️ Only runs on **fresh database** (when postgres_data volume is empty)

### Triggering Database Initialization

The script runs when:

1. **First time starting services:**
```bash
docker-compose up -d
```

2. **After removing the database volume:**
```bash
docker-compose down -v  # Remove volumes
docker-compose up -d    # Recreate database with init scripts
```

3. **Rebuilding the postgres service:**
```bash
docker-compose down
docker volume rm secure-mcp-gateway_postgres_data  # Remove postgres volume
docker-compose up -d
```

### Verifying Tables Were Created

```bash
# Check if tables exist
docker exec -it mcp-gateway-postgres psql -U mcp_user -d mcp_gateway -c "\dt"

# Should show:
#  Schema |      Name        | Type  |  Owner
# --------+------------------+-------+----------
#  public | policies         | table | mcp_user
#  public | policy_resources | table | mcp_user
#  public | policy_audit     | table | mcp_user

# View table structure
docker exec -it mcp-gateway-postgres psql -U mcp_user -d mcp_gateway -c "\d policies"

# Count policies
docker exec -it mcp-gateway-postgres psql -U mcp_user -d mcp_gateway -c "SELECT COUNT(*) FROM policies;"
```

### Manual Execution (if needed)

If you need to run the script manually:

```bash
# Copy script into running container
docker cp docker/init-policies-db.sql mcp-gateway-postgres:/tmp/

# Execute script
docker exec -it mcp-gateway-postgres psql -U mcp_user -d mcp_gateway -f /tmp/init-policies-db.sql
```

## Other Files

### keycloak-realm.json

**Purpose:** Keycloak realm configuration for authentication

**When it runs:** Imported when Keycloak container starts

**What it contains:**
- Realm settings
- Client configurations
- User roles and permissions

### keycloak-init.sh

**Purpose:** Initialize Keycloak with default realm and users

**Usage:** Runs via Makefile or docker-compose

### mock_mcp_server.py

**Purpose:** Mock MCP server for testing

**Usage:** Runs in the mock-mcp-server container for development testing

## Best Practices

1. **Never modify running database directly** - Use migrations
2. **Version control all init scripts** - Track changes in git
3. **Test migrations locally first** - Before applying to production
4. **Backup before volume removal** - `docker-compose down -v` deletes data
5. **Use idempotent SQL** - Always use `IF NOT EXISTS`, `OR REPLACE`, etc.

## Troubleshooting

### Tables not created

**Cause:** Database volume already exists from previous run

**Solution:** Remove and recreate:
```bash
docker-compose down
docker volume rm secure-mcp-gateway_postgres_data
docker-compose up -d
```

### Init script errors

**Check logs:**
```bash
docker-compose logs postgres | grep -i error
```

### Permission errors

**Verify grants:**
```bash
docker exec -it mcp-gateway-postgres psql -U mcp_user -d mcp_gateway -c "\dp policies"
```

## Production Considerations

- Use separate migration tool (e.g., Flyway, Liquibase) for production
- Don't rely on init scripts for schema updates
- Use proper database backup/restore procedures
- Consider using managed database services (AWS RDS, Google Cloud SQL, etc.)

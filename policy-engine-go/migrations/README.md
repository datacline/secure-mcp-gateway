# Policy Engine Database Migrations

## Overview

This directory contains SQL migrations for moving policy storage from YAML files to PostgreSQL database.

## Current Status

**The Policy Engine is currently using file-based storage (YAML files).**

Database storage is planned but not yet implemented in the Go code. These migration scripts prepare the database schema for when the database storage backend is implemented.

## Quick Apply (For Testing)

To apply the database schema (without actually using it yet):

```bash
# From the repository root

# Start PostgreSQL if not running
docker-compose up -d postgres

# Apply migration
docker exec -i mcp-gateway-postgres psql -U mcp_user -d mcp_gateway < policy-engine-go/migrations/001_create_policies_tables.sql

# Verify tables were created
docker exec -it mcp-gateway-postgres psql -U mcp_user -d mcp_gateway -c "\dt"
```

Expected output:
```
             List of relations
 Schema |      Name        | Type  |  Owner
--------+------------------+-------+----------
 public | policies         | table | mcp_user
 public | policy_resources | table | mcp_user
 public | policy_audit     | table | mcp_user
```

## Migrations

### 001_create_policies_tables.sql

**Status:** Ready to apply (schema only, not used yet)

**What it does:**
- Creates `policies` table for storing policy data
- Creates `policy_resources` table for resource bindings
- Creates `policy_audit` table for change tracking
- Sets up indexes for performance
- Creates triggers for auto-updating timestamps

**Tables created:**

1. **policies** - Main policy storage
   - policy_id (PK)
   - name, description, status, priority
   - policy_rules (JSONB) - Rule definitions
   - resources (JSONB) - Resource bindings
   - Timestamps and audit fields

2. **policy_resources** - Efficient resource lookups
   - Maps policies to resources
   - Enables fast queries like "all policies for server X"

3. **policy_audit** - Audit trail
   - Tracks all policy changes
   - Records who changed what and when

## When Database Storage is Implemented

Once the Go code supports database storage, you'll need to:

### 1. Apply the Migration

```bash
docker exec -i mcp-gateway-postgres psql -U mcp_user -d mcp_gateway < policy-engine-go/migrations/001_create_policies_tables.sql
```

### 2. Update Environment Variables

Add to `server-java/docker-compose.yml` under `policy-engine`:

```yaml
environment:
  POLICY_STORAGE: "database"
  DATABASE_URL: "postgres://mcp_user:mcp_password@postgres:5432/mcp_gateway?sslmode=disable"
```

### 3. Migrate Existing Policies

```bash
# Run migration script (to be implemented)
docker exec -it policy-engine /app/bin/migrate-policies
```

### 4. Restart Services

```bash
docker-compose restart policy-engine
```

## Migration Script (Future)

A migration script will be provided to:
- Read existing YAML policies from `policies/unified/`
- Convert to database format
- Insert into PostgreSQL
- Preserve policy IDs and relationships
- Create backup of YAML files

## Rollback

If you need to rollback to file-based storage:

```sql
-- Drop all policy tables
DROP TABLE IF EXISTS policy_audit CASCADE;
DROP TABLE IF EXISTS policy_resources CASCADE;
DROP TABLE IF EXISTS policies CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column();
```

Then restart the policy-engine without database environment variables.

## Development vs Production

### Development (Current)
- **Storage:** YAML files
- **Location:** `policy-engine-go/policies/unified/`
- **Pros:** Easy to edit, version control friendly
- **Cons:** No transactions, concurrency issues

### Production (Recommended)
- **Storage:** PostgreSQL database
- **Tables:** policies, policy_resources, policy_audit
- **Pros:** ACID compliance, concurrent access, audit trail
- **Cons:** Requires database maintenance

## FAQ

**Q: Can I apply the migrations now?**
A: Yes, but they won't be used until database storage is implemented in the Go code.

**Q: Will applying migrations break anything?**
A: No, the tables will just sit empty until the feature is implemented.

**Q: When will database storage be available?**
A: It's on the roadmap. Track progress at [GitHub Issues](https://github.com/datacline/secure-mcp-gateway/issues).

**Q: Can I use both file and database storage?**
A: Not yet, but hybrid mode is planned for gradual migration.

## Need Help?

- Check: [POLICY_STORAGE_MIGRATION.md](../POLICY_STORAGE_MIGRATION.md)
- Issues: https://github.com/datacline/secure-mcp-gateway/issues
- Email: support@datacline.com

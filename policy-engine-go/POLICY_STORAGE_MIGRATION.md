# Policy Storage Migration: Files to Database

## Current State

The Policy Engine currently stores policies as YAML files in the `policies/unified/` directory. This has limitations:

- ❌ Not suitable for production (file locking, concurrency issues)
- ❌ No transaction support
- ❌ Difficult to query and search
- ❌ No audit trail
- ❌ Manual backup required

## Recommended Solution: PostgreSQL Storage

Use the existing PostgreSQL database (already running for the Java Gateway) to store policies.

### Database Schema

Create a `policies` table in PostgreSQL:

```sql
-- Create policies table
CREATE TABLE IF NOT EXISTS policies (
    policy_id VARCHAR(255) PRIMARY KEY,
    policy_code VARCHAR(255) UNIQUE,
    name VARCHAR(512) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    priority INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,

    -- Policy rules and resources as JSONB
    policy_rules JSONB,
    resources JSONB,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),

    -- Indexing
    CONSTRAINT check_status CHECK (status IN ('draft', 'active', 'suspended', 'retired'))
);

-- Create indexes for faster queries
CREATE INDEX idx_policies_status ON policies(status);
CREATE INDEX idx_policies_priority ON policies(priority);
CREATE INDEX idx_policies_code ON policies(policy_code);
CREATE INDEX idx_policies_resources ON policies USING GIN (resources);

-- Create policy_resources table for efficient resource lookups
CREATE TABLE IF NOT EXISTS policy_resources (
    id BIGSERIAL PRIMARY KEY,
    policy_id VARCHAR(255) REFERENCES policies(policy_id) ON DELETE CASCADE,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(policy_id, resource_type, resource_id)
);

CREATE INDEX idx_policy_resources_lookup ON policy_resources(resource_type, resource_id);
CREATE INDEX idx_policy_resources_policy ON policy_resources(policy_id);
```

### Migration Path

#### Option 1: Quick Fix (Current - File-based with writable volume)

**Status: ✅ Already implemented**

- Policies stored in YAML files
- Volume is now writable (no more read-only errors)
- Suitable for development and testing

**No further action needed for development use.**

#### Option 2: Database Storage (Recommended for Production)

**Status:** ✅ Database tables are **automatically created** on first startup!

**Implementation Steps:**

1. **Database schema creation** ✅ **Automatic**

The database tables (`policies`, `policy_resources`, `policy_audit`) are automatically created when you first start the services. The init script is located at `docker/init-policies-db.sql` and runs on PostgreSQL initialization.

**Verify tables exist:**
```bash
docker exec -it mcp-gateway-postgres psql -U mcp_user -d mcp_gateway -c "\dt"
```

2. **Update Policy Engine configuration**

Add to `policy-engine-go/.env`:
```bash
# Database Configuration
DATABASE_ENABLED=true
DATABASE_URL=postgres://mcp_user:mcp_password@postgres:5432/mcp_gateway?sslmode=disable
DATABASE_POOL_SIZE=10
```

3. **Update docker-compose.yml**

```yaml
policy-engine:
  environment:
    # ... existing env vars ...
    DATABASE_ENABLED: "true"
    DATABASE_URL: "postgres://mcp_user:mcp_password@postgres:5432/mcp_gateway?sslmode=disable"
  depends_on:
    postgres:
      condition: service_healthy
```

4. **Migrate existing YAML policies to database**

```bash
# Run migration script (to be created)
docker exec -it policy-engine /app/migrate-to-db
```

#### Option 3: Hybrid Approach (Development + Production)

- **Development**: Use file-based storage (fast, easy to edit)
- **Production**: Use database storage (reliable, scalable)

```bash
# Environment variable to toggle storage type
POLICY_STORAGE_TYPE=database  # or "file"
```

## Implementation Status

### Current (v1.0)
- ✅ File-based storage with writable volume
- ✅ Works for development and testing
- ❌ Not recommended for production

### Planned (v2.0)
- [ ] PostgreSQL storage backend
- [ ] Migration script from files to database
- [ ] Backward compatibility mode
- [ ] Performance benchmarks

## Temporary Solution (Until Database Implementation)

For now, the file-based storage works but has the limitation that you removed. Here's what to know:

### Current Setup
- Policies are saved to: `policy-engine-go/policies/unified/*.yaml`
- Volume mount: **Read-Write** (fixed)
- Suitable for: Development, testing, small deployments

### Limitations
- Concurrent writes may cause issues
- No transaction support
- Manual backup required

### Best Practices with File Storage

1. **Regular Backups**
```bash
# Backup policies
docker cp policy-engine:/app/policies ./policy-backups/$(date +%Y%m%d)
```

2. **Version Control**
```bash
# Commit policy changes
cd policy-engine-go/policies
git add unified/
git commit -m "Add/Update policies"
```

3. **Monitor for Conflicts**
```bash
# Check policy directory
docker exec policy-engine ls -la /app/policies/unified/
```

## When to Migrate to Database

Migrate when you experience:
- Multiple concurrent policy updates
- Need for audit trails
- Complex policy queries
- Production deployment
- More than 100 policies

## Need Help?

For database storage implementation, please:
1. Open a GitHub issue
2. Request database storage feature
3. Contribute to the implementation

Or contact: support@datacline.com

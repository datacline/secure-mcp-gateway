# Database Migrations

This directory contains SQL migration scripts for the Secure MCP Gateway database schema.

## Available Migrations

### 001_initial_schema.sql
PostgreSQL version of the initial database schema. Includes:
- `tools` - Registered tool information (legacy)
- `audit_logs` - Audit trail of all gateway operations
- `mcp_servers` - MCP server configurations (optional, alternative to YAML)
- `policy_decisions` - Cached policy evaluation results (optional)
- `api_keys` - API keys for programmatic access (optional)
- `sessions` - User session tracking (optional)

### 001_initial_schema_sqlite.sql
SQLite version of the initial database schema. Same tables as PostgreSQL version but adapted for SQLite syntax.

## Usage

### For PostgreSQL

```bash
# Connect to your PostgreSQL database
psql -U mcp_user -d mcp_gateway

# Run the migration
\i migrations/001_initial_schema.sql

# Or using command line
psql -U mcp_user -d mcp_gateway -f migrations/001_initial_schema.sql
```

### For SQLite

```bash
# Run the migration
sqlite3 secure_mcp_gateway.db < migrations/001_initial_schema_sqlite.sql

# Or interactively
sqlite3 secure_mcp_gateway.db
.read migrations/001_initial_schema_sqlite.sql
```

### Using Docker Compose

The PostgreSQL migration will run automatically when you start the stack:

```bash
# Start the stack
docker-compose up -d

# Check if migration ran
docker-compose exec postgres psql -U mcp_user -d mcp_gateway -c "\dt"
```

## Schema Overview

### Core Tables

#### tools
Stores registered tool information. Used for legacy tool management functionality.

```sql
- id: Primary key
- name: Tool name (unique)
- version: Tool version
- description: Tool description
- path: Path to tool executable
- permissions: JSON array of permissions
- parameters: JSON schema for parameters
- environment: Environment variables
- timeout: Execution timeout
- is_active: Soft delete flag
- created_at, updated_at: Timestamps
```

#### audit_logs
Complete audit trail of all gateway operations.

```sql
- id: Primary key
- tool_name: Tool or MCP server name
- user: User identifier
- action: Action performed (invoke, list_tools, etc.)
- status: Result status (success, failure, denied)
- parameters: Request parameters (JSON)
- output: Execution output
- error: Error message if failed
- execution_time: Execution time in milliseconds
- timestamp: When the action occurred
```

### Optional Tables

#### mcp_servers
Alternative to YAML configuration for MCP servers.

```sql
- id: Primary key
- name: Server name (unique)
- url: Server URL
- type: Server type (http, grpc)
- timeout: Request timeout
- enabled: Whether server is active
- description: Server description
- metadata: Additional configuration (JSON)
- created_at, updated_at: Timestamps
```

#### policy_decisions
Cache for policy evaluation results to improve performance.

```sql
- id: Primary key
- user_identifier: User or subject
- resource: Resource identifier
- action: Action being checked
- decision: allow or deny
- reason: Explanation
- expires_at: Cache expiration
- created_at: When cached
```

#### api_keys
API key authentication support.

```sql
- id: Primary key
- key_hash: SHA-256 hash of the key
- name: Key name/description
- user_identifier: Owner
- scopes: Allowed scopes (JSON)
- enabled: Whether key is active
- expires_at: Key expiration
- last_used_at: Last usage timestamp
- created_at: When created
- created_by: Creator
```

#### sessions
Session management for web interfaces.

```sql
- id: Primary key
- session_token: Unique session identifier
- user_identifier: User
- user_data: Session data (JSON)
- ip_address: Client IP
- user_agent: Client user agent
- expires_at: Session expiration
- created_at: When created
- last_activity_at: Last activity
```

## Views

### recent_audit_activity
Shows audit activity from the last 24 hours.

```sql
SELECT * FROM recent_audit_activity LIMIT 10;
```

### policy_violations
Shows all policy violations.

```sql
SELECT * FROM policy_violations WHERE user = 'dev@example.com';
```

### tool_usage_stats
Aggregated tool usage statistics.

```sql
SELECT * FROM tool_usage_stats ORDER BY invocation_count DESC;
```

## Indexes

The schema includes indexes optimized for common query patterns:

- Tool lookups by name and status
- Audit log queries by user, action, status, and timestamp
- MCP server lookups
- Policy decision cache lookups
- API key and session lookups

## Maintenance

### Cleanup Old Audit Logs

```sql
-- PostgreSQL
DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '90 days';

-- SQLite
DELETE FROM audit_logs WHERE timestamp < datetime('now', '-90 days');
```

### Cleanup Expired Policy Cache

```sql
DELETE FROM policy_decisions WHERE expires_at < CURRENT_TIMESTAMP;
```

### Cleanup Expired Sessions

```sql
DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
```

## Migration History

| Version | Date       | Description                    |
|---------|------------|--------------------------------|
| 001     | 2025-01-15 | Initial schema with core tables |

## Future Migrations

Add new migration files with sequential numbering:
- `002_add_metrics.sql` - Add metrics tables
- `003_add_rate_limiting.sql` - Add rate limiting tables
- etc.

Each migration should be:
1. Idempotent (safe to run multiple times)
2. Include both PostgreSQL and SQLite versions if applicable
3. Documented in this README

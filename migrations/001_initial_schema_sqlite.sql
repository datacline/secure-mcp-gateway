-- Migration: 001_initial_schema_sqlite.sql
-- Description: Initial database schema for Secure MCP Gateway (SQLite version)
-- Created: 2025-01-15
-- Database: SQLite

-- ============================================================================
-- Table: tools
-- Description: Stores registered tool information (legacy support)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0.0',
    description TEXT NOT NULL,
    path TEXT NOT NULL,
    permissions TEXT NOT NULL,  -- JSON array stored as text
    parameters TEXT,  -- JSON object stored as text (nullable)
    environment TEXT,  -- JSON object stored as text (nullable)
    timeout INTEGER NOT NULL DEFAULT 30,
    is_active INTEGER NOT NULL DEFAULT 1,  -- SQLite uses 1/0 for boolean
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups by name
CREATE INDEX IF NOT EXISTS idx_tools_name ON tools(name);

-- Index for active tools
CREATE INDEX IF NOT EXISTS idx_tools_active ON tools(is_active);


-- ============================================================================
-- Table: audit_logs
-- Description: Stores audit trail of all gateway operations
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_name TEXT NOT NULL,
    user TEXT NOT NULL,
    action TEXT NOT NULL,  -- register, invoke, delete, list_tools, etc.
    status TEXT NOT NULL,  -- success, failure, denied, policy_violation
    parameters TEXT,  -- JSON object stored as text (nullable)
    output TEXT,  -- Execution output (nullable)
    error TEXT,  -- Error message (nullable)
    execution_time INTEGER,  -- Execution time in milliseconds (nullable)
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_tool_name ON audit_logs(tool_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Composite index for user activity queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user, timestamp DESC);


-- ============================================================================
-- Table: mcp_servers (optional - if you want to store config in DB)
-- Description: Stores MCP server configurations (alternative to YAML)
-- ============================================================================
CREATE TABLE IF NOT EXISTS mcp_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'http',  -- http, grpc, etc.
    timeout INTEGER NOT NULL DEFAULT 30,
    enabled INTEGER NOT NULL DEFAULT 1,  -- SQLite boolean
    description TEXT,
    metadata TEXT,  -- JSON object for additional configuration
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_mcp_servers_name ON mcp_servers(name);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled ON mcp_servers(enabled);


-- ============================================================================
-- Table: policy_decisions (optional - for caching policy decisions)
-- Description: Cache policy evaluation results for performance
-- ============================================================================
CREATE TABLE IF NOT EXISTS policy_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_identifier TEXT NOT NULL,  -- username or subject
    resource TEXT NOT NULL,  -- resource identifier
    action TEXT NOT NULL,  -- action being performed
    decision TEXT NOT NULL,  -- allow, deny
    reason TEXT,  -- reason for the decision
    expires_at TIMESTAMP NOT NULL,  -- when this cache entry expires
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_policy_decisions_lookup
    ON policy_decisions(user_identifier, resource, action, expires_at);

-- Index for cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_policy_decisions_expires ON policy_decisions(expires_at);


-- ============================================================================
-- Table: api_keys (optional - for API key authentication)
-- Description: API keys for programmatic access
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash TEXT UNIQUE NOT NULL,  -- SHA-256 hash of the API key
    name TEXT NOT NULL,
    user_identifier TEXT NOT NULL,
    scopes TEXT,  -- JSON array of allowed scopes
    enabled INTEGER NOT NULL DEFAULT 1,
    expires_at TIMESTAMP,  -- NULL for no expiration
    last_used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_identifier);
CREATE INDEX IF NOT EXISTS idx_api_keys_enabled ON api_keys(enabled);


-- ============================================================================
-- Table: sessions (optional - for session management)
-- Description: User session tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_token TEXT UNIQUE NOT NULL,
    user_identifier TEXT NOT NULL,
    user_data TEXT,  -- JSON object with user info
    ip_address TEXT,  -- IPv4 or IPv6
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_identifier);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);


-- ============================================================================
-- Views for common queries (SQLite compatible)
-- ============================================================================

-- View: Recent audit activity (last 24 hours)
CREATE VIEW IF NOT EXISTS recent_audit_activity AS
SELECT
    id,
    tool_name,
    user,
    action,
    status,
    execution_time,
    timestamp
FROM audit_logs
WHERE timestamp > datetime('now', '-24 hours')
ORDER BY timestamp DESC;

-- View: Policy violations
CREATE VIEW IF NOT EXISTS policy_violations AS
SELECT
    id,
    tool_name,
    user,
    action,
    error as reason,
    timestamp
FROM audit_logs
WHERE status = 'policy_violation'
ORDER BY timestamp DESC;

-- View: Tool usage statistics
CREATE VIEW IF NOT EXISTS tool_usage_stats AS
SELECT
    tool_name,
    COUNT(*) as invocation_count,
    COUNT(DISTINCT user) as unique_users,
    AVG(execution_time) as avg_execution_time_ms,
    MAX(timestamp) as last_used_at
FROM audit_logs
WHERE action = 'invoke' AND status = 'success'
GROUP BY tool_name
ORDER BY invocation_count DESC;


-- ============================================================================
-- Triggers for updated_at columns (SQLite version)
-- ============================================================================

-- Trigger for tools table
DROP TRIGGER IF EXISTS update_tools_updated_at;
CREATE TRIGGER update_tools_updated_at
    AFTER UPDATE ON tools
    FOR EACH ROW
BEGIN
    UPDATE tools SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger for mcp_servers table
DROP TRIGGER IF EXISTS update_mcp_servers_updated_at;
CREATE TRIGGER update_mcp_servers_updated_at
    AFTER UPDATE ON mcp_servers
    FOR EACH ROW
BEGIN
    UPDATE mcp_servers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

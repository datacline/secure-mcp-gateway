-- Migration: 001_initial_schema.sql
-- Description: Initial database schema for Secure MCP Gateway
-- Created: 2025-01-15
-- Database: PostgreSQL (also compatible with SQLite with minor modifications)

-- ============================================================================
-- Table: tools
-- Description: Stores registered tool information (legacy support)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    description TEXT NOT NULL,
    path VARCHAR(500) NOT NULL,
    permissions TEXT NOT NULL,  -- JSON array stored as text
    parameters TEXT,  -- JSON object stored as text (nullable)
    environment TEXT,  -- JSON object stored as text (nullable)
    timeout INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT true,
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
    id SERIAL PRIMARY KEY,
    tool_name VARCHAR(255) NOT NULL,
    user VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,  -- register, invoke, delete, list_tools, etc.
    status VARCHAR(50) NOT NULL,  -- success, failure, denied, policy_violation
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
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    url VARCHAR(500) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'http',  -- http, grpc, etc.
    timeout INTEGER NOT NULL DEFAULT 30,
    enabled BOOLEAN NOT NULL DEFAULT true,
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
    id SERIAL PRIMARY KEY,
    user_identifier VARCHAR(255) NOT NULL,  -- username or subject
    resource VARCHAR(500) NOT NULL,  -- resource identifier
    action VARCHAR(50) NOT NULL,  -- action being performed
    decision VARCHAR(20) NOT NULL,  -- allow, deny
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
    id SERIAL PRIMARY KEY,
    key_hash VARCHAR(64) UNIQUE NOT NULL,  -- SHA-256 hash of the API key
    name VARCHAR(255) NOT NULL,
    user_identifier VARCHAR(255) NOT NULL,
    scopes TEXT,  -- JSON array of allowed scopes
    enabled BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMP,  -- NULL for no expiration
    last_used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL
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
    id SERIAL PRIMARY KEY,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    user_identifier VARCHAR(255) NOT NULL,
    user_data TEXT,  -- JSON object with user info
    ip_address VARCHAR(45),  -- IPv4 or IPv6
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
-- Views for common queries
-- ============================================================================

-- View: Recent audit activity
CREATE OR REPLACE VIEW recent_audit_activity AS
SELECT
    id,
    tool_name,
    user,
    action,
    status,
    execution_time,
    timestamp
FROM audit_logs
WHERE timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- View: Policy violations
CREATE OR REPLACE VIEW policy_violations AS
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
CREATE OR REPLACE VIEW tool_usage_stats AS
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
-- Functions and Triggers
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for tools table
DROP TRIGGER IF EXISTS update_tools_updated_at ON tools;
CREATE TRIGGER update_tools_updated_at
    BEFORE UPDATE ON tools
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for mcp_servers table
DROP TRIGGER IF EXISTS update_mcp_servers_updated_at ON mcp_servers;
CREATE TRIGGER update_mcp_servers_updated_at
    BEFORE UPDATE ON mcp_servers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- Initial Data (optional)
-- ============================================================================

-- Insert default MCP servers (if not using YAML config)
-- INSERT INTO mcp_servers (name, url, type, timeout, enabled, description)
-- VALUES
--     ('default', 'http://localhost:3000', 'http', 30, true, 'Default local MCP server'),
--     ('mock-server', 'http://mock-mcp-server:3000', 'http', 30, false, 'Mock server for Docker')
-- ON CONFLICT (name) DO NOTHING;


-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE tools IS 'Registered tools information (legacy support)';
COMMENT ON TABLE audit_logs IS 'Audit trail of all gateway operations';
COMMENT ON TABLE mcp_servers IS 'MCP server configurations';
COMMENT ON TABLE policy_decisions IS 'Cached policy evaluation results';
COMMENT ON TABLE api_keys IS 'API keys for programmatic access';
COMMENT ON TABLE sessions IS 'User session tracking';

COMMENT ON COLUMN tools.permissions IS 'JSON array of permission levels';
COMMENT ON COLUMN tools.parameters IS 'JSON schema for tool parameters';
COMMENT ON COLUMN tools.environment IS 'JSON object of environment variables';
COMMENT ON COLUMN audit_logs.execution_time IS 'Execution time in milliseconds';
COMMENT ON COLUMN audit_logs.parameters IS 'JSON object of request parameters';

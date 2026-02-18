-- Secure MCP Gateway - Policy Engine Database Initialization
-- This script runs automatically when PostgreSQL container is first created

-- Connect to mcp_gateway database
\c mcp_gateway

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
    policy_rules JSONB NOT NULL DEFAULT '[]',
    resources JSONB NOT NULL DEFAULT '[]',

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),

    -- Constraints
    CONSTRAINT check_status CHECK (status IN ('draft', 'active', 'suspended', 'retired')),
    CONSTRAINT check_priority CHECK (priority >= 0)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);
CREATE INDEX IF NOT EXISTS idx_policies_priority ON policies(priority);
CREATE INDEX IF NOT EXISTS idx_policies_code ON policies(policy_code);
CREATE INDEX IF NOT EXISTS idx_policies_resources ON policies USING GIN (resources);
CREATE INDEX IF NOT EXISTS idx_policies_created_at ON policies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_policies_updated_at ON policies(updated_at DESC);

-- Create policy_resources table for efficient resource lookups
CREATE TABLE IF NOT EXISTS policy_resources (
    id BIGSERIAL PRIMARY KEY,
    policy_id VARCHAR(255) NOT NULL REFERENCES policies(policy_id) ON DELETE CASCADE,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(policy_id, resource_type, resource_id)
);

-- Create indexes for policy_resources
CREATE INDEX IF NOT EXISTS idx_policy_resources_lookup ON policy_resources(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_policy_resources_policy ON policy_resources(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_resources_type ON policy_resources(resource_type);

-- Create policy_audit table for tracking changes
CREATE TABLE IF NOT EXISTS policy_audit (
    id BIGSERIAL PRIMARY KEY,
    policy_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    changed_by VARCHAR(255),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    old_value JSONB,
    new_value JSONB,

    CONSTRAINT check_action CHECK (action IN ('created', 'updated', 'deleted', 'activated', 'suspended', 'retired'))
);

CREATE INDEX IF NOT EXISTS idx_policy_audit_policy ON policy_audit(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_audit_action ON policy_audit(action);
CREATE INDEX IF NOT EXISTS idx_policy_audit_changed_at ON policy_audit(changed_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS update_policies_updated_at ON policies;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_policies_updated_at
    BEFORE UPDATE ON policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON policies TO mcp_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON policy_resources TO mcp_user;
GRANT SELECT, INSERT ON policy_audit TO mcp_user;
GRANT USAGE, SELECT ON SEQUENCE policy_resources_id_seq TO mcp_user;
GRANT USAGE, SELECT ON SEQUENCE policy_audit_id_seq TO mcp_user;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Policy Engine database tables created successfully';
END
$$;

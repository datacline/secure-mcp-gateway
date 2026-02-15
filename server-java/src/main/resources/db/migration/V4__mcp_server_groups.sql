-- Migration V4: Create MCP Server Groups table
-- This table stores groups of MCP servers for easier management

CREATE TABLE IF NOT EXISTS mcp_server_groups (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    server_names TEXT, -- JSON array of server names (HTTP servers only)
    gateway_url VARCHAR(1024), -- MCP-compliant HTTP endpoint for this group
    gateway_port INTEGER, -- Port for the group's gateway endpoint
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_mcp_server_groups_name ON mcp_server_groups(name);

-- Create index on created_at for ordering
CREATE INDEX IF NOT EXISTS idx_mcp_server_groups_created_at ON mcp_server_groups(created_at DESC);

-- Add comment to table
COMMENT ON TABLE mcp_server_groups IS 'Groups of MCP servers - each group acts as a sub-gateway with its own MCP endpoint';
COMMENT ON COLUMN mcp_server_groups.name IS 'Unique name of the group';
COMMENT ON COLUMN mcp_server_groups.description IS 'Optional description of the group purpose';
COMMENT ON COLUMN mcp_server_groups.server_names IS 'JSON array of HTTP MCP server names (STDIO servers must be converted first)';
COMMENT ON COLUMN mcp_server_groups.gateway_url IS 'MCP-compliant HTTP endpoint that aggregates all servers in this group';
COMMENT ON COLUMN mcp_server_groups.gateway_port IS 'Port number for the group gateway endpoint';
COMMENT ON COLUMN mcp_server_groups.enabled IS 'Whether this group gateway is enabled';

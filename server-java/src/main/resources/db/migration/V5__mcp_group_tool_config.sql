-- V5: Add tool configuration support for MCP Server Groups
-- Allows configuring which tools from each server are exposed through the group gateway

-- Add tool_config column to store per-server tool selections
ALTER TABLE mcp_server_groups ADD COLUMN tool_config TEXT;

COMMENT ON COLUMN mcp_server_groups.tool_config IS 'JSON object mapping server names to their allowed tools';

-- Make URL nullable to support STDIO servers
-- STDIO servers don't have URLs as they execute locally via command line
ALTER TABLE mcp_servers ALTER COLUMN url DROP NOT NULL;

-- Add command field for STDIO servers (optional, for storing the command to execute)
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS command TEXT;

-- Add args field for STDIO servers (optional, for storing command arguments)
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS args TEXT;

# Changelog

## [Unreleased]

### Removed
- **Policy Engine** - Removed Casbin-based RBAC policy enforcement
  - Deleted `server/policies/` directory and all policy engine code
  - Deleted `policies/` directory with policy configuration files
  - Removed policy checks from all route handlers (`mcp.py`, `tools.py`, `invoke.py`)
  - Removed `casbin==1.37.0` dependency from requirements
  - Simplified architecture - focus on authentication and auditing only
  - Removed policy-related configuration (`policy_file`, `casbin_model`, `casbin_policy`)
  - Updated README to remove all policy/RBAC documentation

**Rationale**: Simplify the gateway to focus on core capabilities (authentication, proxying, auditing). Authorization logic should be handled by individual MCP servers or at the application layer, not at the gateway level.

### Added
- **Broadcast Tools for AI Agents** - AI agents can now query multiple MCP servers simultaneously
  - Automatic detection: If a tool exists on multiple servers, a `broadcast__<tool_name>` version is created
  - Tag-based broadcast: `broadcast__by_tag__<tag>` tools for querying servers by tag (e.g., logging, databases)
  - Aggregated results: AI agents receive formatted results from all servers
  - Use case: "Search logs across all ELK servers" or "Check health across all databases"
- **CLI Tags Support** - `datacline register-mcp` now supports `--tags` option for broadcast grouping
  - Register servers with tags: `--tags "logging,production,us-west"`
  - Tags enable automatic broadcast tool generation
  - Simplifies multi-region and distributed system configuration
- OAuth 2.0/2.1 support for MCP clients (VS Code, Claude Desktop)
- OAuth2 discovery endpoints (RFC 8414, RFC 8707)
  - `/.well-known/oauth-authorization-server`
  - `/.well-known/oauth-protected-resource`
  - `/.well-known/oauth-protected-resource/mcp`
- Token introspection-based authentication (RFC 7662)
- PKCE support for public clients (RFC 7636)
- Audience validation for OAuth2 tokens
- Comprehensive OAuth2 setup documentation

### Changed
- Restructured authentication module into `server/auth/` package
  - `server/auth/jwt_auth.py` - JWT authentication (existing)
  - `server/auth/mcp_auth.py` - OAuth2 token introspection (new)
- Consolidated documentation into `docs/` directory
- Updated README with OAuth2 authentication information
- Improved project structure documentation

### Fixed
- OAuth2 discovery endpoints now return publicly accessible URLs
- MCP endpoint 401 responses include correct OAuth2 metadata
- VS Code MCP client authentication flow

### Removed
- Redundant OAuth2 documentation files:
  - `OAUTH_DISCOVERY_FIX.md` (consolidated into docs/OAUTH2_SETUP.md)
  - `REFACTORING_SUMMARY.md` (internal development doc)
  - `VSCODE_MCP_OAUTH2_SETUP.md` (consolidated into docs/OAUTH2_SETUP.md)
  - `VSCODE_OAUTH_CHECKLIST.md` (consolidated into docs/OAUTH2_SETUP.md)
  - `KEYCLOAK_VSCODE_CLIENT_CONFIG.md` (consolidated into docs/OAUTH2_SETUP.md)
  - `MCP_OAUTH2_SETUP.md` (consolidated into docs/OAUTH2_SETUP.md)
  - `QUICK_START_VSCODE.md` (consolidated into docs/OAUTH2_SETUP.md)

### Documentation
- **New**: `docs/OAUTH2_SETUP.md` - Comprehensive OAuth2 configuration guide
- **Moved**: `CLAUDE_DESKTOP_CONFIG.md` → `docs/CLAUDE_DESKTOP_CONFIG.md`
- **Moved**: `MCP_PROTOCOL_IMPLEMENTATION.md` → `docs/MCP_PROTOCOL_IMPLEMENTATION.md`
- **Updated**: `README.md` - Added OAuth2 section and improved structure
- **Added**: Popular MCP Servers configuration section in README
  - Figma MCP Server configuration guide
  - GitHub MCP Server configuration guide
  - Notion MCP Server reference
- **Added**: Broadcast Tools configuration documentation
  - How to configure servers with tags for broadcast
  - Tool-based vs tag-based broadcast explained
  - Best practices for multi-region and distributed systems
  - Complete examples for ELK clusters, databases, multi-region setups

## Project Structure

```
secure-mcp-gateway/
├── README.md                      # Main documentation
├── CHANGELOG.md                   # This file
├── docs/                          # Documentation
│   ├── OAUTH2_SETUP.md            # OAuth2 configuration guide
│   ├── CLAUDE_DESKTOP_CONFIG.md   # Claude Desktop setup
│   └── MCP_PROTOCOL_IMPLEMENTATION.md
├── server/                        # Application code
│   ├── auth/                      # Authentication modules
│   │   ├── jwt_auth.py            # JWT authentication
│   │   └── mcp_auth.py            # OAuth2 token introspection
│   └── routes/
│       ├── oauth_proxy.py         # OAuth2 discovery endpoints
│       ├── mcp_protocol.py        # MCP JSON-RPC endpoint
│       └── ...
└── ...
```

## Migration Guide

If you were using any of the removed documentation files, please refer to:
- **All OAuth2 setup** → `docs/OAUTH2_SETUP.md`
- **Claude Desktop** → `docs/CLAUDE_DESKTOP_CONFIG.md`
- **MCP Protocol** → `docs/MCP_PROTOCOL_IMPLEMENTATION.md`

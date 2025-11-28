#!/bin/bash
# MCP Stdio Proxy Wrapper with OAuth2 Authentication
#
# This script configures and runs the MCP stdio proxy with OAuth2 client credentials flow.
# Update the variables below with your Keycloak client credentials.

# OAuth2 Configuration
# Get these values from your Keycloak admin console after creating a client
export MCP_OAUTH_ENABLED=false  # Set to 'true' to enable OAuth2
export MCP_OAUTH_CLIENT_ID="mcp-client"
export MCP_OAUTH_CLIENT_SECRET="your-client-secret-here"
export MCP_OAUTH_TOKEN_URL="http://localhost:8080/realms/mcp-gateway/protocol/openid-connect/token"

# Gateway Configuration
export MCP_GATEWAY_URL="http://localhost:8000/mcp"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run the MCP stdio proxy
exec python3 "$SCRIPT_DIR/mcp_stdio_proxy.py"

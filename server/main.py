from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from server.routes import mcp, mcp_standard, mcp_protocol, oauth_proxy
from server.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

app = FastAPI(
    title="Secure MCP Gateway",
    description="A secure gateway for managing and proxying MCP servers with JWT authentication, policy enforcement, and comprehensive auditing",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
# OAuth2 proxy endpoints (for VS Code and other MCP clients)
app.include_router(oauth_proxy.router)

# MCP Protocol Aggregator (native MCP protocol for Claude Desktop)
app.include_router(mcp_protocol.router)

# Standard MCP protocol endpoints (for Claude Desktop, Cursor, etc.)
app.include_router(mcp_standard.router)

# Legacy REST API endpoints (for direct HTTP API access)
app.include_router(mcp.router)


@app.get("/api")
async def api_info():
    """API information (legacy REST API)"""
    return {
        "name": "Secure MCP Gateway - REST API",
        "version": "2.0.0",
        "description": "REST API endpoints for MCP server management",
        "features": [
            "JWT/Keycloak authentication",
            "RBAC policy engine",
            "MCP server proxying",
            "Structured audit logging",
            "Broadcast invocation"
        ],
        "endpoints": {
            "list_tools": "GET /mcp/list-tools?mcp_server={name}",
            "invoke": "POST /mcp/invoke?mcp_server={name}",
            "invoke_broadcast": "POST /mcp/invoke-broadcast",
            "servers": "GET /mcp/servers",
            "server_info": "GET /mcp/server/{name}/info"
        },
        "status": "running",
        "auth_enabled": settings.auth_enabled
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "auth_enabled": settings.auth_enabled,
        "database": settings.database_url.split('://')[0]
    }


@app.get("/config")
async def get_config():
    """Get non-sensitive configuration information"""
    return {
        "auth_enabled": settings.auth_enabled,
        "keycloak_realm": settings.keycloak_realm,
        "policy_file": settings.policy_file,
        "audit_log_file": settings.audit_log_file,
        "audit_to_stdout": settings.audit_to_stdout
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        log_level="info"
    )

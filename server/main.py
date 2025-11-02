from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from server.routes import mcp
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
app.include_router(mcp.router)  # MCP proxy endpoints


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "name": "Secure MCP Gateway",
        "version": "2.0.0",
        "description": "Gateway for secure MCP server access with authentication and policy enforcement",
        "features": [
            "JWT/Keycloak authentication",
            "RBAC policy engine",
            "MCP server proxying",
            "Structured audit logging",
            "Tool management"
        ],
        "endpoints": {
            "list_tools": "GET /mcp/list-tools?mcp_server={name}",
            "invoke": "POST /mcp/invoke?mcp_server={name}",
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

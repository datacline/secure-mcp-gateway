from pydantic_settings import BaseSettings
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Literal
from enum import Enum
import yaml
from pathlib import Path


class Settings(BaseSettings):
    """Application settings"""

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000

    # Database settings
    database_url: str = "sqlite:///secure_mcp_gateway.db"

    # Auth settings
    auth_enabled: bool = True
    keycloak_url: Optional[str] = None
    keycloak_realm: Optional[str] = "mcp-gateway"
    jwks_url: Optional[str] = None
    jwt_algorithm: str = "RS256"
    jwt_audience: Optional[str] = None
    token_cache_ttl: int = 300  # 5 minutes

    # MCP settings
    mcp_servers_config: str = "mcp_servers.yaml"

    # Audit settings
    audit_log_file: str = "audit.json"
    audit_to_stdout: bool = True

    # Proxy settings
    proxy_timeout: int = 60

    # MCP OAuth2 settings
    mcp_auth_enabled: bool = False
    mcp_oauth_client_id: Optional[str] = "mcp-server"
    mcp_oauth_client_secret: Optional[str] = None
    mcp_resource_server_url: Optional[str] = "http://localhost:8000/mcp"
    mcp_required_scopes: str = "mcp:tools, openid, profile, email"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


class AuthMethod(str, Enum):
    """Supported authentication methods"""
    API_KEY = "api_key"
    BEARER = "bearer"
    BASIC = "basic"
    OAUTH2 = "oauth2"
    CUSTOM = "custom"
    NONE = "none"


class AuthLocation(str, Enum):
    """Where to place the auth credential"""
    HEADER = "header"
    QUERY = "query"
    BODY = "body"


class AuthFormat(str, Enum):
    """How to format the credential"""
    RAW = "raw"
    PREFIX = "prefix"
    TEMPLATE = "template"


class MCPAuthConfig(BaseModel):
    """Authentication configuration for MCP server"""
    method: AuthMethod = Field(default=AuthMethod.NONE, description="Authentication method")
    location: AuthLocation = Field(default=AuthLocation.HEADER, description="Where to place credentials")
    name: str = Field(default="Authorization", description="Header/query/body parameter name")
    format: AuthFormat = Field(default=AuthFormat.PREFIX, description="How to format the credential")
    prefix: str = Field(default="Bearer ", description="Prefix for the credential (e.g., 'Bearer ', 'ApiKey ')")
    template: Optional[str] = Field(default=None, description="Template for custom format: {credential}")
    credential_ref: Optional[str] = Field(default=None, description="Reference to credential (vault://, env://, file://)")
    credential_value: Optional[str] = Field(default=None, description="Direct credential value (not recommended)")
    tenant_scope: Optional[Literal["org", "team", "user"]] = Field(default=None, description="Tenant scoping")
    allowed_hosts: Optional[List[str]] = Field(default=None, description="Restrict auth to specific hosts")
    metadata: Optional[Dict[str, str]] = Field(default=None, description="Additional auth metadata")

    class Config:
        use_enum_values = True


class MCPServerConfig:
    """MCP Server configuration"""

    def __init__(self, config_file: str = "mcp_servers.yaml"):
        self.config_file = Path(config_file)
        self.servers: Dict[str, dict] = {}
        self._load_config()

    def _load_config(self):
        """Load MCP server configurations from YAML"""
        if self.config_file.exists():
            with open(self.config_file, 'r') as f:
                data = yaml.safe_load(f)
                self.servers = data.get('servers', {}) if data else {}
        else:
            # Create default config
            self.servers = {
                'default': {
                    'url': 'http://localhost:3000',
                    'type': 'http',
                    'timeout': 30,
                    'enabled': True,
                    'auth': None
                }
            }
            self._save_config()

    def _save_config(self):
        """Save MCP server configurations to YAML"""
        with open(self.config_file, 'w') as f:
            yaml.dump({'servers': self.servers}, f, default_flow_style=False)

    def get_server(self, name: str) -> Optional[dict]:
        """Get MCP server configuration by name"""
        return self.servers.get(name)

    def list_servers(self) -> List[str]:
        """List all configured MCP servers"""
        return list(self.servers.keys())

    def add_server(self, name: str, url: str, server_type: str = 'http',
                   timeout: int = 30, enabled: bool = True, auth_config: Optional[Dict] = None):
        """Add or update MCP server configuration"""
        self.servers[name] = {
            'url': url,
            'type': server_type,
            'timeout': timeout,
            'enabled': enabled,
            'auth': auth_config
        }
        self._save_config()

    def get_auth_config(self, name: str) -> Optional[MCPAuthConfig]:
        """Get parsed authentication configuration for a server"""
        server = self.get_server(name)
        if not server or not server.get('auth'):
            return None

        try:
            return MCPAuthConfig(**server['auth'])
        except Exception:
            return None

    def remove_server(self, name: str) -> bool:
        """Remove MCP server configuration"""
        if name in self.servers:
            del self.servers[name]
            self._save_config()
            return True
        return False

    def get_all_servers(self) -> Dict[str, dict]:
        """Get all configured MCP servers (both enabled and disabled)"""
        return self.servers.copy()

    def get_enabled_servers(self) -> Dict[str, dict]:
        """Get all enabled MCP servers"""
        return {name: config for name, config in self.servers.items()
                if config.get('enabled', True)}

    def get_servers_by_tags(self, tags: List[str]) -> List[str]:
        """Get MCP servers that have any of the specified tags"""
        matching_servers = []
        for name, config in self.servers.items():
            if not config.get('enabled', True):
                continue
            server_tags = config.get('tags', [])
            if any(tag in server_tags for tag in tags):
                matching_servers.append(name)
        return matching_servers

    def get_servers_with_tool(self, tool_name: str) -> List[str]:
        """Get all servers that provide a specific tool"""
        matching_servers = []
        for name, config in self.servers.items():
            if not config.get('enabled', True):
                continue
            tools = config.get('tools', [])
            if tool_name in tools or '*' in tools:  # '*' means server provides all tools
                matching_servers.append(name)
        return matching_servers


# Global instances
settings = Settings()
mcp_config = MCPServerConfig(settings.mcp_servers_config)

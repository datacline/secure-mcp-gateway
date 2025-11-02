from pydantic_settings import BaseSettings
from typing import Optional, Dict, List
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

    # Policy settings
    policy_file: str = "policies/policy.yaml"
    casbin_model: str = "server/policies/rbac_model.conf"
    casbin_policy: str = "server/policies/rbac_policy.csv"

    # MCP settings
    mcp_servers_config: str = "mcp_servers.yaml"

    # Audit settings
    audit_log_file: str = "audit.json"
    audit_to_stdout: bool = True

    # Proxy settings
    proxy_timeout: int = 60

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


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
                    'enabled': True
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
                   timeout: int = 30, enabled: bool = True):
        """Add or update MCP server configuration"""
        self.servers[name] = {
            'url': url,
            'type': server_type,
            'timeout': timeout,
            'enabled': enabled
        }
        self._save_config()

    def remove_server(self, name: str) -> bool:
        """Remove MCP server configuration"""
        if name in self.servers:
            del self.servers[name]
            self._save_config()
            return True
        return False

    def get_enabled_servers(self) -> Dict[str, dict]:
        """Get all enabled MCP servers"""
        return {name: config for name, config in self.servers.items()
                if config.get('enabled', True)}


# Global instances
settings = Settings()
mcp_config = MCPServerConfig(settings.mcp_servers_config)

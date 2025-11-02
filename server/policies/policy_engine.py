import casbin
import yaml
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from server.config import settings


class PolicyEngine:
    """Enhanced RBAC policy engine using Casbin with YAML-based policies"""

    def __init__(self, model_path: str = None, policy_path: str = None, yaml_policy_path: str = None):
        """
        Initialize policy engine with Casbin and YAML policies

        Args:
            model_path: Path to Casbin model configuration
            policy_path: Path to Casbin policy CSV file
            yaml_policy_path: Path to YAML policy configuration
        """
        # Use default paths if not provided
        if model_path is None:
            model_path = settings.casbin_model
        if policy_path is None:
            policy_path = settings.casbin_policy
        if yaml_policy_path is None:
            yaml_policy_path = settings.policy_file

        self.yaml_policy_path = Path(yaml_policy_path)
        self.yaml_policy = self._load_yaml_policy()

        # Create default configuration files if they don't exist
        self._ensure_config_files(Path(model_path), Path(policy_path))

        # Initialize Casbin enforcer
        self.enforcer = casbin.Enforcer(str(model_path), str(policy_path))

        # Load YAML policies into Casbin
        self._sync_yaml_to_casbin()

    def _load_yaml_policy(self) -> Dict[str, Any]:
        """Load YAML policy configuration"""
        if self.yaml_policy_path.exists():
            with open(self.yaml_policy_path, 'r') as f:
                return yaml.safe_load(f) or {}
        return {
            'roles': {},
            'user_roles': {},
            'group_roles': {},
            'rules': [],
            'default_policy': 'deny'
        }

    def _sync_yaml_to_casbin(self):
        """Synchronize YAML policies to Casbin enforcer"""
        # Clear existing policies
        self.enforcer.clear_policy()

        # Add role permissions from YAML
        for role_name, role_config in self.yaml_policy.get('roles', {}).items():
            for perm in role_config.get('permissions', []):
                resource = perm.get('resource', '*')
                actions = perm.get('actions', [])
                for action in actions:
                    self.enforcer.add_policy(role_name, resource, action)

        # Add user-role mappings
        for user, roles in self.yaml_policy.get('user_roles', {}).items():
            for role in roles:
                self.enforcer.add_grouping_policy(user, role)

        # Add group-role mappings
        for group, roles in self.yaml_policy.get('group_roles', {}).items():
            for role in roles:
                self.enforcer.add_grouping_policy(group, role)

        # Save policies
        self.enforcer.save_policy()

    def _ensure_config_files(self, model_path: Path, policy_path: Path):
        """Create default configuration files if they don't exist"""
        # Create RBAC model configuration
        if not model_path.exists():
            model_path.parent.mkdir(parents=True, exist_ok=True)
            model_content = """[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && (p.obj == "*" || r.obj == p.obj || regexMatch(p.obj, r.obj)) && (p.act == "*" || r.act == p.act)
"""
            model_path.write_text(model_content)

        # Create default policy
        if not policy_path.exists():
            policy_path.parent.mkdir(parents=True, exist_ok=True)
            policy_content = """p, admin, *, *
p, user, *, list_tools
g, anonymous, user
"""
            policy_path.write_text(policy_content)

    def check_permission(self, user: str, resource: str, action: str,
                        groups: Optional[List[str]] = None) -> Tuple[bool, Optional[str]]:
        """
        Check if user has permission to perform action on resource

        Args:
            user: Username or subject
            resource: Resource identifier (e.g., "mcp:server_name:tool_name")
            action: Action (list_tools, invoke_tool, etc.)
            groups: User's group memberships

        Returns:
            Tuple of (is_allowed, reason)
        """
        # Check custom rules first
        rule_result, rule_reason = self._check_custom_rules(user, resource, action)
        if rule_result is not None:
            return rule_result, rule_reason

        # Check user permission via Casbin
        if self.enforcer.enforce(user, resource, action):
            return True, "allowed by user permission"

        # Check group permissions if provided
        if groups:
            for group in groups:
                if self.enforcer.enforce(group, resource, action):
                    return True, f"allowed by group permission: {group}"

        # Check default policy
        default_policy = self.yaml_policy.get('default_policy', 'deny')
        if default_policy == 'allow':
            return True, "allowed by default policy"

        return False, "denied by default policy"

    def _check_custom_rules(self, user: str, resource: str, action: str) -> Tuple[Optional[bool], Optional[str]]:
        """
        Check custom policy rules from YAML

        Returns:
            Tuple of (decision, reason) or (None, None) if no rule matches
        """
        rules = self.yaml_policy.get('rules', [])

        # Sort rules by priority (higher first)
        sorted_rules = sorted(rules, key=lambda r: r.get('priority', 0), reverse=True)

        for rule in sorted_rules:
            if self._match_rule_condition(rule.get('condition', {}), user, resource, action):
                rule_action = rule.get('action', 'deny')
                rule_name = rule.get('name', 'unnamed rule')

                if rule_action == 'deny':
                    return False, f"denied by rule: {rule_name}"
                elif rule_action == 'allow':
                    return True, f"allowed by rule: {rule_name}"

        return None, None

    def _match_rule_condition(self, condition: Dict[str, Any], user: str, resource: str, action: str) -> bool:
        """Check if a rule condition matches the current request"""
        # Check user condition
        if 'user' in condition:
            if condition['user'] != user:
                return False

        # Check action condition
        if 'action' in condition:
            if condition['action'] != action:
                return False

        # Check MCP server condition (from resource)
        if 'mcp_server' in condition:
            parts = resource.split(':')
            if len(parts) >= 2:
                mcp_server = parts[1]
                if condition['mcp_server'] != mcp_server:
                    return False
            else:
                return False

        # Check tool name pattern
        if 'tool_name_pattern' in condition:
            parts = resource.split(':')
            if len(parts) >= 3:
                tool_name = parts[2]
                pattern = condition['tool_name_pattern']
                if not re.match(pattern, tool_name):
                    return False
            else:
                return False

        return True

    def get_user_roles(self, user: str) -> List[str]:
        """Get all roles assigned to a user"""
        return self.enforcer.get_roles_for_user(user)

    def get_user_permissions(self, user: str) -> List[List[str]]:
        """Get all permissions for a user"""
        return self.enforcer.get_permissions_for_user(user)

    def add_policy(self, user: str, resource: str, action: str) -> bool:
        """Add a policy rule"""
        return self.enforcer.add_policy(user, resource, action)

    def remove_policy(self, user: str, resource: str, action: str) -> bool:
        """Remove a policy rule"""
        return self.enforcer.remove_policy(user, resource, action)

    def add_role_for_user(self, user: str, role: str) -> bool:
        """Assign a role to a user"""
        return self.enforcer.add_grouping_policy(user, role)

    def remove_role_for_user(self, user: str, role: str) -> bool:
        """Remove a role from a user"""
        return self.enforcer.remove_grouping_policy(user, role)

    def reload_policy(self):
        """Reload policy from files"""
        self.yaml_policy = self._load_yaml_policy()
        self._sync_yaml_to_casbin()
        self.enforcer.load_policy()


# Global policy engine instance
policy_engine = PolicyEngine()

"""
Integration tests for policy check endpoint

Tests the /api/v1/check-mcp-policy endpoint and mcp-gateway-hook.sh integration
"""

import pytest
import json
from fastapi.testclient import TestClient
from pathlib import Path


@pytest.fixture
def client():
    """Create test client"""
    from server.main import app
    return TestClient(app)


class TestPolicyCheckEndpoint:
    """Tests for /api/v1/check-mcp-policy endpoint"""

    def test_check_policy_allow(self, client):
        """Test policy check that allows execution"""
        response = client.post(
            "/api/v1/check-mcp-policy",
            json={
                "tool_name": "search",
                "mcp_server": "web-search",
                "parameters": {}
            },
            headers={"X-API-Key": "test-key-12345"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["permission"] in ["allow", "deny"]
        assert isinstance(data["continue"], bool)

    def test_check_policy_missing_api_key(self, client):
        """Test policy check without API key"""
        response = client.post(
            "/api/v1/check-mcp-policy",
            json={
                "tool_name": "search",
                "mcp_server": "web-search",
                "parameters": {}
            }
        )

        # Should return 401 for missing API key
        assert response.status_code == 401

    def test_check_policy_with_parameters(self, client):
        """Test policy check with tool parameters"""
        response = client.post(
            "/api/v1/check-mcp-policy",
            json={
                "tool_name": "read_file",
                "mcp_server": "fs-tools",
                "parameters": {"path": "/etc/passwd"},
                "user_id": "user@example.com"
            },
            headers={"X-API-Key": "test-key-12345"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "permission" in data
        assert "continue" in data

    def test_check_policy_with_user_context(self, client):
        """Test policy check with user and device context"""
        response = client.post(
            "/api/v1/check-mcp-policy",
            json={
                "tool_name": "execute_sql",
                "mcp_server": "database",
                "parameters": {"query": "SELECT * FROM users"},
                "user_id": "alice@example.com",
                "device_id": "device-uuid-123"
            },
            headers={"X-API-Key": "test-key-12345"}
        )

        assert response.status_code == 200

    def test_policy_response_format(self, client):
        """Test that response is in correct format for Cursor"""
        response = client.post(
            "/api/v1/check-mcp-policy",
            json={
                "tool_name": "test",
                "mcp_server": "test-server"
            },
            headers={"X-API-Key": "test-key-12345"}
        )

        assert response.status_code == 200
        data = response.json()

        # Must have these fields
        assert "permission" in data
        assert "continue" in data

        # permission must be "allow" or "deny"
        assert data["permission"] in ["allow", "deny"]

        # continue must be boolean
        assert isinstance(data["continue"], bool)

        # If denied, should have user message
        if data["permission"] == "deny":
            # userMessage is optional
            if "userMessage" in data:
                assert isinstance(data["userMessage"], str)

    def test_policy_endpoint_health(self, client):
        """Test health check endpoint"""
        response = client.get("/api/v1/check-mcp-policy/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["endpoint"] == "/api/v1/check-mcp-policy"


class TestHookScriptIntegration:
    """Integration tests for the hook script"""

    def test_hook_script_exists(self):
        """Test that hook script exists and is executable"""
        script_path = Path(__file__).parent.parent / "examples" / "mcp-gateway-hook.sh"
        assert script_path.exists(), f"Hook script not found at {script_path}"
        assert script_path.stat().st_mode & 0o111, "Hook script is not executable"

    def test_hook_script_valid_bash(self):
        """Test that hook script is valid bash"""
        import subprocess
        script_path = Path(__file__).parent.parent / "examples" / "mcp-gateway-hook.sh"

        # Check syntax using bash -n
        result = subprocess.run(
            ["bash", "-n", str(script_path)],
            capture_output=True
        )

        assert result.returncode == 0, f"Bash syntax error: {result.stderr.decode()}"

    def test_hook_script_requires_dependencies(self):
        """Test that hook script checks for curl and jq"""
        import subprocess
        script_path = Path(__file__).parent.parent / "examples" / "mcp-gateway-hook.sh"

        # Run with PATH that doesn't include curl
        result = subprocess.run(
            [str(script_path)],
            input=b'{"tool_name":"test","mcp_server":"test"}',
            capture_output=True,
            env={"PATH": "/bin:/usr/bin"}  # Exclude curl
        )

        # Should fail or handle gracefully
        assert result.returncode != 0 or b"Required command not found" in result.stderr


class TestErrorHandling:
    """Tests for error handling and edge cases"""

    def test_policy_check_empty_payload(self, client):
        """Test policy check with empty payload"""
        response = client.post(
            "/api/v1/check-mcp-policy",
            json={},
            headers={"X-API-Key": "test-key-12345"}
        )

        # Should handle gracefully (400 or 422 for validation error)
        assert response.status_code in [400, 422]

    def test_policy_check_missing_required_fields(self, client):
        """Test policy check with missing required fields"""
        response = client.post(
            "/api/v1/check-mcp-policy",
            json={"tool_name": "test"},  # Missing mcp_server
            headers={"X-API-Key": "test-key-12345"}
        )

        assert response.status_code in [400, 422]

    def test_policy_check_invalid_json(self, client):
        """Test policy check with invalid JSON"""
        response = client.post(
            "/api/v1/check-mcp-policy",
            data="{invalid json",
            headers={
                "X-API-Key": "test-key-12345",
                "Content-Type": "application/json"
            }
        )

        assert response.status_code in [400, 422]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

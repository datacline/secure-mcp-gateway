"""
Policy Check Routes

This module implements the /api/v1/check-mcp-policy endpoint for Cursor integration.
It handles hook requests from the Cursor beforeMCPExecution hook and evaluates policies.

Request Flow:
  1. Cursor calls beforeMCPExecution hook
  2. Hook script reads MCP execution context and sends to /api/v1/check-mcp-policy
  3. Gateway authenticates via X-API-Key header
  4. Gateway evaluates policies based on user, tool, server, and parameters
  5. Gateway returns decision: {permission: "allow"|"deny", continue: bool, userMessage: "..."}
  6. Hook script outputs decision to stdout for Cursor to process
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from server.config import settings
from server.audit.logger import audit_logger

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["policy"])


# ============================================================================
# Data Models
# ============================================================================

class MCPExecutionRequest(BaseModel):
    """MCP execution request from Cursor hook"""
    tool_name: str = Field(..., description="Name of the MCP tool being invoked")
    mcp_server: str = Field(..., description="Name of the MCP server")
    parameters: Optional[Dict[str, Any]] = Field(default=None, description="Tool parameters")
    user_id: Optional[str] = Field(default=None, description="User identifier")
    device_id: Optional[str] = Field(default=None, description="Device identifier")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Additional context")


class PolicyDecision(BaseModel):
    """Policy decision response"""
    permission: str = Field(..., description="'allow' or 'deny'")
    continue_: bool = Field(
        alias="continue",
        description="True to continue execution, False to block"
    )
    user_message: Optional[str] = Field(
        default=None,
        alias="userMessage",
        description="Message to display to user (if denied)"
    )

    class Config:
        populate_by_name = True


# ============================================================================
# Policy Evaluation Engine
# ============================================================================

class PolicyEvaluator:
    """
    Evaluates MCP execution policies based on:
    - User identity (from API key)
    - Tool being invoked
    - MCP server
    - Tool parameters
    - Organizational policies
    """

    def __init__(self):
        """Initialize policy evaluator"""
        self.logger = logging.getLogger(__name__)

    def evaluate(
        self,
        api_key: str,
        tool_name: str,
        mcp_server: str,
        parameters: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
        device_id: Optional[str] = None,
    ) -> PolicyDecision:
        """
        Evaluate if an MCP execution should be allowed

        Args:
            api_key: API key (used to identify customer/user)
            tool_name: Name of the tool being invoked
            mcp_server: Name of the MCP server
            parameters: Tool parameters (for inspection)
            user_id: Optional user identifier
            device_id: Optional device identifier

        Returns:
            PolicyDecision with permission and message
        """

        # TODO: Implement actual policy evaluation logic
        # For now, allow all requests (permissive default)

        self.logger.debug(
            f"Evaluating policy: tool={tool_name}, server={mcp_server}, user={user_id}"
        )

        # Example policy checks (to be implemented):
        # 1. Check if tool is in blocklist
        # 2. Check if tool is in allowlist (if allowlist exists)
        # 3. Check user/role permissions for this tool
        # 4. Check device compliance
        # 5. Check parameter restrictions (e.g., file path restrictions)
        # 6. Check rate limits
        # 7. Check time-based access controls

        # For now: Allow all
        return PolicyDecision(
            permission="allow",
            continue_=True,
            user_message=None
        )


# Global policy evaluator instance
_evaluator = PolicyEvaluator()


# ============================================================================
# API Key Authentication
# ============================================================================

class APIKeyAuthenticator:
    """
    Authenticates requests using X-API-Key header

    In production, this would:
    - Look up API key in database
    - Verify it's not revoked or expired
    - Return user/customer information
    - Rate limit by key
    - Log authentication attempts
    """

    def __init__(self):
        """Initialize authenticator"""
        self.logger = logging.getLogger(__name__)

    def authenticate(self, api_key: str) -> Dict[str, Any]:
        """
        Authenticate an API key

        Args:
            api_key: API key from X-API-Key header

        Returns:
            User/customer information dict

        Raises:
            HTTPException: If key is invalid
        """

        if not api_key:
            raise HTTPException(status_code=401, detail="Missing X-API-Key header")

        # TODO: Implement actual API key verification
        # For now, accept any non-empty key

        # In production, this would:
        # 1. Query database for API key
        # 2. Check if key is active (not revoked/expired)
        # 3. Check rate limits
        # 4. Return user/customer/device information

        self.logger.debug(f"Authenticating API key: {api_key[:8]}...")

        # Extract customer ID from key format (if applicable)
        # Example format: "sk-customer123-randomhash"
        customer_id = self._extract_customer_id(api_key)

        return {
            "api_key": api_key,
            "customer_id": customer_id,
            "authenticated_at": datetime.utcnow().isoformat()
        }

    @staticmethod
    def _extract_customer_id(api_key: str) -> str:
        """Extract customer ID from API key (implementation-specific)"""
        # Example: "sk-cust123-..." -> "cust123"
        parts = api_key.split("-")
        if len(parts) >= 2:
            return parts[1]
        return "unknown"


# Global authenticator instance
_authenticator = APIKeyAuthenticator()


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/check-mcp-policy", response_model=PolicyDecision)
async def check_mcp_policy(
    request: MCPExecutionRequest,
    x_api_key: str = Header(..., description="API key for authentication"),
    request_obj: Request = None
) -> Dict[str, Any]:
    """
    Check MCP execution policy (Cursor hook endpoint)

    This endpoint is called by the mcp-gateway-hook.sh script running in Cursor
    to determine whether an MCP tool execution should be allowed or denied.

    Args:
        request: MCP execution request with tool_name, mcp_server, parameters
        x_api_key: API key from X-API-Key header
        request_obj: FastAPI request object (for logging/metrics)

    Returns:
        PolicyDecision: {permission: "allow"|"deny", continue: bool, userMessage: "..."}

    Example Request:
        POST /api/v1/check-mcp-policy
        X-API-Key: sk-customer123-abcdefghijk...
        Content-Type: application/json

        {
          "tool_name": "search",
          "mcp_server": "web-search",
          "parameters": {"query": "..."},
          "user_id": "user@example.com",
          "device_id": "device-uuid"
        }

    Example Response (Allow):
        {
          "permission": "allow",
          "continue": true
        }

    Example Response (Deny):
        {
          "permission": "deny",
          "continue": false,
          "userMessage": "This tool is not approved for your organization"
        }
    """

    start_time = datetime.utcnow()

    try:
        # Authenticate API key
        user_info = _authenticator.authenticate(x_api_key)
        logger.info(
            f"Policy check request from {user_info['customer_id']}: "
            f"tool={request.tool_name}, server={request.mcp_server}"
        )

        # Evaluate policy
        decision = _evaluator.evaluate(
            api_key=x_api_key,
            tool_name=request.tool_name,
            mcp_server=request.mcp_server,
            parameters=request.parameters,
            user_id=request.user_id,
            device_id=request.device_id
        )

        # Audit log the decision
        execution_time_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
        audit_logger.log_mcp_request(
            user=request.user_id or "unknown",
            action="check_policy",
            mcp_server=request.mcp_server,
            tool_name=request.tool_name,
            status="success",
            policy_decision=decision.permission,
            duration_ms=int(execution_time_ms)
        )

        logger.debug(f"Policy decision: {decision.permission}")

        # Return decision in format Cursor hook expects
        return {
            "permission": decision.permission,
            "continue": decision.continue_,
            "userMessage": decision.user_message
        }

    except HTTPException:
        # Re-raise authentication errors
        raise
    except Exception as e:
        logger.error(f"Policy check failed: {str(e)}", exc_info=True)
        # Fail securely: deny on error
        return {
            "permission": "deny",
            "continue": False,
            "userMessage": "Policy evaluation failed. Please try again."
        }


@router.get("/check-mcp-policy/health")
async def policy_endpoint_health():
    """
    Health check for the policy endpoint

    Used by monitoring systems and the hook script's fail-open logic.
    """
    return {
        "status": "healthy",
        "endpoint": "/api/v1/check-mcp-policy",
        "version": "1.0.0"
    }


# ============================================================================
# Audit Logging Extension
# ============================================================================

# Extend audit logger with policy-specific methods (if not already present)
if not hasattr(audit_logger, 'log_policy_check'):
    def _log_policy_check(
        tool_name: str,
        mcp_server: str,
        user_id: str,
        decision: str,
        execution_time_ms: float = 0.0,
        reason: str = ""
    ):
        """Log a policy check decision"""
        audit_logger.log(
            action="mcp_policy_check",
            resource=f"{mcp_server}:{tool_name}",
            user=user_id,
            details={
                "tool_name": tool_name,
                "mcp_server": mcp_server,
                "decision": decision,
                "execution_time_ms": execution_time_ms,
                "reason": reason
            }
        )

    audit_logger.log_policy_check = _log_policy_check

import logging
import json
from typing import Optional, Dict, Any
from datetime import datetime
from pathlib import Path
from server.db import db
from server.config import settings


class StructuredJSONFormatter(logging.Formatter):
    """Custom formatter for structured JSON logging"""

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON"""
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add extra fields if present
        if hasattr(record, 'audit_data'):
            log_data.update(record.audit_data)

        return json.dumps(log_data)


class AuditLogger:
    """Audit logger for tracking tool and MCP operations with structured JSON output"""

    def __init__(self):
        # Setup structured JSON logger
        self.logger = logging.getLogger("audit")
        self.logger.setLevel(logging.INFO)
        self.logger.handlers.clear()  # Clear any existing handlers

        # JSON formatter
        json_formatter = StructuredJSONFormatter()

        # File handler for JSON audit logs
        audit_file = Path(settings.audit_log_file)
        file_handler = logging.FileHandler(audit_file)
        file_handler.setLevel(logging.INFO)
        file_handler.setFormatter(json_formatter)
        self.logger.addHandler(file_handler)

        # Optional stdout handler
        if settings.audit_to_stdout:
            stdout_handler = logging.StreamHandler()
            stdout_handler.setLevel(logging.INFO)
            stdout_handler.setFormatter(json_formatter)
            self.logger.addHandler(stdout_handler)

    def _log_event(self, event_data: Dict[str, Any]):
        """Log event with structured data"""
        record = self.logger.makeRecord(
            self.logger.name,
            logging.INFO,
            "(audit)",
            0,
            "",
            (),
            None
        )
        record.audit_data = event_data
        self.logger.handle(record)

    def log_mcp_request(
        self,
        user: str,
        action: str,
        mcp_server: str,
        tool_name: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
        status: str = "pending",
        policy_decision: Optional[str] = None,
        duration_ms: Optional[int] = None,
        response_status: Optional[int] = None,
        error: Optional[str] = None
    ):
        """
        Log MCP request with full context

        Args:
            user: Username or subject from JWT
            action: Action performed (list_tools, invoke_tool, etc.)
            mcp_server: Target MCP server name
            tool_name: Tool name if applicable
            parameters: Request parameters
            status: Request status (pending, success, denied, error)
            policy_decision: Policy evaluation result
            duration_ms: Request duration in milliseconds
            response_status: HTTP response status code
            error: Error message if any
        """
        event_data = {
            "event_type": "mcp_request",
            "user": user,
            "action": action,
            "mcp_server": mcp_server,
            "tool_name": tool_name,
            "parameters": parameters,
            "status": status,
            "policy_decision": policy_decision,
            "duration_ms": duration_ms,
            "response_status": response_status,
            "error": error
        }

        # Remove None values
        event_data = {k: v for k, v in event_data.items() if v is not None}

        self._log_event(event_data)

        # Also log to database
        db.log_audit({
            "tool_name": tool_name or mcp_server,
            "user": user,
            "action": action,
            "status": status,
            "parameters": parameters,
            "error": error,
            "execution_time": duration_ms
        })

    def log_tool_registration(self, tool_name: str, user: str, status: str, error: Optional[str] = None):
        """Log tool registration event"""
        event_data = {
            "event_type": "tool_registration",
            "tool_name": tool_name,
            "user": user,
            "status": status,
            "error": error
        }

        event_data = {k: v for k, v in event_data.items() if v is not None}
        self._log_event(event_data)

        # Log to database
        db.log_audit({
            "tool_name": tool_name,
            "user": user,
            "action": "register",
            "status": status,
            "error": error
        })

    def log_tool_invocation(
        self,
        tool_name: str,
        user: str,
        status: str,
        parameters: Optional[Dict[str, Any]] = None,
        output: Optional[str] = None,
        error: Optional[str] = None,
        execution_time: Optional[int] = None
    ):
        """Log tool invocation event"""
        event_data = {
            "event_type": "tool_invocation",
            "tool_name": tool_name,
            "user": user,
            "status": status,
            "parameters": parameters,
            "output": output[:1000] if output else None,  # Truncate long outputs
            "error": error,
            "execution_time_ms": execution_time
        }

        event_data = {k: v for k, v in event_data.items() if v is not None}
        self._log_event(event_data)

        # Log to database
        db.log_audit({
            "tool_name": tool_name,
            "user": user,
            "action": "invoke",
            "status": status,
            "parameters": parameters,
            "output": output,
            "error": error,
            "execution_time": execution_time
        })

    def log_tool_deletion(self, tool_name: str, user: str, status: str, error: Optional[str] = None):
        """Log tool deletion event"""
        event_data = {
            "event_type": "tool_deletion",
            "tool_name": tool_name,
            "user": user,
            "status": status,
            "error": error
        }

        event_data = {k: v for k, v in event_data.items() if v is not None}
        self._log_event(event_data)

        # Log to database
        db.log_audit({
            "tool_name": tool_name,
            "user": user,
            "action": "delete",
            "status": status,
            "error": error
        })

    def log_policy_violation(
        self,
        tool_name: str,
        user: str,
        action: str,
        reason: str
    ):
        """Log policy violation"""
        event_data = {
            "event_type": "policy_violation",
            "tool_name": tool_name,
            "user": user,
            "action": action,
            "reason": reason,
            "status": "denied"
        }

        self._log_event(event_data)

        # Log to database
        db.log_audit({
            "tool_name": tool_name,
            "user": user,
            "action": action,
            "status": "policy_violation",
            "error": reason
        })

    def log_auth_event(
        self,
        user: Optional[str],
        action: str,
        status: str,
        error: Optional[str] = None,
        ip_address: Optional[str] = None
    ):
        """Log authentication events"""
        event_data = {
            "event_type": "authentication",
            "user": user,
            "action": action,
            "status": status,
            "error": error,
            "ip_address": ip_address
        }

        event_data = {k: v for k, v in event_data.items() if v is not None}
        self._log_event(event_data)


# Global audit logger instance
audit_logger = AuditLogger()

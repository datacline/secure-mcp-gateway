from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, DateTime, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
import json
from typing import List, Optional
from pathlib import Path

Base = declarative_base()


class ToolDB(Base):
    """SQLAlchemy model for tools"""
    __tablename__ = "tools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    version = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    path = Column(String, nullable=False)
    permissions = Column(Text, nullable=False)  # JSON string
    parameters = Column(Text, nullable=True)  # JSON string
    environment = Column(Text, nullable=True)  # JSON string
    timeout = Column(Integer, default=30)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLogDB(Base):
    """SQLAlchemy model for audit logs"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    tool_name = Column(String, index=True, nullable=False)
    user = Column(String, index=True, nullable=False)
    action = Column(String, nullable=False)  # register, invoke, delete
    status = Column(String, nullable=False)  # success, failure
    parameters = Column(Text, nullable=True)  # JSON string
    output = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    execution_time = Column(Integer, nullable=True)  # milliseconds
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class Database:
    """Database connection manager"""

    def __init__(self, db_path: str = "secure_mcp_gateway.db"):
        db_file = Path(db_path)
        self.engine = create_engine(f"sqlite:///{db_file}")
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

    def get_session(self) -> Session:
        """Get database session"""
        return self.SessionLocal()

    def create_tool(self, tool_data: dict) -> ToolDB:
        """Create a new tool in database"""
        session = self.get_session()
        try:
            tool = ToolDB(
                name=tool_data["name"],
                version=tool_data["version"],
                description=tool_data["description"],
                path=tool_data["path"],
                permissions=json.dumps(tool_data["permissions"]),
                parameters=json.dumps(tool_data.get("parameters")) if tool_data.get("parameters") else None,
                environment=json.dumps(tool_data.get("environment")) if tool_data.get("environment") else None,
                timeout=tool_data.get("timeout", 30),
                is_active=True
            )
            session.add(tool)
            session.commit()
            session.refresh(tool)
            return tool
        finally:
            session.close()

    def get_tool(self, tool_name: str) -> Optional[ToolDB]:
        """Get tool by name"""
        session = self.get_session()
        try:
            return session.query(ToolDB).filter(ToolDB.name == tool_name, ToolDB.is_active == True).first()
        finally:
            session.close()

    def get_all_tools(self) -> List[ToolDB]:
        """Get all active tools"""
        session = self.get_session()
        try:
            return session.query(ToolDB).filter(ToolDB.is_active == True).all()
        finally:
            session.close()

    def delete_tool(self, tool_name: str) -> bool:
        """Soft delete a tool"""
        session = self.get_session()
        try:
            tool = session.query(ToolDB).filter(ToolDB.name == tool_name).first()
            if tool:
                tool.is_active = False
                session.commit()
                return True
            return False
        finally:
            session.close()

    def log_audit(self, log_data: dict):
        """Create audit log entry"""
        session = self.get_session()
        try:
            audit_log = AuditLogDB(
                tool_name=log_data["tool_name"],
                user=log_data["user"],
                action=log_data["action"],
                status=log_data["status"],
                parameters=json.dumps(log_data.get("parameters")) if log_data.get("parameters") else None,
                output=log_data.get("output"),
                error=log_data.get("error"),
                execution_time=log_data.get("execution_time")
            )
            session.add(audit_log)
            session.commit()
        finally:
            session.close()

    def get_audit_logs(self, tool_name: Optional[str] = None, user: Optional[str] = None, limit: int = 100) -> List[AuditLogDB]:
        """Get audit logs with optional filters"""
        session = self.get_session()
        try:
            query = session.query(AuditLogDB)
            if tool_name:
                query = query.filter(AuditLogDB.tool_name == tool_name)
            if user:
                query = query.filter(AuditLogDB.user == user)
            return query.order_by(AuditLogDB.timestamp.desc()).limit(limit).all()
        finally:
            session.close()


# Global database instance
db = Database()

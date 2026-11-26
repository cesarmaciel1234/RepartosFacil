from datetime import datetime
import uuid

from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class LocalUser(Base):
    __tablename__ = "local_users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=True)
    display_name = Column(String, nullable=True)
    role = Column(String, nullable=False, default="Driver")
    is_anonymous = Column(String, nullable=False, default="true")
    created_at = Column(DateTime, default=datetime.utcnow)


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (UniqueConstraint("collection", "document_id", name="uq_document_path"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    collection = Column(String, nullable=False, index=True)
    document_id = Column(String, nullable=False, index=True)
    data = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LoginThrottle(Base):
    __tablename__ = "login_throttles"

    account_key = Column(String(64), primary_key=True)
    attempts = Column(Integer, nullable=False)
    expires_at = Column(DateTime, nullable=False)

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base


class Circular(Base):
    __tablename__ = "circulars"

    id              = Column(String, primary_key=True, default=lambda: str(uuid4()))
    source          = Column(String, nullable=False)        # "IFSCA" | "RBI"
    title           = Column(String, nullable=False)
    url             = Column(String, unique=True, nullable=False)
    published_at    = Column(DateTime, nullable=True)
    fetched_at      = Column(DateTime, default=datetime.utcnow)
    raw_content     = Column(Text, nullable=True)
    summary         = Column(Text, nullable=True)
    why_it_matters  = Column(Text, nullable=True)
    relevance_score = Column(String, nullable=True)         # HIGH | MEDIUM | LOW | NOT_RELEVANT
    action_items    = Column(JSONB, nullable=True)          # [{"action": ..., "deadline": ...}]
    is_reviewed     = Column(Boolean, default=False)
    reviewed_at     = Column(DateTime, nullable=True)
    analyzed_at     = Column(DateTime, nullable=True)

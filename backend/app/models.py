from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


class AgencyCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    status: str = "pending"
    contact_person: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None


class AgencyOut(AgencyCreate):
    id: str
    created_at: datetime
    updated_at: datetime


class Provenance(BaseModel):
    source_system: str
    source_agency: Optional[str] = None
    ingested_at: datetime = Field(default_factory=datetime.utcnow)
    original_timestamp: Optional[datetime] = None
    transformations: list[str] = Field(default_factory=list)
    model_version: Optional[str] = None
    confidence: Optional[float] = None
    chain_of_custody_id: Optional[str] = None
    dataset_version: Optional[str] = None


class EventCreate(BaseModel):
    event_type: str
    title: str
    description: Optional[str] = None
    location: Optional[dict[str, Any]] = None
    entities: Optional[list[dict[str, Any]]] = None
    tags: list[str] = Field(default_factory=list)
    severity: Optional[str] = None
    modality: str = "text"
    provenance: Provenance


class EventOut(EventCreate):
    id: str
    created_at: datetime


class AuditEvent(BaseModel):
    actor: str
    role: str
    action: str
    target: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

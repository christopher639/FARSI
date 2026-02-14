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
    media_path: Optional[str] = None
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


class ThreatAlertCreate(BaseModel):
    title: str
    description: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None
    source: Optional[str] = None


class ThreatAlertOut(ThreatAlertCreate):
    id: str
    created_at: datetime
    updated_at: datetime


class IntelligenceReportCreate(BaseModel):
    title: str
    content: Optional[str] = None
    classification: Optional[str] = None
    category: Optional[str] = None
    source: Optional[str] = None
    author_id: Optional[str] = None


class IntelligenceReportOut(IntelligenceReportCreate):
    id: str
    created_at: datetime
    updated_at: datetime


class CrimeReportCreate(BaseModel):
    crime_type: str
    description: Optional[str] = None
    location_label: Optional[str] = None
    latitude: float
    longitude: float
    reported_at: Optional[datetime] = None


class CrimeReportOut(BaseModel):
    id: str
    crime_id: str
    crime_type: Optional[str] = None
    context: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    reported_by: Optional[str] = None
    month: Optional[str] = None
    created_at: datetime


class SurveillanceStreamCreate(BaseModel):
    name: str
    rtsp_url: Optional[str] = None
    status: Optional[str] = "inactive"


class SurveillanceStreamOut(SurveillanceStreamCreate):
    id: str
    last_heartbeat: Optional[datetime] = None
    created_at: datetime


class SurveillanceFrameCreate(BaseModel):
    stream_id: str
    storage_path: Optional[str] = None
    detections: list[dict[str, Any]] = Field(default_factory=list)


class SurveillanceFrameOut(SurveillanceFrameCreate):
    id: str
    captured_at: datetime
    created_at: datetime


class HeatmapCellCreate(BaseModel):
    window_start: datetime
    window_end: datetime
    lat: float
    lon: float
    score: float


class HeatmapCellOut(HeatmapCellCreate):
    id: str
    created_at: datetime


class ModelRegistryCreate(BaseModel):
    name: str
    version: str
    model_type: str
    framework: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class ModelRegistryOut(ModelRegistryCreate):
    id: str
    created_at: datetime


class InferenceResultCreate(BaseModel):
    event_id: Optional[str] = None
    model_id: Optional[str] = None
    result: dict[str, Any]


class InferenceResultOut(InferenceResultCreate):
    id: str
    created_at: datetime

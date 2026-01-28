from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    record: dict[str, Any] = Field(..., description="Single crime record payload")


class PredictResponse(BaseModel):
    prediction: int


class TrainResponse(BaseModel):
    message: str
    model_path: str
    report: str


class HeatmapResponse(BaseModel):
    rows: list[dict[str, Any]]


class HeatmapPoint(BaseModel):
    lat: float
    lon: float
    weight: float
    severity: str
    area_name: Optional[str] = None
    crime_desc: Optional[str] = None
    date: Optional[str] = None
    hour: Optional[int] = None


class HeatmapPointsResponse(BaseModel):
    points: list[HeatmapPoint]


class TextClassifyRequest(BaseModel):
    text: str


class TextClassifyResponse(BaseModel):
    prediction: int


class EntityResponse(BaseModel):
    emails: list[str]
    phones: list[str]
    ids: list[str]
    plates: list[str]


class MotionRequest(BaseModel):
    video_path: str
    min_area: int = 500


class MotionEvent(BaseModel):
    frame_index: int
    motion_score: float
    bbox: tuple[int, int, int, int]


class MotionResponse(BaseModel):
    events: list[MotionEvent]


class SimulatedResponse(BaseModel):
    message: str
    data: Optional[Any] = None


class UcfTrainRequest(BaseModel):
    dataset_path: Optional[str] = Field(
        default=None,
        description="Local dataset root path. If omitted, server attempts kagglehub download.",
    )
    dataset_id: str = Field(default="odins0n/ucf-crime-dataset")
    label_mode: str = Field(default="binary", description="binary | multiclass")
    epochs: int = 2
    batch_size: int = 4
    lr: float = 1e-3
    num_frames: int = 16
    size: int = 112
    max_videos: Optional[int] = 400
    seed: int = 42
    val_split: float = 0.2
    freeze_backbone: bool = True


class UcfTrainResponse(BaseModel):
    message: str
    model_path: str
    labels_path: str
    label_mode: str
    samples_used: int
    train_accuracy: float
    val_accuracy: float
    report: str


class UcfPredictRequest(BaseModel):
    video_path: str
    label_mode: str = Field(default="binary", description="binary | multiclass")
    num_frames: int = 16
    size: int = 112


class UcfPredictResponse(BaseModel):
    prediction: str
    confidence: float
    probs: dict[str, float]
    model_path: str
    label_mode: str

import io
import os
import tempfile
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

import cv2
import numpy as np
from PIL import Image
from transformers import pipeline

VEHICLE_LABELS = {"car", "truck", "bus", "motorcycle", "bicycle"}


@lru_cache(maxsize=1)
def _detector():
    return pipeline("object-detection", model="facebook/detr-resnet-50")


def _to_image(image_bytes: bytes) -> Image.Image:
    return Image.open(io.BytesIO(image_bytes)).convert("RGB")


def _to_cv2(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Could not decode image bytes")
    return frame


def run_object_detection(image_bytes: bytes, score_threshold: float = 0.4) -> dict[str, Any]:
    image = _to_image(image_bytes)
    detections = _detector()(image)
    results = []
    for det in detections:
        score = float(det.get("score", 0))
        if score < score_threshold:
            continue
        results.append(
            {
                "label": det.get("label"),
                "score": score,
                "box": det.get("box"),
            }
        )
    return {"detections": results}


def run_vehicle_recognition(detections: list[dict[str, Any]], score_threshold: float = 0.4) -> list[dict[str, Any]]:
    vehicles = []
    for det in detections:
        label = str(det.get("label", "")).lower()
        score = float(det.get("score", 0))
        if label in VEHICLE_LABELS and score >= score_threshold:
            vehicles.append(det)
    return vehicles


def _image_quality_anomalies(frame: np.ndarray) -> list[dict[str, Any]]:
    anomalies: list[dict[str, Any]] = []
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    brightness = float(np.mean(gray))
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    if brightness < 45:
        anomalies.append(
            {
                "type": "low_light",
                "severity": "medium",
                "score": round((45 - brightness) / 45, 3),
                "details": f"Average brightness is {brightness:.1f}",
            }
        )
    if sharpness < 30:
        anomalies.append(
            {
                "type": "blurred_view",
                "severity": "low",
                "score": round((30 - sharpness) / 30, 3),
                "details": f"Frame sharpness is {sharpness:.1f}",
            }
        )
    return anomalies


def detect_anomalies(frame: np.ndarray, detections: list[dict[str, Any]], prev_frame: np.ndarray | None = None) -> list[dict[str, Any]]:
    anomalies = _image_quality_anomalies(frame)
    person_count = sum(1 for det in detections if str(det.get("label", "")).lower() == "person")
    unattended_items = {"backpack", "handbag", "suitcase"}
    item_count = sum(1 for det in detections if str(det.get("label", "")).lower() in unattended_items)

    if person_count >= 15:
        anomalies.append(
            {
                "type": "crowd_gathering",
                "severity": "high",
                "score": round(min(person_count / 30, 1.0), 3),
                "details": f"Detected {person_count} persons in one frame",
            }
        )

    if item_count > 0 and person_count == 0:
        anomalies.append(
            {
                "type": "unattended_object",
                "severity": "high",
                "score": round(min(item_count / 3, 1.0), 3),
                "details": f"Detected {item_count} unattended object(s)",
            }
        )

    if prev_frame is not None:
        prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
        curr_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        diff = cv2.absdiff(prev_gray, curr_gray)
        motion_ratio = float(np.count_nonzero(diff > 25) / diff.size)
        if motion_ratio > 0.35:
            anomalies.append(
                {
                    "type": "rapid_scene_change",
                    "severity": "medium",
                    "score": round(min(motion_ratio, 1.0), 3),
                    "details": f"High inter-frame motion ratio: {motion_ratio:.2f}",
                }
            )

    return anomalies


def _event_type_for_anomaly(anomaly_type: str) -> str:
    mapping = {
        "crowd_gathering": "crowd_gathering",
        "unattended_object": "suspicious_activity",
        "rapid_scene_change": "motion_detected",
        "low_light": "suspicious_activity",
        "blurred_view": "suspicious_activity",
    }
    return mapping.get(anomaly_type, "suspicious_activity")


def analyze_image(image_bytes: bytes, stream_id: str | None = None, timestamp: str | None = None) -> dict[str, Any]:
    detections = run_object_detection(image_bytes)["detections"]
    vehicles = run_vehicle_recognition(detections)
    frame = _to_cv2(image_bytes)
    anomalies = detect_anomalies(frame, detections)
    ts = timestamp or datetime.now(timezone.utc).isoformat()
    flagged_events = []
    for vehicle in vehicles:
        flagged_events.append(
            {
                "timestamp": ts,
                "stream_id": stream_id,
                "event_type": "vehicle_identified",
                "subject": vehicle.get("label", "vehicle"),
                "details": {
                    "type": "vehicle_detection",
                    "severity": "medium",
                    "score": vehicle.get("score"),
                    "box": vehicle.get("box"),
                },
            }
        )
    for anomaly in anomalies:
        flagged_events.append(
            {
                "timestamp": ts,
                "stream_id": stream_id,
                "event_type": _event_type_for_anomaly(str(anomaly.get("type", ""))),
                "subject": anomaly.get("type", "scene"),
                "details": anomaly,
            }
        )
    return {
        "mode": "image",
        "stream_id": stream_id,
        "timestamp": ts,
        "detections": detections,
        "vehicles": vehicles,
        "anomalies": anomalies,
        "flagged_events": flagged_events,
        "flagged": len(flagged_events) > 0,
    }


def analyze_video(
    video_bytes: bytes,
    stream_id: str | None = None,
    sample_every_n_frames: int = 5,
    max_frames: int = 300,
) -> dict[str, Any]:
    temp_path = ""
    frame_results: list[dict[str, Any]] = []
    flagged_events: list[dict[str, Any]] = []
    processed_frames = 0
    sampled_frames = 0
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            tmp.write(video_bytes)
            temp_path = tmp.name

        cap = cv2.VideoCapture(temp_path)
        prev_frame: np.ndarray | None = None
        fps = cap.get(cv2.CAP_PROP_FPS) or 0

        while cap.isOpened() and processed_frames < max_frames:
            ok, frame = cap.read()
            if not ok:
                break
            processed_frames += 1
            if sample_every_n_frames > 1 and processed_frames % sample_every_n_frames != 0:
                prev_frame = frame
                continue

            sampled_frames += 1
            ok_encode, encoded = cv2.imencode(".jpg", frame)
            if not ok_encode:
                continue
            image_bytes = encoded.tobytes()
            detections = run_object_detection(image_bytes)["detections"]
            vehicles = run_vehicle_recognition(detections)
            anomalies = detect_anomalies(frame, detections, prev_frame)
            frame_ts = (
                datetime.now(timezone.utc).isoformat()
                if fps <= 0
                else f"{processed_frames / fps:.2f}s"
            )

            frame_result = {
                "frame_index": processed_frames,
                "timestamp": frame_ts,
                "detections": detections,
                "vehicles": vehicles,
                "anomalies": anomalies,
            }
            frame_results.append(frame_result)

            for vehicle in vehicles:
                flagged_events.append(
                    {
                        "stream_id": stream_id,
                        "frame_index": processed_frames,
                        "timestamp": frame_ts,
                        "event_type": "vehicle_identified",
                        "subject": vehicle.get("label", "vehicle"),
                        "details": {
                            "type": "vehicle_detection",
                            "severity": "medium",
                            "score": vehicle.get("score"),
                            "box": vehicle.get("box"),
                        },
                    }
                )
            for anomaly in anomalies:
                flagged_events.append(
                    {
                        "stream_id": stream_id,
                        "frame_index": processed_frames,
                        "timestamp": frame_ts,
                        "event_type": _event_type_for_anomaly(str(anomaly.get("type", ""))),
                        "subject": anomaly["type"],
                        "details": anomaly,
                    }
                )

            prev_frame = frame

        cap.release()

        return {
            "mode": "video",
            "stream_id": stream_id,
            "processed_frames": processed_frames,
            "sampled_frames": sampled_frames,
            "frame_results": frame_results,
            "flagged_events": flagged_events,
            "flagged": len(flagged_events) > 0,
            "summary": {
                "total_detections": sum(len(r["detections"]) for r in frame_results),
                "total_vehicles": sum(len(r["vehicles"]) for r in frame_results),
                "total_anomalies": sum(len(r["anomalies"]) for r in frame_results),
            },
        }
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

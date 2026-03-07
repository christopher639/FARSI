"""
Face Recognition module — ArcFace embeddings + FAISS index search.

This module loads pre-trained artifacts (FAISS index, metadata) that are
produced by the Kaggle training notebook and deployed to models/face_recognition/.

Pipeline:
    1. InsightFace detects faces & produces ArcFace 512-dim embeddings
    2. FAISS index searches for nearest-neighbour suspects (cosine similarity)
    3. Returns ranked matches with confidence scores

Artifacts expected at MODELS_DIR / face_recognition/:
    - face_index.faiss
    - face_metadata.pkl
    - model_manifest.json
"""

from __future__ import annotations

import io
import json
import logging
import os
import pickle
from functools import lru_cache
from pathlib import Path
from typing import Any

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────
MODELS_DIR = Path(os.environ.get(
    "FACE_MODELS_DIR",
    str(Path(__file__).resolve().parents[3] / "models" / "face_recognition"),
))

EMBED_DIM = 512
DEFAULT_SIMILARITY_THRESHOLD = 0.45
DEFAULT_TOP_K = 5
DEFAULT_MIN_FACE_SIZE = 60  # pixels — ignore tiny faces


# ── Lazy-loaded singletons ───────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _face_app():
    """Load InsightFace ArcFace model (buffalo_l)."""
    try:
        from insightface.app import FaceAnalysis
    except ImportError:
        raise ImportError(
            "insightface is required for face recognition. "
            "Install with: pip install insightface onnxruntime"
        )

    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
    app = FaceAnalysis(name="buffalo_l", providers=providers)
    app.prepare(ctx_id=0, det_size=(640, 640))
    logger.info("InsightFace (ArcFace buffalo_l) loaded")
    return app


@lru_cache(maxsize=1)
def _load_faiss_index():
    """Load FAISS index and metadata from disk."""
    try:
        import faiss
    except ImportError:
        raise ImportError("faiss-cpu is required. Install with: pip install faiss-cpu")

    index_path = MODELS_DIR / "face_index.faiss"
    meta_path = MODELS_DIR / "face_metadata.pkl"

    if not index_path.exists() or not meta_path.exists():
        logger.warning(
            "FAISS artifacts not found at %s. "
            "Run the Kaggle training notebook and deploy artifacts first.",
            MODELS_DIR,
        )
        return None, []

    index = faiss.read_index(str(index_path))
    with open(meta_path, "rb") as f:
        metadata = pickle.load(f)

    logger.info("FAISS index loaded: %d vectors × %d dims", index.ntotal, EMBED_DIM)
    return index, metadata


def _get_manifest() -> dict[str, Any]:
    """Load model manifest JSON if available."""
    manifest_path = MODELS_DIR / "model_manifest.json"
    if manifest_path.exists():
        with open(manifest_path) as f:
            return json.load(f)
    return {}


# ── Public API ───────────────────────────────────────────────────────────────

def detect_faces(image_bytes: bytes) -> list[dict[str, Any]]:
    """Detect all faces in an image and return bounding boxes + metadata."""
    app = _face_app()
    frame = _bytes_to_cv2(image_bytes)
    faces = app.get(frame)

    results = []
    for i, face in enumerate(faces):
        x1, y1, x2, y2 = face.bbox.astype(int).tolist()
        face_w = x2 - x1

        if face_w < DEFAULT_MIN_FACE_SIZE:
            continue

        results.append({
            "face_id": i,
            "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
            "det_score": round(float(face.det_score), 4),
            "age": int(face.age) if hasattr(face, "age") else None,
            "gender": _gender_label(face),
        })

    return results


def search_faces(
    image_bytes: bytes,
    *,
    similarity_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
    top_k: int = DEFAULT_TOP_K,
    min_face_size: int = DEFAULT_MIN_FACE_SIZE,
) -> dict[str, Any]:
    """
    Detect faces in an image and search the FAISS suspect database.

    Returns:
        {
            "faces_detected": int,
            "matches": [
                {
                    "face_id": int,
                    "bbox": {...},
                    "det_score": float,
                    "suspects": [
                        {
                            "suspect_id": str,
                            "name": str,
                            "confidence": float,
                            "risk_level": str,
                            ...
                        }
                    ]
                }
            ],
            "model_info": {...}
        }
    """
    app = _face_app()
    index, metadata = _load_faiss_index()
    frame = _bytes_to_cv2(image_bytes)
    faces = app.get(frame)

    matches: list[dict[str, Any]] = []

    for i, face in enumerate(faces):
        x1, y1, x2, y2 = face.bbox.astype(int).tolist()
        if (x2 - x1) < min_face_size:
            continue

        face_result: dict[str, Any] = {
            "face_id": i,
            "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
            "det_score": round(float(face.det_score), 4),
            "age": int(face.age) if hasattr(face, "age") else None,
            "gender": _gender_label(face),
            "suspects": [],
        }

        # Search FAISS if index is available
        if index is not None and index.ntotal > 0:
            embedding = face.normed_embedding.reshape(1, -1).astype("float32")
            distances, indices = index.search(embedding, top_k)

            for dist, idx in zip(distances[0], indices[0]):
                if idx < 0 or dist < similarity_threshold:
                    continue
                suspect = metadata[idx].copy()
                # Remove internal fields
                suspect.pop("source_image", None)
                suspect["confidence"] = round(float(dist), 4)
                suspect["match_pct"] = f"{dist * 100:.1f}%"
                face_result["suspects"].append(suspect)

        matches.append(face_result)

    return {
        "faces_detected": len(matches),
        "matches": matches,
        "model_info": {
            "index_size": index.ntotal if index else 0,
            "embedding_dim": EMBED_DIM,
            "threshold": similarity_threshold,
            "arcface_model": "buffalo_l",
        },
    }


def get_suspect_database() -> list[dict[str, Any]]:
    """Return all suspects in the FAISS metadata (deduplicated by suspect_id)."""
    _, metadata = _load_faiss_index()
    seen: set[str] = set()
    suspects: list[dict[str, Any]] = []

    for entry in metadata:
        sid = entry.get("suspect_id", "")
        if sid and sid not in seen:
            seen.add(sid)
            record = {k: v for k, v in entry.items() if k != "source_image"}
            suspects.append(record)

    return suspects


def get_model_status() -> dict[str, Any]:
    """Return the current status of the face recognition model."""
    index, metadata = _load_faiss_index()
    manifest = _get_manifest()
    return {
        "loaded": index is not None,
        "index_vectors": index.ntotal if index else 0,
        "metadata_entries": len(metadata),
        "models_dir": str(MODELS_DIR),
        "manifest": manifest,
    }


# ── Helpers ──────────────────────────────────────────────────────────────────

def _bytes_to_cv2(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Could not decode image bytes")
    return frame


def _gender_label(face) -> str | None:
    gender = getattr(face, "gender", None)
    if gender is None:
        return None
    return "M" if gender == 1 else "F"

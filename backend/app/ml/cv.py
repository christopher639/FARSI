from functools import lru_cache
from typing import Any
import io

from PIL import Image
from transformers import pipeline


@lru_cache(maxsize=1)
def _detector():
    return pipeline("object-detection", model="facebook/detr-resnet-50")


def run_object_detection(image_bytes: bytes) -> dict[str, Any]:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    detections = _detector()(image)
    results = []
    for det in detections:
        results.append(
            {
                "label": det.get("label"),
                "score": float(det.get("score", 0)),
                "box": det.get("box"),
            }
        )
    return {"detections": results}

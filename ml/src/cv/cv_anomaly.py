from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import cv2
import numpy as np


@dataclass
class AnomalyEvent:
    frame_index: int
    motion_score: float
    bbox: tuple[int, int, int, int]


def detect_motion(video_path: Path, min_area: int = 500) -> list[AnomalyEvent]:
    cap = cv2.VideoCapture(str(video_path))
    back_sub = cv2.createBackgroundSubtractorMOG2(history=200, varThreshold=25)

    events: list[AnomalyEvent] = []
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        mask = back_sub.apply(frame)
        _, thresh = cv2.threshold(mask, 200, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_area:
                continue
            x, y, w, h = cv2.boundingRect(cnt)
            motion_score = float(area)
            events.append(AnomalyEvent(frame_index=frame_idx, motion_score=motion_score, bbox=(x, y, w, h)))

        frame_idx += 1

    cap.release()
    return events

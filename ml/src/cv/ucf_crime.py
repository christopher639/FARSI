from __future__ import annotations

import json
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Literal

import cv2

from src.config import MODEL_DIR


UcfLabelMode = Literal["binary", "multiclass"]


UCF_CLASSES: tuple[str, ...] = (
    "Abuse",
    "Arrest",
    "Arson",
    "Assault",
    "Burglary",
    "Explosion",
    "Fighting",
    "RoadAccidents",
    "Robbery",
    "Shooting",
    "Shoplifting",
    "Stealing",
    "Vandalism",
    "Normal",
)


VIDEO_EXTS = {".mp4", ".avi", ".mkv", ".mov", ".mpg", ".mpeg"}


@dataclass(frozen=True)
class UcfTrainResult:
    model_path: Path
    labels_path: Path
    label_mode: UcfLabelMode
    samples_used: int
    train_accuracy: float
    val_accuracy: float
    report: str


def download_ucf_crime(dataset_id: str = "odins0n/ucf-crime-dataset") -> Path:
    try:
        import kagglehub  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "kagglehub is not installed. Add it to requirements and reinstall."
        ) from exc

    path = kagglehub.dataset_download(dataset_id)
    return Path(path)


def _infer_ucf_label(video_path: Path) -> str | None:
    parts = [p.lower() for p in video_path.parts]
    stem = video_path.stem.lower()

    for label in UCF_CLASSES:
        low = label.lower()
        if low in parts:
            return label
        if stem.startswith(low + "_") or stem.startswith(low + "-") or stem.startswith(low):
            return label

    if "normal" in parts or "normal" in stem:
        return "Normal"

    return None


def _iter_videos(root: Path) -> Iterable[Path]:
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower() in VIDEO_EXTS:
            yield p


def scan_ucf_dataset(
    root: Path,
    *,
    label_mode: UcfLabelMode = "binary",
    max_videos: int | None = 800,
    seed: int = 42,
) -> list[tuple[Path, str]]:
    if not root.exists():
        raise FileNotFoundError(f"Dataset path not found: {root}")

    samples: list[tuple[Path, str]] = []
    for video in _iter_videos(root):
        label = _infer_ucf_label(video)
        if not label:
            continue

        if label_mode == "binary":
            label = "Normal" if label == "Normal" else "Crime"

        samples.append((video, label))

    if not samples:
        raise RuntimeError(
            "No labeled videos found. Ensure the dataset contains videos under folders like "
            "'Normal', 'Robbery', 'Assault', etc."
        )

    rnd = random.Random(seed)
    rnd.shuffle(samples)
    if max_videos is not None:
        samples = samples[: max(1, int(max_videos))]
    return samples


def _read_uniform_frames(
    video_path: Path,
    *,
    num_frames: int = 16,
    size: int = 112,
) -> "torch.Tensor":
    try:
        import numpy as np
        import torch
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("torch and numpy are required for UCF-Crime training.") from exc

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open video: {video_path}")

    try:
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if frame_count <= 0:
            indices = list(range(num_frames))
        else:
            indices = np.linspace(0, max(0, frame_count - 1), num=num_frames).astype(int).tolist()

        frames: list["np.ndarray"] = []
        last_frame = None
        for idx in indices:
            if frame_count > 0:
                cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ok, frame = cap.read()
            if not ok or frame is None:
                frame = last_frame
            if frame is None:
                continue
            last_frame = frame

            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frame = cv2.resize(frame, (size, size), interpolation=cv2.INTER_AREA)
            frames.append(frame)

        if not frames:
            raise RuntimeError(f"No frames could be read from: {video_path}")

        while len(frames) < num_frames:
            frames.append(frames[-1])

        arr = np.stack(frames[:num_frames], axis=0).astype("float32") / 255.0  # (T,H,W,C)
        arr = np.transpose(arr, (3, 0, 1, 2))  # (C,T,H,W)
        return torch.from_numpy(arr)
    finally:
        cap.release()


def _build_model(num_classes: int, *, freeze_backbone: bool = True) -> "torch.nn.Module":
    try:
        import torch
        import torch.nn as nn
        from torchvision.models.video import R3D_18_Weights, r3d_18
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "torch/torchvision are required. Install torch and torchvision for your Python version."
        ) from exc

    model = r3d_18(weights=R3D_18_Weights.DEFAULT)
    model.fc = nn.Linear(model.fc.in_features, num_classes)

    if freeze_backbone:
        for name, param in model.named_parameters():
            if not name.startswith("fc"):
                param.requires_grad = False

    return model


def _accuracy(logits: "torch.Tensor", targets: "torch.Tensor") -> float:
    import torch

    pred = torch.argmax(logits, dim=1)
    correct = (pred == targets).sum().item()
    total = targets.numel()
    return float(correct) / float(max(1, total))


def train_ucf_crime_model(
    dataset_root: Path,
    *,
    label_mode: UcfLabelMode = "binary",
    epochs: int = 2,
    batch_size: int = 4,
    lr: float = 1e-3,
    num_frames: int = 16,
    size: int = 112,
    max_videos: int | None = 400,
    seed: int = 42,
    val_split: float = 0.2,
    freeze_backbone: bool = True,
) -> UcfTrainResult:
    try:
        import torch
        import torch.nn as nn
        from torch.utils.data import DataLoader, Dataset
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("torch is required for UCF-Crime training.") from exc

    samples = scan_ucf_dataset(dataset_root, label_mode=label_mode, max_videos=max_videos, seed=seed)
    labels = sorted({label for _, label in samples})
    class_to_idx = {label: i for i, label in enumerate(labels)}

    rnd = random.Random(seed)
    rnd.shuffle(samples)
    split = int(len(samples) * (1.0 - max(0.05, min(0.95, val_split))))
    train_samples = samples[: max(1, split)]
    val_samples = samples[max(1, split) :]

    class VideoDataset(Dataset):
        def __init__(self, items: list[tuple[Path, str]]):
            self.items = items

        def __len__(self) -> int:
            return len(self.items)

        def __getitem__(self, idx: int):
            path, label = self.items[idx]
            x = _read_uniform_frames(path, num_frames=num_frames, size=size)
            y = class_to_idx[label]
            return x, y

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = _build_model(len(labels), freeze_backbone=freeze_backbone).to(device)

    train_loader = DataLoader(VideoDataset(train_samples), batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(VideoDataset(val_samples), batch_size=batch_size, shuffle=False) if val_samples else None

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=lr)

    best_val = -1.0
    best_state = None
    last_train_acc = 0.0
    last_val_acc = 0.0

    for epoch in range(max(1, int(epochs))):
        model.train()
        train_acc_sum = 0.0
        train_batches = 0
        for x, y in train_loader:
            x = x.to(device, non_blocking=True)
            y = torch.as_tensor(y, device=device)
            optimizer.zero_grad(set_to_none=True)
            logits = model(x)
            loss = criterion(logits, y)
            loss.backward()
            optimizer.step()
            train_acc_sum += _accuracy(logits.detach(), y)
            train_batches += 1
        last_train_acc = train_acc_sum / max(1, train_batches)

        if val_loader is not None:
            model.eval()
            val_acc_sum = 0.0
            val_batches = 0
            with torch.no_grad():
                for x, y in val_loader:
                    x = x.to(device, non_blocking=True)
                    y = torch.as_tensor(y, device=device)
                    logits = model(x)
                    val_acc_sum += _accuracy(logits, y)
                    val_batches += 1
            last_val_acc = val_acc_sum / max(1, val_batches)

            if last_val_acc > best_val:
                best_val = last_val_acc
                best_state = {k: v.detach().cpu() for k, v in model.state_dict().items()}
        else:
            best_state = {k: v.detach().cpu() for k, v in model.state_dict().items()}
            best_val = last_train_acc

    model_name = f"ucf_crime_r3d18_{label_mode}.pt"
    labels_name = f"ucf_crime_labels_{label_mode}.json"
    model_path = MODEL_DIR / model_name
    labels_path = MODEL_DIR / labels_name

    if best_state is not None:
        torch.save(best_state, model_path)
    else:  # pragma: no cover
        torch.save(model.state_dict(), model_path)

    labels_path.write_text(json.dumps({"labels": labels, "class_to_idx": class_to_idx}, indent=2))

    report = (
        f"UCF-Crime ({label_mode}) trained on {len(train_samples)} train / {len(val_samples)} val videos. "
        f"Device={device.type}. Classes={labels}."
    )

    return UcfTrainResult(
        model_path=model_path,
        labels_path=labels_path,
        label_mode=label_mode,
        samples_used=len(samples),
        train_accuracy=float(last_train_acc),
        val_accuracy=float(last_val_acc),
        report=report,
    )


def predict_ucf_crime(
    video_path: Path,
    *,
    label_mode: UcfLabelMode = "binary",
    num_frames: int = 16,
    size: int = 112,
) -> dict:
    try:
        import torch
        import torch.nn.functional as F
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("torch is required for UCF-Crime prediction.") from exc

    model_path = MODEL_DIR / f"ucf_crime_r3d18_{label_mode}.pt"
    labels_path = MODEL_DIR / f"ucf_crime_labels_{label_mode}.json"
    if not model_path.exists() or not labels_path.exists():
        raise FileNotFoundError("UCF-Crime model not trained yet. Call /cv/ucf/train first.")

    meta = json.loads(labels_path.read_text(encoding="utf-8"))
    labels: list[str] = meta["labels"]
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = _build_model(len(labels), freeze_backbone=False).to(device)
    state = torch.load(model_path, map_location="cpu")
    model.load_state_dict(state)
    model.eval()

    x = _read_uniform_frames(video_path, num_frames=num_frames, size=size).unsqueeze(0).to(device)
    with torch.no_grad():
        logits = model(x)
        probs = F.softmax(logits, dim=1).squeeze(0).detach().cpu().tolist()

    best_idx = int(max(range(len(probs)), key=lambda i: probs[i]))
    prediction = labels[best_idx]
    confidence = float(probs[best_idx])

    return {
        "prediction": prediction,
        "confidence": confidence,
        "probs": {labels[i]: float(probs[i]) for i in range(len(labels))},
        "model_path": str(model_path),
        "label_mode": label_mode,
    }

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import Request

from .supabase_client import get_supabase


def _truncate(value: Any, limit: int = 4000) -> Any:
    if isinstance(value, str) and len(value) > limit:
        return value[:limit] + "...<truncated>"
    if isinstance(value, dict):
        return {str(k): _truncate(v, limit=limit) for k, v in value.items()}
    if isinstance(value, list):
        return [_truncate(v, limit=limit) for v in value[:200]]
    return value


def log_audit_event(
    *,
    action: str,
    target: str | None,
    role: str | None,
    actor: str = "api",
    metadata: dict[str, Any] | None = None,
    request: Request | None = None,
) -> None:
    payload_metadata = dict(metadata or {})
    if request is not None:
        payload_metadata.setdefault("path", request.url.path)
        payload_metadata.setdefault("method", request.method)
        payload_metadata.setdefault("client_ip", request.client.host if request.client else None)
        payload_metadata.setdefault("user_agent", request.headers.get("user-agent"))

    payload = {
        "actor": actor,
        "role": role,
        "action": action,
        "target": target,
        "metadata": _truncate(payload_metadata),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        get_supabase().table("audit_logs").insert(payload).execute()
    except Exception:
        # Audit logging should not block critical API operations.
        return

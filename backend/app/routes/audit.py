from fastapi import APIRouter, Depends, Query

from ..db import get_db
from ..deps import require_permission


router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
def list_audit_events(
    limit: int = Query(50, ge=1, le=200),
    _: str = Depends(require_permission("audit.read")),
):
    db = get_db()
    docs = db["audit_logs"].find().sort("created_at", -1).limit(limit)
    results = []
    for doc in docs:
        doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
        results.append(doc)
    return results

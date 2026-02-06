ROLE_PERMISSIONS = {
    "admin": {
        "agencies.read",
        "agencies.write",
        "events.read",
        "events.write",
        "ingest.write",
        "audit.read",
        "rbac.read",
        "users.manage",
    },
    "analyst": {
        "agencies.read",
        "events.read",
        "rbac.read",
    },
    "viewer": {
        "events.read",
        "rbac.read",
    },
    "ingestor": {
        "ingest.write",
        "events.write",
    },
    "auditor": {
        "audit.read",
        "rbac.read",
    },
}


def role_has_permission(role: str, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, set())

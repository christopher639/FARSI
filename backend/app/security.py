import hashlib


def hash_api_key(key: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{key}".encode("utf-8")).hexdigest()

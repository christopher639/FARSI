from postgrest.exceptions import APIError


def raise_with_migration_hint(exc: APIError, table_name: str) -> None:
    code = ""
    message = str(exc)
    if isinstance(getattr(exc, "args", None), tuple) and exc.args and isinstance(exc.args[0], dict):
        payload = exc.args[0]
        code = str(payload.get("code") or "")
        message = str(payload.get("message") or message)

    if code == "PGRST205" or table_name in message:
        raise RuntimeError(
            f"Missing table '{table_name}'. Apply Supabase migrations before running this command."
        ) from exc

    raise exc

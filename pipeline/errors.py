from postgrest.exceptions import APIError


def raise_with_migration_hint(exc: APIError, table_name: str) -> None:
    code = ""
    message = str(exc)
    if isinstance(getattr(exc, "args", None), tuple) and exc.args and isinstance(exc.args[0], dict):
        payload = exc.args[0]
        code = str(payload.get("code") or "")
        message = str(payload.get("message") or message)

    if code == "PGRST205" or "Could not find the table" in message:
        raise RuntimeError(
            f"Missing table '{table_name}'. Apply Supabase migrations before running this command."
        ) from exc

    raw_text = str(exc)
    if (code == "42501" or "42501" in raw_text) and (
        "row-level security policy" in message or "row-level security policy" in raw_text
    ):
        raise RuntimeError(
            f"Permission denied on '{table_name}' due to RLS. Use SUPABASE_SERVICE_ROLE_KEY for pipeline writes."
        ) from exc

    raise exc

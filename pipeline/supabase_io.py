import argparse
import os
import pandas as pd
from postgrest.exceptions import APIError

from .config import get_supabase_config
from .errors import raise_with_migration_hint
from .supabase_client import get_supabase_client


def import_csv(csv_path: str, table: str | None = None, chunk_size: int = 500) -> int:
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    df = pd.read_csv(csv_path)
    records = df.to_dict(orient="records")
    for r in records:
        for k, v in list(r.items()):
            if pd.isna(v):
                r[k] = None
    if not records:
        return 0

    cfg = get_supabase_config()
    target_table = table or cfg.table
    supabase = get_supabase_client()
    inserted = 0

    for i in range(0, len(records), chunk_size):
        chunk = records[i : i + chunk_size]
        try:
            result = supabase.table(target_table).insert(chunk).execute()
        except APIError as exc:
            raise_with_migration_hint(exc, target_table)
        inserted += len(result.data or [])

    return inserted


def export_csv(output_path: str, table: str | None = None, limit: int | None = None) -> int:
    cfg = get_supabase_config()
    target_table = table or cfg.table
    supabase = get_supabase_client()

    records = []
    page_size = 1000
    offset = 0
    remaining = limit if limit else None

    while True:
        batch_size = page_size if remaining is None else min(page_size, remaining)
        try:
            result = supabase.table(target_table).select("*").range(offset, offset + batch_size - 1).execute()
        except APIError as exc:
            raise_with_migration_hint(exc, target_table)
        data = result.data or []
        if not data:
            break
        records.extend(data)
        offset += batch_size
        if remaining is not None:
            remaining -= batch_size
            if remaining <= 0:
                break

    df = pd.DataFrame(records)
    df.to_csv(output_path, index=False)
    return len(records)


def main():
    parser = argparse.ArgumentParser(description="Import/export data to Supabase")
    subparsers = parser.add_subparsers(dest="command", required=True)

    import_cmd = subparsers.add_parser("import", help="Import CSV into Supabase")
    import_cmd.add_argument("--csv", required=True, help="Path to CSV file")
    import_cmd.add_argument("--table", default=None, help="Target table (default: SUPABASE_CRIME_TABLE)")
    import_cmd.add_argument("--chunk-size", type=int, default=500, help="Insert chunk size")

    export_cmd = subparsers.add_parser("export", help="Export Supabase table to CSV")
    export_cmd.add_argument("--out", required=True, help="Output CSV path")
    export_cmd.add_argument("--table", default=None, help="Source table (default: SUPABASE_CRIME_TABLE)")
    export_cmd.add_argument("--limit", type=int, default=None, help="Optional row limit")

    args = parser.parse_args()

    if args.command == "import":
        inserted = import_csv(args.csv, table=args.table, chunk_size=args.chunk_size)
        print(f"Inserted {inserted} rows into Supabase")
    elif args.command == "export":
        exported = export_csv(args.out, table=args.table, limit=args.limit)
        print(f"Exported {exported} rows from Supabase")


if __name__ == "__main__":
    main()

export function getErrorMessage(err: unknown, fallback = "Unexpected error"): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  return fallback;
}

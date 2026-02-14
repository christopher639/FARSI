import { describe, expect, it } from "vitest";
import { getErrorMessage } from "@/lib/errors";

describe("getErrorMessage", () => {
  it("returns message from Error instances", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns non-empty string inputs directly", () => {
    expect(getErrorMessage("failed")).toBe("failed");
  });

  it("falls back for unknown values", () => {
    expect(getErrorMessage({})).toBe("Unexpected error");
    expect(getErrorMessage(null, "fallback")).toBe("fallback");
  });
});

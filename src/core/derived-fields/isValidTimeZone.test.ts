import { describe, expect, it } from "vitest";
import { isValidTimeZone } from "@/core/derived-fields/isValidTimeZone";

describe("isValidTimeZone", () => {
  it("accepts IANA names", () => {
    expect(isValidTimeZone("Europe/Paris")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects unknown names and free text", () => {
    expect(isValidTimeZone("Paris")).toBe(false);
    expect(isValidTimeZone("Europe/Pariss")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("not a zone")).toBe(false);
  });
});

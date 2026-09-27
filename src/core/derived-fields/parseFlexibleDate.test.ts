import { describe, expect, it } from "vitest";
import { parseFlexibleDate } from "@/core/derived-fields/parseFlexibleDate";

describe("parseFlexibleDate", () => {
  it("parses an ISO 8601 string", () => {
    const date = parseFlexibleDate("2026-01-15T12:30:00.000Z");
    expect(date.toISOString()).toBe("2026-01-15T12:30:00.000Z");
  });

  it("parses a millisecond epoch string (>10 digits)", () => {
    // Regression: new Date("1782764351598") alone is Invalid Date, even
    // though new Date(1782764351598) (the number) parses correctly.
    const date = parseFlexibleDate("1782764351598");
    expect(date.toISOString()).toBe("2026-06-29T20:19:11.598Z");
  });

  it("parses a second epoch string (<=10 digits)", () => {
    const date = parseFlexibleDate("1782764351");
    expect(date.toISOString()).toBe("2026-06-29T20:19:11.000Z");
  });

  it("returns Invalid Date for garbage input", () => {
    expect(Number.isNaN(parseFlexibleDate("not-a-timestamp").getTime())).toBe(true);
  });

  it("returns Invalid Date for an empty string", () => {
    expect(Number.isNaN(parseFlexibleDate("").getTime())).toBe(true);
  });

  it("trims surrounding whitespace before checking for pure digits", () => {
    const date = parseFlexibleDate("  1782764351598  ");
    expect(date.toISOString()).toBe("2026-06-29T20:19:11.598Z");
  });
});

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

  it("rejects short integers (ids, counts, durations) instead of reading them as 1970 dates", () => {
    for (const value of ["1", "2", "42", "2350", "8080", "12345678"]) {
      expect(Number.isNaN(parseFlexibleDate(value).getTime()), value).toBe(true);
    }
  });

  it("rejects an 11-digit integer (ambiguous between seconds and milliseconds)", () => {
    expect(Number.isNaN(parseFlexibleDate("17827643515").getTime())).toBe(true);
  });

  it("accepts the 9-digit seconds and 12-digit milliseconds boundaries", () => {
    expect(parseFlexibleDate("100000000").toISOString()).toBe("1973-03-03T09:46:40.000Z");
    expect(parseFlexibleDate("100000000000").toISOString()).toBe("1973-03-03T09:46:40.000Z");
  });

  it("does not let V8's lenient parser turn words with a number into dates (host-01 is not 2001-01-01)", () => {
    for (const value of ["host-01", "host-08", "level-3", "abc 12"]) {
      expect(Number.isNaN(parseFlexibleDate(value).getTime()), value).toBe(true);
    }
  });

  it("still accepts the common non-ISO formats", () => {
    expect(parseFlexibleDate("2026-01-15 12:30:00").getFullYear()).toBe(2026);
    expect(parseFlexibleDate("2026-01-15").getFullYear()).toBe(2026);
    expect(parseFlexibleDate("2026-01-15T12:30:00+01:00").toISOString()).toBe("2026-01-15T11:30:00.000Z");
    expect(parseFlexibleDate("Thu, 15 Jan 2026 12:30:00 GMT").toISOString()).toBe("2026-01-15T12:30:00.000Z");
    expect(parseFlexibleDate("Jan 15, 2026 12:30 PM").getFullYear()).toBe(2026);
    expect(parseFlexibleDate("01/15/2026").getFullYear()).toBe(2026);
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

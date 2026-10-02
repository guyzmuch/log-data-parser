import { describe, expect, it } from "vitest";
import { detectColumnPatterns } from "@/core/derived-fields/detectColumnPatterns";

describe("detectColumnPatterns", () => {
  it("detects a date column", () => {
    expect(detectColumnPatterns(["2026-01-15T12:30:00.000Z", "2026-01-16T08:00:00.000Z"])).toContain("date");
  });

  it("detects epoch seconds and milliseconds as dates", () => {
    expect(detectColumnPatterns(["1768480200", "1768480256"])).toContain("date");
    expect(detectColumnPatterns(["1768480200000", "1768480256000"])).toContain("date");
  });

  it("does not detect small integers (ids, counts, durations) as dates", () => {
    expect(detectColumnPatterns(["1", "2", "3", "4"])).not.toContain("date");
    expect(detectColumnPatterns(["142", "89", "2350", "56"])).not.toContain("date");
  });

  it("does not detect a stringified JSON column as JSON (it is reported as escaped chars)", () => {
    const sample = ['{\\"user\\":\\"alice\\"}', '{\\"user\\":\\"bob\\"}'];
    expect(detectColumnPatterns(sample)).toEqual(["stringified-escapes"]);
  });

  it("detects a JSON column", () => {
    expect(detectColumnPatterns(['{"a":1}', '{"b":2}'])).toContain("json");
  });

  it("detects stringified escape sequences", () => {
    expect(detectColumnPatterns(['He said \\"hi\\"', "line1\\nline2"])).toContain("stringified-escapes");
  });

  it("does not report padding (cells are trimmed at parse time; there's no action for it)", () => {
    expect(detectColumnPatterns([" padded ", "  also padded"])).toEqual([]);
  });

  it("detects nothing for plain unremarkable values", () => {
    expect(detectColumnPatterns(["alice", "bob", "carol"])).toEqual([]);
  });

  it("requires majority agreement, not just one match", () => {
    // Only 1 of 4 values looks like a date -> below the default 0.5 threshold.
    expect(detectColumnPatterns(["2026-01-15T12:30:00.000Z", "not a date", "nope", "still not"])).not.toContain(
      "date",
    );
  });

  it("ignores empty values when computing the majority", () => {
    expect(detectColumnPatterns(["2026-01-15T12:30:00.000Z", "", "2026-01-16T08:00:00.000Z"])).toContain("date");
  });

  it("returns an empty array for an empty sample", () => {
    expect(detectColumnPatterns([])).toEqual([]);
  });

  it("respects a custom threshold", () => {
    const sample = ["2026-01-15T12:30:00.000Z", "not a date"]; // 50% match
    expect(detectColumnPatterns(sample, 0.5)).toContain("date");
    expect(detectColumnPatterns(sample, 0.75)).not.toContain("date");
  });
});

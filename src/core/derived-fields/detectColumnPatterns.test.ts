import { describe, expect, it } from "vitest";
import { detectColumnPatterns } from "@/core/derived-fields/detectColumnPatterns";

describe("detectColumnPatterns", () => {
  it("detects a date column", () => {
    expect(detectColumnPatterns(["2026-01-15T12:30:00.000Z", "2026-01-16T08:00:00.000Z"])).toContain("date");
  });

  it("detects a JSON column", () => {
    expect(detectColumnPatterns(['{"a":1}', '{"b":2}'])).toContain("json");
  });

  it("detects stringified escape sequences", () => {
    expect(detectColumnPatterns(['He said \\"hi\\"', "line1\\nline2"])).toContain("stringified-escapes");
  });

  it("detects whitespace padding", () => {
    expect(detectColumnPatterns([" padded ", "  also padded"])).toContain("whitespace-padding");
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

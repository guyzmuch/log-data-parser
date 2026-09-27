import { describe, expect, it } from "vitest";
import { splitIntoRecords } from "@/core/parsing/splitIntoRecords";

describe("splitIntoRecords", () => {
  it("returns an empty array for empty input", () => {
    expect(splitIntoRecords("")).toEqual([]);
  });

  it("splits on \\n", () => {
    expect(splitIntoRecords("a\nb\nc")).toEqual([
      { index: 0, raw: "a" },
      { index: 1, raw: "b" },
      { index: 2, raw: "c" },
    ]);
  });

  it("splits on \\r\\n", () => {
    expect(splitIntoRecords("a\r\nb\r\nc")).toEqual([
      { index: 0, raw: "a" },
      { index: 1, raw: "b" },
      { index: 2, raw: "c" },
    ]);
  });

  it("splits on \\r", () => {
    expect(splitIntoRecords("a\rb\rc")).toEqual([
      { index: 0, raw: "a" },
      { index: 1, raw: "b" },
      { index: 2, raw: "c" },
    ]);
  });

  it("drops exactly one trailing blank line from a final newline", () => {
    expect(splitIntoRecords("a\nb\n")).toEqual([
      { index: 0, raw: "a" },
      { index: 1, raw: "b" },
    ]);
  });

  it("preserves genuine blank lines in the middle", () => {
    expect(splitIntoRecords("a\n\nb")).toEqual([
      { index: 0, raw: "a" },
      { index: 1, raw: "" },
      { index: 2, raw: "b" },
    ]);
  });
});

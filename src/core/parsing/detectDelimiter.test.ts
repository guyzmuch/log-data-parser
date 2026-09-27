import { describe, expect, it } from "vitest";
import { detectDelimiter } from "@/core/parsing/detectDelimiter";

describe("detectDelimiter", () => {
  it("detects comma when it splits every line consistently", () => {
    expect(detectDelimiter(["a,b,c", "d,e,f", "g,h,i"])).toBe(",");
  });

  it("detects tab when it splits every line consistently", () => {
    expect(detectDelimiter(["a\tb\tc", "d\te\tf"])).toBe("\t");
  });

  it("detects pipe over comma when only pipe is consistent", () => {
    expect(detectDelimiter(["a|b,c", "d|e", "f|g,h,i"])).toBe("|");
  });

  it("detects semicolon when comma is present but inconsistent across lines", () => {
    // Semicolon splits every line into exactly 2 fields; comma's field count varies line to line.
    expect(detectDelimiter(["a;b,c", "d;e", "f;g,h,i"])).toBe(";");
  });

  it("falls back to comma when nothing splits consistently", () => {
    expect(detectDelimiter(["abc", "def"])).toBe(",");
  });

  it("falls back to comma for an empty sample", () => {
    expect(detectDelimiter([])).toBe(",");
  });

  it("prefers the delimiter with the higher field count when both are consistent", () => {
    // Comma splits into 4 fields consistently; semicolon splits into 2 fields consistently.
    expect(detectDelimiter(["a,b;c,d", "e,f;g,h"])).toBe(",");
  });
});

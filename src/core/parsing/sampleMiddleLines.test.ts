import { describe, expect, it } from "vitest";
import { sampleMiddleLines } from "@/core/parsing/sampleMiddleLines";

describe("sampleMiddleLines", () => {
  it("returns all lines when there are fewer than the requested count", () => {
    expect(sampleMiddleLines("a\nb\nc", 5)).toEqual(["a", "b", "c"]);
  });

  it("returns all lines when there are exactly the requested count", () => {
    expect(sampleMiddleLines("a\nb\nc", 3)).toEqual(["a", "b", "c"]);
  });

  it("samples from the middle, excluding the first and last lines, for an odd total", () => {
    // 9 lines, sample 3 -> indexes 3,4,5
    const raw = ["l0", "l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8"].join("\n");
    expect(sampleMiddleLines(raw, 3)).toEqual(["l3", "l4", "l5"]);
  });

  it("samples from the middle for an even total", () => {
    // 10 lines, sample 4 -> start = floor((10-4)/2) = 3 -> indexes 3,4,5,6
    const raw = ["l0", "l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8", "l9"].join("\n");
    expect(sampleMiddleLines(raw, 4)).toEqual(["l3", "l4", "l5", "l6"]);
  });

  it("never includes the very first or last line when the dataset is larger than the sample", () => {
    const raw = ["first", "l1", "l2", "l3", "l4", "l5", "last"].join("\n");
    const sample = sampleMiddleLines(raw, 3);
    expect(sample).not.toContain("first");
    expect(sample).not.toContain("last");
  });
});

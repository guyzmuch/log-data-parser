import { describe, expect, it } from "vitest";
import { computeWindow } from "@/components/data-table/windowRange";

describe("computeWindow", () => {
  it("covers the visible rows plus the overscan on both sides", () => {
    // 36px rows, 360px viewport = 10 rows in view; scrolled to row 100.
    expect(computeWindow(3600, 360, 36, 1000, 5)).toEqual({ start: 95, end: 115 });
  });

  it("starts at 0 at the top, without a negative start", () => {
    expect(computeWindow(0, 360, 36, 1000, 5)).toEqual({ start: 0, end: 15 });
  });

  it("stops at the end of the list", () => {
    expect(computeWindow(35_700, 360, 36, 1000, 5)).toEqual({ start: 986, end: 1000 });
  });

  it("renders everything when the list is shorter than the window", () => {
    expect(computeWindow(0, 800, 36, 8, 10)).toEqual({ start: 0, end: 8 });
  });

  it("is empty for an empty list", () => {
    expect(computeWindow(0, 800, 36, 0, 10)).toEqual({ start: 0, end: 0 });
  });

  it("clamps a scroll position beyond the end (the list just got shorter)", () => {
    expect(computeWindow(90_000, 360, 36, 100, 5)).toEqual({ start: 100, end: 100 });
  });

  it("ignores a negative scroll position (elastic scrolling) and a zero-height viewport", () => {
    expect(computeWindow(-50, 360, 36, 100, 2)).toEqual({ start: 0, end: 12 });
    expect(computeWindow(360, 0, 36, 100, 2)).toEqual({ start: 8, end: 12 });
  });
});

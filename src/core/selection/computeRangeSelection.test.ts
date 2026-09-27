import { describe, expect, it } from "vitest";
import { computeRangeSelection } from "@/core/selection/computeRangeSelection";

const noModifiers = { ctrlOrMeta: false, shift: false };
const allVisible = [0, 1, 2, 3, 4, 5];

describe("computeRangeSelection", () => {
  it("plain click selects only the clicked row", () => {
    const { selection, anchorIndex } = computeRangeSelection(new Set([0, 1]), 0, 3, noModifiers, allVisible);
    expect([...selection]).toEqual([3]);
    expect(anchorIndex).toBe(3);
  });

  it("ctrl-click adds the clicked row to the existing selection", () => {
    const { selection, anchorIndex } = computeRangeSelection(
      new Set([1]),
      1,
      4,
      { ctrlOrMeta: true, shift: false },
      allVisible,
    );
    expect([...selection].sort()).toEqual([1, 4]);
    expect(anchorIndex).toBe(4);
  });

  it("ctrl-click on an already-selected row removes it", () => {
    const { selection } = computeRangeSelection(
      new Set([1, 4]),
      4,
      4,
      { ctrlOrMeta: true, shift: false },
      allVisible,
    );
    expect([...selection]).toEqual([1]);
  });

  it("shift-click selects the contiguous visible range from the anchor forward", () => {
    const { selection, anchorIndex } = computeRangeSelection(
      new Set(),
      2,
      5,
      { ctrlOrMeta: false, shift: true },
      allVisible,
    );
    expect([...selection].sort((a, b) => a - b)).toEqual([2, 3, 4, 5]);
    expect(anchorIndex).toBe(2); // anchor stays put on shift-click
  });

  it("shift-click selects the contiguous visible range from the anchor backward", () => {
    const { selection } = computeRangeSelection(new Set(), 5, 2, { ctrlOrMeta: false, shift: true }, allVisible);
    expect([...selection].sort((a, b) => a - b)).toEqual([2, 3, 4, 5]);
  });

  it("shift-click with no prior anchor falls back to a plain click", () => {
    const { selection, anchorIndex } = computeRangeSelection(
      new Set(),
      null,
      3,
      { ctrlOrMeta: false, shift: true },
      allVisible,
    );
    expect([...selection]).toEqual([3]);
    expect(anchorIndex).toBe(3);
  });

  it("shift-click replaces any prior selection with the new range, not union", () => {
    const { selection } = computeRangeSelection(
      new Set([10, 20]),
      2,
      4,
      { ctrlOrMeta: false, shift: true },
      allVisible,
    );
    expect([...selection].sort((a, b) => a - b)).toEqual([2, 3, 4]);
  });

  it("regression: shift-click skips rows filtered out of the visible list, even though their raw index falls in between", () => {
    // 4 records: patch(0), get(1), post(2), get(3) — filtered down to just the "get" rows (1 and 3).
    // A raw index-based range from 1..3 would wrongly include index 2 (post); position-based must not.
    const visibleAfterFilter = [1, 3];
    const { selection } = computeRangeSelection(
      new Set(),
      1,
      3,
      { ctrlOrMeta: false, shift: true },
      visibleAfterFilter,
    );
    expect([...selection].sort((a, b) => a - b)).toEqual([1, 3]);
  });

  it("shift-click falls back to a plain click when the anchor row is no longer visible", () => {
    // Anchor was row 0, but a filter change since then removed it from view.
    const { selection, anchorIndex } = computeRangeSelection(
      new Set(),
      0,
      3,
      { ctrlOrMeta: false, shift: true },
      [1, 2, 3],
    );
    expect([...selection]).toEqual([3]);
    expect(anchorIndex).toBe(3);
  });
});

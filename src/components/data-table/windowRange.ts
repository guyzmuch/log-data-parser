export interface WindowRange {
  /** Index of the first row to render. */
  start: number;
  /** One past the index of the last row to render. */
  end: number;
}

/**
 * Which rows of a fixed-row-height list to put in the DOM for a scroll position: the ones in view plus
 * `overscan` rows on each side, so quick scrolling doesn't flash empty space. Always within [0, count].
 */
export function computeWindow(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  count: number,
  overscan: number,
): WindowRange {
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight) - overscan;
  const last = Math.ceil((Math.max(0, scrollTop) + Math.max(0, viewportHeight)) / rowHeight) + overscan;
  const start = Math.min(Math.max(0, first), count);
  const end = Math.min(Math.max(start, last), count);
  return { start, end };
}

/** Index of the row that contains `y`, given each row's top in `offsets` (with the total height as last entry). */
function rowAt(offsets: number[], y: number): number {
  let low = 0;
  let high = offsets.length - 2;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (offsets[mid] <= y) low = mid;
    else high = mid - 1;
  }
  return low;
}

/**
 * computeWindow for rows of different heights. `offsets[i]` is the top of row i and the last entry is the
 * total height, so `offsets` has one entry more than there are rows.
 */
export function computeVariableWindow(
  scrollTop: number,
  viewportHeight: number,
  offsets: number[],
  overscan: number,
): WindowRange {
  const count = offsets.length - 1;
  if (count <= 0) return { start: 0, end: 0 };
  const top = Math.max(0, scrollTop);
  const start = Math.max(0, rowAt(offsets, top) - overscan);
  const end = Math.min(count, rowAt(offsets, top + Math.max(0, viewportHeight)) + 1 + overscan);
  return { start, end: Math.max(start, end) };
}

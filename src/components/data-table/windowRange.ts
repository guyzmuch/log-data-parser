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

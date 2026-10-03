"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { computeWindow } from "@/components/data-table/windowRange";

/** Assumed until the scroll box has been measured, so the first paint already has enough rows. */
const ASSUMED_VIEWPORT_HEIGHT = 800;
/** The scroll position is tracked in blocks of this many rows, so scrolling within a block re-renders nothing. */
const BLOCK_ROWS = 4;

interface ScrollMetrics {
  scrollTop: number;
  viewportHeight: number;
}

/**
 * Windowing for a scrolling list of fixed-height rows: only the rows near the viewport are rendered.
 * Attach `scrollRef` and `onScroll` to the scroll box, and render rows `range.start` to `range.end`
 * between spacers that stand in for the rest. The box is held in state (a callback ref) so it is
 * measured whenever it mounts, e.g. after an empty or "no match" message gave way to rows.
 */
export function useWindowedRows(count: number, rowHeight: number, overscan: number) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [metrics, setMetrics] = useState<ScrollMetrics>({ scrollTop: 0, viewportHeight: ASSUMED_VIEWPORT_HEIGHT });

  const measure = useCallback(() => {
    if (!element) return;
    const block = rowHeight * BLOCK_ROWS;
    const next = { scrollTop: Math.floor(element.scrollTop / block) * block, viewportHeight: element.clientHeight };
    // Same block and size: keep the old object so React skips the re-render.
    setMetrics((previous) =>
      previous.scrollTop === next.scrollTop && previous.viewportHeight === next.viewportHeight ? previous : next,
    );
  }, [element, rowHeight]);

  useEffect(() => {
    if (!element) return;
    // Observing fires once straight away, which is the first measurement; later it follows window resizes.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, measure]);

  const range = useMemo(
    () => computeWindow(metrics.scrollTop, metrics.viewportHeight, rowHeight, count, overscan),
    [metrics, rowHeight, count, overscan],
  );

  return { scrollRef: setElement, onScroll: measure, range };
}

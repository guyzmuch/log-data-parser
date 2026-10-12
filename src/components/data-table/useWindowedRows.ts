"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { computeVariableWindow } from "@/components/data-table/windowRange";

/** Assumed until the scroll box has been measured, so the first paint already has enough rows. */
const ASSUMED_VIEWPORT_HEIGHT = 800;

interface ScrollMetrics {
  scrollTop: number;
  viewportHeight: number;
}

/**
 * Windowing for a scrolling list of rows: only the rows near the viewport are rendered. `offsets[i]` is the
 * top of row i, with the total height as an extra last entry, so rows can have different heights (a record
 * with JSON array items is taller). Attach `scrollRef` and `onScroll` to the scroll box, and render rows
 * `range.start` to `range.end` between spacers that stand in for the rest. The scroll position is tracked in
 * blocks of `blockHeight` px, so scrolling within a block re-renders nothing. The box is held in state (a
 * callback ref) so it is measured whenever it mounts, e.g. after an empty or "no match" message gave way to rows.
 */
export function useWindowedRows(offsets: number[], blockHeight: number, overscan: number) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [metrics, setMetrics] = useState<ScrollMetrics>({ scrollTop: 0, viewportHeight: ASSUMED_VIEWPORT_HEIGHT });

  const measure = useCallback(() => {
    if (!element) return;
    const next = {
      scrollTop: Math.floor(element.scrollTop / blockHeight) * blockHeight,
      viewportHeight: element.clientHeight,
    };
    // Same block and size: keep the old object so React skips the re-render.
    setMetrics((previous) =>
      previous.scrollTop === next.scrollTop && previous.viewportHeight === next.viewportHeight ? previous : next,
    );
  }, [element, blockHeight]);

  useEffect(() => {
    if (!element) return;
    // Observing fires once straight away, which is the first measurement; later it follows window resizes.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, measure]);

  const range = useMemo(
    // A block is scrolled past in steps, so the window reaches one block further down to never show a gap.
    () => computeVariableWindow(metrics.scrollTop, metrics.viewportHeight + blockHeight, offsets, overscan),
    [metrics, offsets, overscan, blockHeight],
  );

  return { scrollRef: setElement, onScroll: measure, range };
}

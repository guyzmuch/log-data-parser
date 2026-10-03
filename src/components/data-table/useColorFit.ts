"use client";

import { useMemo } from "react";
import { colorFitByField, type ColorFit } from "@/core/display/colorFit";
import { useAppStore } from "@/state/useAppStore";

/**
 * How well each column (Derived Fields included) suits color-coding, by Field key. Memoised on `records`, so it
 * doesn't re-run on search or display changes.
 */
export function useColorFit(): Map<string, ColorFit> {
  const records = useAppStore((s) => s.records);
  return useMemo(() => colorFitByField(records), [records]);
}

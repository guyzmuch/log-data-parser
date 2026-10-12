"use client";

import { useMemo } from "react";
import { detectColumnPatterns, type ColumnPatternKind } from "@/core/derived-fields/detectColumnPatterns";
import { useAppStore } from "@/state/useAppStore";

/** Hint text shown on a column header chip. */
export const PATTERN_LABELS: Record<ColumnPatternKind, string> = {
  date: "date",
  json: "JSON",
  "json-in-text": "JSON in text",
  "stringified-escapes": "escaped chars",
};

const SAMPLE_SIZE = 50;

/**
 * Which patterns each base column's values mostly match, by Field key. Looks at parsed values only,
 * so it's memoised on `records` and doesn't re-run on search or display changes.
 */
export function useDetectedPatterns(): Record<string, ColumnPatternKind[]> {
  const baseFieldNames = useAppStore((s) => s.baseFieldNames);
  const records = useAppStore((s) => s.records);

  return useMemo(() => {
    const sample = records.slice(0, SAMPLE_SIZE);
    const detected: Record<string, ColumnPatternKind[]> = {};
    for (const key of baseFieldNames) {
      // A JSON array column is judged on its items.
      const values = sample.flatMap((record) => record.fields.filter((f) => f.key === key).flatMap((f) => f.items ?? [f.value]));
      detected[key] = detectColumnPatterns(values);
    }
    return detected;
  }, [baseFieldNames, records]);
}

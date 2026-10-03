import type { ParsedRecord } from "@/core/dataset/types";
import { normalizeColorKey } from "@/core/display/valueColor";

/** A column with more different values than this can't be told apart by color: there are only about a dozen distinguishable colors. */
export const MAX_COLOR_VALUES = 12;

/**
 * Whether a column suits color-coding:
 * - "good": a handful of different values (2 to MAX_COLOR_VALUES) that repeat, each used twice or more on average,
 *   e.g. a method or a level. This is the one that gets suggested.
 * - "varied": few enough values to color, but they mostly occur once (a short list of ids or timestamps). Allowed, not suggested.
 * - "single": every value is the same, so color-coding would show one color
 * - "too-many": more different values than colors, e.g. ids or timestamps
 * - "empty": nothing but blanks
 */
export type ColorFitStatus = "good" | "varied" | "single" | "too-many" | "empty";

export interface ColorFit {
  /** Different values (as colored: blanks and case ignored), counted up to MAX_COLOR_VALUES + 1. */
  distinct: number;
  status: ColorFitStatus;
}

/**
 * How well each column suits color-coding, by Field key, over every Record (a column that looks tidy in the first
 * rows can still turn out to have thousands of values). Counting stops for a column once it is over the limit,
 * so a column of ids costs almost nothing. Blank values and Parse Errors are not counted.
 */
export function colorFitByField(records: ParsedRecord[]): Map<string, ColorFit> {
  const seen = new Map<string, { values: Set<string>; count: number }>();

  for (const record of records) {
    for (const field of record.fields) {
      let column = seen.get(field.key);
      if (!column) {
        column = { values: new Set(), count: 0 };
        seen.set(field.key, column);
      }
      if (field.parseError || column.values.size > MAX_COLOR_VALUES) continue;
      const value = normalizeColorKey(field.value);
      if (value === "") continue;
      column.values.add(value);
      column.count++;
    }
  }

  const fits = new Map<string, ColorFit>();
  for (const [key, { values, count }] of seen) {
    const distinct = values.size;
    const status: ColorFitStatus =
      distinct === 0
        ? "empty"
        : distinct === 1
          ? "single"
          : distinct > MAX_COLOR_VALUES
            ? "too-many"
            : distinct * 2 <= count
              ? "good"
              : "varied";
    fits.set(key, { distinct, status });
  }
  return fits;
}

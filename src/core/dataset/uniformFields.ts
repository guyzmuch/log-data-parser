import type { ParsedRecord } from "@/core/dataset/types";

/**
 * A column that tells nothing apart from row to row:
 * - "empty": every value is blank (only whitespace, or missing)
 * - "same": every Record has the same non-blank value
 */
export type UniformColumn = { kind: "empty" } | { kind: "same"; value: string };

/**
 * The columns whose values are all blank or all the same, by Field key, over every Record. A Parse Error counts as
 * data that differs from everything (a column of failed dates is broken, not uniform). A Record without the Field
 * counts as blank there. Values are compared with surrounding blanks ignored. A Dataset of one Record has no "same"
 * column: with nothing to compare, every column would be one.
 */
export function uniformFields(records: ParsedRecord[]): Map<string, UniformColumn> {
  const seen = new Map<string, { value: string | null; count: number; varies: boolean }>();

  for (const record of records) {
    for (const field of record.fields) {
      let column = seen.get(field.key);
      if (!column) {
        column = { value: null, count: 0, varies: false };
        seen.set(field.key, column);
      }
      column.count++;
      if (column.varies) continue;
      if (field.parseError) {
        column.varies = true;
        continue;
      }
      // A JSON array column is judged on its items.
      for (const raw of field.items ?? [field.value]) {
        const value = raw.trim();
        if (column.value === null) column.value = value;
        else if (value !== column.value) column.varies = true;
      }
    }
  }

  const uniform = new Map<string, UniformColumn>();
  for (const [key, { value, count, varies }] of seen) {
    if (varies) continue;
    if (value === null || value === "") {
      uniform.set(key, { kind: "empty" });
    } else if (count === records.length && records.length > 1) {
      // Records lacking the Field are blank there, so the value isn't the same everywhere.
      uniform.set(key, { kind: "same", value });
    }
  }
  return uniform;
}

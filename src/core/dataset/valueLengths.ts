import type { ParsedRecord } from "@/core/dataset/types";

/** What a Parse Error cell shows in the table, so the column is at least that wide. */
const PARSE_ERROR_TEXT_LENGTH = "Invalid parse".length;

/**
 * The longest displayed value of each Field across all Records, by Field key, in one pass.
 * The table uses it to give each column a stable width without rendering every row (a
 * windowed table only has a few rows in the DOM, so the browser can't size columns from content).
 */
export function maxValueLengths(records: ParsedRecord[]): Map<string, number> {
  const longest = new Map<string, number>();
  for (const record of records) {
    for (const field of record.fields) {
      const length = field.parseError ? PARSE_ERROR_TEXT_LENGTH : field.value.length;
      if (length > (longest.get(field.key) ?? 0)) longest.set(field.key, length);
    }
  }
  return longest;
}

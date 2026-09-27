import type { ParsedRecord } from "@/core/dataset/types";

/**
 * Case-insensitive substring match against the value of any Visible Field
 * (fields not currently visible are ignored, even if their value matches).
 * An empty/whitespace-only term matches every Record — "no search active".
 */
export function matchesSearch(record: ParsedRecord, visibleFieldKeys: string[], term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (needle === "") return true;

  return visibleFieldKeys.some((key) => {
    const field = record.fields.find((f) => f.key === key);
    return field !== undefined && field.value.toLowerCase().includes(needle);
  });
}

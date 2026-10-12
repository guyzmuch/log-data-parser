import type { ParsedRecord } from "@/core/dataset/types";
import { derivedFieldKey } from "@/core/derived-fields/derivedFieldKey";
import type { DerivedFieldSpec } from "@/core/derived-fields/types";
import type { JsonColumns } from "@/core/json/types";

/** "info.trace[].line" → "info.trace[]": the array a column name belongs to, from the name alone. */
export function arrayKeyFromName(key: string): string | undefined {
  const at = key.indexOf("[]");
  return at === -1 ? undefined : key.slice(0, at + 2);
}

/**
 * The array each array column belongs to, by Field key: the JSON columns of a root-level array, plus the
 * Derived Fields computed from them (they have one value per item too).
 */
export function buildArrayKeyByField(jsonColumns: JsonColumns, derivedFieldSelections: DerivedFieldSpec[]): Map<string, string> {
  const byField = new Map<string, string>();
  for (const [key, info] of Object.entries(jsonColumns)) {
    if (info.arrayKey) byField.set(key, info.arrayKey);
  }
  for (const spec of derivedFieldSelections) {
    const arrayKey = byField.get(spec.sourceFieldKey);
    if (arrayKey) byField.set(derivedFieldKey(spec), arrayKey);
  }
  return byField;
}

/** How many items each array has in a Record, by array key. An array the Record doesn't have is left out. */
export function arrayItemCounts(record: ParsedRecord, arrayKeyByField: ReadonlyMap<string, string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const field of record.fields) {
    const arrayKey = arrayKeyByField.get(field.key);
    if (!arrayKey || !field.items) continue;
    counts.set(arrayKey, Math.max(counts.get(arrayKey) ?? 0, field.items.length));
  }
  return counts;
}

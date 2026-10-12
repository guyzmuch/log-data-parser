import type { ParsedRecord } from "@/core/dataset/types";

/**
 * "This column is (or is not) exactly this value", added by clicking a cell. Every filter that is enabled
 * must hold for a Record to stay in view (they combine with AND). Session-only, like hidden Records.
 */
export interface FieldFilter {
  id: string;
  /** Field key of the column. */
  key: string;
  /** The exact cell value (an empty string stands for an empty cell). */
  value: string;
  /** True for "filter out": keep the Records whose value is NOT this one. */
  negate: boolean;
  /** A disabled filter stays listed but doesn't filter. */
  disabled: boolean;
}

/** The filters that currently filter. */
export function enabledFilters(filters: readonly FieldFilter[]): FieldFilter[] {
  return filters.filter((filter) => !filter.disabled);
}

/**
 * Whether a Record passes every enabled filter. The value is compared exactly (case and blanks count), not as a
 * search term. A Parse Error cell or a missing Field has no value: it never equals anything, so a "filter for" drops
 * the Record and a "filter out" keeps it.
 */
export function matchesFieldFilters(record: ParsedRecord, filters: readonly FieldFilter[]): boolean {
  for (const filter of filters) {
    if (filter.disabled) continue;
    const field = record.fields.find((f) => f.key === filter.key);
    // A JSON array column matches when any of its items is the value (or the whole joined cell is).
    const equal =
      field !== undefined && !field.parseError && (field.value === filter.value || field.items?.includes(filter.value) === true);
    if (filter.negate ? equal : !equal) return false;
  }
  return true;
}

/**
 * Adds a filter, without ever listing the same column and value twice: asking again for the same thing just turns
 * it back on, and asking for the opposite one flips the existing filter.
 */
export function addFieldFilter(
  filters: readonly FieldFilter[],
  id: string,
  key: string,
  value: string,
  negate: boolean,
): FieldFilter[] {
  const existing = filters.find((filter) => filter.key === key && filter.value === value);
  if (!existing) return [...filters, { id, key, value, negate, disabled: false }];
  return filters.map((filter) => (filter === existing ? { ...filter, negate, disabled: false } : filter));
}

/** The filters whose column exists. */
export function pruneFieldFilters(filters: readonly FieldFilter[], knownKeys: ReadonlySet<string>): FieldFilter[] {
  return filters.filter((filter) => knownKeys.has(filter.key));
}

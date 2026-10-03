import type { ColumnOption, ColumnOptionsMap } from "@/core/profile/types";

const OPTIONS: ColumnOption[] = ["secondLine", "colorCode"];

/** Whether a column has this option on. */
export function hasColumnOption(map: ColumnOptionsMap | undefined, key: string, option: ColumnOption): boolean {
  return map?.[key]?.[option] === true;
}

/** The keys that have `option` on, in the order of `order` (keys not in `order` are left out). */
export function keysWithOption(map: ColumnOptionsMap | undefined, option: ColumnOption, order: string[]): string[] {
  return order.filter((key) => hasColumnOption(map, key, option));
}

/** The map with one option of one column turned on or off. Empty entries are removed; undefined when nothing is left. */
export function setColumnOption(
  map: ColumnOptionsMap | undefined,
  key: string,
  option: ColumnOption,
  on: boolean,
): ColumnOptionsMap | undefined {
  const next: ColumnOptionsMap = { ...map };
  const entry = { ...next[key] };
  if (on) entry[option] = true;
  else delete entry[option];

  if (Object.keys(entry).length > 0) next[key] = entry;
  else delete next[key];
  return Object.keys(next).length > 0 ? next : undefined;
}

/** Keeps only the entries of keys in `knownKeys`. Undefined when nothing is left. */
export function pruneColumnOptions(map: ColumnOptionsMap | undefined, knownKeys: ReadonlySet<string>): ColumnOptionsMap | undefined {
  if (!map) return undefined;
  const next: ColumnOptionsMap = {};
  for (const [key, entry] of Object.entries(map)) {
    if (knownKeys.has(key)) next[key] = entry;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Turns an unknown value (from storage or an imported file) into a safe map: only known options set to
 * true survive. `legacySecondLineKeys` is the older `secondLineKeys` list, folded in as `secondLine`.
 */
export function normalizeColumnOptions(value: unknown, legacySecondLineKeys?: unknown): ColumnOptionsMap | undefined {
  let map: ColumnOptionsMap | undefined;

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry !== "object" || entry === null) continue;
      for (const option of OPTIONS) {
        if ((entry as Record<string, unknown>)[option] === true) map = setColumnOption(map, key, option, true);
      }
    }
  }

  if (Array.isArray(legacySecondLineKeys)) {
    for (const key of legacySecondLineKeys) {
      if (typeof key === "string") map = setColumnOption(map, key, "secondLine", true);
    }
  }

  return map;
}

import { derivedFieldKey } from "@/core/derived-fields/derivedFieldKey";
import { isDerivedFieldSpec } from "@/core/derived-fields/isDerivedFieldSpec";
import type { DisplayConfig } from "@/core/profile/types";

/**
 * Makes a (possibly stale) display config consistent with the Fields a Dataset
 * actually parsed to, so applying a saved Profile to a different Dataset — or
 * re-saving after the parsing config changed — never leaves ghost columns:
 *
 * - Derived Field specs whose source column doesn't exist (or that are of an
 *   unsupported kind, or collide with an existing key) are dropped.
 * - Visible keys that don't exist are dropped; if none survive (nothing in
 *   common, or nothing set yet, e.g. a built-in template) everything is made
 *   visible. A column the Profile has never seen stays hidden otherwise — a
 *   Profile can't tell "new" from "deliberately hidden".
 * - Labels and search state carry over untouched.
 */
export function reconcileDisplay(display: DisplayConfig, baseFieldNames: string[]): DisplayConfig {
  const baseKeys = new Set(baseFieldNames);

  const seenKeys = new Set<string>();
  const derivedFieldSelections = display.derivedFieldSelections.filter((spec) => {
    if (!isDerivedFieldSpec(spec) || !baseKeys.has(spec.sourceFieldKey)) return false;
    const key = derivedFieldKey(spec);
    if (baseKeys.has(key) || seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  const knownKeys = new Set([...baseFieldNames, ...seenKeys]);
  const visibleFieldKeys = [...new Set(display.visibleFieldKeys)].filter((key) => knownKeys.has(key));

  return {
    ...display,
    derivedFieldSelections,
    visibleFieldKeys: visibleFieldKeys.length > 0 ? visibleFieldKeys : [...baseFieldNames, ...seenKeys],
  };
}

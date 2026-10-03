import { derivedFieldKey } from "@/core/derived-fields/derivedFieldKey";
import type { DisplayConfig } from "@/core/profile/types";

/** Every Field key in natural order: base columns as parsed, then Derived Fields in the order they were added. */
export function naturalFieldOrder(baseFieldNames: string[], display: DisplayConfig): string[] {
  return [...baseFieldNames, ...display.derivedFieldSelections.map(derivedFieldKey)];
}

/**
 * The full column order, hidden columns included. Profiles saved before `fieldOrder` existed fall back to
 * "shown columns in their order, then the rest naturally" (reconcileDisplay does the same when applying).
 */
export function currentFieldOrder(display: DisplayConfig, baseFieldNames: string[]): string[] {
  if (display.fieldOrder) return display.fieldOrder;
  const shown = new Set(display.visibleFieldKeys);
  return [...display.visibleFieldKeys, ...naturalFieldOrder(baseFieldNames, display).filter((key) => !shown.has(key))];
}

/** The shown subset of `order`, in `order`. This is what keeps a hidden column's place when it's hidden and shown again. */
export function visibleInOrder(order: string[], shown: ReadonlySet<string>): string[] {
  return order.filter((key) => shown.has(key));
}

/** `order` with `key` moved to sit just before `beforeKey` (or to the end when null). Unchanged if either key isn't in it. */
export function moveBefore(order: string[], key: string, beforeKey: string | null): string[] {
  if (key === beforeKey || !order.includes(key) || (beforeKey !== null && !order.includes(beforeKey))) return order;
  const without = order.filter((k) => k !== key);
  const at = beforeKey === null ? without.length : without.indexOf(beforeKey);
  return [...without.slice(0, at), key, ...without.slice(at)];
}

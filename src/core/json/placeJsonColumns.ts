import type { JsonColumns } from "@/core/json/types";
import { visibleInOrder } from "@/core/profile/fieldOrder";
import type { Profile, ViewColumns } from "@/core/profile/types";

/**
 * Puts the JSON columns a column layout has never seen right after their source column (after the JSON
 * columns it already has there), shown. The first time a source column gets JSON columns it is hidden:
 * the parsed columns are usually what is wanted, not the raw cell. It can be shown again like any column.
 *
 * Runs before reconcileDisplay, which would otherwise add these columns at the end, hidden. A layout with
 * nothing shown yet (a built-in template) is left alone: reconcileDisplay shows everything there.
 */
export function placeJsonColumns<T extends ViewColumns>(columns: T, fieldNames: string[], jsonColumns: JsonColumns): T {
  if (columns.visibleFieldKeys.length === 0) return columns;

  const shownBefore = new Set(columns.visibleFieldKeys);
  const order = columns.fieldOrder
    ? [...columns.fieldOrder]
    : [...columns.visibleFieldKeys, ...fieldNames.filter((key) => !shownBefore.has(key) && !jsonColumns[key])];
  const known = new Set(order);
  const newKeys = fieldNames.filter((key) => jsonColumns[key] && !known.has(key));
  if (newKeys.length === 0) return columns;

  const shown = new Set(shownBefore);
  for (const key of newKeys) {
    const source = jsonColumns[key].sourceKey;
    const isFamily = (k: string) => k === source || jsonColumns[k]?.sourceKey === source;
    if (!order.some((k) => jsonColumns[k]?.sourceKey === source)) shown.delete(source);
    const anchor = order.findLastIndex(isFamily);
    order.splice(anchor === -1 ? order.length : anchor + 1, 0, key);
    shown.add(key);
  }

  return { ...columns, fieldOrder: order, visibleFieldKeys: visibleInOrder(order, shown) };
}

/** placeJsonColumns on a Profile's display and on each of its saved views. */
export function placeJsonColumnsInProfile(profile: Profile, fieldNames: string[], jsonColumns: JsonColumns): Profile {
  if (Object.keys(jsonColumns).length === 0) return profile;
  return {
    ...profile,
    display: placeJsonColumns(profile.display, fieldNames, jsonColumns),
    ...(profile.views ? { views: profile.views.map((view) => placeJsonColumns(view, fieldNames, jsonColumns)) } : {}),
  };
}

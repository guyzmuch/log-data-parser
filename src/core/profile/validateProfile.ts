import { isDerivedFieldSpec } from "@/core/derived-fields/isDerivedFieldSpec";
import { DELIMITER_CANDIDATES } from "@/core/parsing/delimiter";
import { normalizeColumnOptions } from "@/core/profile/columnOptions";
import type { ParsingConfig } from "@/core/parsing/types";
import type { DisplayConfig, Profile, ProfileView, SearchState } from "@/core/profile/types";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalizeParsing(value: unknown): ParsingConfig | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const v = value as Record<string, unknown>;

  if (
    v.kind !== "delimiter" ||
    typeof v.delimiter !== "string" ||
    !(DELIMITER_CANDIDATES as string[]).includes(v.delimiter) ||
    typeof v.hasHeaderRow !== "boolean" ||
    typeof v.stripQuotes !== "boolean" ||
    (v.trimCells !== undefined && typeof v.trimCells !== "boolean") ||
    (v.quoteAware !== undefined && typeof v.quoteAware !== "boolean") ||
    typeof v.trimBoundaryPartials !== "boolean" ||
    typeof v.expectedFieldCount !== "number" ||
    (v.fieldNames !== undefined && !isStringArray(v.fieldNames)) ||
    (v.jsonFieldKeys !== undefined && !isStringArray(v.jsonFieldKeys))
  ) {
    return undefined;
  }

  return value as ParsingConfig;
}

function normalizeSearchState(value: unknown): SearchState | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.term !== "string" || (v.mode !== "highlight" && v.mode !== "filter")) return undefined;
  return { term: v.term, mode: v.mode };
}

function normalizeDisplay(value: unknown): DisplayConfig | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const v = value as Record<string, unknown>;

  const fieldLabels: Record<string, string> = {};
  if (typeof v.fieldLabels === "object" && v.fieldLabels !== null) {
    for (const [key, label] of Object.entries(v.fieldLabels)) {
      if (typeof label === "string") fieldLabels[key] = label;
    }
  }

  const columnWidths: Record<string, number> = {};
  if (typeof v.columnWidths === "object" && v.columnWidths !== null) {
    for (const [key, width] of Object.entries(v.columnWidths)) {
      if (typeof width === "number" && Number.isFinite(width) && width > 0) columnWidths[key] = width;
    }
  }

  const searchState = normalizeSearchState(v.searchState);
  // `secondLineKeys` is what second-line columns were stored as before columnOptions existed.
  const columnOptions = normalizeColumnOptions(v.columnOptions, v.secondLineKeys);

  return {
    ...(Object.keys(columnWidths).length > 0 ? { columnWidths } : {}),
    visibleFieldKeys: Array.isArray(v.visibleFieldKeys) ? v.visibleFieldKeys.filter((k) => typeof k === "string") : [],
    ...(Array.isArray(v.fieldOrder) ? { fieldOrder: v.fieldOrder.filter((k) => typeof k === "string") } : {}),
    ...(columnOptions ? { columnOptions } : {}),
    fieldLabels,
    // Unknown/legacy kinds are dropped rather than rejecting the whole Profile.
    derivedFieldSelections: Array.isArray(v.derivedFieldSelections) ? v.derivedFieldSelections.filter(isDerivedFieldSpec) : [],
    ...(searchState ? { searchState } : {}),
  };
}

/** Keeps the well-formed views; undefined when none survive (the Profile then just has no saved views). */
function normalizeViews(value: unknown): ProfileView[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seenIds = new Set<string>();
  const views: ProfileView[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const v = item as Record<string, unknown>;
    if (typeof v.id !== "string" || typeof v.name !== "string" || seenIds.has(v.id) || !isStringArray(v.visibleFieldKeys)) continue;
    seenIds.add(v.id);
    const columnOptions = normalizeColumnOptions(v.columnOptions, v.secondLineKeys);
    views.push({
      id: v.id,
      name: v.name,
      visibleFieldKeys: v.visibleFieldKeys,
      ...(isStringArray(v.fieldOrder) ? { fieldOrder: v.fieldOrder } : {}),
      ...(columnOptions ? { columnOptions } : {}),
    });
  }
  return views.length > 0 ? views : undefined;
}

/**
 * Turns an unknown value (a localStorage entry or an imported file's entry)
 * into a safe Profile, or undefined if it isn't one. Structural problems in
 * `parsing` reject the Profile (it can't be applied); problems in `display`
 * are repaired — missing arrays default to empty, and Derived Field specs of
 * an unsupported kind are dropped — so one stale spec can't brick a saved
 * Profile (or, worse, crash the table on apply).
 */
export function normalizeProfile(value: unknown): Profile | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const v = value as Record<string, unknown>;

  if (
    typeof v.id !== "string" ||
    typeof v.name !== "string" ||
    typeof v.createdAt !== "string" ||
    typeof v.updatedAt !== "string"
  ) {
    return undefined;
  }

  const parsing = normalizeParsing(v.parsing);
  const display = normalizeDisplay(v.display);
  if (!parsing || !display) return undefined;

  const views = normalizeViews(v.views);
  const activeViewId = views?.some((view) => view.id === v.activeViewId) ? (v.activeViewId as string) : undefined;

  return {
    id: v.id,
    name: v.name,
    parsing,
    display,
    ...(views ? { views } : {}),
    ...(activeViewId ? { activeViewId } : {}),
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

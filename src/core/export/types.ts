/**
 * Which Records get exported — mutually exclusive, not combinable toggles
 * (see Export Scope in CONTEXT.md). Columns are always the current Visible
 * Fields/order, regardless of scope.
 */
export type ExportScope = "all" | "excluding-hidden" | "matching-filter";

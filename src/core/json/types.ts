/** How deep nested objects are flattened into their own columns (`info.a.b.c.d.e`); deeper values stay as JSON text. */
export const MAX_JSON_DEPTH = 5;

/** Where a column produced by the parsing rule's JSON option comes from. */
export interface JsonColumnInfo {
  /** The split column whose cells held the JSON. */
  sourceKey: string;
  /** Set on the columns of one root-level array (e.g. "info.trace[]"): all columns of that array share it. */
  arrayKey?: string;
  /** True for the "(text)" column: the cell's text outside the JSON. */
  text?: boolean;
}

/** JSON columns by Field key. A column that isn't listed is a plain split column (or a Derived Field). */
export type JsonColumns = Record<string, JsonColumnInfo>;

/**
 * How the items of a root-level array are shown in the table (the CSV export always puts them in one cell, one per line):
 * - "table" (default): a collapsible table of its own under the record.
 * - "rows": the array's columns stay in the main table, one line per item inside the record.
 */
export type ArrayMode = "table" | "rows";

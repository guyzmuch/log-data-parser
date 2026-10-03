export type Delimiter = "," | "\t" | "|" | ";" | " ";

/**
 * How to split a Record into Fields. A discriminated union so future kinds
 * (e.g. `{ kind: 'regex' }`) can be added without restructuring Profile/Dataset.
 */
export interface DelimiterParsingConfig {
  kind: "delimiter";
  delimiter: Delimiter;
  hasHeaderRow: boolean;
  /** Strips one pair of surrounding quotes from each cell and header name (plain splitting only). */
  stripQuotes: boolean;
  /**
   * Removes the blanks around each cell and header name. New Profiles have it on. Omitted (Profiles
   * saved before this existed) means "same as stripQuotes", which is what they always did.
   */
  trimCells?: boolean;
  /**
   * Parse with CSV quoting rules (via PapaParse) instead of a plain split: a delimiter or a line break
   * inside "double quotes" stays in the cell, and `""` is a literal quote. The parser removes the quotes
   * itself, so `stripQuotes` has no effect then. Omitted means off; Profiles saved before this existed
   * behave exactly as before.
   */
  quoteAware?: boolean;
  /** Compares the first/last Record's Field count against expectedFieldCount and drops it if short. */
  trimBoundaryPartials: boolean;
  /** Ground truth for boundary trimming, frozen into the Profile at wizard-config time. */
  expectedFieldCount: number;
  /** Field names in order, from a detected/confirmed header row, or user-assigned. */
  fieldNames?: string[];
}

export type ParsingConfig = DelimiterParsingConfig;

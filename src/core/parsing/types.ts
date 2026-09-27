export type Delimiter = "," | "\t" | "|" | ";";

/**
 * How to split a Record into Fields. A discriminated union so future kinds
 * (e.g. `{ kind: 'regex' }`) can be added without restructuring Profile/Dataset.
 */
export interface DelimiterParsingConfig {
  kind: "delimiter";
  delimiter: Delimiter;
  hasHeaderRow: boolean;
  stripQuotes: boolean;
  /** Compares the first/last Record's Field count against expectedFieldCount and drops it if short. */
  trimBoundaryPartials: boolean;
  /** Ground truth for boundary trimming, frozen into the Profile at wizard-config time. */
  expectedFieldCount: number;
  /** Field names in order, from a detected/confirmed header row, or user-assigned. */
  fieldNames?: string[];
}

export type ParsingConfig = DelimiterParsingConfig;

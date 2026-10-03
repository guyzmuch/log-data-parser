/** The whole blob of content a user has uploaded or pasted in one go. */
export interface Dataset {
  rawText: string;
  /** Where it came from: a file name, a sample's name, or "Pasted text". Display only. */
  name?: string;
}

/** One line within a Dataset, before any parsing. */
export interface RecordLine {
  index: number;
  raw: string;
}

/**
 * One named value within a Record. A Field with `sourceFieldKey` set is a
 * Derived Field, computed from another Field rather than produced directly
 * by splitting a Record.
 */
export interface Field {
  key: string;
  value: string;
  sourceFieldKey?: string;
  /** Set when a Derived Field's computation failed (e.g. invalid date parse). `value` is meaningless when true. */
  parseError?: boolean;
}

/** One parsed line: the full set of Fields, independent of what a Profile currently displays. */
export interface ParsedRecord {
  index: number;
  raw: string;
  fields: Field[];
}

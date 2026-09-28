export type IanaTimeZone = string;

/**
 * Discriminated union so new kinds can be added without restructuring
 * DisplayConfig. `kind` distinguishes them; each Derived Field type from
 * `computeDerivedFields` for what a spec of that kind actually computes.
 */
export interface DateDerivedFieldSpec {
  kind: "date";
  sourceFieldKey: string;
  // No "raw" representation: it would just duplicate the source Field's own
  // value as a second column, which is never useful — the source Field is
  // already right there.
  representation: "iso" | "timezone";
  /** IANA zone (e.g. "Europe/Paris"). Ignored unless representation is "timezone"; omitted there means browser-local. */
  timezone?: IanaTimeZone;
}

/** Trims leading/trailing whitespace from the source Field's value. */
export interface TrimDerivedFieldSpec {
  kind: "trim";
  sourceFieldKey: string;
}

/** Un-escapes common backslash sequences (\", \\, \n, \t, \r) from a stringified value. */
export interface UnescapeDerivedFieldSpec {
  kind: "unescape";
  sourceFieldKey: string;
}

/**
 * Extracts one top-level key from a source Field's value, parsed as a JSON
 * object. One spec per discovered key — see discoverJsonKeys.ts. Nested
 * objects/arrays are not recursively exploded further (v1 keeps this to one
 * level), just stringified back for display.
 */
export interface JsonKeyDerivedFieldSpec {
  kind: "json-key";
  sourceFieldKey: string;
  jsonKey: string;
}

export type DerivedFieldSpec =
  | DateDerivedFieldSpec
  | TrimDerivedFieldSpec
  | UnescapeDerivedFieldSpec
  | JsonKeyDerivedFieldSpec;

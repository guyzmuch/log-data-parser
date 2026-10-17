import type { UrlPart } from "@/core/derived-fields/parseUrl";
import type { UserAgentPart } from "@/core/derived-fields/parseUserAgent";

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
  //
  // "utc-date" ("2026-01-15") and "utc-time" ("12:30:48", with ".137" only when there are milliseconds) are the two
  // halves of the same instant in UTC, as separate columns: handy for filtering and color-coding, which want few
  // different values per column.
  representation: "iso" | "timezone" | "utc-date" | "utc-time";
  /** IANA zone (e.g. "Europe/Paris"). Ignored unless representation is "timezone"; omitted there means browser-local. */
  timezone?: IanaTimeZone;
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

/**
 * Extracts one key from the first `{key="value",count=34}` set of a source Field's value (Prometheus labels, or
 * any JSON-like braces using `=`). One spec per discovered key — see discoverKeyValueKeys.ts.
 */
export interface KeyValueKeyDerivedFieldSpec {
  kind: "key-value-key";
  sourceFieldKey: string;
  key: string;
}

/** The text of a source Field outside its `{key=value}` set, before and after joined: the Prometheus metric name, value and timestamp. */
export interface KeyValueTextDerivedFieldSpec {
  kind: "key-value-text";
  sourceFieldKey: string;
}

/** One part (protocol, hostname, port, pathname, search) of the first URL or path in a source Field's value. See parseUrl. */
export interface UrlPartDerivedFieldSpec {
  kind: "url-part";
  sourceFieldKey: string;
  part: UrlPart;
}

/** One decoded query parameter (`?q=boots&page=2`) of that URL. One spec per discovered parameter. */
export interface UrlQueryKeyDerivedFieldSpec {
  kind: "url-query-key";
  sourceFieldKey: string;
  param: string;
}

/** Decodes a base64 value as UTF-8 text. A value that isn't base64 text is a Parse Error. */
export interface Base64DerivedFieldSpec {
  kind: "base64";
  sourceFieldKey: string;
}

/** One part of a user agent string (browser, its version, OS, device type). One spec per part, see parseUserAgent. */
export interface UserAgentDerivedFieldSpec {
  kind: "user-agent";
  sourceFieldKey: string;
  part: UserAgentPart;
}

export type DerivedFieldSpec =
  | DateDerivedFieldSpec
  | UnescapeDerivedFieldSpec
  | JsonKeyDerivedFieldSpec
  | KeyValueKeyDerivedFieldSpec
  | KeyValueTextDerivedFieldSpec
  | UrlPartDerivedFieldSpec
  | UrlQueryKeyDerivedFieldSpec
  | Base64DerivedFieldSpec
  | UserAgentDerivedFieldSpec;

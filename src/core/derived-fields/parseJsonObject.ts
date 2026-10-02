import { unescapeStringified } from "@/core/derived-fields/unescapeStringified";

/** Parses `value` as JSON, returning the object only if it's a genuine plain object (not an array, string, number, null). */
export function tryParseJsonObject(value: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Like tryParseJsonObject, but also accepts a *stringified* JSON object — what
 * a cell looks like when the JSON was copy-pasted out of another JSON string:
 * `{\"user\":\"alice\"}` (escapes left over after quote stripping) or the fully
 * quoted `"{\"user\":\"alice\"}"`. Used to extract keys; the column-pattern
 * detector keeps using the strict version so such a column is reported as
 * "escaped chars", not "JSON".
 */
export function tryParseJsonObjectLenient(value: string): Record<string, unknown> | undefined {
  const strict = tryParseJsonObject(value);
  if (strict) return strict;

  // Fully quoted stringified JSON: the first parse yields the inner string.
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === "string") return tryParseJsonObject(parsed);
  } catch {
    // not a JSON string literal — fall through to the unescape attempt
  }

  return tryParseJsonObject(unescapeStringified(value.trim()));
}

/** Renders one JSON value for display in a cell — primitives as-is, objects/arrays stringified (not recursively exploded further in v1). */
export function stringifyJsonValue(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  return JSON.stringify(value);
}

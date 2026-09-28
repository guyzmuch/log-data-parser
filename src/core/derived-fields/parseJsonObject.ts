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

/** Renders one JSON value for display in a cell — primitives as-is, objects/arrays stringified (not recursively exploded further in v1). */
export function stringifyJsonValue(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  return JSON.stringify(value);
}

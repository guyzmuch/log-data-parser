import { stringifyJsonValue } from "@/core/derived-fields/parseJsonObject";
import { isPlainObject, parseJsonContainerLenient, type JsonContainer } from "@/core/json/findEmbeddedJson";
import { MAX_JSON_DEPTH } from "@/core/json/types";

/** One cell's JSON as column values. */
export interface FlatJson {
  /** Column key → value, in the order the keys were met. */
  scalars: Map<string, string>;
  /** Root-level array key (e.g. "info.trace[]") → its items, each as column key → value. */
  arrays: Map<string, Map<string, string>[]>;
}

/** A string that holds JSON (`"[{\"a\":1}]"`) becomes that JSON; anything else is returned as is. */
function decode(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  return parseJsonContainerLenient(trimmed) ?? value;
}

/**
 * Writes one value under `key`: an object is flattened into `key.child` columns while `level` (how many keys
 * deep `key` is) is under MAX_JSON_DEPTH; deeper objects and arrays that aren't at the root are kept as JSON text.
 * `arrays` is only passed for the root's direct children: those are the arrays split into items.
 */
function walk(
  key: string,
  raw: unknown,
  level: number,
  into: Map<string, string>,
  arrays: Map<string, Map<string, string>[]> | null,
): void {
  const value = decode(raw);
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (level >= MAX_JSON_DEPTH || entries.length === 0) {
      into.set(key, JSON.stringify(value));
      return;
    }
    for (const [child, childValue] of entries) walk(`${key}.${child}`, childValue, level + 1, into, null);
    return;
  }
  if (Array.isArray(value) && arrays) {
    const arrayKey = `${key}[]`;
    arrays.set(arrayKey, value.map((item) => flattenItem(arrayKey, item, level)));
    return;
  }
  into.set(key, stringifyJsonValue(value));
}

/** One array item: an object gives `arrayKey.child` columns, anything else is the value of `arrayKey` itself. */
function flattenItem(arrayKey: string, raw: unknown, level: number): Map<string, string> {
  const item = new Map<string, string>();
  const value = decode(raw);
  if (isPlainObject(value) && Object.keys(value).length > 0) {
    for (const [child, childValue] of Object.entries(value)) walk(`${arrayKey}.${child}`, childValue, level + 1, item, null);
  } else {
    item.set(arrayKey, stringifyJsonValue(value));
  }
  return item;
}

/**
 * Flattens a cell's JSON into columns named after `sourceKey`: `info.message`, `info.user.name`, and for an
 * array at the root of the JSON, one column per item key, marked with `[]`: `info.trace[].line`.
 */
export function flattenJson(json: JsonContainer, sourceKey: string): FlatJson {
  const scalars = new Map<string, string>();
  const arrays = new Map<string, Map<string, string>[]>();

  if (Array.isArray(json)) {
    const arrayKey = `${sourceKey}[]`;
    arrays.set(arrayKey, json.map((item) => flattenItem(arrayKey, item, 0)));
  } else {
    for (const [key, value] of Object.entries(json)) walk(`${sourceKey}.${key}`, value, 1, scalars, arrays);
  }

  return { scalars, arrays };
}

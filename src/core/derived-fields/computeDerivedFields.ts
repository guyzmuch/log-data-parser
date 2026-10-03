import type { Field } from "@/core/dataset/types";
import { derivedFieldKey } from "@/core/derived-fields/derivedFieldKey";
import { parseFlexibleDate } from "@/core/derived-fields/parseFlexibleDate";
import { stringifyJsonValue, tryParseJsonObjectLenient } from "@/core/derived-fields/parseJsonObject";
import type { DateDerivedFieldSpec, DerivedFieldSpec, JsonKeyDerivedFieldSpec } from "@/core/derived-fields/types";
import { unescapeStringified } from "@/core/derived-fields/unescapeStringified";

/**
 * Per-cell memo of the expensive parses, shared by every spec that targets the
 * same Field: a JSON column with 20 keys parses the cell once, not 20 times.
 */
interface CellParses {
  date?: Date;
  json?: { value: Record<string, unknown> | undefined };
}

// Constructing an Intl.DateTimeFormat is slow, and a log can have 100k cells.
const formatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string | undefined): Intl.DateTimeFormat {
  const cacheKey = timeZone ?? "";
  let formatter = formatters.get(cacheKey);
  if (!formatter) {
    // Throws a RangeError for an invalid zone; nothing is cached in that case.
    formatter = new Intl.DateTimeFormat(undefined, { timeZone, dateStyle: "medium", timeStyle: "medium" });
    formatters.set(cacheKey, formatter);
  }
  return formatter;
}

/** "12:30:48.137Z" -> "12:30:48.137", "12:30:00.000Z" -> "12:30:00": milliseconds only when there are some. */
function formatUtcTime(isoTime: string): string {
  return isoTime.replace(/Z$/, "").replace(/\.000$/, "");
}

function computeDate(field: Field, spec: DateDerivedFieldSpec, key: string, parses: CellParses): Field {
  parses.date ??= parseFlexibleDate(field.value);
  const date = parses.date;
  if (Number.isNaN(date.getTime())) {
    return { key, value: "", sourceFieldKey: field.key, parseError: true };
  }

  try {
    if (spec.representation === "iso") {
      return { key, value: date.toISOString(), sourceFieldKey: field.key };
    }
    if (spec.representation === "utc-date" || spec.representation === "utc-time") {
      const [day, time] = date.toISOString().split("T");
      return { key, value: spec.representation === "utc-date" ? day : formatUtcTime(time), sourceFieldKey: field.key };
    }
    // representation === "timezone" (spec.timezone omitted = browser-local)
    return { key, value: getFormatter(spec.timezone).format(date), sourceFieldKey: field.key };
  } catch {
    // e.g. an invalid IANA timezone identifier
    return { key, value: "", sourceFieldKey: field.key, parseError: true };
  }
}

function computeJsonKey(field: Field, spec: JsonKeyDerivedFieldSpec, key: string, parses: CellParses): Field {
  parses.json ??= { value: tryParseJsonObjectLenient(field.value) };
  const parsed = parses.json.value;
  if (!parsed) {
    return { key, value: "", sourceFieldKey: field.key, parseError: true };
  }
  // The key just not being present on this particular record's object is
  // normal (different records can have different JSON shapes) — an empty
  // value, not a Parse Error, which is reserved for "this cell wasn't valid
  // JSON at all."
  return { key, value: stringifyJsonValue(parsed[spec.jsonKey]), sourceFieldKey: field.key };
}

function computeOne(field: Field, spec: DerivedFieldSpec, parses: CellParses): Field {
  const key = derivedFieldKey(spec);

  switch (spec.kind) {
    case "date":
      return computeDate(field, spec, key, parses);
    case "unescape":
      return { key, value: unescapeStringified(field.value), sourceFieldKey: field.key };
    case "json-key":
      return computeJsonKey(field, spec, key, parses);
  }
}

/** All Derived Fields a source Field produces from the specs that target it. */
export function computeDerivedFields(field: Field, specs: DerivedFieldSpec[]): Field[] {
  const parses: CellParses = {};
  return specs.filter((spec) => spec.sourceFieldKey === field.key).map((spec) => computeOne(field, spec, parses));
}

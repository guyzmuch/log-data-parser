import type { Field } from "@/core/dataset/types";
import { derivedFieldKey } from "@/core/derived-fields/derivedFieldKey";
import { parseFlexibleDate } from "@/core/derived-fields/parseFlexibleDate";
import { stringifyJsonValue, tryParseJsonObject } from "@/core/derived-fields/parseJsonObject";
import type { DateDerivedFieldSpec, DerivedFieldSpec, JsonKeyDerivedFieldSpec } from "@/core/derived-fields/types";
import { unescapeStringified } from "@/core/derived-fields/unescapeStringified";

function computeDate(field: Field, spec: DateDerivedFieldSpec, key: string): Field {
  const date = parseFlexibleDate(field.value);
  if (Number.isNaN(date.getTime())) {
    return { key, value: "", sourceFieldKey: field.key, parseError: true };
  }

  try {
    if (spec.representation === "iso") {
      return { key, value: date.toISOString(), sourceFieldKey: field.key };
    }
    // representation === "timezone" (spec.timezone omitted = browser-local)
    const value = new Intl.DateTimeFormat(undefined, {
      timeZone: spec.timezone,
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(date);
    return { key, value, sourceFieldKey: field.key };
  } catch {
    // e.g. an invalid IANA timezone identifier
    return { key, value: "", sourceFieldKey: field.key, parseError: true };
  }
}

function computeJsonKey(field: Field, spec: JsonKeyDerivedFieldSpec, key: string): Field {
  const parsed = tryParseJsonObject(field.value);
  if (!parsed) {
    return { key, value: "", sourceFieldKey: field.key, parseError: true };
  }
  // The key just not being present on this particular record's object is
  // normal (different records can have different JSON shapes) — an empty
  // value, not a Parse Error, which is reserved for "this cell wasn't valid
  // JSON at all."
  return { key, value: stringifyJsonValue(parsed[spec.jsonKey]), sourceFieldKey: field.key };
}

function computeOne(field: Field, spec: DerivedFieldSpec): Field {
  const key = derivedFieldKey(spec);

  switch (spec.kind) {
    case "date":
      return computeDate(field, spec, key);
    case "trim":
      return { key, value: field.value.trim(), sourceFieldKey: field.key };
    case "unescape":
      return { key, value: unescapeStringified(field.value), sourceFieldKey: field.key };
    case "json-key":
      return computeJsonKey(field, spec, key);
  }
}

/** All Derived Fields a source Field produces from the specs that target it. */
export function computeDerivedFields(field: Field, specs: DerivedFieldSpec[]): Field[] {
  return specs.filter((spec) => spec.sourceFieldKey === field.key).map((spec) => computeOne(field, spec));
}

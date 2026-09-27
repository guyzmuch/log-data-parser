import type { Field } from "@/core/dataset/types";
import { derivedFieldKey } from "@/core/derived-fields/derivedFieldKey";
import type { DerivedFieldSpec } from "@/core/derived-fields/types";

function computeOne(field: Field, spec: DerivedFieldSpec): Field {
  const key = derivedFieldKey(spec);

  const date = new Date(field.value);
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

/** All Derived Fields a source Field produces from the specs that target it (uses plain `new Date(value)` parsing, nothing fancy). */
export function computeDerivedFields(field: Field, specs: DerivedFieldSpec[]): Field[] {
  return specs.filter((spec) => spec.sourceFieldKey === field.key).map((spec) => computeOne(field, spec));
}

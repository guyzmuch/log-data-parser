import type { DateDerivedFieldSpec, DerivedFieldSpec } from "@/core/derived-fields/types";

function dateKey(spec: DateDerivedFieldSpec): string {
  switch (spec.representation) {
    case "iso":
      return `${spec.sourceFieldKey} (ISO)`;
    case "timezone":
      return spec.timezone ? `${spec.sourceFieldKey} (${spec.timezone})` : `${spec.sourceFieldKey} (local time)`;
    case "utc-date":
      return `${spec.sourceFieldKey} (date)`;
    case "utc-time":
      return `${spec.sourceFieldKey} (time)`;
  }
}

/**
 * Deterministic display key for a Derived Field, derived from its spec.
 * The "(local time)" suffix for a timezone-less date spec is a provisional
 * label — the user can rename it via the existing column-rename control if
 * they want something else; nothing here is load-bearing beyond uniqueness.
 */
export function derivedFieldKey(spec: DerivedFieldSpec): string {
  switch (spec.kind) {
    case "date":
      return dateKey(spec);
    case "unescape":
      return `${spec.sourceFieldKey} (unescaped)`;
    case "json-key":
      return `${spec.sourceFieldKey}.${spec.jsonKey}`;
  }
}

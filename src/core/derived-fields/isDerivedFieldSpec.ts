import type { DerivedFieldSpec } from "@/core/derived-fields/types";

/**
 * Runtime check that an unknown value is a well-formed, *currently supported*
 * DerivedFieldSpec. Specs come from localStorage and imported files, so a
 * Profile saved by an older version can carry a kind that no longer exists
 * (e.g. the removed "trim") — those must be dropped, not crash derivation.
 */
export function isDerivedFieldSpec(value: unknown): value is DerivedFieldSpec {
  if (typeof value !== "object" || value === null) return false;
  const spec = value as Record<string, unknown>;
  if (typeof spec.sourceFieldKey !== "string") return false;

  switch (spec.kind) {
    case "date":
      return (
        (spec.representation === "iso" || spec.representation === "timezone") &&
        (spec.timezone === undefined || typeof spec.timezone === "string")
      );
    case "unescape":
      return true;
    case "json-key":
      return typeof spec.jsonKey === "string";
    default:
      return false;
  }
}

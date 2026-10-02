import type { ParsedRecord } from "@/core/dataset/types";
import { computeDerivedFields } from "@/core/derived-fields/computeDerivedFields";
import type { DerivedFieldSpec } from "@/core/derived-fields/types";

/**
 * Recomputes derivation over already-parsed Records — no re-parse of raw
 * text. Any previously-derived Fields (identified by `sourceFieldKey` being
 * set) are stripped and rebuilt fresh from the current specs, so this is
 * safe to call repeatedly as specs are added, and never accumulates stale
 * or duplicate Derived Fields.
 */
export function applyDerivedFields(records: ParsedRecord[], specs: DerivedFieldSpec[]): ParsedRecord[] {
  // Group once, so each cell only looks at the specs that target it.
  const specsBySource = new Map<string, DerivedFieldSpec[]>();
  for (const spec of specs) {
    const group = specsBySource.get(spec.sourceFieldKey);
    if (group) group.push(spec);
    else specsBySource.set(spec.sourceFieldKey, [spec]);
  }

  return records.map((record) => {
    const baseFields = record.fields.filter((field) => field.sourceFieldKey === undefined);
    if (specsBySource.size === 0) return { ...record, fields: baseFields };

    const derived = baseFields.flatMap((field) => {
      const fieldSpecs = specsBySource.get(field.key);
      return fieldSpecs ? computeDerivedFields(field, fieldSpecs) : [];
    });
    return { ...record, fields: [...baseFields, ...derived] };
  });
}

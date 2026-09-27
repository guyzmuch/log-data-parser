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
  return records.map((record) => {
    const baseFields = record.fields.filter((field) => field.sourceFieldKey === undefined);
    const derived = baseFields.flatMap((field) => computeDerivedFields(field, specs));
    return { ...record, fields: [...baseFields, ...derived] };
  });
}

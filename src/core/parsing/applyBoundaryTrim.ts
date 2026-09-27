import type { ParsedRecord } from "@/core/dataset/types";

/**
 * Drops the first and/or last Record if its Field count is short of
 * expectedFieldCount — a copy-paste that clipped the start/end of the log.
 * Only ever checks the two boundary Records, never a majority vote across
 * the Dataset, and never drops the only Record when there's just one.
 */
export function applyBoundaryTrim(records: ParsedRecord[], expectedFieldCount: number): ParsedRecord[] {
  if (records.length <= 1) return records;

  const lastIndex = records.length - 1;
  return records.filter((record, i) => {
    const isBoundary = i === 0 || i === lastIndex;
    const isPartial = record.fields.length < expectedFieldCount;
    return !(isBoundary && isPartial);
  });
}

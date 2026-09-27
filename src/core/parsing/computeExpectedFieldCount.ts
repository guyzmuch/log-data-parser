import type { ParsedRecord } from "@/core/dataset/types";

/**
 * Majority-vote Field count across a sample of Records — used only during
 * wizard configuration (on the middle sample) to propose expectedFieldCount,
 * which is then frozen into the Profile. Never used at parse time for
 * boundary trimming, which compares against that frozen value instead.
 */
export function computeExpectedFieldCount(sampleRecords: ParsedRecord[]): number {
  if (sampleRecords.length === 0) return 0;

  const counts = new Map<number, number>();
  for (const record of sampleRecords) {
    const count = record.fields.length;
    counts.set(count, (counts.get(count) ?? 0) + 1);
  }

  let mode = sampleRecords[0].fields.length;
  let modeFrequency = 0;
  for (const [count, frequency] of counts) {
    if (frequency > modeFrequency) {
      modeFrequency = frequency;
      mode = count;
    }
  }

  return mode;
}

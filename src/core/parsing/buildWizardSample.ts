import { sampleMiddleLines } from "@/core/parsing/sampleMiddleLines";
import { splitIntoRecords } from "@/core/parsing/splitIntoRecords";

/**
 * The sample that drives the Profile wizard's live preview, for lines or rows alike: the first item,
 * followed by items sampled from the middle of the *remaining* ones. A header is never "sampled" —
 * it's a fixed structural fact about the first line — so when hasHeaderRow is on, treating a random
 * middle row as the header (as a middle-only sample would) is always wrong, regardless of how
 * representative that sample otherwise is for delimiter/field-count stats. Sampling the middle from
 * items 1+ (never the first again) keeps a small dataset from listing its first item twice.
 */
export function sampleWithFirst<T>(items: T[], middleSampleSize: number): T[] {
  if (items.length === 0) return [];

  const [first, ...rest] = items;
  return [first, ...sampleMiddleLines(rest, middleSampleSize)];
}

/** The wizard sample as raw lines (used to detect the delimiter and for plain-split previews). */
export function buildWizardSample(rawText: string, middleSampleSize: number): string[] {
  return sampleWithFirst(
    splitIntoRecords(rawText).map((line) => line.raw),
    middleSampleSize,
  );
}

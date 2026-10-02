import { sampleMiddleOf } from "@/core/parsing/sampleMiddleLines";
import { splitIntoRecords } from "@/core/parsing/splitIntoRecords";

/**
 * Builds the line sample used to drive the Profile wizard's live preview:
 * the dataset's true first line, followed by body rows sampled from the
 * middle of the *remaining* lines. A header is never "sampled" — it's a fixed
 * structural fact about line 0 — so when hasHeaderRow is on, treating a random
 * middle row as the header (as a middle-only sample would) is always wrong,
 * regardless of how representative that sample otherwise is for
 * delimiter/field-count stats. Sampling the middle from lines 1+ (never line
 * 0 again) keeps a small dataset from listing its first line twice.
 */
export function buildWizardSample(rawText: string, middleSampleSize: number): string[] {
  const lines = splitIntoRecords(rawText).map((line) => line.raw);
  if (lines.length === 0) return [];

  const [firstLine, ...bodyLines] = lines;
  return [firstLine, ...sampleMiddleOf(bodyLines, middleSampleSize)];
}

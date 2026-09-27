import { sampleMiddleLines } from "@/core/parsing/sampleMiddleLines";
import { splitIntoRecords } from "@/core/parsing/splitIntoRecords";

/**
 * Builds the line sample used to drive the Profile wizard's live preview:
 * the dataset's true first line, followed by body rows sampled from the
 * middle. A header is never "sampled" — it's a fixed structural fact about
 * line 0 — so when hasHeaderRow is on, treating a random middle row as the
 * header (as a middle-only sample would) is always wrong, regardless of how
 * representative that sample otherwise is for delimiter/field-count stats.
 */
export function buildWizardSample(rawText: string, middleSampleSize: number): string[] {
  const middleSample = sampleMiddleLines(rawText, middleSampleSize);
  const firstLine = splitIntoRecords(rawText)[0]?.raw;
  return firstLine === undefined ? middleSample : [firstLine, ...middleSample];
}

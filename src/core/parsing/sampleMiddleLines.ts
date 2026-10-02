import { splitIntoRecords } from "@/core/parsing/splitIntoRecords";

/**
 * Samples lines from the middle of the raw text, not the head or tail — a
 * copy-paste often clips the very first/last line, and building a Profile's
 * parsing config off a clipped boundary line would poison the config.
 */
export function sampleMiddleLines(rawText: string, count: number): string[] {
  return sampleMiddleOf(
    splitIntoRecords(rawText).map((line) => line.raw),
    count,
  );
}

/** Same as sampleMiddleLines, for lines that are already split. */
export function sampleMiddleOf(lines: string[], count: number): string[] {
  if (lines.length <= count) return lines;

  const start = Math.floor((lines.length - count) / 2);
  return lines.slice(start, start + count);
}

import { parseFlexibleDate } from "@/core/derived-fields/parseFlexibleDate";
import { tryParseJsonObject } from "@/core/derived-fields/parseJsonObject";

export type ColumnPatternKind = "date" | "json" | "stringified-escapes";

interface ColumnPatternDetector {
  kind: ColumnPatternKind;
  test: (value: string) => boolean;
}

const DETECTORS: ColumnPatternDetector[] = [
  { kind: "date", test: (value) => !Number.isNaN(parseFlexibleDate(value).getTime()) },
  { kind: "json", test: (value) => tryParseJsonObject(value) !== undefined },
  { kind: "stringified-escapes", test: (value) => /\\[ntr"\\]/.test(value) },
];

const DEFAULT_THRESHOLD = 0.5;

/**
 * Which patterns a column's sample values mostly match — majority-vote over
 * non-empty values, same technique as computeExpectedFieldCount. Informs UI
 * suggestions only; never auto-applies anything (see the grilling decision
 * on timestamp auto-detection: propose, don't auto-apply).
 */
export function detectColumnPatterns(sampleValues: string[], threshold = DEFAULT_THRESHOLD): ColumnPatternKind[] {
  const nonEmpty = sampleValues.filter((value) => value.trim() !== "");
  if (nonEmpty.length === 0) return [];

  return DETECTORS.filter((detector) => {
    const matchCount = nonEmpty.filter((value) => detector.test(value)).length;
    return matchCount / nonEmpty.length >= threshold;
  }).map((detector) => detector.kind);
}

import { looksLikeBase64 } from "@/core/derived-fields/decodeBase64";
import { parseFlexibleDate } from "@/core/derived-fields/parseFlexibleDate";
import { tryParseJsonObjectLenient } from "@/core/derived-fields/parseJsonObject";
import { tryParseKeyValueObject } from "@/core/derived-fields/parseKeyValueObject";
import { looksLikeUserAgent } from "@/core/derived-fields/parseUserAgent";
import { hasEscapeSequences } from "@/core/derived-fields/unescapeStringified";
import { hasJsonInText } from "@/core/json/findEmbeddedJson";

export type ColumnPatternKind = "date" | "json" | "json-in-text" | "key-value" | "stringified-escapes" | "base64" | "user-agent";

interface ColumnPatternDetector {
  kind: ColumnPatternKind;
  test: (value: string) => boolean;
}

const DETECTORS: ColumnPatternDetector[] = [
  { kind: "date", test: (value) => !Number.isNaN(parseFlexibleDate(value).getTime()) },
  // Stringified JSON (`{\"a\":1}`, `"{\"a\":1}"`) counts too: parsing it as JSON is what's wanted, not unescaping it.
  { kind: "json", test: (value) => tryParseJsonObjectLenient(value) !== undefined },
  { kind: "json-in-text", test: hasJsonInText },
  { kind: "key-value", test: (value) => tryParseKeyValueObject(value) !== undefined },
  { kind: "stringified-escapes", test: hasEscapeSequences },
  { kind: "base64", test: looksLikeBase64 },
  { kind: "user-agent", test: looksLikeUserAgent },
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

  const kinds = DETECTORS.filter((detector) => {
    const matchCount = nonEmpty.filter((value) => detector.test(value)).length;
    return matchCount / nonEmpty.length >= threshold;
  }).map((detector) => detector.kind);

  // A JSON column's escapes are the JSON's own quoting: parsing the JSON handles them.
  return kinds.includes("json") ? kinds.filter((kind) => kind !== "stringified-escapes") : kinds;
}

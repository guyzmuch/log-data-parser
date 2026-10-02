import { tryParseJsonObjectLenient } from "@/core/derived-fields/parseJsonObject";

/** Union of top-level keys across every sample value that parses as a JSON object, in first-seen order. Non-JSON/non-object values are skipped. */
export function discoverJsonKeys(sampleValues: string[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();

  for (const value of sampleValues) {
    const parsed = tryParseJsonObjectLenient(value);
    if (!parsed) continue;
    for (const key of Object.keys(parsed)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }

  return keys;
}

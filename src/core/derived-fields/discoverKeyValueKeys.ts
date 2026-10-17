import { tryParseKeyValueObject } from "@/core/derived-fields/parseKeyValueObject";

/** Union of keys across every sample value holding a `{key=value,…}` set, in first-seen order. Values without one are skipped. */
export function discoverKeyValueKeys(sampleValues: string[]): string[] {
  const keys = new Set<string>();
  for (const value of sampleValues) {
    const parsed = tryParseKeyValueObject(value);
    if (parsed) for (const key of Object.keys(parsed)) keys.add(key);
  }
  return [...keys];
}

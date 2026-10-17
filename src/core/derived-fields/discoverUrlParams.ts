import { tryParseUrl } from "@/core/derived-fields/parseUrl";

/** Union of query parameter names across every sample value holding a URL, in first-seen order. */
export function discoverUrlParams(sampleValues: string[]): string[] {
  const names = new Set<string>();
  for (const value of sampleValues) {
    const url = tryParseUrl(value);
    if (url) for (const name of Object.keys(url.params)) names.add(name);
  }
  return [...names];
}

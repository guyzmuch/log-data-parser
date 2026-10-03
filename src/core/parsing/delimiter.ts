import type { Delimiter } from "@/core/parsing/types";

export const DELIMITER_CANDIDATES: Delimiter[] = [",", "\t", "|", ";", " "];

/**
 * Simple split on the delimiter — not quote-aware (a delimiter inside a
 * quoted field still splits there). That is the right behaviour for the
 * log formats this path serves; real CSV with quoted fields goes through the
 * `quoteAware` parsing mode instead (parseQuotedRows in parseRows.ts), which
 * the wizard turns on by default for ".csv" files.
 */
export function splitDelimitedLine(raw: string, delimiter: Delimiter): string[] {
  return raw.split(delimiter);
}

/**
 * Trims blanks around the value, then strips one matching pair of
 * leading/trailing double or single quotes, if present. Trimming comes first
 * so padded cells like ` "a" ` (common with `a | b` style delimiters) still
 * lose their quotes; blanks *inside* the quotes are kept.
 */
export function stripQuotesFromValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

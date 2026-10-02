import type { Delimiter } from "@/core/parsing/types";

export const DELIMITER_CANDIDATES: Delimiter[] = [",", "\t", "|", ";", " "];

/**
 * Simple split on the delimiter — not RFC4180 quote-aware (a delimiter
 * inside a quoted field will still split there). Matches the project's
 * "nothing fancy" v1 scope; a quote-aware CSV parser is a future upgrade.
 *
 * TODO: a delimiter embedded inside quoted CSV data (e.g. `a,"b,c",d`) will
 * be split incorrectly — not handled, not tested. See "Advanced" ideas in
 * docs/project_idea.md.
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

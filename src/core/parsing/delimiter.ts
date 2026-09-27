import type { Delimiter } from "@/core/parsing/types";

export const DELIMITER_CANDIDATES: Delimiter[] = [",", "\t", "|", ";"];

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

/** Strips one matching pair of leading/trailing double or single quotes, if present. */
export function stripQuotesFromValue(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

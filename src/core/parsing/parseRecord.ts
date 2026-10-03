import type { Field, ParsedRecord, RecordLine } from "@/core/dataset/types";
import { splitDelimitedLine, stripQuotesFromValue } from "@/core/parsing/delimiter";
import type { ParsingConfig } from "@/core/parsing/types";

/** Whether cells (and header names) get their surrounding blanks removed. Profiles saved before `trimCells` existed trimmed exactly when they stripped quotes. */
export function trimsCells(config: ParsingConfig): boolean {
  return config.trimCells ?? config.stripQuotes;
}

/**
 * Applies the config's cell cleanup to one raw value: trims blanks (if `trimCells`) and, in plain
 * splitting, strips one pair of surrounding quotes (if `stripQuotes`). Quoted CSV mode has already
 * removed the quotes (so stripping again would eat quotes that belong to the data).
 */
export function cleanValue(value: string, config: ParsingConfig): string {
  const trim = trimsCells(config);
  if (config.stripQuotes && !config.quoteAware) {
    const stripped = stripQuotesFromValue(value);
    // Without trimming, a value that had no quotes to strip keeps its blanks.
    return trim || stripped !== value.trim() ? stripped : value;
  }
  return trim ? value.trim() : value;
}

/** Builds a Record from already-split cell values, naming the Fields per the Profile's config. */
export function recordFromValues(index: number, raw: string, values: string[], config: ParsingConfig): ParsedRecord {
  const fields: Field[] = values.map((value, i) => ({
    key: config.fieldNames?.[i] ?? `Field ${i + 1}`,
    value: cleanValue(value, config),
  }));

  return { index, raw, fields };
}

/** Splits one RecordLine into Fields per the Profile's parsing config (plain delimiter split). */
export function parseRecord(line: RecordLine, config: ParsingConfig): ParsedRecord {
  return recordFromValues(line.index, line.raw, splitDelimitedLine(line.raw, config.delimiter), config);
}

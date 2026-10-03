import type { Field, ParsedRecord, RecordLine } from "@/core/dataset/types";
import { splitDelimitedLine, stripQuotesFromValue } from "@/core/parsing/delimiter";
import type { ParsingConfig } from "@/core/parsing/types";

/**
 * Applies the config's cell cleanup to one raw value. Plain splitting trims blanks and then strips one
 * pair of surrounding quotes. Quoted CSV mode has already removed the quotes (so stripping again would
 * eat quotes that belong to the data), and only trims blanks.
 */
export function cleanValue(value: string, config: ParsingConfig): string {
  if (!config.stripQuotes) return value;
  return config.quoteAware ? value.trim() : stripQuotesFromValue(value);
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

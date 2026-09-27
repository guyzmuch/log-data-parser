import type { Field, ParsedRecord, RecordLine } from "@/core/dataset/types";
import { splitDelimitedLine, stripQuotesFromValue } from "@/core/parsing/delimiter";
import type { ParsingConfig } from "@/core/parsing/types";

/** Splits one RecordLine into Fields per the Profile's parsing config. */
export function parseRecord(line: RecordLine, config: ParsingConfig): ParsedRecord {
  const rawValues = splitDelimitedLine(line.raw, config.delimiter);
  const values = config.stripQuotes ? rawValues.map(stripQuotesFromValue) : rawValues;

  const fields: Field[] = values.map((value, i) => ({
    key: config.fieldNames?.[i] ?? `Field ${i + 1}`,
    value,
  }));

  return { index: line.index, raw: line.raw, fields };
}

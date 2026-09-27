import type { ParsedRecord } from "@/core/dataset/types";
import { applyBoundaryTrim } from "@/core/parsing/applyBoundaryTrim";
import { splitDelimitedLine, stripQuotesFromValue } from "@/core/parsing/delimiter";
import { parseRecord } from "@/core/parsing/parseRecord";
import { splitIntoRecords } from "@/core/parsing/splitIntoRecords";
import type { ParsingConfig } from "@/core/parsing/types";

export interface ParsedDataset {
  fieldNames: string[];
  records: ParsedRecord[];
}

/** Parses a whole Dataset's raw text with a Profile's parsing config into the full set of Records/Fields. */
export function parseDataset(rawText: string, config: ParsingConfig): ParsedDataset {
  const lines = splitIntoRecords(rawText);
  if (lines.length === 0) {
    return { fieldNames: config.fieldNames ?? [], records: [] };
  }

  let dataLines = lines;
  let fieldNames = config.fieldNames;

  if (config.hasHeaderRow) {
    const [headerLine, ...rest] = lines;
    const headerValues = splitDelimitedLine(headerLine.raw, config.delimiter);
    fieldNames = config.stripQuotes ? headerValues.map(stripQuotesFromValue) : headerValues;
    dataLines = rest;
  }

  const configWithNames: ParsingConfig = { ...config, fieldNames };
  let records = dataLines.map((line) => parseRecord(line, configWithNames));

  if (config.trimBoundaryPartials) {
    records = applyBoundaryTrim(records, config.expectedFieldCount);
  }

  // Fall back to whatever Field keys parseRecord actually used (e.g. its
  // generic "Field N" names) when there's no header row and no explicit
  // fieldNames — otherwise this would report [] even though every Record
  // has properly-keyed Fields.
  const resolvedFieldNames = fieldNames ?? records[0]?.fields.map((field) => field.key) ?? [];

  return { fieldNames: resolvedFieldNames, records };
}

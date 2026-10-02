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

  // Always prefer the keys a parsed Record actually ended up with over the
  // raw config.fieldNames: parseRecord already applies the correct
  // per-field fallback (config.fieldNames?.[i] ?? "Field N"), so this is
  // right whether fieldNames is absent, full, or only a partial prefix (a
  // built-in Profile may only name the fields that reliably stay aligned —
  // see builtInProfiles.ts). Using config.fieldNames directly here would
  // silently truncate the list to its own length whenever it's shorter than
  // the actual Record. Take the *widest* Record, not the first: a short first
  // line (clipped paste, ragged log) must not hide columns that later Records
  // do have. Only fall back to config.fieldNames when there's no Record to
  // ask (e.g. an empty Dataset, or boundary trim dropped every Record).
  const widestRecord = records.reduce<ParsedRecord | undefined>(
    (widest, record) => (widest === undefined || record.fields.length > widest.fields.length ? record : widest),
    undefined,
  );
  const resolvedFieldNames = widestRecord?.fields.map((field) => field.key) ?? fieldNames ?? [];

  return { fieldNames: resolvedFieldNames, records };
}

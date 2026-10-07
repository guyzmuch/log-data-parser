import type { ParsedRecord } from "@/core/dataset/types";
import { expandJsonFields } from "@/core/json/expandJsonFields";
import type { JsonColumns } from "@/core/json/types";
import { applyBoundaryTrim } from "@/core/parsing/applyBoundaryTrim";
import { cleanValue, recordFromValues } from "@/core/parsing/parseRecord";
import { toRawRows, type RawRow } from "@/core/parsing/parseRows";
import type { ParsingConfig } from "@/core/parsing/types";

export interface ParsedDataset {
  fieldNames: string[];
  records: ParsedRecord[];
  /** The columns the parsing rule's JSON option added, when it is on for a column. */
  jsonColumns?: JsonColumns;
}

/** Turns already-split rows into Records per a Profile's parsing config: header names, cell cleanup, boundary trim. */
export function parseRawRows(rows: RawRow[], config: ParsingConfig): ParsedDataset {
  if (rows.length === 0) {
    return { fieldNames: config.fieldNames ?? [], records: [] };
  }

  let dataRows = rows;
  let fieldNames = config.fieldNames;

  if (config.hasHeaderRow) {
    const [headerRow, ...rest] = rows;
    fieldNames = headerRow.values.map((value) => cleanValue(value, config));
    dataRows = rest;
  }

  const configWithNames: ParsingConfig = { ...config, fieldNames };
  let records = dataRows.map((row) => recordFromValues(row.index, row.raw, row.values, configWithNames));

  if (config.trimBoundaryPartials) {
    records = applyBoundaryTrim(records, config.expectedFieldCount);
  }

  // Always prefer the keys a parsed Record actually ended up with over the
  // raw config.fieldNames: recordFromValues already applies the correct
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

  if (config.jsonFieldKeys && config.jsonFieldKeys.length > 0) {
    return expandJsonFields(resolvedFieldNames, records, config.jsonFieldKeys);
  }
  return { fieldNames: resolvedFieldNames, records };
}

/** Parses a whole Dataset's raw text with a Profile's parsing config into the full set of Records/Fields. */
export function parseDataset(rawText: string, config: ParsingConfig): ParsedDataset {
  return parseRawRows(toRawRows(rawText, config.delimiter, config.quoteAware === true), config);
}

import Papa from "papaparse";
import { splitDelimitedLine } from "@/core/parsing/delimiter";
import { splitIntoRecords } from "@/core/parsing/splitIntoRecords";
import type { Delimiter } from "@/core/parsing/types";

/** One row of a Dataset split into raw cell values, before any trimming/unquoting or field naming. */
export interface RawRow {
  /** Position among all rows, 0-based. With quoted line breaks a row can span several lines, so this is not a line number. */
  index: number;
  /** The row's text. Exact for line-based parsing; rebuilt from the cells (joined with the delimiter) for quoted CSV. */
  raw: string;
  values: string[];
}

/**
 * Splits text into rows of cells with CSV quoting rules: a delimiter or line break inside "quotes" belongs
 * to the cell, and `""` inside quotes is one literal quote. Blank lines become a row with one empty cell,
 * and the one empty row a final newline would add is dropped — the same conventions as the line-based path.
 */
export function parseQuotedRows(rawText: string, delimiter: Delimiter): string[][] {
  if (rawText === "") return [];

  // Parse problems (a stray quote, rows of different lengths) are tolerated: the rows found are still
  // returned, and raggedness is already handled downstream by the boundary trim and field naming.
  const { data } = Papa.parse<string[]>(rawText, { delimiter, quoteChar: '"', escapeChar: '"', skipEmptyLines: false });

  const last = data[data.length - 1];
  if (last && last.length === 1 && last[0] === "") data.pop();
  return data;
}

/** Every row of the text, split either with CSV quoting rules or by plain line + delimiter splitting. */
export function toRawRows(rawText: string, delimiter: Delimiter, quoteAware: boolean): RawRow[] {
  if (quoteAware) {
    return parseQuotedRows(rawText, delimiter).map((values, index) => ({
      index,
      raw: values.join(delimiter),
      values,
    }));
  }
  return splitIntoRecords(rawText).map((line) => ({
    index: line.index,
    raw: line.raw,
    values: splitDelimitedLine(line.raw, delimiter),
  }));
}

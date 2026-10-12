import { computeExpectedFieldCount } from "@/core/parsing/computeExpectedFieldCount";
import { parseRawRows, type ParsedDataset } from "@/core/parsing/parseDataset";
import type { RawRow } from "@/core/parsing/parseRows";
import type { Delimiter, DelimiterParsingConfig } from "@/core/parsing/types";

export interface DelimiterParsingChoices {
  delimiter: Delimiter;
  hasHeaderRow: boolean;
  stripQuotes: boolean;
  /** Omitted keeps the legacy meaning (trim iff stripQuotes) and leaves `trimCells` out of the config. */
  trimCells?: boolean;
  trimBoundaryPartials: boolean;
  /** CSV quoting rules; the rows handed in must have been split the same way. Omitted from the config when off. */
  quoteAware?: boolean;
  /** Names to keep from an existing Profile (ignored when hasHeaderRow, where the header supplies them). */
  fieldNames?: string[];
  /** Split columns that may contain JSON. Omitted from the config when empty. */
  jsonFieldKeys?: string[];
}

export interface ParsingPreview {
  config: DelimiterParsingConfig;
  parsed: ParsedDataset;
}

/**
 * Builds a full ParsingConfig — freezing expectedFieldCount from a
 * majority-vote over the sample rows, computed *before* any trim toggle is
 * applied — and parses the sample with it. Used for both the wizard's live
 * preview and, unchanged, as the config saved into the Profile, so the
 * preview the user sees is exactly what they get.
 */
export function buildParsingPreview(sampleRows: RawRow[], choices: DelimiterParsingChoices): ParsingPreview {
  const untrimmedConfig: DelimiterParsingConfig = {
    kind: "delimiter",
    delimiter: choices.delimiter,
    hasHeaderRow: choices.hasHeaderRow,
    stripQuotes: choices.stripQuotes,
    ...(choices.trimCells !== undefined ? { trimCells: choices.trimCells } : {}),
    ...(choices.quoteAware ? { quoteAware: true } : {}),
    trimBoundaryPartials: false,
    expectedFieldCount: 0,
    ...(choices.fieldNames ? { fieldNames: choices.fieldNames } : {}),
  };

  const { records: untrimmedRecords } = parseRawRows(sampleRows, untrimmedConfig);
  const expectedFieldCount = computeExpectedFieldCount(untrimmedRecords);

  const config: DelimiterParsingConfig = {
    ...untrimmedConfig,
    trimBoundaryPartials: choices.trimBoundaryPartials,
    expectedFieldCount,
    ...(choices.jsonFieldKeys && choices.jsonFieldKeys.length > 0 ? { jsonFieldKeys: choices.jsonFieldKeys } : {}),
  };

  return { config, parsed: parseRawRows(sampleRows, config) };
}

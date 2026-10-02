import { computeExpectedFieldCount } from "@/core/parsing/computeExpectedFieldCount";
import { parseDataset, type ParsedDataset } from "@/core/parsing/parseDataset";
import type { Delimiter, DelimiterParsingConfig } from "@/core/parsing/types";

export interface DelimiterParsingChoices {
  delimiter: Delimiter;
  hasHeaderRow: boolean;
  stripQuotes: boolean;
  trimBoundaryPartials: boolean;
  /** Names to keep from an existing Profile (ignored when hasHeaderRow, where the header supplies them). */
  fieldNames?: string[];
}

export interface ParsingPreview {
  config: DelimiterParsingConfig;
  parsed: ParsedDataset;
}

/**
 * Builds a full ParsingConfig — freezing expectedFieldCount from a
 * majority-vote over the sample text, computed *before* any trim toggle is
 * applied — and parses the sample with it. Used for both the wizard's live
 * preview and, unchanged, as the config saved into the Profile, so the
 * preview the user sees is exactly what they get.
 */
export function buildParsingPreview(sampleRawText: string, choices: DelimiterParsingChoices): ParsingPreview {
  const untrimmedConfig: DelimiterParsingConfig = {
    kind: "delimiter",
    delimiter: choices.delimiter,
    hasHeaderRow: choices.hasHeaderRow,
    stripQuotes: choices.stripQuotes,
    trimBoundaryPartials: false,
    expectedFieldCount: 0,
    ...(choices.fieldNames ? { fieldNames: choices.fieldNames } : {}),
  };

  const { records: untrimmedRecords } = parseDataset(sampleRawText, untrimmedConfig);
  const expectedFieldCount = computeExpectedFieldCount(untrimmedRecords);

  const config: DelimiterParsingConfig = {
    ...untrimmedConfig,
    trimBoundaryPartials: choices.trimBoundaryPartials,
    expectedFieldCount,
  };

  return { config, parsed: parseDataset(sampleRawText, config) };
}

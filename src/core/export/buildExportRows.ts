import type { ParsedRecord } from "@/core/dataset/types";
import type { DisplayConfig } from "@/core/profile/types";
import { matchesSearch } from "@/core/search/matchesSearch";
import type { ExportScope } from "@/core/export/types";

export interface ExportRows {
  header: string[];
  rows: string[][];
}

/**
 * Selects which Records to export per scope, and projects them onto the
 * current Visible Fields (in order) — same columns the table shows.
 * "matching-filter" with no active Filter-mode search term behaves as "all"
 * (there's nothing to filter by, so exporting nothing would be surprising).
 * A Parse Error cell exports the same "Invalid parse" text the table shows,
 * not a blank — export stays WYSIWYG with what's on screen.
 */
export function buildExportRows(
  records: ParsedRecord[],
  display: DisplayConfig,
  scope: ExportScope,
  hiddenRecordIndexes: ReadonlySet<number>,
): ExportRows {
  const { visibleFieldKeys, fieldLabels, searchState } = display;
  const header = visibleFieldKeys.map((key) => fieldLabels[key] ?? key);

  let selected = records;
  if (scope === "excluding-hidden") {
    selected = records.filter((record) => !hiddenRecordIndexes.has(record.index));
  } else if (scope === "matching-filter") {
    const term = searchState?.term ?? "";
    const filterActive = searchState?.mode === "filter" && term.trim() !== "";
    if (filterActive) {
      selected = records.filter((record) => matchesSearch(record, visibleFieldKeys, term));
    }
  }

  const rows = selected.map((record) =>
    visibleFieldKeys.map((key) => {
      const field = record.fields.find((f) => f.key === key);
      if (field?.parseError) return "Invalid parse";
      return field?.value ?? "";
    }),
  );

  return { header, rows };
}

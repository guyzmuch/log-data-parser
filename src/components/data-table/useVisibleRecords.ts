"use client";

import { useMemo } from "react";
import type { ParsedRecord } from "@/core/dataset/types";
import { matchesSearch } from "@/core/search/matchesSearch";
import { useAppStore } from "@/state/useAppStore";

export interface VisibleRecords {
  /** Records not hidden by the user (what "Hide selected" can still act on, before any search filter). */
  shownRecords: ParsedRecord[];
  /** What the table actually renders: shownRecords, minus those a Filter-mode search excludes. */
  visibleRecords: ParsedRecord[];
  visibleIndexesInOrder: number[];
  /** Position (1-based) of each Record among all parsed Records, by Record index — the "#" column. */
  ordinalByIndex: Map<number, number>;
  /** How many of the selected Records are currently visible. */
  visibleSelectedCount: number;
}

/**
 * The view-layer exclusions (hidden rows, Filter-mode search) applied to the immutable parsed Records,
 * shared by the table and the toolbar chips so both always agree on what "visible" means.
 */
export function useVisibleRecords(): VisibleRecords {
  const records = useAppStore((s) => s.records);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const hiddenRecordIndexes = useAppStore((s) => s.hiddenRecordIndexes);
  const selectedRecordIndexes = useAppStore((s) => s.selectedRecordIndexes);

  const visibleFieldKeys = activeProfile?.display.visibleFieldKeys;
  const searchState = activeProfile?.display.searchState;
  const term = searchState?.term ?? "";
  const mode = searchState?.mode ?? "highlight";

  const ordinalByIndex = useMemo(() => new Map(records.map((record, i) => [record.index, i + 1])), [records]);

  const { shownRecords, visibleRecords } = useMemo(() => {
    const shown = records.filter((record) => !hiddenRecordIndexes.has(record.index));
    const visible =
      mode === "filter" && visibleFieldKeys
        ? shown.filter((record) => matchesSearch(record, visibleFieldKeys, term))
        : shown;
    return { shownRecords: shown, visibleRecords: visible };
  }, [records, hiddenRecordIndexes, mode, term, visibleFieldKeys]);

  const visibleIndexesInOrder = useMemo(() => visibleRecords.map((record) => record.index), [visibleRecords]);
  const visibleSelectedCount = useMemo(
    () => visibleIndexesInOrder.filter((index) => selectedRecordIndexes.has(index)).length,
    [visibleIndexesInOrder, selectedRecordIndexes],
  );

  return { shownRecords, visibleRecords, visibleIndexesInOrder, ordinalByIndex, visibleSelectedCount };
}

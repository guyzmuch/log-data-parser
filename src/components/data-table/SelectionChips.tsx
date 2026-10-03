"use client";

import { Button } from "@/components/ui/button";
import { useVisibleRecords } from "@/components/data-table/useVisibleRecords";
import { useAppStore } from "@/state/useAppStore";

/** Shown only while there's something to act on: selected rows (and the actions for them), and hidden rows. */
export function SelectionChips() {
  const hiddenCount = useAppStore((s) => s.hiddenRecordIndexes.size);
  const hideSelectedRecords = useAppStore((s) => s.hideSelectedRecords);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const unhideAllRecords = useAppStore((s) => s.unhideAllRecords);
  const { visibleIndexesInOrder, visibleSelectedCount } = useVisibleRecords();

  return (
    <>
      {visibleSelectedCount > 0 && (
        <div className="flex h-8 items-center gap-1 border border-border bg-muted pr-1 pl-2.5 text-sm">
          <span className="font-medium">{visibleSelectedCount} selected</span>
          <Button variant="ghost" size="xs" onClick={() => hideSelectedRecords(visibleIndexesInOrder)}>
            Hide selected
          </Button>
          <Button variant="ghost" size="xs" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}
      {hiddenCount > 0 && (
        <div className="flex h-8 items-center gap-1 border border-border bg-muted pr-1 pl-2.5 text-sm">
          <span className="font-medium">
            {hiddenCount} {hiddenCount === 1 ? "row" : "rows"} hidden
          </span>
          <Button variant="ghost" size="xs" onClick={unhideAllRecords}>
            Unhide
          </Button>
        </div>
      )}
    </>
  );
}

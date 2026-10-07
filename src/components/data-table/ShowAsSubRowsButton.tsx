"use client";

import { RowsIcon } from "@phosphor-icons/react";
import type { ArrayMode } from "@/core/json/types";
import { useAppStore } from "@/state/useAppStore";

export const ARRAY_MODE_LABELS: Record<ArrayMode, string> = {
  table: "Nested table",
  rows: "Sub-rows (one line per item)",
};

/**
 * On a nested array table's bar: puts the array's columns back in the main table, one line per item. The column
 * menu of those columns switches back to a table. Clicks don't reach the row (no selection).
 */
export function ShowAsSubRowsButton({ arrayKey }: { arrayKey: string }) {
  const setArrayMode = useAppStore((s) => s.setArrayMode);

  return (
    <button
      type="button"
      title="Show the items in the main table's columns, one line per item. The column menu switches back to a table."
      onClick={(event) => {
        event.stopPropagation();
        setArrayMode(arrayKey, "rows");
      }}
      className="flex items-center gap-1 border border-border bg-background px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
    >
      <RowsIcon className="size-3.5" />
      Show as sub-rows
    </button>
  );
}

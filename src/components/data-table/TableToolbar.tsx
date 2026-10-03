"use client";

import { ColumnsPopover } from "@/components/data-table/ColumnsPopover";
import { SelectionChips } from "@/components/data-table/SelectionChips";
import { ExportMenu } from "@/components/export-menu/ExportMenu";
import { SearchBar } from "@/components/search-bar/SearchBar";

/** Search on the left; what's selected/hidden, column picking and export on the right. */
export function TableToolbar() {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-5 py-3">
      <SearchBar />
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <SelectionChips />
        <ColumnsPopover />
        <ExportMenu />
      </div>
    </div>
  );
}

"use client";

import { ChatTextIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { ColumnsPopover } from "@/components/data-table/ColumnsPopover";
import { useUniformColumns } from "@/components/data-table/useUniformColumns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/state/useAppStore";
import { SelectionChips } from "@/components/data-table/SelectionChips";
import { ViewMenu } from "@/components/data-table/ViewMenu";
import { ExportMenu } from "@/components/export-menu/ExportMenu";
import { SearchBar } from "@/components/search-bar/SearchBar";

/** Shows or hides the Comment column. Comments are kept (and exported) while it is hidden. */
function CommentsToggle() {
  const showComments = useAppStore((s) => s.showComments);
  const setShowComments = useAppStore((s) => s.setShowComments);
  const count = useAppStore((s) => s.recordComments.size);

  return (
    <Button
      variant="outline"
      aria-pressed={showComments}
      title={showComments ? "Hide the comment column" : "Show a column to write a remark on each row"}
      onClick={() => setShowComments(!showComments)}
      className={cn(showComments && "bg-accent")}
    >
      <ChatTextIcon />
      Comments
      {count > 0 && <span className="text-muted-foreground">{count}</span>}
    </Button>
  );
}

/** Hides at once the shown columns that are empty or hold the same value in every row. Only there when there are some. */
function HideUniformColumnsButton() {
  const visibleFieldKeys = useAppStore((s) => s.activeProfile?.display.visibleFieldKeys);
  const hideFields = useAppStore((s) => s.hideFields);
  const uniformColumns = useUniformColumns();

  const toHide = (visibleFieldKeys ?? []).filter((key) => uniformColumns.has(key));
  if (toHide.length === 0) return null;

  return (
    <Button
      variant="outline"
      title="Hide the shown columns that are empty or have the same value in every row. Show them again from “Columns”."
      onClick={() => hideFields(toHide)}
    >
      <EyeSlashIcon />
      Hide empty &amp; same-value
      <span className="text-muted-foreground">{toHide.length}</span>
    </Button>
  );
}

/** Search on the left; what's selected/hidden, column picking and export on the right. */
export function TableToolbar() {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-5 py-3">
      <SearchBar />
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <SelectionChips />
        <CommentsToggle />
        <ViewMenu />
        <HideUniformColumnsButton />
        <ColumnsPopover />
        <ExportMenu />
      </div>
    </div>
  );
}

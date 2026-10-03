"use client";

import { ChatTextIcon } from "@phosphor-icons/react";
import { ColumnsPopover } from "@/components/data-table/ColumnsPopover";
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

/** Search on the left; what's selected/hidden, column picking and export on the right. */
export function TableToolbar() {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-5 py-3">
      <SearchBar />
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <SelectionChips />
        <CommentsToggle />
        <ViewMenu />
        <ColumnsPopover />
        <ExportMenu />
      </div>
    </div>
  );
}

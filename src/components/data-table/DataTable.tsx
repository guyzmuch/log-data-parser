"use client";

import type { MouseEvent, ReactNode } from "react";
import { ColumnHeader } from "@/components/data-table/ColumnHeader";
import { useDetectedPatterns } from "@/components/data-table/useDetectedPatterns";
import { useVisibleRecords } from "@/components/data-table/useVisibleRecords";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { derivedFieldKey } from "@/core/derived-fields/derivedFieldKey";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/state/useAppStore";

/** Wraps every case-insensitive occurrence of `term` in `value` with a <mark>. */
function highlightMatches(value: string, term: string): ReactNode {
  const needle = term.trim();
  if (needle === "") return value;

  const lowerValue = value.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let index = lowerValue.indexOf(lowerNeedle, cursor);

  while (index !== -1) {
    if (index > cursor) parts.push(value.slice(cursor, index));
    parts.push(
      <mark key={index} className="bg-yellow-200 text-inherit dark:bg-yellow-500/40">
        {value.slice(index, index + needle.length)}
      </mark>,
    );
    cursor = index + needle.length;
    index = lowerValue.indexOf(lowerNeedle, cursor);
  }
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts;
}

const DERIVED_HEAD = "bg-[color-mix(in_oklch,var(--muted),var(--foreground)_5%)]";
const DERIVED_CELL = "bg-muted/40";

export function DataTable() {
  const records = useAppStore((s) => s.records);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const selectedRecordIndexes = useAppStore((s) => s.selectedRecordIndexes);
  const selectRecord = useAppStore((s) => s.selectRecord);
  const selectAllVisible = useAppStore((s) => s.selectAllVisible);
  const deselectAllVisible = useAppStore((s) => s.deselectAllVisible);
  const detectedByField = useDetectedPatterns();
  const { shownRecords, visibleRecords, visibleIndexesInOrder, ordinalByIndex, visibleSelectedCount } =
    useVisibleRecords();

  if (!activeProfile || records.length === 0) {
    return <p className="px-5 text-sm text-muted-foreground">No data parsed yet.</p>;
  }

  const { visibleFieldKeys, searchState, derivedFieldSelections } = activeProfile.display;
  const term = searchState?.term ?? "";
  const mode = searchState?.mode ?? "highlight";
  const derivedKeys = new Set(derivedFieldSelections.map(derivedFieldKey));

  if (visibleFieldKeys.length === 0) {
    return <p className="px-5 text-sm text-muted-foreground">No columns are shown. Use “Columns” to pick some.</p>;
  }
  if (visibleRecords.length === 0) {
    return (
      <p className="px-5 text-sm text-muted-foreground">
        {shownRecords.length === 0 ? "All records are hidden." : "No records match your search."}
      </p>
    );
  }

  const allVisibleSelected = visibleIndexesInOrder.length > 0 && visibleSelectedCount === visibleIndexesInOrder.length;
  const headerCheckedState = allVisibleSelected ? true : visibleSelectedCount > 0 ? "indeterminate" : false;

  function handleRowClick(event: MouseEvent, index: number) {
    selectRecord(index, { ctrlOrMeta: event.ctrlKey || event.metaKey, shift: event.shiftKey }, visibleIndexesInOrder);
  }

  function handleRowCheckboxClick(event: MouseEvent, index: number) {
    event.stopPropagation();
    // Shift-click on the checkbox still range-selects, same as shift-clicking the row.
    // A plain checkbox click toggles just that row — reusing ctrl-click semantics so it
    // doesn't require ctrl held, which is the natural default for a checkbox.
    if (event.shiftKey) {
      selectRecord(index, { ctrlOrMeta: false, shift: true }, visibleIndexesInOrder);
      return;
    }
    selectRecord(index, { ctrlOrMeta: true, shift: false }, visibleIndexesInOrder);
  }

  return (
    // The box is the table's only scroller (the shadcn Table wraps itself in an overflow-x-auto
    // container, which would put the horizontal scrollbar at the bottom of the full-height table),
    // so the header can stick to its top edge and both scrollbars sit on its visible edges.
    <div className="mx-5 mb-5 min-h-0 flex-1 overflow-auto border border-border [&_[data-slot=table-container]]:overflow-visible">
      <Table className="text-[0.8125rem]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky top-0 z-10 w-24 border-b bg-muted">
              <div className="flex items-center gap-2 pl-1">
                <Checkbox
                  checked={headerCheckedState}
                  onCheckedChange={() =>
                    allVisibleSelected ? deselectAllVisible(visibleIndexesInOrder) : selectAllVisible(visibleIndexesInOrder)
                  }
                  aria-label="Select all visible rows"
                />
                <span className="text-xs font-medium text-muted-foreground">#</span>
              </div>
            </TableHead>
            {visibleFieldKeys.map((key, position) => (
              <TableHead
                key={key}
                className={cn("sticky top-0 z-10 border-b bg-muted px-3", derivedKeys.has(key) && DERIVED_HEAD)}
              >
                <ColumnHeader
                  fieldKey={key}
                  detected={detectedByField[key] ?? []}
                  isFirst={position === 0}
                  isLast={position === visibleFieldKeys.length - 1}
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRecords.map((record) => (
            <TableRow
              key={record.index}
              data-state={selectedRecordIndexes.has(record.index) ? "selected" : undefined}
              onClick={(event) => handleRowClick(event, record.index)}
              className="cursor-pointer"
            >
              <TableCell>
                <div className="flex items-center gap-2 pl-1">
                  <Checkbox
                    checked={selectedRecordIndexes.has(record.index)}
                    onClick={(event) => handleRowCheckboxClick(event, record.index)}
                    aria-label={`Select row ${record.index}`}
                  />
                  <span className="min-w-6 text-right text-xs text-muted-foreground tabular-nums">
                    {ordinalByIndex.get(record.index)}
                  </span>
                </div>
              </TableCell>
              {visibleFieldKeys.map((key) => {
                const field = record.fields.find((f) => f.key === key);
                const cellClass = cn("px-3 font-mono", derivedKeys.has(key) && DERIVED_CELL);
                if (field?.parseError) {
                  return (
                    <TableCell key={key} className={cn(cellClass, "text-destructive")}>
                      Invalid parse
                    </TableCell>
                  );
                }
                const value = field?.value ?? "";
                return (
                  <TableCell key={key} className={cellClass}>
                    {mode === "highlight" ? highlightMatches(value, term) : value}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

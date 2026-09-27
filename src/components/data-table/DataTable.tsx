"use client";

import type { MouseEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { matchesSearch } from "@/core/search/matchesSearch";
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
      <mark key={index} className="bg-primary/30 text-inherit">
        {value.slice(index, index + needle.length)}
      </mark>,
    );
    cursor = index + needle.length;
    index = lowerValue.indexOf(lowerNeedle, cursor);
  }
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts;
}

export function DataTable() {
  const records = useAppStore((s) => s.records);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const hiddenRecordIndexes = useAppStore((s) => s.hiddenRecordIndexes);
  const selectedRecordIndexes = useAppStore((s) => s.selectedRecordIndexes);
  const selectRecord = useAppStore((s) => s.selectRecord);
  const selectAllVisible = useAppStore((s) => s.selectAllVisible);
  const deselectAllVisible = useAppStore((s) => s.deselectAllVisible);
  const hideSelectedRecords = useAppStore((s) => s.hideSelectedRecords);
  const unhideAllRecords = useAppStore((s) => s.unhideAllRecords);

  if (!activeProfile || records.length === 0) {
    return <p className="text-xs text-muted-foreground">No data parsed yet.</p>;
  }

  const { visibleFieldKeys, fieldLabels, searchState } = activeProfile.display;
  const term = searchState?.term ?? "";
  const mode = searchState?.mode ?? "highlight";

  const shownRecords = records.filter((record) => !hiddenRecordIndexes.has(record.index));
  const visibleRecords =
    mode === "filter" ? shownRecords.filter((record) => matchesSearch(record, visibleFieldKeys, term)) : shownRecords;
  const visibleIndexesInOrder = visibleRecords.map((record) => record.index);

  const allVisibleSelected =
    visibleIndexesInOrder.length > 0 && visibleIndexesInOrder.every((index) => selectedRecordIndexes.has(index));
  const someVisibleSelected = visibleIndexesInOrder.some((index) => selectedRecordIndexes.has(index));
  const headerCheckedState = allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false;

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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={selectedRecordIndexes.size === 0} onClick={hideSelectedRecords}>
          Hide selected ({selectedRecordIndexes.size})
        </Button>
        <Button variant="outline" size="sm" disabled={hiddenRecordIndexes.size === 0} onClick={unhideAllRecords}>
          Unhide all{hiddenRecordIndexes.size > 0 ? ` (${hiddenRecordIndexes.size})` : ""}
        </Button>
      </div>

      {visibleRecords.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {shownRecords.length === 0 ? "All records are hidden." : "No records match your search."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={headerCheckedState}
                  onCheckedChange={() =>
                    allVisibleSelected ? deselectAllVisible(visibleIndexesInOrder) : selectAllVisible(visibleIndexesInOrder)
                  }
                  aria-label="Select all visible rows"
                />
              </TableHead>
              {visibleFieldKeys.map((key) => (
                <TableHead key={key}>{fieldLabels[key] ?? key}</TableHead>
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
                  <Checkbox
                    checked={selectedRecordIndexes.has(record.index)}
                    onClick={(event) => handleRowCheckboxClick(event, record.index)}
                    aria-label={`Select row ${record.index}`}
                  />
                </TableCell>
                {visibleFieldKeys.map((key) => {
                  const field = record.fields.find((f) => f.key === key);
                  if (field?.parseError) {
                    return (
                      <TableCell key={key} className="text-destructive">
                        Invalid parse
                      </TableCell>
                    );
                  }
                  const value = field?.value ?? "";
                  return (
                    <TableCell key={key}>{mode === "highlight" ? highlightMatches(value, term) : value}</TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

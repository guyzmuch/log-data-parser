"use client";

import { Fragment, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { ColumnHeader } from "@/components/data-table/ColumnHeader";
import { useDetectedPatterns } from "@/components/data-table/useDetectedPatterns";
import { useVisibleRecords } from "@/components/data-table/useVisibleRecords";
import { useWindowedRows } from "@/components/data-table/useWindowedRows";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { maxValueLengths } from "@/core/dataset/valueLengths";
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

/**
 * Rows are windowed: only the ones near the viewport are in the DOM, so a huge log scrolls as smoothly
 * as a small one. That needs every body row to be exactly this tall (h-9 = 2.25rem at the default font
 * size, and the same in px as long as the root font size isn't changed) and columns of a width that
 * doesn't depend on which rows are currently rendered (see COLUMN_*_CH).
 */
const ROW_HEIGHT = 36;
/** Height of the full-width line a "second line" column gets under each row: up to three lines of text, then "…". */
const EXTRA_ROW_HEIGHT = 68;
/** Rows rendered above and below the viewport, so fast scrolling doesn't flash blank space. */
const OVERSCAN_ROWS = 12;
/** Column widths come from the longest value (in monospace characters), within these limits. Longer values are cut off with "…". */
const COLUMN_MIN_CH = 8;
const COLUMN_MAX_CH = 80;
/** A header needs room for its menu button and any hint chips next to the label. */
const HEADER_EXTRA_CH = 5;
const HINT_CHIP_CH = 9;
/** Width of the row-select / "#" column, and the horizontal padding of every other cell (px-3 on both sides). */
const LEADING_COLUMN_WIDTH = "6rem";
const CELL_PADDING = "1.5rem";

/** Narrowest and widest a column can be dragged to, in px. */
const RESIZE_MIN_PX = 80;
const RESIZE_MAX_PX = 1600;

/** A grip on a header's right edge: drag to resize the column, double-click to put it back to automatic. */
function ResizeHandle({ fieldKey, label }: { fieldKey: string; label: string }) {
  const setColumnWidth = useAppStore((s) => s.setColumnWidth);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const cell = event.currentTarget.parentElement;
    if (!cell) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: cell.getBoundingClientRect().width };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const width = drag.current.startWidth + event.clientX - drag.current.startX;
    setColumnWidth(fieldKey, Math.min(RESIZE_MAX_PX, Math.max(RESIZE_MIN_PX, width)));
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize column ${label}`}
      title="Drag to resize, double-click to reset"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={() => setColumnWidth(fieldKey, null)}
      className="absolute inset-y-0 right-0 z-20 w-2 cursor-col-resize touch-none after:absolute after:inset-y-2 after:right-0 after:w-px after:bg-border hover:after:w-0.5 hover:after:bg-ring"
    />
  );
}

/** Width of the comment column. */
const COMMENT_COLUMN_WIDTH = "18rem";

/** The user's remark on a record: click to type, Enter or leaving the box saves, Escape cancels. Exported as an extra CSV column. */
function CommentCell({ index }: { index: number }) {
  const comment = useAppStore((s) => s.recordComments.get(index) ?? "");
  const setRecordComment = useAppStore((s) => s.setRecordComment);
  const [draft, setDraft] = useState<string | null>(null);
  const finished = useRef(false);

  function finish(save: boolean) {
    if (finished.current) return;
    finished.current = true;
    if (save && draft !== null) setRecordComment(index, draft);
    setDraft(null);
  }

  return (
    <TableCell data-comment="true" className="px-2 py-0" onClick={(event) => event.stopPropagation()}>
      {draft === null ? (
        <button
          type="button"
          aria-label={comment ? `Edit comment on row ${index}` : `Add comment on row ${index}`}
          title={comment || undefined}
          onClick={() => {
            finished.current = false;
            setDraft(comment);
          }}
          className={cn(
            "block h-7 w-full truncate px-1 text-left outline-none hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring",
            comment ? "font-sans" : "text-muted-foreground/60",
          )}
        >
          {comment || "Add comment…"}
        </button>
      ) : (
        <Input
          autoFocus
          aria-label={`Comment on row ${index}`}
          className="h-7"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") finish(true);
            else if (event.key === "Escape") finish(false);
          }}
          onBlur={() => finish(true)}
        />
      )}
    </TableCell>
  );
}

function Spacer({ height, columns }: { height: number; columns: number }) {
  return (
    <tr aria-hidden="true" data-spacer="true">
      <td colSpan={columns} style={{ height, padding: 0, border: 0 }} />
    </tr>
  );
}

export function DataTable() {
  const records = useAppStore((s) => s.records);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const selectedRecordIndexes = useAppStore((s) => s.selectedRecordIndexes);
  const showComments = useAppStore((s) => s.showComments);
  const selectRecord = useAppStore((s) => s.selectRecord);
  const selectAllVisible = useAppStore((s) => s.selectAllVisible);
  const deselectAllVisible = useAppStore((s) => s.deselectAllVisible);
  const detectedByField = useDetectedPatterns();
  const { shownRecords, visibleRecords, visibleIndexesInOrder, ordinalByIndex, visibleSelectedCount } =
    useVisibleRecords();
  const valueLengths = useMemo(() => maxValueLengths(records), [records]);
  // Shown columns flagged "second line" leave the header and the row; each gets its own full-width line
  // under the row instead. Every record is therefore the same height: the row plus one line per flagged column.
  const flagged = new Set(activeProfile?.display.secondLineKeys ?? []);
  const shownKeys = activeProfile?.display.visibleFieldKeys ?? [];
  const extraKeys = shownKeys.filter((key) => flagged.has(key));
  const columnKeys = shownKeys.filter((key) => !flagged.has(key));
  const recordHeight = ROW_HEIGHT + extraKeys.length * EXTRA_ROW_HEIGHT;
  const { scrollRef, onScroll, range } = useWindowedRows(visibleRecords.length, recordHeight, OVERSCAN_ROWS);

  if (!activeProfile || records.length === 0) {
    return <p className="px-5 text-sm text-muted-foreground">No data parsed yet.</p>;
  }

  const { visibleFieldKeys, fieldLabels, searchState, derivedFieldSelections, columnWidths } = activeProfile.display;
  const term = searchState?.term ?? "";
  const mode = searchState?.mode ?? "highlight";
  const derivedByKey = new Map(derivedFieldSelections.map((spec) => [derivedFieldKey(spec), spec]));

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

  const labelOf = (key: string) => fieldLabels[key] ?? key;
  /** Width in monospace characters: the longest value or the header, whichever needs more, within the limits. */
  function columnChars(key: string): number {
    const spec = derivedByKey.get(key);
    const caption = spec ? `from ${labelOf(spec.sourceFieldKey)} · ${spec.kind}`.length * 0.8 : 0;
    const header = Math.max(
      labelOf(key).length + HEADER_EXTRA_CH + (detectedByField[key]?.length ?? 0) * HINT_CHIP_CH,
      caption,
    );
    return Math.min(COLUMN_MAX_CH, Math.max(COLUMN_MIN_CH, valueLengths.get(key) ?? 0, header));
  }

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

  // The range can lag behind a list that just got shorter (a new search) until the next measurement.
  const start = Math.min(range.start, visibleRecords.length);
  const end = Math.min(Math.max(range.end, start), visibleRecords.length);
  const windowRecords = visibleRecords.slice(start, end);
  // The select/"#" column, the data columns, and an empty filler column that soaks up spare width.
  const commentColumns = showComments ? 1 : 0;
  const columnCount = columnKeys.length + 2 + commentColumns;
  const rowsPerRecord = 1 + extraKeys.length;

  return (
    // The box is the table's only scroller (the shadcn Table wraps itself in an overflow-x-auto
    // container, which would put the horizontal scrollbar at the bottom of the full-height table),
    // so the header can stick to its top edge and both scrollbars sit on its visible edges.
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="mx-5 mb-5 min-h-0 flex-1 overflow-auto border border-border [&_[data-slot=table-container]]:overflow-visible"
    >
      {/* Fixed layout + explicit column widths: the browser can't size columns from rows it hasn't rendered.
          `w-px min-w-full` makes the table as wide as its columns need, and at least as wide as the box;
          the last column has no width, so any spare room goes there instead of stretching the others. */}
      <Table className="w-px min-w-full table-fixed text-[0.8125rem]" aria-rowcount={visibleRecords.length * rowsPerRecord + 1}>
        <colgroup>
          <col style={{ width: LEADING_COLUMN_WIDTH }} />
          {columnKeys.map((key) => (
            <col
              key={key}
              className="font-mono text-[0.8125rem]"
              style={{ width: columnWidths?.[key] ?? `calc(${columnChars(key)}ch + ${CELL_PADDING})` }}
            />
          ))}
          {showComments && <col style={{ width: COMMENT_COLUMN_WIDTH }} />}
          <col />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky top-0 z-10 border-b bg-muted">
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
            {columnKeys.map((key, position) => (
              <TableHead
                key={key}
                className={cn("sticky top-0 z-10 overflow-hidden border-b bg-muted px-3", derivedByKey.has(key) && DERIVED_HEAD)}
              >
                <ColumnHeader
                  fieldKey={key}
                  detected={detectedByField[key] ?? []}
                  isFirst={position === 0}
                  isLast={position === columnKeys.length - 1}
                />
                <ResizeHandle fieldKey={key} label={labelOf(key)} />
              </TableHead>
            ))}
            {showComments && (
              <TableHead className="sticky top-0 z-10 border-b bg-muted px-3 text-xs font-medium text-muted-foreground">
                Comment
              </TableHead>
            )}
            <TableHead aria-hidden="true" className="sticky top-0 z-10 border-b bg-muted p-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {start > 0 && <Spacer height={start * recordHeight} columns={columnCount} />}
          {windowRecords.map((record, offset) => {
            const selected = selectedRecordIndexes.has(record.index) ? "selected" : undefined;
            const firstRowIndex = (start + offset) * rowsPerRecord + 2;
            return (
            <Fragment key={record.index}>
            <TableRow
              aria-rowindex={firstRowIndex}
              data-state={selected}
              onClick={(event) => handleRowClick(event, record.index)}
              className={cn("h-9 cursor-pointer", extraKeys.length > 0 && "border-b-0")}
            >
              <TableCell className="py-0">
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
              {columnKeys.map((key) => {
                const field = record.fields.find((f) => f.key === key);
                const cellClass = cn("overflow-hidden px-3 py-0 font-mono text-ellipsis", derivedByKey.has(key) && DERIVED_CELL);
                if (field?.parseError) {
                  return (
                    <TableCell key={key} className={cn(cellClass, "text-destructive")}>
                      Invalid parse
                    </TableCell>
                  );
                }
                const value = field?.value ?? "";
                return (
                  <TableCell key={key} className={cellClass} title={value.length > COLUMN_MAX_CH || columnWidths?.[key] ? value : undefined}>
                    {mode === "highlight" ? highlightMatches(value, term) : value}
                  </TableCell>
                );
              })}
              {showComments && <CommentCell index={record.index} />}
              <TableCell aria-hidden="true" className="p-0" />
            </TableRow>
            {extraKeys.map((key, j) => {
              const field = record.fields.find((f) => f.key === key);
              const value = field?.parseError ? "Invalid parse" : (field?.value ?? "");
              return (
                <TableRow
                  key={key}
                  data-extra="true"
                  aria-rowindex={firstRowIndex + 1 + j}
                  data-state={selected}
                  onClick={(event) => handleRowClick(event, record.index)}
                  style={{ height: EXTRA_ROW_HEIGHT }}
                  className={cn("cursor-pointer", j < extraKeys.length - 1 && "border-b-0")}
                >
                  <TableCell className="p-0" />
                  <TableCell
                    colSpan={columnKeys.length + 1 + commentColumns}
                    title={value}
                    className={cn("overflow-hidden px-3 pt-1 pb-0 align-top whitespace-normal", derivedByKey.has(key) && DERIVED_CELL)}
                  >
                    <div className={cn("line-clamp-3 font-mono leading-5 break-words", field?.parseError && "text-destructive")}>
                      <span className="mr-2 font-sans text-xs text-muted-foreground select-none">{labelOf(key)}</span>
                      {!field?.parseError && mode === "highlight" ? highlightMatches(value, term) : value}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            </Fragment>
            );
          })}
          {end < visibleRecords.length && <Spacer height={(visibleRecords.length - end) * recordHeight} columns={columnCount} />}
        </TableBody>
      </Table>
    </div>
  );
}

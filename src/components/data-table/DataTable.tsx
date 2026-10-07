"use client";

import {
  Fragment,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { CaretDownIcon, CaretRightIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from "@phosphor-icons/react";
import { ShowAsSubRowsButton } from "@/components/data-table/ShowAsSubRowsButton";
import { ColumnHeader } from "@/components/data-table/ColumnHeader";
import { ValueBadge } from "@/components/data-table/ValueBadge";
import { useArrayKeyByField } from "@/components/data-table/useArrayKeyByField";
import { useColorFit } from "@/components/data-table/useColorFit";
import { useDetectedPatterns } from "@/components/data-table/useDetectedPatterns";
import { useVisibleRecords } from "@/components/data-table/useVisibleRecords";
import { useWindowedRows } from "@/components/data-table/useWindowedRows";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ParsedRecord } from "@/core/dataset/types";
import { maxValueLengths } from "@/core/dataset/valueLengths";
import { derivedFieldKey } from "@/core/derived-fields/derivedFieldKey";
import { enabledFilters } from "@/core/filters/fieldFilters";
import { arrayItemCounts } from "@/core/json/arrayColumns";
import { arrayModeOf, hasColumnOption } from "@/core/profile/columnOptions";
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
 * Every other record is shaded, all its lines alike, so a record spread over several lines reads as one. A tint of
 * the text color, so it shows in dark mode too. Selected records get the accent instead.
 */
const STRIPE = "bg-foreground/[0.07]";
const SELECTED = "bg-accent";

/**
 * Rows are windowed: only the ones near the viewport are in the DOM, so a huge log scrolls as smoothly
 * as a small one. That needs the height of every record to be known without rendering it (see recordLayout)
 * and columns of a width that doesn't depend on which rows are currently rendered (see COLUMN_*_CH).
 * A one-line row is h-9 = 2.25rem at the default font size, and the same in px as long as the root font size
 * isn't changed.
 */
const ROW_HEIGHT = 36;
/** A record whose JSON array items are shown as sub-rows: one line of this height per item, plus padding above and below. */
const ITEM_LINE_HEIGHT = 24;
const ITEM_PADDING = 6;
/** Height of the full-width line a "second line" column gets under each row: up to three lines of text, then "…". */
const EXTRA_ROW_HEIGHT = 68;
/** A JSON array shown as a nested table: the line with its open/close button, then a header and a row per item when open. */
const ARRAY_BAR_HEIGHT = 32;
const NESTED_ROW_HEIGHT = 28;
const NESTED_PADDING = 8;
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

/** The two "filter for / filter out this value" buttons shown over a hovered value (like Kibana). */
function FilterButtons({ fieldKey, value, onDone, className }: { fieldKey: string; value: string; onDone: () => void; className: string }) {
  const addFieldFilter = useAppStore((s) => s.addFieldFilter);

  function filter(event: MouseEvent, negate: boolean) {
    event.stopPropagation(); // not a click on the row: it must not select it
    addFieldFilter(fieldKey, value, negate);
    onDone();
  }

  const buttonClass = "grid size-6 place-items-center outline-none hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring";
  return (
    <span className={cn("absolute right-1 flex h-6 items-center border border-border bg-background shadow-sm", className)}>
      <button type="button" aria-label="Filter for value" title="Filter for value" onClick={(e) => filter(e, false)} className={buttonClass}>
        <MagnifyingGlassPlusIcon className="size-4" />
      </button>
      <button type="button" aria-label="Filter out value" title="Filter out value" onClick={(e) => filter(e, true)} className={buttonClass}>
        <MagnifyingGlassMinusIcon className="size-4" />
      </button>
    </span>
  );
}

/**
 * A data cell. Hovering it shows two buttons to filter on its value: keep only the rows with this exact value in
 * this column, or leave them out. The buttons exist only while the cell is hovered, so the many cells of a big
 * table stay cheap. In a record that spans several lines the value sits on the first line.
 */
function DataCell({
  fieldKey,
  value,
  className,
  title,
  multiLine,
  children,
}: {
  fieldKey: string;
  value: string;
  className: string;
  title?: string;
  multiLine: boolean;
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <TableCell
      className={cn("relative", multiLine && "py-1.5 align-top", className)}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {multiLine ? <div className="h-6 truncate leading-6">{children}</div> : children}
      {hovered && (
        <FilterButtons
          fieldKey={fieldKey}
          value={value}
          onDone={() => setHovered(false)}
          className={multiLine ? "top-1.5" : "inset-y-0 my-auto"}
        />
      )}
    </TableCell>
  );
}

/** One item of a JSON array shown as sub-rows: its own line, with its own filter buttons. */
function ItemLine({ fieldKey, value, first, children }: { fieldKey: string; value: string; first: boolean; children: ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      data-item-line="true"
      title={value.length > 40 ? value : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn("relative h-6 truncate px-3 leading-6", !first && "border-t border-dashed border-border")}
    >
      {children}
      {hovered && value !== "" && (
        <FilterButtons fieldKey={fieldKey} value={value} onDone={() => setHovered(false)} className="inset-y-0 my-auto" />
      )}
    </div>
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
    <TableCell data-comment="true" className="px-2 py-0 align-top" onClick={(event) => event.stopPropagation()}>
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
            "mt-1 block h-7 w-full truncate px-1 text-left outline-none hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring",
            comment ? "font-sans" : "text-muted-foreground/60",
          )}
        >
          {comment || "Add comment…"}
        </button>
      ) : (
        <Input
          autoFocus
          aria-label={`Comment on row ${index}`}
          className="mt-1 h-7"
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

/**
 * A body row: the shadcn TableRow without its hover color, which would hide the stripes and the selected color
 * under the mouse (that is exactly where the row being clicked is).
 */
function BodyRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={cn("border-b", className)} {...props} />;
}

function Spacer({ height, columns }: { height: number; columns: number }) {
  return (
    <tr aria-hidden="true" data-spacer="true">
      <td colSpan={columns} style={{ height, padding: 0, border: 0 }} />
    </tr>
  );
}

/** A JSON array shown as a nested table under its record. */
interface ArrayTable {
  arrayKey: string;
  /** The array's shown columns, in column order. */
  columns: string[];
}

/** What a record needs on screen, computed without rendering it so the windowing knows its height. */
interface RecordLayout {
  /** Lines of the main row: one per item of the longest array shown as sub-rows, at least one. */
  lines: number;
  /** The nested tables the record has (arrays it has items in), with their item count and whether they're open. */
  tables: { table: ArrayTable; count: number; open: boolean }[];
  height: number;
  /** Table rows (<tr>) it takes. */
  rowCount: number;
}

function mainRowHeight(lines: number): number {
  return lines <= 1 ? ROW_HEIGHT : 2 * ITEM_PADDING + lines * ITEM_LINE_HEIGHT;
}

function arrayTableHeight(count: number, open: boolean): number {
  return open ? ARRAY_BAR_HEIGHT + NESTED_ROW_HEIGHT * (count + 1) + NESTED_PADDING : ARRAY_BAR_HEIGHT;
}

export function DataTable() {
  const records = useAppStore((s) => s.records);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const jsonColumns = useAppStore((s) => s.jsonColumns);
  const expandedArrayTables = useAppStore((s) => s.expandedArrayTables);
  const toggleArrayTable = useAppStore((s) => s.toggleArrayTable);
  const setArrayTablesOpen = useAppStore((s) => s.setArrayTablesOpen);
  const selectedRecordIndexes = useAppStore((s) => s.selectedRecordIndexes);
  const showComments = useAppStore((s) => s.showComments);
  const fieldFilters = useAppStore((s) => s.fieldFilters);
  const selectRecord = useAppStore((s) => s.selectRecord);
  const selectAllVisible = useAppStore((s) => s.selectAllVisible);
  const deselectAllVisible = useAppStore((s) => s.deselectAllVisible);
  const detectedByField = useDetectedPatterns();
  const colorFits = useColorFit();
  const arrayKeyByField = useArrayKeyByField();
  const { shownRecords, visibleRecords, visibleIndexesInOrder, ordinalByIndex, visibleSelectedCount } =
    useVisibleRecords();
  const valueLengths = useMemo(() => maxValueLengths(records), [records]);

  const columnOptions = activeProfile?.display.columnOptions;
  const shownKeys = activeProfile?.display.visibleFieldKeys;

  // Which shown columns go where: shown columns flagged "second line" leave the header and the row for a
  // full-width line under it; the columns of a JSON array shown as a nested table leave them for that table.
  const columns = useMemo(() => {
    const extraKeys: string[] = [];
    const columnKeys: string[] = [];
    const tableColumns = new Map<string, string[]>();
    for (const key of shownKeys ?? []) {
      if (hasColumnOption(columnOptions, key, "secondLine")) {
        extraKeys.push(key);
        continue;
      }
      const arrayKey = arrayKeyByField.get(key);
      if (arrayKey && arrayModeOf(columnOptions, arrayKey) === "table") {
        tableColumns.set(arrayKey, [...(tableColumns.get(arrayKey) ?? []), key]);
      } else {
        columnKeys.push(key);
      }
    }
    const rowsArrays = new Set(
      columnKeys.flatMap((key) => {
        const arrayKey = arrayKeyByField.get(key);
        return arrayKey && arrayModeOf(columnOptions, arrayKey) === "rows" ? [arrayKey] : [];
      }),
    );
    const tables: ArrayTable[] = [...tableColumns].map(([arrayKey, keys]) => ({ arrayKey, columns: keys }));
    return { extraKeys, columnKeys, tables, rowsArrays };
  }, [shownKeys, columnOptions, arrayKeyByField]);

  const layoutOf = useMemo(() => {
    const { extraKeys, tables, rowsArrays } = columns;
    return (record: ParsedRecord): RecordLayout => {
      const counts = rowsArrays.size > 0 || tables.length > 0 ? arrayItemCounts(record, arrayKeyByField) : undefined;
      let lines = 1;
      for (const arrayKey of rowsArrays) lines = Math.max(lines, counts?.get(arrayKey) ?? 0);
      const recordTables = tables.flatMap((table) => {
        const count = counts?.get(table.arrayKey) ?? 0;
        return count > 0 ? [{ table, count, open: expandedArrayTables.has(`${table.arrayKey}\n${record.index}`) }] : [];
      });
      const height =
        mainRowHeight(lines) +
        extraKeys.length * EXTRA_ROW_HEIGHT +
        recordTables.reduce((sum, { count, open }) => sum + arrayTableHeight(count, open), 0);
      return { lines, tables: recordTables, height, rowCount: 1 + extraKeys.length + recordTables.length };
    };
  }, [columns, arrayKeyByField, expandedArrayTables]);

  // Top of each visible record (the total height as last entry), and how many table rows come before it.
  const { offsets, rowsBefore } = useMemo(() => {
    const tops = [0];
    const before = [0];
    for (const record of visibleRecords) {
      const layout = layoutOf(record);
      tops.push(tops[tops.length - 1] + layout.height);
      before.push(before[before.length - 1] + layout.rowCount);
    }
    return { offsets: tops, rowsBefore: before };
  }, [visibleRecords, layoutOf]);

  const { scrollRef, onScroll, range } = useWindowedRows(offsets, ROW_HEIGHT * 4, OVERSCAN_ROWS);

  if (!activeProfile || records.length === 0) {
    return <p className="px-5 text-sm text-muted-foreground">No data parsed yet.</p>;
  }

  const { visibleFieldKeys, fieldLabels, searchState, derivedFieldSelections, columnWidths } = activeProfile.display;
  const { extraKeys, columnKeys } = columns;
  // Matches are highlighted in both search modes: Filter only also hides the records without one.
  const term = searchState?.term ?? "";
  const derivedByKey = new Map(derivedFieldSelections.map((spec) => [derivedFieldKey(spec), spec]));
  const isDerivedLike = (key: string) => derivedByKey.has(key) || jsonColumns[key] !== undefined;

  if (visibleFieldKeys.length === 0) {
    return <p className="px-5 text-sm text-muted-foreground">No columns are shown. Use “Columns” to pick some.</p>;
  }
  if (visibleRecords.length === 0) {
    return (
      <p className="px-5 text-sm text-muted-foreground">
        {shownRecords.length === 0
          ? "All records are hidden."
          : enabledFilters(fieldFilters).length > 0
            ? "No records match the filters."
            : "No records match your search."}
      </p>
    );
  }

  const allVisibleSelected = visibleIndexesInOrder.length > 0 && visibleSelectedCount === visibleIndexesInOrder.length;
  const headerCheckedState = allVisibleSelected ? true : visibleSelectedCount > 0 ? "indeterminate" : false;

  const labelOf = (key: string) => fieldLabels[key] ?? key;
  /** A nested table's column title: the key without its array's name ("info.trace[].line" → "line"). */
  const nestedLabelOf = (key: string, arrayKey: string) =>
    fieldLabels[key] ?? (key === arrayKey ? "value" : key.slice(arrayKey.length + 1));
  /** Width in monospace characters: the longest value or the header, whichever needs more, within the limits. */
  function columnChars(key: string): number {
    const spec = derivedByKey.get(key);
    const json = jsonColumns[key];
    const captionText = spec ? `from ${labelOf(spec.sourceFieldKey)} · ${spec.kind}` : json ? `from ${labelOf(json.sourceKey)} · JSON` : "";
    const caption = captionText.length * 0.8;
    const header = Math.max(
      labelOf(key).length +
        HEADER_EXTRA_CH +
        ((detectedByField[key]?.length ?? 0) + (colorFits.get(key)?.status === "good" ? 1 : 0)) * HINT_CHIP_CH,
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

  /** A value as shown: the search term highlighted, and a color badge when its column is color-coded. */
  function valueContent(key: string, value: string): ReactNode {
    const content = highlightMatches(value, term);
    return hasColumnOption(columnOptions, key, "colorCode") && value !== "" ? <ValueBadge value={value}>{content}</ValueBadge> : content;
  }

  /** The cells of one record's main row. */
  function mainCells(record: ParsedRecord, layout: RecordLayout): ReactNode[] {
    const multiLine = layout.lines > 1;
    return columnKeys.map((key) => {
      const field = record.fields.find((f) => f.key === key);
      const cellClass = cn("overflow-hidden px-3 py-0 font-mono text-ellipsis", isDerivedLike(key) && DERIVED_CELL);
      if (field?.parseError) {
        return (
          <TableCell key={key} className={cn(cellClass, "text-destructive", multiLine && "py-1.5 align-top")}>
            Invalid parse
          </TableCell>
        );
      }

      const arrayKey = arrayKeyByField.get(key);
      const mode = arrayKey ? arrayModeOf(columnOptions, arrayKey) : undefined;
      if (field?.items && mode === "rows") {
        // Sub-rows: one line per item, lined up with the items of the same index in the array's other columns.
        return (
          <TableCell key={key} data-items="true" className={cn(cellClass, "px-0 py-1.5 align-top")}>
            {field.items.map((item, i) => (
              <ItemLine key={i} fieldKey={key} value={item} first={i === 0}>
                {valueContent(key, item)}
              </ItemLine>
            ))}
          </TableCell>
        );
      }

      const value = field?.value ?? "";
      return (
        <DataCell
          key={key}
          fieldKey={key}
          value={value}
          className={cellClass}
          multiLine={multiLine}
          title={value.length > COLUMN_MAX_CH || columnWidths?.[key] ? value : undefined}
        >
          {valueContent(key, value)}
        </DataCell>
      );
    });
  }

  // The range can lag behind a list that just got shorter (a new search) until the next measurement.
  const start = Math.min(range.start, visibleRecords.length);
  const end = Math.min(Math.max(range.end, start), visibleRecords.length);
  const windowRecords = visibleRecords.slice(start, end);
  // The select/"#" column, the data columns, and an empty filler column that soaks up spare width.
  const commentColumns = showComments ? 1 : 0;
  const columnCount = columnKeys.length + 2 + commentColumns;
  const fullWidthSpan = columnKeys.length + 1 + commentColumns;

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
      <Table className="w-px min-w-full table-fixed text-[0.8125rem]" aria-rowcount={rowsBefore[rowsBefore.length - 1] + 1}>
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
                className={cn("sticky top-0 z-10 overflow-hidden border-b bg-muted px-3", isDerivedLike(key) && DERIVED_HEAD)}
              >
                <ColumnHeader
                  fieldKey={key}
                  detected={detectedByField[key] ?? []}
                  colorFit={colorFits.get(key)}
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
          {start > 0 && <Spacer height={offsets[start]} columns={columnCount} />}
          {windowRecords.map((record, offset) => {
            const position = start + offset;
            const layout = layoutOf(record);
            // Not data-state="selected": the shadcn row would paint it grey, which a striped row is already.
            const selected = selectedRecordIndexes.has(record.index) ? "true" : undefined;
            const stripe = selected ? SELECTED : position % 2 === 1 && STRIPE;
            const firstRowIndex = rowsBefore[position] + 2;
            const hasMore = layout.rowCount > 1;
            return (
              <Fragment key={record.index}>
                <BodyRow
                  aria-rowindex={firstRowIndex}
                  data-selected={selected}
                  onClick={(event) => handleRowClick(event, record.index)}
                  style={{ height: mainRowHeight(layout.lines) }}
                  className={cn("cursor-pointer", stripe, hasMore && "border-b-0")}
                >
                  <TableCell className={cn("py-0", layout.lines > 1 && "pt-1.5 align-top")}>
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
                  {mainCells(record, layout)}
                  {showComments && <CommentCell index={record.index} />}
                  <TableCell aria-hidden="true" className="p-0" />
                </BodyRow>
                {extraKeys.map((key, j) => {
                  const field = record.fields.find((f) => f.key === key);
                  const value = field?.parseError ? "Invalid parse" : (field?.value ?? "");
                  return (
                    <BodyRow
                      key={key}
                      data-extra="true"
                      aria-rowindex={firstRowIndex + 1 + j}
                      data-selected={selected}
                      onClick={(event) => handleRowClick(event, record.index)}
                      style={{ height: EXTRA_ROW_HEIGHT }}
                      className={cn("cursor-pointer", stripe, (j < extraKeys.length - 1 || layout.tables.length > 0) && "border-b-0")}
                    >
                      <TableCell className="p-0" />
                      <TableCell
                        colSpan={fullWidthSpan}
                        title={value}
                        className={cn("overflow-hidden px-3 pt-1 pb-0 align-top whitespace-normal", isDerivedLike(key) && DERIVED_CELL)}
                      >
                        <div className={cn("line-clamp-3 font-mono leading-5 break-words", field?.parseError && "text-destructive")}>
                          <span className="mr-2 font-sans text-xs text-muted-foreground select-none">{labelOf(key)}</span>
                          {field?.parseError ? value : valueContent(key, value)}
                        </div>
                      </TableCell>
                    </BodyRow>
                  );
                })}
                {layout.tables.map(({ table, count, open }, j) => {
                  const height = arrayTableHeight(count, open);
                  return (
                    <BodyRow
                      key={table.arrayKey}
                      data-array-table={table.arrayKey}
                      aria-rowindex={firstRowIndex + 1 + extraKeys.length + j}
                      data-selected={selected}
                      onClick={(event) => handleRowClick(event, record.index)}
                      style={{ height }}
                      className={cn("cursor-pointer", stripe, j < layout.tables.length - 1 && "border-b-0")}
                    >
                      <TableCell className="p-0" />
                      <TableCell colSpan={fullWidthSpan} className="p-0 align-top">
                        <div style={{ height }} className="overflow-hidden px-3">
                          <div className="flex h-8 items-center gap-3">
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleArrayTable(table.arrayKey, record.index);
                            }}
                            className="flex h-8 items-center gap-1.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            {open ? <CaretDownIcon className="size-3.5" /> : <CaretRightIcon className="size-3.5" />}
                            <span className="font-mono font-semibold text-foreground">{labelOf(table.arrayKey)}</span>
                            {count} {count === 1 ? "item" : "items"}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setArrayTablesOpen(table.arrayKey, visibleIndexesInOrder, !open);
                            }}
                            className="text-xs text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            {open ? "Close all" : "Open all"}
                          </button>
                          <ShowAsSubRowsButton arrayKey={table.arrayKey} />
                          </div>
                          {open && (
                            <table className="w-auto max-w-full table-auto border border-border font-mono text-[0.8125rem]">
                              <thead>
                                <tr className="bg-muted" style={{ height: NESTED_ROW_HEIGHT }}>
                                  {table.columns.map((key) => (
                                    <th key={key} className="px-3 text-left text-xs font-semibold whitespace-nowrap">
                                      {nestedLabelOf(key, table.arrayKey)}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {Array.from({ length: count }, (_, i) => (
                                  <tr key={i} className="border-t border-border" style={{ height: NESTED_ROW_HEIGHT }}>
                                    {table.columns.map((key) => {
                                      const field = record.fields.find((f) => f.key === key);
                                      const item = field?.items?.[i] ?? "";
                                      return (
                                        <td key={key} title={item.length > 60 ? item : undefined} className="max-w-[60ch] truncate px-3">
                                          {valueContent(key, item)}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </TableCell>
                    </BodyRow>
                  );
                })}
              </Fragment>
            );
          })}
          {end < visibleRecords.length && (
            <Spacer height={offsets[offsets.length - 1] - offsets[end]} columns={columnCount} />
          )}
        </TableBody>
      </Table>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  ArrowElbowDownRightIcon,
  ColumnsIcon,
  DotsSixVerticalIcon,
  EyeIcon,
  EyeSlashIcon,
  MagnifyingGlassIcon,
  PaletteIcon,
} from "@phosphor-icons/react";
import { useColorFit } from "@/components/data-table/useColorFit";
import { MAX_COLOR_VALUES } from "@/core/display/colorFit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { derivedFieldKey } from "@/core/derived-fields/derivedFieldKey";
import { hasColumnOption } from "@/core/profile/columnOptions";
import { currentFieldOrder } from "@/core/profile/fieldOrder";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/state/useAppStore";

/** Marker used while dragging over the empty zone under the list, meaning "move to the end". */
const END = "__end__";

/** Every column in one compact list: show/hide, find by name, reorder by dragging. */
export function ColumnsPopover() {
  const activeProfile = useAppStore((s) => s.activeProfile);
  const baseFieldNames = useAppStore((s) => s.baseFieldNames);
  const toggleFieldVisibility = useAppStore((s) => s.toggleFieldVisibility);
  const moveFieldBefore = useAppStore((s) => s.moveFieldBefore);
  const showAllFields = useAppStore((s) => s.showAllFields);
  const hideAllFields = useAppStore((s) => s.hideAllFields);
  const resetFieldOrder = useAppStore((s) => s.resetFieldOrder);
  const toggleColumnOption = useAppStore((s) => s.toggleColumnOption);
  const colorFits = useColorFit();

  const [query, setQuery] = useState("");
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  if (!activeProfile) return null;
  const { visibleFieldKeys, fieldLabels, derivedFieldSelections } = activeProfile.display;

  const labelOf = (key: string) => fieldLabels[key] ?? key;
  const sourceByDerivedKey = new Map(derivedFieldSelections.map((spec) => [derivedFieldKey(spec), spec.sourceFieldKey]));
  const visible = new Set(visibleFieldKeys);
  const columnOptions = activeProfile.display.columnOptions;
  // The full column order: a hidden column stays where it is (dimmed) instead of dropping to the bottom.
  const rows = currentFieldOrder(activeProfile.display, baseFieldNames);

  const needle = query.trim().toLowerCase();
  const canDrag = needle === "";

  const listed = needle ? rows.filter((key) => labelOf(key).toLowerCase().includes(needle)) : rows;

  function handleDrop(target: string) {
    if (dragKey) moveFieldBefore(dragKey, target === END ? null : target);
    setDragKey(null);
    setOverKey(null);
  }

  return (
    <Popover onOpenChange={(open) => !open && setQuery("")}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <ColumnsIcon />
          Columns
          <span className="text-muted-foreground">
            {visibleFieldKeys.length} of {rows.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="relative mb-2">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Find a column…"
            aria-label="Find a column"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 pb-1 text-sm">
          <Button variant="ghost" size="xs" onClick={showAllFields}>
            Show all
          </Button>
          <Button variant="ghost" size="xs" onClick={hideAllFields}>
            Hide all
          </Button>
          <Button variant="ghost" size="xs" onClick={resetFieldOrder}>
            Reset order
          </Button>
        </div>

        <ul className="max-h-80 overflow-y-auto" aria-label="Columns">
          {listed.map((key) => {
            const isShown = visible.has(key);
            const onSecondLine = hasColumnOption(columnOptions, key, "secondLine");
            const fit = colorFits.get(key);
            const colorOn = hasColumnOption(columnOptions, key, "colorCode");
            const colorSuggested = fit?.status === "good" && !colorOn;
            const colorBlocked = fit?.status === "too-many" && !colorOn;
            const source = sourceByDerivedKey.get(key);
            return (
              <li
                key={key}
                draggable={canDrag}
                onDragStart={() => setDragKey(key)}
                onDragEnd={() => {
                  setDragKey(null);
                  setOverKey(null);
                }}
                onDragOver={(event) => {
                  if (!dragKey) return;
                  event.preventDefault();
                  setOverKey(key);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(key);
                }}
                className={cn(
                  "flex h-8 items-center gap-1.5 pr-1 pl-0.5 text-sm",
                  !isShown && "text-muted-foreground",
                  dragKey === key && "opacity-40",
                  overKey === key && dragKey !== key && "shadow-[inset_0_2px_0_var(--foreground)]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-5 place-items-center text-border",
                    canDrag && "cursor-grab text-muted-foreground",
                  )}
                >
                  <DotsSixVerticalIcon className="size-4" />
                </span>
                <button
                  type="button"
                  aria-label={`${isShown ? "Hide" : "Show"} column ${labelOf(key)}`}
                  aria-pressed={isShown}
                  onClick={() => toggleFieldVisibility(key)}
                  className="grid size-6 shrink-0 place-items-center outline-none hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {isShown ? <EyeIcon className="size-4" /> : <EyeSlashIcon className="size-4" />}
                </button>
                <span className="min-w-0 flex-1 truncate font-mono text-[0.8125rem]" title={labelOf(key)}>
                  {labelOf(key)}
                </span>
                <button
                  type="button"
                  aria-label={`${onSecondLine ? "Show in the row" : "Show on a second line"}: ${labelOf(key)}`}
                  aria-pressed={onSecondLine}
                  title={onSecondLine ? "On a second line — click to put it back in the row" : "Show on a second line under the row"}
                  onClick={() => toggleColumnOption(key, "secondLine")}
                  className={cn(
                    "grid size-6 shrink-0 place-items-center outline-none hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring",
                    onSecondLine ? "bg-accent text-foreground" : "text-muted-foreground",
                  )}
                >
                  <ArrowElbowDownRightIcon className="size-4" />
                </button>
                <span
                  title={
                    colorBlocked
                      ? `Too many different values to tell apart by color: more than ${MAX_COLOR_VALUES}`
                      : colorOn
                        ? "Color-coded — click to stop"
                        : colorSuggested
                          ? `Only ${fit?.distinct} different values: good for color-coding`
                          : "Color each different value"
                  }
                >
                  <button
                    type="button"
                    disabled={colorBlocked}
                    aria-label={`${colorOn ? "Stop color-coding" : "Color-code values"}: ${labelOf(key)}`}
                    aria-pressed={colorOn}
                    onClick={() => toggleColumnOption(key, "colorCode")}
                    className={cn(
                      "grid size-6 shrink-0 place-items-center outline-none hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35",
                      colorOn ? "bg-accent text-foreground" : colorSuggested ? "font-semibold text-foreground ring-1 ring-border" : "text-muted-foreground",
                    )}
                  >
                    <PaletteIcon className="size-4" />
                  </button>
                </span>
                {source !== undefined && (
                  <span className="shrink-0 text-[0.6875rem] text-muted-foreground">from {labelOf(source)}</span>
                )}
              </li>
            );
          })}
          {canDrag && (
            <li
              aria-hidden
              className={cn("h-3", overKey === END && "shadow-[inset_0_2px_0_var(--foreground)]")}
              onDragOver={(event) => {
                if (!dragKey) return;
                event.preventDefault();
                setOverKey(END);
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(END);
              }}
            />
          )}
          {listed.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">No column matches “{query}”.</li>}
        </ul>
        <p className="border-t border-border px-1 pt-2 text-xs text-muted-foreground">
          Drag to reorder. A hidden column keeps its place. The arrow puts a column on its own line under each row; the palette gives each different value its own color.
        </p>
      </PopoverContent>
    </Popover>
  );
}

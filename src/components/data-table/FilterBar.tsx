"use client";

import { XIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FieldFilter } from "@/core/filters/fieldFilters";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/state/useAppStore";

/** How a filter reads on its pill: "column: value", "NOT column: value", with "(empty)" for an empty cell. */
function describeFilter(filter: FieldFilter, columnLabel: string): string {
  const value = filter.value === "" ? "(empty)" : filter.value;
  return `${filter.negate ? "NOT " : ""}${columnLabel}: ${value}`;
}

function FilterPill({ filter }: { filter: FieldFilter }) {
  const label = useAppStore((s) => s.activeProfile?.display.fieldLabels[filter.key] ?? filter.key);
  const removeFieldFilter = useAppStore((s) => s.removeFieldFilter);
  const toggleNegation = useAppStore((s) => s.toggleFieldFilterNegation);
  const toggleDisabled = useAppStore((s) => s.toggleFieldFilterDisabled);
  const text = describeFilter(filter, label);

  return (
    <div
      data-testid="filter-pill"
      data-negated={filter.negate}
      data-disabled={filter.disabled}
      className={cn(
        "flex h-7 max-w-80 items-center border text-[0.8125rem]",
        filter.negate ? "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100" : "border-border bg-muted",
        filter.disabled && "opacity-60",
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={filter.disabled ? `${text} (disabled)` : text}
            aria-label={`Filter ${text}`}
            className={cn("min-w-0 truncate px-2 text-left outline-none hover:bg-black/5 focus-visible:ring-1 focus-visible:ring-ring", filter.disabled && "line-through")}
          >
            {text}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => toggleNegation(filter.id)}>
            {filter.negate ? "Include results" : "Exclude results"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => toggleDisabled(filter.id)}>
            {filter.disabled ? "Re-enable" : "Temporarily disable"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => removeFieldFilter(filter.id)}>Remove</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        aria-label={`Remove filter ${text}`}
        onClick={() => removeFieldFilter(filter.id)}
        className="grid size-7 shrink-0 place-items-center text-muted-foreground outline-none hover:bg-black/5 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}

/** The cell filters, listed above the table as pills that can be flipped, switched off or removed. Hidden when there are none. */
export function FilterBar() {
  const fieldFilters = useAppStore((s) => s.fieldFilters);
  const clearFieldFilters = useAppStore((s) => s.clearFieldFilters);
  if (fieldFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-5 pb-3" role="group" aria-label="Filters">
      {fieldFilters.map((filter) => (
        <FilterPill key={filter.id} filter={filter} />
      ))}
      <Button variant="ghost" size="xs" onClick={clearFieldFilters} className="text-muted-foreground">
        Clear all
      </Button>
    </div>
  );
}

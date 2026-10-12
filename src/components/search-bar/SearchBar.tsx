"use client";

import { useState, type KeyboardEvent } from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { ClockCounterClockwiseIcon, MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { listSearchHistory, setSearchHistory, withSearchTerm } from "@/core/persistence/searchHistory";
import type { SearchMode } from "@/core/profile/types";
import { useAppStore } from "@/state/useAppStore";

const DEFAULT_SEARCH_STATE = { term: "", mode: "highlight" as SearchMode };

/** How many past searches the suggestion list shows at once. */
const SUGGESTION_LIMIT = 8;

/** Past searches, saved in local storage (see searchHistory). */
function useSearchHistory() {
  const [history, setHistory] = useState(listSearchHistory);

  function update(next: string[]) {
    setHistory(next);
    setSearchHistory(next);
  }

  return {
    history,
    remember: (term: string) => update(withSearchTerm(history, term)),
    forget: (term: string) => update(history.filter((past) => past !== term)),
  };
}

export function SearchBar() {
  const activeProfile = useAppStore((s) => s.activeProfile);
  const setSearchState = useAppStore((s) => s.setSearchState);
  const { history, remember, forget } = useSearchHistory();

  if (!activeProfile) return null;

  const { term, mode } = activeProfile.display.searchState ?? DEFAULT_SEARCH_STATE;

  // The search runs as you type; a term is only remembered once you're done with it (Enter, or leaving the field),
  // so the history isn't filled with every prefix typed along the way.
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") remember(term);
  }

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      <Autocomplete.Root
        items={history}
        value={term}
        onValueChange={(value, details) => {
          setSearchState({ term: value, mode });
          if (details.reason === "item-press") remember(value);
        }}
        openOnInputClick
        limit={SUGGESTION_LIMIT}
      >
        <div className="relative w-full sm:w-72">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Autocomplete.Input
            render={<Input className="pl-8" />}
            placeholder="Search visible columns…"
            aria-label="Search visible columns"
            onKeyDown={handleKeyDown}
            onBlur={() => remember(term)}
          />
        </div>
        <Autocomplete.Portal>
          <Autocomplete.Positioner className="isolate z-50 outline-none" sideOffset={4} align="start">
            <Autocomplete.Popup
              aria-label="Recent searches"
              className="w-(--anchor-width) max-w-(--available-width) rounded-none bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 data-empty:hidden"
            >
              <div className="px-2 pt-1.5 pb-1 text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase">
                Recent searches
              </div>
              <Autocomplete.List className="max-h-(--available-height) overflow-y-auto outline-none">
                {(past: string) => (
                  <Autocomplete.Item
                    key={past}
                    value={past}
                    className="group/item flex min-h-8 cursor-default items-center gap-2 rounded-none py-1 pr-1 pl-2 outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    <ClockCounterClockwiseIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-mono text-[0.8125rem]">{past}</span>
                    <button
                      type="button"
                      aria-label={`Remove “${past}” from recent searches`}
                      title="Remove from recent searches"
                      className="grid size-6 shrink-0 place-items-center text-muted-foreground opacity-0 outline-none group-data-highlighted/item:opacity-100 hover:bg-border hover:text-foreground focus-visible:opacity-100"
                      // Keep the click from also picking the suggestion.
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={(event) => {
                        event.stopPropagation();
                        forget(past);
                      }}
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
      <ToggleGroup
        variant="outline"
        spacing={0}
        value={[mode]}
        onValueChange={([value]) => value && setSearchState({ term, mode: value as SearchMode })}
      >
        <ToggleGroupItem value="highlight">Highlight</ToggleGroupItem>
        <ToggleGroupItem value="filter">Filter</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

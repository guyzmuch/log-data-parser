"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SearchMode } from "@/core/profile/types";
import { useAppStore } from "@/state/useAppStore";

const DEFAULT_SEARCH_STATE = { term: "", mode: "highlight" as SearchMode };

export function SearchBar() {
  const activeProfile = useAppStore((s) => s.activeProfile);
  const setSearchState = useAppStore((s) => s.setSearchState);

  if (!activeProfile) return null;

  const { term, mode } = activeProfile.display.searchState ?? DEFAULT_SEARCH_STATE;

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-72">
        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search visible columns…"
          value={term}
          onChange={(event) => setSearchState({ term: event.target.value, mode })}
        />
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={0}
        value={mode}
        onValueChange={(value) => value && setSearchState({ term, mode: value as SearchMode })}
      >
        <ToggleGroupItem value="highlight">Highlight</ToggleGroupItem>
        <ToggleGroupItem value="filter">Filter</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

"use client";

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
    <div className="flex items-center gap-2 border border-input p-2">
      <Input
        className="max-w-xs"
        placeholder="Search visible columns…"
        value={term}
        onChange={(event) => setSearchState({ term: event.target.value, mode })}
      />
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(value) => value && setSearchState({ term, mode: value as SearchMode })}
      >
        <ToggleGroupItem value="highlight">Highlight</ToggleGroupItem>
        <ToggleGroupItem value="filter">Filter</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

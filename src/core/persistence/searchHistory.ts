const STORAGE_KEY = "log-data-parser:search-history";

/** How many past searches are kept. The oldest goes first. */
export const MAX_SEARCH_HISTORY = 100;

function hasLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

/** The history with `term` moved (or added) to the front, most recent first. A blank term leaves it as it is. */
export function withSearchTerm(history: string[], term: string): string[] {
  const trimmed = term.trim();
  if (trimmed === "") return history;
  return [trimmed, ...history.filter((past) => past !== trimmed)].slice(0, MAX_SEARCH_HISTORY);
}

/** Past search terms, most recent first, shared by every Profile and Dataset. Persists across reloads. */
export function listSearchHistory(): string[] {
  if (!hasLocalStorage()) return [];

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((term): term is string => typeof term === "string") : [];
  } catch {
    return [];
  }
}

export function setSearchHistory(history: string[]): void {
  if (!hasLocalStorage()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

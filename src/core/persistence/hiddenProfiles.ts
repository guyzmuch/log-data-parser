const STORAGE_KEY = "log-data-parser:hidden-profile-ids";

function hasLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

/** Persistent (not session-only) — see Hidden Profile in CONTEXT.md. Works for both built-in and user Profile ids. */
export function listHiddenProfileIds(): string[] {
  if (!hasLocalStorage()) return [];

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function setHiddenProfileIds(ids: string[]): void {
  if (!hasLocalStorage()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

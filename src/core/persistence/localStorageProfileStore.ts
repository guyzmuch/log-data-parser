import type { Profile } from "@/core/profile/types";
import { normalizeProfile } from "@/core/profile/validateProfile";

const STORAGE_KEY = "log-data-parser:profiles";
const SCHEMA_VERSION = 1;

interface ProfileStoreSnapshot {
  schemaVersion: number;
  profiles: Profile[];
}

function emptySnapshot(): ProfileStoreSnapshot {
  return { schemaVersion: SCHEMA_VERSION, profiles: [] };
}

function hasLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

function readSnapshot(): ProfileStoreSnapshot {
  if (!hasLocalStorage()) return emptySnapshot();

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptySnapshot();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as { profiles?: unknown }).profiles)) {
      return emptySnapshot();
    }
    // Repair stale entries and drop corrupt ones individually, rather than discarding the whole store.
    const profiles = (parsed as { profiles: unknown[] }).profiles
      .map(normalizeProfile)
      .filter((profile): profile is Profile => profile !== undefined);
    return { schemaVersion: SCHEMA_VERSION, profiles };
  } catch {
    return emptySnapshot();
  }
}

function writeSnapshot(snapshot: ProfileStoreSnapshot): void {
  if (!hasLocalStorage()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function listProfiles(): Profile[] {
  return readSnapshot().profiles;
}

/** Inserts a new Profile, or replaces the existing one with the same id. */
export function saveProfile(profile: Profile): void {
  const snapshot = readSnapshot();
  const index = snapshot.profiles.findIndex((p) => p.id === profile.id);

  if (index === -1) {
    snapshot.profiles.push(profile);
  } else {
    snapshot.profiles[index] = profile;
  }

  writeSnapshot(snapshot);
}

/** Upserts each given Profile by id, in one write. */
export function saveProfiles(profiles: Profile[]): void {
  const snapshot = readSnapshot();

  for (const profile of profiles) {
    const index = snapshot.profiles.findIndex((p) => p.id === profile.id);
    if (index === -1) {
      snapshot.profiles.push(profile);
    } else {
      snapshot.profiles[index] = profile;
    }
  }

  writeSnapshot(snapshot);
}

export function deleteProfile(id: string): void {
  const snapshot = readSnapshot();
  writeSnapshot({
    schemaVersion: SCHEMA_VERSION,
    profiles: snapshot.profiles.filter((profile) => profile.id !== id),
  });
}

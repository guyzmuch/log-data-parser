import { create } from "zustand";
import type { Dataset, ParsedRecord } from "@/core/dataset/types";
import { computeExpectedFieldCount } from "@/core/parsing/computeExpectedFieldCount";
import { detectDelimiter } from "@/core/parsing/detectDelimiter";
import { parseDataset } from "@/core/parsing/parseDataset";
import { parseRecord } from "@/core/parsing/parseRecord";
import { sampleMiddleLines } from "@/core/parsing/sampleMiddleLines";
import type { DelimiterParsingConfig } from "@/core/parsing/types";
import { createDefaultDisplayConfig, createProfile } from "@/core/profile/createProfile";
import type { Profile } from "@/core/profile/types";

/**
 * Phase D placeholder: auto-derives a delimiter Profile straight from the
 * Dataset (auto-detected delimiter, no header/quote/trim toggles). Replaced
 * by the interactive wizard in Phase E, which lets the user confirm/override
 * these choices instead of guessing.
 */
function autoCreateProfile(rawText: string): Profile {
  const sample = sampleMiddleLines(rawText, 10);
  const delimiter = detectDelimiter(sample);

  const draftConfig: DelimiterParsingConfig = {
    kind: "delimiter",
    delimiter,
    hasHeaderRow: false,
    stripQuotes: false,
    trimBoundaryPartials: false,
    expectedFieldCount: 0,
  };

  const sampleRecords = sample.map((raw, index) => parseRecord({ index, raw }, draftConfig));
  const expectedFieldCount = computeExpectedFieldCount(sampleRecords);
  const fieldNames = Array.from({ length: expectedFieldCount }, (_, i) => `Field ${i + 1}`);

  return createProfile({
    name: "Untitled profile",
    parsing: { ...draftConfig, expectedFieldCount },
    display: createDefaultDisplayConfig(fieldNames),
  });
}

interface AppState {
  dataset: Dataset | null;
  fieldNames: string[];
  records: ParsedRecord[];
  activeProfile: Profile | null;
  /** Session-only; never persisted to the Profile (see Hidden Record in CONTEXT.md). */
  hiddenRecordIndexes: Set<number>;

  loadDataset: (rawText: string) => void;
  setVisibleFieldKeys: (keys: string[]) => void;
  toggleFieldVisibility: (key: string) => void;
  moveFieldUp: (key: string) => void;
  moveFieldDown: (key: string) => void;
  renameField: (key: string, label: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  dataset: null,
  fieldNames: [],
  records: [],
  activeProfile: null,
  hiddenRecordIndexes: new Set(),

  loadDataset: (rawText) => {
    const activeProfile = autoCreateProfile(rawText);
    const { fieldNames, records } = parseDataset(rawText, activeProfile.parsing);

    set({
      dataset: { rawText },
      activeProfile,
      fieldNames,
      records,
      hiddenRecordIndexes: new Set(),
    });
  },

  setVisibleFieldKeys: (keys) => {
    const profile = get().activeProfile;
    if (!profile) return;
    set({ activeProfile: { ...profile, display: { ...profile.display, visibleFieldKeys: keys } } });
  },

  toggleFieldVisibility: (key) => {
    const profile = get().activeProfile;
    if (!profile) return;
    const { visibleFieldKeys } = profile.display;
    const next = visibleFieldKeys.includes(key)
      ? visibleFieldKeys.filter((k) => k !== key)
      : [...visibleFieldKeys, key];
    get().setVisibleFieldKeys(next);
  },

  moveFieldUp: (key) => {
    const profile = get().activeProfile;
    if (!profile) return;
    const keys = [...profile.display.visibleFieldKeys];
    const i = keys.indexOf(key);
    if (i <= 0) return;
    [keys[i - 1], keys[i]] = [keys[i], keys[i - 1]];
    get().setVisibleFieldKeys(keys);
  },

  moveFieldDown: (key) => {
    const profile = get().activeProfile;
    if (!profile) return;
    const keys = [...profile.display.visibleFieldKeys];
    const i = keys.indexOf(key);
    if (i === -1 || i >= keys.length - 1) return;
    [keys[i + 1], keys[i]] = [keys[i], keys[i + 1]];
    get().setVisibleFieldKeys(keys);
  },

  renameField: (key, label) => {
    const profile = get().activeProfile;
    if (!profile) return;
    set({
      activeProfile: {
        ...profile,
        display: { ...profile.display, fieldLabels: { ...profile.display.fieldLabels, [key]: label } },
      },
    });
  },
}));

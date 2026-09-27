import { create } from "zustand";
import type { Dataset, ParsedRecord } from "@/core/dataset/types";
import { parseDataset } from "@/core/parsing/parseDataset";
import { listProfiles, saveProfile } from "@/core/persistence/localStorageProfileStore";
import type { Profile } from "@/core/profile/types";

interface AppState {
  dataset: Dataset | null;
  fieldNames: string[];
  records: ParsedRecord[];
  activeProfile: Profile | null;
  /** Session-only; never persisted to the Profile (see Hidden Record in CONTEXT.md). */
  hiddenRecordIndexes: Set<number>;
  /** Profiles available to pick from, loaded from localStorage. */
  savedProfiles: Profile[];

  loadDataset: (rawText: string) => void;
  /** Re-parses the current Dataset with this Profile and makes it active. */
  applyProfile: (profile: Profile) => void;
  /** Persists the Profile, refreshes the picker list, then applies it. */
  saveAndApplyProfile: (profile: Profile) => void;

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
  savedProfiles: [],

  loadDataset: (rawText) => {
    set({
      dataset: { rawText },
      activeProfile: null,
      fieldNames: [],
      records: [],
      hiddenRecordIndexes: new Set(),
      savedProfiles: listProfiles(),
    });
  },

  applyProfile: (profile) => {
    const dataset = get().dataset;
    if (!dataset) return;
    const { fieldNames, records } = parseDataset(dataset.rawText, profile.parsing);
    set({ activeProfile: profile, fieldNames, records, hiddenRecordIndexes: new Set() });
  },

  saveAndApplyProfile: (profile) => {
    saveProfile(profile);
    set({ savedProfiles: listProfiles() });
    get().applyProfile(profile);
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

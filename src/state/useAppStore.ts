import { create } from "zustand";
import type { Dataset, ParsedRecord } from "@/core/dataset/types";
import { applyDerivedFields } from "@/core/derived-fields/applyDerivedFields";
import { derivedFieldKey } from "@/core/derived-fields/derivedFieldKey";
import type { DerivedFieldSpec } from "@/core/derived-fields/types";
import { parseDataset } from "@/core/parsing/parseDataset";
import { listProfiles, saveProfile } from "@/core/persistence/localStorageProfileStore";
import type { Profile } from "@/core/profile/types";

interface AppState {
  dataset: Dataset | null;
  /** Field keys parsing produced directly, before any Derived Fields. */
  baseFieldNames: string[];
  /** baseFieldNames + the current derivedFieldSelections' keys — what ColumnControls iterates. */
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

  /** Adds the default ISO/local-time pair for a Field, if it doesn't already have Derived Fields. No-op otherwise. */
  addDefaultDateDerivedFields: (sourceFieldKey: string) => void;
  /** Adds one more timezone-specific Derived Field for a Field — additive, never replaces existing ones. */
  addTimezoneDerivedField: (sourceFieldKey: string, timezone: string) => void;
}

export const useAppStore = create<AppState>((set, get) => {
  /** Recomputes derivation over the current base Records and applies new display state in one go. */
  function commitDerivedFieldSelections(derivedFieldSelections: DerivedFieldSpec[]) {
    const { activeProfile, baseFieldNames, records } = get();
    if (!activeProfile) return;

    const previousKeys = new Set(activeProfile.display.derivedFieldSelections.map(derivedFieldKey));
    const newlyAddedKeys = derivedFieldSelections.map(derivedFieldKey).filter((key) => !previousKeys.has(key));

    const updatedProfile: Profile = {
      ...activeProfile,
      display: {
        ...activeProfile.display,
        derivedFieldSelections,
        // New Derived Fields default to visible, same as a freshly-created Profile's base fields.
        visibleFieldKeys: [...activeProfile.display.visibleFieldKeys, ...newlyAddedKeys],
      },
    };

    set({
      activeProfile: updatedProfile,
      fieldNames: [...baseFieldNames, ...derivedFieldSelections.map(derivedFieldKey)],
      records: applyDerivedFields(records, derivedFieldSelections),
    });
  }

  return {
    dataset: null,
    baseFieldNames: [],
    fieldNames: [],
    records: [],
    activeProfile: null,
    hiddenRecordIndexes: new Set(),
    savedProfiles: [],

    loadDataset: (rawText) => {
      set({
        dataset: { rawText },
        activeProfile: null,
        baseFieldNames: [],
        fieldNames: [],
        records: [],
        hiddenRecordIndexes: new Set(),
        savedProfiles: listProfiles(),
      });
    },

    applyProfile: (profile) => {
      const dataset = get().dataset;
      if (!dataset) return;
      const { fieldNames: baseFieldNames, records: baseRecords } = parseDataset(dataset.rawText, profile.parsing);
      const records = applyDerivedFields(baseRecords, profile.display.derivedFieldSelections);
      const derivedKeys = profile.display.derivedFieldSelections.map(derivedFieldKey);
      set({
        activeProfile: profile,
        baseFieldNames,
        fieldNames: [...baseFieldNames, ...derivedKeys],
        records,
        hiddenRecordIndexes: new Set(),
      });
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

    addDefaultDateDerivedFields: (sourceFieldKey) => {
      const profile = get().activeProfile;
      if (!profile) return;
      if (profile.display.derivedFieldSelections.some((spec) => spec.sourceFieldKey === sourceFieldKey)) return;

      const newSpecs: DerivedFieldSpec[] = [
        { kind: "date", sourceFieldKey, representation: "iso" },
        { kind: "date", sourceFieldKey, representation: "timezone" },
      ];
      commitDerivedFieldSelections([...profile.display.derivedFieldSelections, ...newSpecs]);
    },

    addTimezoneDerivedField: (sourceFieldKey, timezone) => {
      const profile = get().activeProfile;
      if (!profile) return;
      const alreadyExists = profile.display.derivedFieldSelections.some(
        (spec) => spec.sourceFieldKey === sourceFieldKey && spec.representation === "timezone" && spec.timezone === timezone,
      );
      if (alreadyExists) return;

      const newSpec: DerivedFieldSpec = { kind: "date", sourceFieldKey, representation: "timezone", timezone };
      commitDerivedFieldSelections([...profile.display.derivedFieldSelections, newSpec]);
    },
  };
});

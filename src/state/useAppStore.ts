import { create } from "zustand";
import type { Dataset, ParsedRecord } from "@/core/dataset/types";
import { applyDerivedFields } from "@/core/derived-fields/applyDerivedFields";
import { derivedFieldKey } from "@/core/derived-fields/derivedFieldKey";
import { discoverJsonKeys } from "@/core/derived-fields/discoverJsonKeys";
import type { DerivedFieldSpec } from "@/core/derived-fields/types";
import { parseDataset } from "@/core/parsing/parseDataset";
import { listHiddenProfileIds, setHiddenProfileIds } from "@/core/persistence/hiddenProfiles";
import { listProfiles, saveProfile, saveProfiles } from "@/core/persistence/localStorageProfileStore";
import type { Profile, SearchState } from "@/core/profile/types";
import { computeRangeSelection, type SelectionModifiers } from "@/core/selection/computeRangeSelection";

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
  /** Rows currently selected (via click/ctrl-click/shift-click), candidates for hiding — not the same as hiddenRecordIndexes. */
  selectedRecordIndexes: Set<number>;
  /** The last plain- or ctrl-clicked row index, used as the shift-click range anchor. */
  selectionAnchorIndex: number | null;
  /** Profiles available to pick from, loaded from localStorage. */
  savedProfiles: Profile[];
  /** Ids of Profiles (built-in or user) hidden from the picker's normal view — see Hidden Profile in CONTEXT.md. */
  hiddenProfileIds: Set<string>;

  loadDataset: (rawText: string) => void;
  /** Re-parses the current Dataset with this Profile and makes it active. */
  applyProfile: (profile: Profile) => void;
  /** Persists the Profile, refreshes the picker list, then applies it. */
  saveAndApplyProfile: (profile: Profile) => void;
  /** Upserts every given Profile by id in one go and refreshes the picker list. Doesn't apply any of them. */
  importSavedProfiles: (profiles: Profile[]) => void;
  /** Persists the current live display state (visible columns, order, labels, derived fields, search) back onto the active Profile. */
  saveCurrentView: () => void;
  /** Hides a Profile (built-in or user) from the picker's normal view. Persists across reloads. */
  hideProfile: (id: string) => void;
  /** Reverses hideProfile. */
  unhideProfile: (id: string) => void;

  setVisibleFieldKeys: (keys: string[]) => void;
  toggleFieldVisibility: (key: string) => void;
  moveFieldUp: (key: string) => void;
  moveFieldDown: (key: string) => void;
  renameField: (key: string, label: string) => void;
  setSearchState: (search: SearchState) => void;

  /**
   * Updates row selection for a click on this row, per the plain/ctrl/shift rules in
   * computeRangeSelection. `visibleIndexesInOrder` must be the currently-rendered Record
   * indexes in order (after hidden + search filtering) so shift-click ranges never sweep
   * in a row that isn't actually visible.
   */
  selectRecord: (index: number, modifiers: SelectionModifiers, visibleIndexesInOrder: number[]) => void;
  /** Adds every currently-visible Record to the selection (leaves already-selected-but-not-visible rows untouched). */
  selectAllVisible: (visibleIndexesInOrder: number[]) => void;
  /** Removes every currently-visible Record from the selection (leaves selected-but-not-visible rows untouched). */
  deselectAllVisible: (visibleIndexesInOrder: number[]) => void;
  /** Moves the current selection into hiddenRecordIndexes and clears the selection. */
  hideSelectedRecords: () => void;
  /** Clears hiddenRecordIndexes, making every Record visible again. */
  unhideAllRecords: () => void;

  /** Adds the default ISO/local-time pair for a Field, if it doesn't already have a date Derived Field. No-op otherwise. */
  addDefaultDateDerivedFields: (sourceFieldKey: string) => void;
  /** Adds one more timezone-specific Derived Field for a Field — additive, never replaces existing ones. */
  addTimezoneDerivedField: (sourceFieldKey: string, timezone: string) => void;
  /** Adds a trimmed Derived Field for a Field, if it doesn't already have one. */
  addTrimDerivedField: (sourceFieldKey: string) => void;
  /** Adds an unescaped Derived Field for a Field, if it doesn't already have one. */
  addUnescapeDerivedField: (sourceFieldKey: string) => void;
  /** Discovers JSON keys from the Field's current values and adds one Derived Field per key. No-op if it already has any, or if nothing in the sample parses as a JSON object. */
  addJsonKeyDerivedFields: (sourceFieldKey: string) => void;
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
    selectedRecordIndexes: new Set(),
    selectionAnchorIndex: null,
    savedProfiles: [],
    hiddenProfileIds: new Set(),

    loadDataset: (rawText) => {
      set({
        dataset: { rawText },
        activeProfile: null,
        baseFieldNames: [],
        fieldNames: [],
        records: [],
        hiddenRecordIndexes: new Set(),
        selectedRecordIndexes: new Set(),
        selectionAnchorIndex: null,
        savedProfiles: listProfiles(),
        hiddenProfileIds: new Set(listHiddenProfileIds()),
      });
    },

    applyProfile: (profile) => {
      const dataset = get().dataset;
      if (!dataset) return;
      const { fieldNames: baseFieldNames, records: baseRecords } = parseDataset(dataset.rawText, profile.parsing);
      const records = applyDerivedFields(baseRecords, profile.display.derivedFieldSelections);
      const derivedKeys = profile.display.derivedFieldSelections.map(derivedFieldKey);

      // A Profile with no Visible Fields set yet (e.g. a built-in template
      // that's never seen this Dataset's actual Field names before) defaults
      // to everything visible, same as a freshly-created Profile.
      const visibleFieldKeys =
        profile.display.visibleFieldKeys.length > 0
          ? profile.display.visibleFieldKeys
          : [...baseFieldNames, ...derivedKeys];
      const appliedProfile: Profile = { ...profile, display: { ...profile.display, visibleFieldKeys } };

      set({
        activeProfile: appliedProfile,
        baseFieldNames,
        fieldNames: [...baseFieldNames, ...derivedKeys],
        records,
        hiddenRecordIndexes: new Set(),
        selectedRecordIndexes: new Set(),
        selectionAnchorIndex: null,
      });
    },

    saveAndApplyProfile: (profile) => {
      saveProfile(profile);
      set({ savedProfiles: listProfiles() });
      get().applyProfile(profile);
    },

    importSavedProfiles: (profiles) => {
      saveProfiles(profiles);
      set({ savedProfiles: listProfiles() });
    },

    saveCurrentView: () => {
      const profile = get().activeProfile;
      if (!profile) return;
      const updatedProfile: Profile = { ...profile, updatedAt: new Date().toISOString() };
      saveProfile(updatedProfile);
      set({ activeProfile: updatedProfile, savedProfiles: listProfiles() });
    },

    hideProfile: (id) => {
      const next = new Set(get().hiddenProfileIds);
      next.add(id);
      setHiddenProfileIds([...next]);
      set({ hiddenProfileIds: next });
    },

    unhideProfile: (id) => {
      const next = new Set(get().hiddenProfileIds);
      next.delete(id);
      setHiddenProfileIds([...next]);
      set({ hiddenProfileIds: next });
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

    setSearchState: (search) => {
      const profile = get().activeProfile;
      if (!profile) return;
      set({ activeProfile: { ...profile, display: { ...profile.display, searchState: search } } });
    },

    selectRecord: (index, modifiers, visibleIndexesInOrder) => {
      const { selectedRecordIndexes, selectionAnchorIndex } = get();
      const { selection, anchorIndex } = computeRangeSelection(
        selectedRecordIndexes,
        selectionAnchorIndex,
        index,
        modifiers,
        visibleIndexesInOrder,
      );
      set({ selectedRecordIndexes: selection, selectionAnchorIndex: anchorIndex });
    },

    selectAllVisible: (visibleIndexesInOrder) => {
      const next = new Set(get().selectedRecordIndexes);
      for (const index of visibleIndexesInOrder) next.add(index);
      set({ selectedRecordIndexes: next });
    },

    deselectAllVisible: (visibleIndexesInOrder) => {
      const next = new Set(get().selectedRecordIndexes);
      for (const index of visibleIndexesInOrder) next.delete(index);
      set({ selectedRecordIndexes: next });
    },

    hideSelectedRecords: () => {
      const { hiddenRecordIndexes, selectedRecordIndexes } = get();
      const next = new Set(hiddenRecordIndexes);
      for (const index of selectedRecordIndexes) next.add(index);
      set({ hiddenRecordIndexes: next, selectedRecordIndexes: new Set(), selectionAnchorIndex: null });
    },

    unhideAllRecords: () => {
      set({ hiddenRecordIndexes: new Set() });
    },

    addDefaultDateDerivedFields: (sourceFieldKey) => {
      const profile = get().activeProfile;
      if (!profile) return;
      const alreadyHasDate = profile.display.derivedFieldSelections.some(
        (spec) => spec.kind === "date" && spec.sourceFieldKey === sourceFieldKey,
      );
      if (alreadyHasDate) return;

      const newSpecs: DerivedFieldSpec[] = [
        { kind: "date", sourceFieldKey, representation: "iso" },
        { kind: "date", sourceFieldKey, representation: "timezone" },
      ];
      commitDerivedFieldSelections([...profile.display.derivedFieldSelections, ...newSpecs]);
    },

    addTrimDerivedField: (sourceFieldKey) => {
      const profile = get().activeProfile;
      if (!profile) return;
      const alreadyExists = profile.display.derivedFieldSelections.some(
        (spec) => spec.kind === "trim" && spec.sourceFieldKey === sourceFieldKey,
      );
      if (alreadyExists) return;

      const newSpec: DerivedFieldSpec = { kind: "trim", sourceFieldKey };
      commitDerivedFieldSelections([...profile.display.derivedFieldSelections, newSpec]);
    },

    addUnescapeDerivedField: (sourceFieldKey) => {
      const profile = get().activeProfile;
      if (!profile) return;
      const alreadyExists = profile.display.derivedFieldSelections.some(
        (spec) => spec.kind === "unescape" && spec.sourceFieldKey === sourceFieldKey,
      );
      if (alreadyExists) return;

      const newSpec: DerivedFieldSpec = { kind: "unescape", sourceFieldKey };
      commitDerivedFieldSelections([...profile.display.derivedFieldSelections, newSpec]);
    },

    addJsonKeyDerivedFields: (sourceFieldKey) => {
      const profile = get().activeProfile;
      if (!profile) return;
      const alreadyHasJson = profile.display.derivedFieldSelections.some(
        (spec) => spec.kind === "json-key" && spec.sourceFieldKey === sourceFieldKey,
      );
      if (alreadyHasJson) return;

      // Discover keys from this Field's actual values across the current
      // Dataset (not the wizard's tiny sample — the real, already-parsed
      // Records) so the offered sub-columns match real data.
      const sampleValues = get()
        .records.slice(0, 50)
        .flatMap((record) => record.fields.filter((f) => f.key === sourceFieldKey).map((f) => f.value));
      const keys = discoverJsonKeys(sampleValues);
      if (keys.length === 0) return;

      const newSpecs: DerivedFieldSpec[] = keys.map((jsonKey) => ({ kind: "json-key", sourceFieldKey, jsonKey }));
      commitDerivedFieldSelections([...profile.display.derivedFieldSelections, ...newSpecs]);
    },

    addTimezoneDerivedField: (sourceFieldKey, timezone) => {
      const profile = get().activeProfile;
      if (!profile) return;
      const alreadyExists = profile.display.derivedFieldSelections.some(
        (spec) =>
          spec.kind === "date" &&
          spec.sourceFieldKey === sourceFieldKey &&
          spec.representation === "timezone" &&
          spec.timezone === timezone,
      );
      if (alreadyExists) return;

      const newSpec: DerivedFieldSpec = { kind: "date", sourceFieldKey, representation: "timezone", timezone };
      commitDerivedFieldSelections([...profile.display.derivedFieldSelections, newSpec]);
    },
  };
});

import { create } from "zustand";
import type { Dataset, ParsedRecord } from "@/core/dataset/types";
import { applyDerivedFields } from "@/core/derived-fields/applyDerivedFields";
import { derivedFieldKey } from "@/core/derived-fields/derivedFieldKey";
import { discoverJsonKeys } from "@/core/derived-fields/discoverJsonKeys";
import { isValidTimeZone } from "@/core/derived-fields/isValidTimeZone";
import type { DerivedFieldSpec } from "@/core/derived-fields/types";
import { parseDataset } from "@/core/parsing/parseDataset";
import { listHiddenProfileIds, setHiddenProfileIds } from "@/core/persistence/hiddenProfiles";
import { listProfiles, saveProfile, saveProfiles } from "@/core/persistence/localStorageProfileStore";
import { isBuiltInProfile } from "@/core/profile/builtInProfiles";
import { createProfile } from "@/core/profile/createProfile";
import { currentFieldOrder, moveBefore, naturalFieldOrder, visibleInOrder } from "@/core/profile/fieldOrder";
import { reconcileDisplay } from "@/core/profile/reconcileDisplay";
import { addFieldFilter, pruneFieldFilters, type FieldFilter } from "@/core/filters/fieldFilters";
import { placeJsonColumnsInProfile } from "@/core/json/placeJsonColumns";
import type { ArrayMode, JsonColumns } from "@/core/json/types";
import { hasColumnOption, setArrayMode, setColumnOption } from "@/core/profile/columnOptions";
import type { ColumnOption, DisplayConfig, Profile, SearchState } from "@/core/profile/types";
import { addView, deleteView, reconcileViews, renameView, switchView, syncActiveView } from "@/core/profile/views";
import { computeRangeSelection, type SelectionModifiers } from "@/core/selection/computeRangeSelection";

/** How many leading Records are inspected when discovering JSON keys. */
const JSON_KEY_SAMPLE_SIZE = 50;

interface AppState {
  dataset: Dataset | null;
  /** Field keys parsing produced directly, before any Derived Fields (JSON columns of the parsing rule included). */
  baseFieldNames: string[];
  /** The columns the parsing rule's JSON option produced, by Field key. */
  jsonColumns: JsonColumns;
  /** Nested array tables (array mode "table") that are open, as `${arrayKey}\n${recordIndex}`. Session-only. */
  expandedArrayTables: Set<string>;
  records: ParsedRecord[];
  activeProfile: Profile | null;
  /** Session-only; never persisted to the Profile (see Hidden Record in CONTEXT.md). */
  hiddenRecordIndexes: Set<number>;
  /** The user's remarks on Records, by Record index. Session-only like hidden Records; exported as an extra CSV column. */
  recordComments: Map<number, string>;
  /** Column-equals-value filters added from cells (see FieldFilter). Session-only; they combine with the search and each other. */
  fieldFilters: FieldFilter[];
  /** Whether the table shows its Comment column. Off by default; comments are exported either way. */
  showComments: boolean;
  /** Rows currently selected (via click/ctrl-click/shift-click), candidates for hiding — not the same as hiddenRecordIndexes. */
  selectedRecordIndexes: Set<number>;
  /** The last plain- or ctrl-clicked row index, used as the shift-click range anchor. */
  selectionAnchorIndex: number | null;
  /** Profiles available to pick from, loaded from localStorage. */
  savedProfiles: Profile[];
  /** Ids of Profiles (built-in or user) hidden from the picker's normal view — see Hidden Profile in CONTEXT.md. */
  hiddenProfileIds: Set<string>;
  /** What the Profile wizard is open on: "new" for a fresh Profile, a Profile to edit its parsing, or null when closed. */
  wizardTarget: Profile | "new" | null;
  /**
   * True while the user is picking a replacement for the current Dataset. The current Dataset, its
   * profile and everything on screen are kept untouched until a new one actually loads, so
   * cancelReplacing() gets back exactly where they were.
   */
  replacing: boolean;

  openWizard: (target: Profile | "new") => void;
  closeWizard: () => void;

  /** Loads a new Dataset (replacing any current one) and resets everything session-scoped. `name` is shown in the top bar. */
  loadDataset: (rawText: string, name?: string) => void;
  /** Shows the "open a file" screen without discarding the current Dataset. */
  startReplacing: () => void;
  /** Leaves the "open a file" screen and returns to the current Dataset as it was. */
  cancelReplacing: () => void;
  /**
   * Re-parses the current Dataset with this Profile and makes it active. The Profile's display
   * config is reconciled with the Fields this Dataset actually has (stale keys/specs dropped).
   */
  applyProfile: (profile: Profile) => void;
  /** Persists the Profile, refreshes the picker list, then applies it. */
  saveAndApplyProfile: (profile: Profile) => void;
  /** Upserts every given Profile by id in one go and refreshes the picker list. Doesn't apply any of them. */
  importSavedProfiles: (profiles: Profile[]) => void;
  /**
   * Persists the current live display state (visible columns, order, labels, derived fields, search)
   * onto the active Profile. A built-in has no storage slot of its own, so saving its view forks it
   * into a new user Profile "<name> (copy)" and makes that one active.
   */
  saveCurrentView: () => void;
  /** Shows another of the active Profile's views (a saved column layout). Not persisted until "Save view". */
  switchView: (viewId: string) => void;
  /** Adds a view starting as a copy of the columns on screen, and switches to it. Not persisted until "Save view". */
  addView: (name: string) => void;
  renameView: (viewId: string, name: string) => void;
  /** Removes a view; the last one can't be removed. */
  deleteView: (viewId: string) => void;
  /** Hides a Profile (built-in or user) from the picker's normal view. Persists across reloads. */
  hideProfile: (id: string) => void;
  /** Reverses hideProfile. */
  unhideProfile: (id: string) => void;

  /** Shows or hides a Field. Its place in the column order is kept, so showing it again puts it back where it was. */
  toggleFieldVisibility: (key: string) => void;
  /** Swaps a shown Field with the shown Field before it (hidden Fields in between don't count). */
  moveFieldUp: (key: string) => void;
  /** Swaps a shown Field with the shown Field after it. */
  moveFieldDown: (key: string) => void;
  /** Moves a Field (shown or hidden) to sit just before `beforeKey` in the column order, or to the end when null. Used by drag-and-drop. */
  moveFieldBefore: (key: string, beforeKey: string | null) => void;
  /** Shows every Field, each in its place in the column order. */
  showAllFields: () => void;
  /** Hides every Field (the column order is kept). */
  hideAllFields: () => void;
  /** Puts the column order back to natural: base columns as parsed, then Derived Fields as they were added. */
  resetFieldOrder: () => void;
  renameField: (key: string, label: string) => void;
  /** Turns one display option of a column on or off (second line, color-coding...). Part of the active view. */
  toggleColumnOption: (key: string, option: ColumnOption) => void;
  /** How a root-level JSON array's items are shown (sub-rows, nested table, or joined in one cell). Part of the active view. */
  setArrayMode: (arrayKey: string, mode: ArrayMode) => void;
  /** Opens or closes a record's nested table of an array. */
  toggleArrayTable: (arrayKey: string, recordIndex: number) => void;
  /** Opens or closes the nested tables of an array for all these records at once. */
  setArrayTablesOpen: (arrayKey: string, recordIndexes: number[], open: boolean) => void;
  /**
   * Turns the parsing rule's "may contain JSON" option on or off for a split column and re-parses. Not saved
   * until "Save view", like the rest of the display.
   */
  setJsonParsing: (key: string, on: boolean) => void;
  /** Sets a column's width in px, or puts it back to automatic when null. */
  setColumnWidth: (key: string, width: number | null) => void;
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
  /**
   * Moves the selected Records that are currently visible into hiddenRecordIndexes. Selected Records
   * that a filter has hidden from view are neither hidden nor deselected, so this never acts on rows
   * the user can't see (same rule as selectAllVisible/deselectAllVisible).
   */
  hideSelectedRecords: (visibleIndexesInOrder: number[]) => void;
  /** Sets the comment on a Record; blank text removes it. */
  setRecordComment: (index: number, comment: string) => void;
  setShowComments: (show: boolean) => void;
  /** Adds "column = value" (or, with negate, "column != value") as a filter. The same column and value is never listed twice. */
  addFieldFilter: (key: string, value: string, negate: boolean) => void;
  removeFieldFilter: (id: string) => void;
  /** Turns "filter for" into "filter out" and back. */
  toggleFieldFilterNegation: (id: string) => void;
  /** Keeps a filter listed but stops it filtering, or starts it again. */
  toggleFieldFilterDisabled: (id: string) => void;
  clearFieldFilters: () => void;
  /** Clears hiddenRecordIndexes, making every Record visible again. */
  unhideAllRecords: () => void;
  /** Deselects every Record. */
  clearSelection: () => void;

  /** Adds the default ISO/local-time pair for a Field. Specs it already has are skipped. */
  addDefaultDateDerivedFields: (sourceFieldKey: string) => void;
  /** Adds the date and the time of a Field as two separate columns (UTC), e.g. to filter on the day. Specs it already has are skipped. */
  addDateTimeSplitDerivedFields: (sourceFieldKey: string) => void;
  /** Adds one more timezone-specific Derived Field for a Field — additive, never replaces. No-op for an unknown timezone. */
  addTimezoneDerivedField: (sourceFieldKey: string, timezone: string) => void;
  /** Adds an unescaped Derived Field for a Field. Skipped if it already has one. */
  addUnescapeDerivedField: (sourceFieldKey: string) => void;
  /** Discovers JSON keys from the Field's current values and adds one Derived Field per key. No-op if nothing in the sample parses as a JSON object. */
  addJsonKeyDerivedFields: (sourceFieldKey: string) => void;
}

export const useAppStore = create<AppState>((set, get) => {
  /** Applies a change to the active Profile's display config (no-op without an active Profile). */
  function updateDisplay(update: (display: DisplayConfig) => DisplayConfig) {
    const profile = get().activeProfile;
    if (!profile) return;
    set({ activeProfile: syncActiveView({ ...profile, display: update(profile.display) }) });
  }

  /**
   * Adds Derived Field specs, skipping any whose key is already taken — by an existing Derived Field
   * or by a base column (e.g. a JSON key "a.b" colliding with a column literally named "a.b") — then
   * re-derives over the base Records and shows the new columns. No-op if nothing is new.
   */
  function addDerivedFields(specs: DerivedFieldSpec[]) {
    const { activeProfile, baseFieldNames, records } = get();
    if (!activeProfile) return;

    const takenKeys = new Set([...baseFieldNames, ...activeProfile.display.derivedFieldSelections.map(derivedFieldKey)]);
    const newSpecs: DerivedFieldSpec[] = [];
    for (const spec of specs) {
      const key = derivedFieldKey(spec);
      if (takenKeys.has(key)) continue;
      takenKeys.add(key);
      newSpecs.push(spec);
    }
    if (newSpecs.length === 0) return;

    const derivedFieldSelections = [...activeProfile.display.derivedFieldSelections, ...newSpecs];
    const newKeys = newSpecs.map(derivedFieldKey);
    const fieldOrder = currentFieldOrder(activeProfile.display, baseFieldNames).slice();
    const shown = new Set([...activeProfile.display.visibleFieldKeys, ...newKeys]);

    // Each new Derived Field goes right after its source column (and after the Derived Fields it
    // already has there), shown. The source is hidden the first time it gets one: usually only the
    // parsed data is wanted, not the raw value. It can be shown again from the Columns popover, and
    // later derivations from it leave it as the user set it.
    const hadChildren = new Set(activeProfile.display.derivedFieldSelections.map((spec) => spec.sourceFieldKey));
    for (const spec of newSpecs) {
      const parent = spec.sourceFieldKey;
      const family = new Set([parent, ...derivedFieldSelections.filter((s) => s.sourceFieldKey === parent).map(derivedFieldKey)]);
      const anchor = Math.max(...fieldOrder.map((key, i) => (family.has(key) ? i : -1)));
      fieldOrder.splice(anchor === -1 ? fieldOrder.length : anchor + 1, 0, derivedFieldKey(spec));
      if (!hadChildren.has(parent)) {
        shown.delete(parent);
        hadChildren.add(parent);
      }
    }

    set({
      records: applyDerivedFields(records, derivedFieldSelections),
      activeProfile: syncActiveView({
        ...activeProfile,
        display: {
          ...activeProfile.display,
          derivedFieldSelections,
          fieldOrder,
          visibleFieldKeys: visibleInOrder(fieldOrder, shown),
        },
      }),
    });
  }

  return {
    dataset: null,
    baseFieldNames: [],
    jsonColumns: {},
    expandedArrayTables: new Set(),
    records: [],
    activeProfile: null,
    hiddenRecordIndexes: new Set(),
    recordComments: new Map(),
    fieldFilters: [],
    showComments: false,
    selectedRecordIndexes: new Set(),
    selectionAnchorIndex: null,
    savedProfiles: [],
    hiddenProfileIds: new Set(),
    wizardTarget: null,
    replacing: false,

    openWizard: (target) => set({ wizardTarget: target }),
    closeWizard: () => set({ wizardTarget: null }),
    startReplacing: () => set({ replacing: true, wizardTarget: null }),
    cancelReplacing: () => set({ replacing: false }),

    loadDataset: (rawText, name) => {
      set({
        replacing: false,
        wizardTarget: null,
        dataset: { rawText, name },
        activeProfile: null,
        baseFieldNames: [],
        jsonColumns: {},
        expandedArrayTables: new Set(),
        records: [],
        hiddenRecordIndexes: new Set(),
        recordComments: new Map(),
        fieldFilters: [],
        showComments: false,
        selectedRecordIndexes: new Set(),
        selectionAnchorIndex: null,
        savedProfiles: listProfiles(),
        hiddenProfileIds: new Set(listHiddenProfileIds()),
      });
    },

    applyProfile: (profile) => {
      const dataset = get().dataset;
      if (!dataset) return;
      const {
        fieldNames: baseFieldNames,
        records: baseRecords,
        jsonColumns = {},
      } = parseDataset(dataset.rawText, profile.parsing);

      // JSON columns the Profile has never seen go next to their source, shown (reconciling alone would
      // add them at the end, hidden).
      const placed = placeJsonColumnsInProfile(profile, baseFieldNames, jsonColumns);

      // A Profile may have been saved against other Fields (or carry stale Derived Field specs, or be a
      // built-in template with nothing visible yet), so its display is reconciled with what this
      // Dataset really parsed to before anything is derived or rendered.
      const display = reconcileDisplay(placed.display, baseFieldNames);
      const parsedIndexes = new Set(baseRecords.map((record) => record.index));

      set({
        activeProfile: reconcileViews({ ...placed, display }, baseFieldNames),
        baseFieldNames,
        jsonColumns,
        expandedArrayTables: new Set(),
        records: applyDerivedFields(baseRecords, display.derivedFieldSelections),
        // Comments survive a profile switch (same Dataset); only those on Records the new parse lacks go.
        recordComments: new Map([...get().recordComments].filter(([index]) => parsedIndexes.has(index))),
        // Filters survive a profile switch on the same Dataset, except those on columns the new parse and display lack.
        fieldFilters: pruneFieldFilters(get().fieldFilters, new Set(display.fieldOrder ?? baseFieldNames)),
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

      const toSave: Profile = isBuiltInProfile(profile)
        ? { ...createProfile({ name: `${profile.name} (copy)`, parsing: profile.parsing, display: profile.display }), views: profile.views, activeViewId: profile.activeViewId }
        : { ...profile, updatedAt: new Date().toISOString() };

      saveProfile(toSave);
      set({ activeProfile: toSave, savedProfiles: listProfiles() });
    },

    switchView: (viewId) => {
      const profile = get().activeProfile;
      if (profile) set({ activeProfile: switchView(profile, viewId, get().baseFieldNames) });
    },

    addView: (name) => {
      const profile = get().activeProfile;
      if (profile) set({ activeProfile: addView(profile, crypto.randomUUID(), name, get().baseFieldNames) });
    },

    renameView: (viewId, name) => {
      const profile = get().activeProfile;
      if (profile) set({ activeProfile: renameView(profile, viewId, name) });
    },

    deleteView: (viewId) => {
      const profile = get().activeProfile;
      if (profile) set({ activeProfile: deleteView(profile, viewId, get().baseFieldNames) });
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

    toggleFieldVisibility: (key) => {
      updateDisplay((display) => {
        const fieldOrder = currentFieldOrder(display, get().baseFieldNames);
        const shown = new Set(display.visibleFieldKeys);
        if (!shown.delete(key)) shown.add(key);
        return { ...display, fieldOrder, visibleFieldKeys: visibleInOrder(fieldOrder, shown) };
      });
    },

    moveFieldUp: (key) => {
      updateDisplay((display) => {
        const i = display.visibleFieldKeys.indexOf(key);
        if (i <= 0) return display;
        const fieldOrder = moveBefore(currentFieldOrder(display, get().baseFieldNames), key, display.visibleFieldKeys[i - 1]);
        return { ...display, fieldOrder, visibleFieldKeys: visibleInOrder(fieldOrder, new Set(display.visibleFieldKeys)) };
      });
    },

    moveFieldDown: (key) => {
      updateDisplay((display) => {
        const i = display.visibleFieldKeys.indexOf(key);
        if (i === -1 || i >= display.visibleFieldKeys.length - 1) return display;
        // Moving down is the next shown column moving up past this one.
        const fieldOrder = moveBefore(currentFieldOrder(display, get().baseFieldNames), display.visibleFieldKeys[i + 1], key);
        return { ...display, fieldOrder, visibleFieldKeys: visibleInOrder(fieldOrder, new Set(display.visibleFieldKeys)) };
      });
    },

    moveFieldBefore: (key, beforeKey) => {
      updateDisplay((display) => {
        const fieldOrder = moveBefore(currentFieldOrder(display, get().baseFieldNames), key, beforeKey);
        return { ...display, fieldOrder, visibleFieldKeys: visibleInOrder(fieldOrder, new Set(display.visibleFieldKeys)) };
      });
    },

    showAllFields: () => {
      updateDisplay((display) => {
        const fieldOrder = currentFieldOrder(display, get().baseFieldNames);
        return { ...display, fieldOrder, visibleFieldKeys: [...fieldOrder] };
      });
    },

    hideAllFields: () => {
      updateDisplay((display) => ({
        ...display,
        fieldOrder: currentFieldOrder(display, get().baseFieldNames),
        visibleFieldKeys: [],
      }));
    },

    resetFieldOrder: () => {
      updateDisplay((display) => {
        const fieldOrder = naturalFieldOrder(get().baseFieldNames, display);
        return { ...display, fieldOrder, visibleFieldKeys: visibleInOrder(fieldOrder, new Set(display.visibleFieldKeys)) };
      });
    },

    renameField: (key, label) => {
      updateDisplay((display) => ({ ...display, fieldLabels: { ...display.fieldLabels, [key]: label } }));
    },

    toggleColumnOption: (key, option) => {
      updateDisplay((display) => {
        const on = !hasColumnOption(display.columnOptions, key, option);
        return { ...display, columnOptions: setColumnOption(display.columnOptions, key, option, on) };
      });
    },

    setArrayMode: (arrayKey, mode) => {
      updateDisplay((display) => ({ ...display, columnOptions: setArrayMode(display.columnOptions, arrayKey, mode) }));
    },

    toggleArrayTable: (arrayKey, recordIndex) => {
      const next = new Set(get().expandedArrayTables);
      const id = `${arrayKey}\n${recordIndex}`;
      if (!next.delete(id)) next.add(id);
      set({ expandedArrayTables: next });
    },

    setArrayTablesOpen: (arrayKey, recordIndexes, open) => {
      const next = new Set(get().expandedArrayTables);
      for (const index of recordIndexes) {
        if (open) next.add(`${arrayKey}\n${index}`);
        else next.delete(`${arrayKey}\n${index}`);
      }
      set({ expandedArrayTables: next });
    },

    setJsonParsing: (key, on) => {
      const profile = get().activeProfile;
      if (!profile) return;
      const current = profile.parsing.jsonFieldKeys ?? [];
      if (current.includes(key) === on) return;

      const jsonFieldKeys = on ? [...current, key] : current.filter((k) => k !== key);
      const parsing = { ...profile.parsing };
      delete parsing.jsonFieldKeys;
      // Turning it off removes the JSON columns: the source column comes back into view in their place.
      const display = on
        ? profile.display
        : { ...profile.display, visibleFieldKeys: [...new Set([...profile.display.visibleFieldKeys, key])] };

      get().applyProfile(
        syncActiveView({
          ...profile,
          parsing: jsonFieldKeys.length > 0 ? { ...parsing, jsonFieldKeys } : parsing,
          display,
        }),
      );
    },

    setColumnWidth: (key, width) => {
      updateDisplay((display) => {
        const columnWidths = { ...display.columnWidths };
        if (width === null) delete columnWidths[key];
        else columnWidths[key] = Math.round(width);
        return { ...display, columnWidths };
      });
    },

    setSearchState: (search) => {
      updateDisplay((display) => ({ ...display, searchState: search }));
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

    hideSelectedRecords: (visibleIndexesInOrder) => {
      const { hiddenRecordIndexes, selectedRecordIndexes } = get();
      const hidden = new Set(hiddenRecordIndexes);
      const stillSelected = new Set(selectedRecordIndexes);
      for (const index of visibleIndexesInOrder) {
        if (!selectedRecordIndexes.has(index)) continue;
        hidden.add(index);
        stillSelected.delete(index);
      }
      set({ hiddenRecordIndexes: hidden, selectedRecordIndexes: stillSelected, selectionAnchorIndex: null });
    },

    setRecordComment: (index, comment) => {
      const next = new Map(get().recordComments);
      if (comment.trim() === "") next.delete(index);
      else next.set(index, comment.trim());
      set({ recordComments: next });
    },

    setShowComments: (show) => set({ showComments: show }),

    addFieldFilter: (key, value, negate) => {
      set({ fieldFilters: addFieldFilter(get().fieldFilters, crypto.randomUUID(), key, value, negate) });
    },

    removeFieldFilter: (id) => {
      set({ fieldFilters: get().fieldFilters.filter((filter) => filter.id !== id) });
    },

    toggleFieldFilterNegation: (id) => {
      set({ fieldFilters: get().fieldFilters.map((f) => (f.id === id ? { ...f, negate: !f.negate } : f)) });
    },

    toggleFieldFilterDisabled: (id) => {
      set({ fieldFilters: get().fieldFilters.map((f) => (f.id === id ? { ...f, disabled: !f.disabled } : f)) });
    },

    clearFieldFilters: () => set({ fieldFilters: [] }),

    unhideAllRecords: () => {
      set({ hiddenRecordIndexes: new Set() });
    },

    clearSelection: () => {
      set({ selectedRecordIndexes: new Set(), selectionAnchorIndex: null });
    },

    addDefaultDateDerivedFields: (sourceFieldKey) => {
      addDerivedFields([
        { kind: "date", sourceFieldKey, representation: "iso" },
        { kind: "date", sourceFieldKey, representation: "timezone" },
      ]);
    },

    addDateTimeSplitDerivedFields: (sourceFieldKey) => {
      addDerivedFields([
        { kind: "date", sourceFieldKey, representation: "utc-date" },
        { kind: "date", sourceFieldKey, representation: "utc-time" },
      ]);
    },

    addUnescapeDerivedField: (sourceFieldKey) => {
      addDerivedFields([{ kind: "unescape", sourceFieldKey }]);
    },

    addJsonKeyDerivedFields: (sourceFieldKey) => {
      // Discover keys from this Field's actual values across the current
      // Dataset (not the wizard's tiny sample — the real, already-parsed
      // Records) so the offered sub-columns match real data.
      const sampleValues = get()
        .records.slice(0, JSON_KEY_SAMPLE_SIZE)
        .flatMap((record) => record.fields.filter((f) => f.key === sourceFieldKey).map((f) => f.value));

      addDerivedFields(
        discoverJsonKeys(sampleValues).map((jsonKey): DerivedFieldSpec => ({ kind: "json-key", sourceFieldKey, jsonKey })),
      );
    },

    addTimezoneDerivedField: (sourceFieldKey, timezone) => {
      if (!isValidTimeZone(timezone)) return;
      addDerivedFields([{ kind: "date", sourceFieldKey, representation: "timezone", timezone }]);
    },
  };
});

// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { BUILT_IN_PROFILES } from "@/core/profile/builtInProfiles";
import { createDefaultDisplayConfig, createProfile } from "@/core/profile/createProfile";
import type { DelimiterParsingConfig } from "@/core/parsing/types";
import type { Profile } from "@/core/profile/types";
import { listProfiles } from "@/core/persistence/localStorageProfileStore";
import { useAppStore } from "@/state/useAppStore";

const initialState = useAppStore.getState();

const PIPE: DelimiterParsingConfig = {
  kind: "delimiter",
  delimiter: "|",
  hasHeaderRow: true,
  stripQuotes: true,
  trimBoundaryPartials: false,
  expectedFieldCount: 3,
};

const RAW = [
  "id | payload | when",
  '1 | {"user":"alice","n":1} | 1768480200',
  '2 | {"user":"bob","n":2} | 1768480256',
  '3 | {"user":"carol","n":3} | 1768480318',
].join("\n");

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    ...createProfile({ name: "p", parsing: PIPE, display: createDefaultDisplayConfig(["id", "payload", "when"]) }),
    ...overrides,
  };
}

function load(raw = RAW, profile = makeProfile()) {
  const store = useAppStore.getState();
  store.loadDataset(raw);
  store.applyProfile(profile);
  return profile;
}

const state = () => useAppStore.getState();
const derivedKeys = () => state().activeProfile!.display.derivedFieldSelections.map((s) => JSON.stringify(s));

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState(initialState, true);
});

describe("applyProfile", () => {
  it("parses the Dataset and shows every column of a fresh Profile", () => {
    load();
    expect(state().baseFieldNames).toEqual(["id", "payload", "when"]);
    expect(state().records).toHaveLength(3);
    expect(state().activeProfile!.display.visibleFieldKeys).toEqual(["id", "payload", "when"]);
  });

  it("shows everything for a template with no visible keys yet (built-in)", () => {
    load(RAW, makeProfile({ display: { visibleFieldKeys: [], fieldLabels: {}, derivedFieldSelections: [] } }));
    expect(state().activeProfile!.display.visibleFieldKeys).toEqual(["id", "payload", "when"]);
  });

  it("drops a Derived Field spec of an unsupported kind instead of crashing derivation", () => {
    const profile = makeProfile();
    profile.display.derivedFieldSelections = [
      { kind: "trim", sourceFieldKey: "id" } as never,
      { kind: "unescape", sourceFieldKey: "payload" },
    ];
    profile.display.visibleFieldKeys = ["id", "payload", "when", "id (trimmed)", "payload (unescaped)"];
    load(RAW, profile);

    expect(derivedKeys()).toEqual([JSON.stringify({ kind: "unescape", sourceFieldKey: "payload" })]);
    expect(state().activeProfile!.display.visibleFieldKeys).toEqual(["id", "payload", "when", "payload (unescaped)"]);
    for (const record of state().records) {
      expect(record.fields.every((field) => field !== undefined && typeof field.key === "string")).toBe(true);
    }
  });

  it("drops specs and visible keys for columns the Dataset doesn't have (Profile from another Dataset)", () => {
    const profile = makeProfile();
    profile.display.derivedFieldSelections = [{ kind: "unescape", sourceFieldKey: "gone" }];
    profile.display.visibleFieldKeys = ["ghost", "id", "gone (unescaped)"];
    load(RAW, profile);

    expect(state().activeProfile!.display.derivedFieldSelections).toEqual([]);
    expect(state().activeProfile!.display.visibleFieldKeys).toEqual(["id"]);
    expect(state().records[0].fields.map((f) => f.key)).toEqual(["id", "payload", "when"]);
  });

  it("clears hidden and selected rows", () => {
    load();
    state().selectRecord(0, { ctrlOrMeta: false, shift: false }, [0, 1, 2]);
    state().hideSelectedRecords([0, 1, 2]);
    expect(state().hiddenRecordIndexes.size).toBe(1);

    state().applyProfile(makeProfile());
    expect(state().hiddenRecordIndexes.size).toBe(0);
    expect(state().selectedRecordIndexes.size).toBe(0);
  });
});

describe("saveCurrentView", () => {
  it("overwrites a user Profile in place", () => {
    const profile = load();
    state().renameField("id", "Identifier");
    state().saveCurrentView();

    expect(listProfiles()).toHaveLength(1);
    expect(listProfiles()[0].id).toBe(profile.id);
    expect(listProfiles()[0].display.fieldLabels).toEqual({ id: "Identifier" });
  });

  it("forks a built-in into a new user Profile instead of storing it under the built-in id", () => {
    const builtIn = BUILT_IN_PROFILES.find((p) => p.id === "builtin:csv-with-header")!;
    state().loadDataset("id,name,role,active\n1,a,x,true\n2,b,y,false");
    state().applyProfile(builtIn);
    state().toggleFieldVisibility("role");
    state().saveCurrentView();

    const saved = listProfiles();
    expect(saved).toHaveLength(1);
    expect(saved[0].id).not.toBe(builtIn.id);
    expect(saved[0].id.startsWith("builtin:")).toBe(false);
    expect(saved[0].name).toBe(`${builtIn.name} (copy)`);
    expect(saved[0].display.visibleFieldKeys).not.toContain("role");

    expect(state().activeProfile!.id).toBe(saved[0].id);
    expect(state().savedProfiles).toEqual(saved);
  });
});

describe("hideSelectedRecords", () => {
  beforeEach(() => {
    load();
  });

  it("hides the selected rows and clears them from the selection", () => {
    state().selectAllVisible([0, 1, 2]);
    state().hideSelectedRecords([0, 1, 2]);
    expect([...state().hiddenRecordIndexes]).toEqual([0, 1, 2]);
    expect(state().selectedRecordIndexes.size).toBe(0);
  });

  it("only hides selected rows that are currently visible (a filter may be hiding the others)", () => {
    state().selectAllVisible([0, 1, 2]); // selected earlier...
    state().hideSelectedRecords([2]); // ...but a filter now only shows row 2

    expect([...state().hiddenRecordIndexes]).toEqual([2]);
    // The selected-but-filtered rows stay selected, untouched.
    expect([...state().selectedRecordIndexes].sort()).toEqual([0, 1]);
  });

  it("does nothing when no visible row is selected", () => {
    state().selectAllVisible([0, 1]);
    state().hideSelectedRecords([2]);
    expect(state().hiddenRecordIndexes.size).toBe(0);
    expect(state().selectedRecordIndexes.size).toBe(2);
  });
});

describe("Derived Field actions", () => {
  beforeEach(() => {
    load();
  });

  it("adds the ISO and local-time pair and shows both columns", () => {
    state().addDefaultDateDerivedFields("when");
    const display = state().activeProfile!.display;
    expect(display.visibleFieldKeys).toEqual(["id", "payload", "when", "when (ISO)", "when (local time)"]);
    expect(state().records[0].fields.map((f) => f.key)).toEqual([
      "id",
      "payload",
      "when",
      "when (ISO)",
      "when (local time)",
    ]);
    expect(state().records[0].fields.find((f) => f.key === "when (ISO)")!.value).toBe("2026-01-15T12:30:00.000Z");
  });

  it("is idempotent: asking twice doesn't duplicate columns", () => {
    state().addDefaultDateDerivedFields("when");
    state().addDefaultDateDerivedFields("when");
    state().addUnescapeDerivedField("payload");
    state().addUnescapeDerivedField("payload");
    expect(state().activeProfile!.display.derivedFieldSelections).toHaveLength(3);
    expect(state().records[0].fields).toHaveLength(6);
  });

  it("adds one json-key spec per discovered key", () => {
    state().addJsonKeyDerivedFields("payload");
    expect(state().activeProfile!.display.visibleFieldKeys).toEqual(["id", "payload", "when", "payload.user", "payload.n"]);
    expect(state().records[1].fields.find((f) => f.key === "payload.user")!.value).toBe("bob");
  });

  it("does nothing for a column with no JSON in it", () => {
    state().addJsonKeyDerivedFields("id");
    expect(state().activeProfile!.display.derivedFieldSelections).toEqual([]);
  });

  it("adds extra timezones additively", () => {
    state().addDefaultDateDerivedFields("when");
    state().addTimezoneDerivedField("when", "Europe/Paris");
    expect(state().activeProfile!.display.visibleFieldKeys).toContain("when (Europe/Paris)");
    expect(state().records[0].fields.find((f) => f.key === "when (Europe/Paris)")!.parseError).toBeUndefined();
  });

  it("ignores an unknown timezone instead of persisting a spec that fails on every row", () => {
    state().addDefaultDateDerivedFields("when");
    state().addTimezoneDerivedField("when", "Paris");
    expect(state().activeProfile!.display.derivedFieldSelections).toHaveLength(2);
    expect(state().records[0].fields.map((f) => f.key)).not.toContain("when (Paris)");
  });

  it("skips a Derived Field whose key collides with a base column", () => {
    load("payload.user | payload\n1 | {\"user\":\"x\"}");
    state().addJsonKeyDerivedFields("payload");
    expect(state().activeProfile!.display.derivedFieldSelections).toEqual([]);
    expect(state().baseFieldNames).toEqual(["payload.user", "payload"]);
  });
});

describe("display mutators", () => {
  beforeEach(() => {
    load();
  });

  it("toggles, reorders and renames without touching parsed Records", () => {
    const before = state().records;

    state().toggleFieldVisibility("payload");
    expect(state().activeProfile!.display.visibleFieldKeys).toEqual(["id", "when"]);
    state().toggleFieldVisibility("payload");
    expect(state().activeProfile!.display.visibleFieldKeys).toEqual(["id", "payload", "when"]);

    state().moveFieldUp("when");
    expect(state().activeProfile!.display.visibleFieldKeys).toEqual(["id", "when", "payload"]);
    state().moveFieldDown("id");
    expect(state().activeProfile!.display.visibleFieldKeys).toEqual(["when", "id", "payload"]);
    state().moveFieldUp("when"); // already first: no-op
    expect(state().activeProfile!.display.visibleFieldKeys).toEqual(["when", "id", "payload"]);

    state().renameField("id", "Identifier");
    expect(state().activeProfile!.display.fieldLabels).toEqual({ id: "Identifier" });

    state().setSearchState({ term: "bob", mode: "filter" });
    expect(state().activeProfile!.display.searchState).toEqual({ term: "bob", mode: "filter" });

    expect(state().records).toBe(before);
  });

  it("does nothing without an active Profile", () => {
    useAppStore.setState({ activeProfile: null });
    state().toggleFieldVisibility("id");
    state().renameField("id", "x");
    expect(state().activeProfile).toBeNull();
  });
});

describe("column order and visibility (columns popover)", () => {
  const visible = () => state().activeProfile!.display.visibleFieldKeys;
  const order = () => state().activeProfile!.display.fieldOrder;

  beforeEach(() => {
    load();
  });

  it("a hidden column keeps its place and comes back where it was", () => {
    state().toggleFieldVisibility("payload");
    expect(visible()).toEqual(["id", "when"]);
    expect(order()).toEqual(["id", "payload", "when"]);

    state().toggleFieldVisibility("payload");
    expect(visible()).toEqual(["id", "payload", "when"]);
  });

  it("a hidden first or last column also comes back in place", () => {
    state().toggleFieldVisibility("id");
    state().toggleFieldVisibility("when");
    expect(visible()).toEqual(["payload"]);

    state().toggleFieldVisibility("when");
    state().toggleFieldVisibility("id");
    expect(visible()).toEqual(["id", "payload", "when"]);
  });

  it("moves a column before another, or to the end, shown or hidden", () => {
    state().moveFieldBefore("when", "id");
    expect(visible()).toEqual(["when", "id", "payload"]);

    state().moveFieldBefore("when", null);
    expect(visible()).toEqual(["id", "payload", "when"]);

    state().toggleFieldVisibility("payload");
    state().moveFieldBefore("payload", "id"); // moving a hidden column changes where it will reappear
    expect(visible()).toEqual(["id", "when"]);
    state().toggleFieldVisibility("payload");
    expect(visible()).toEqual(["payload", "id", "when"]);
  });

  it("ignores moves onto itself, or involving a key that isn't a column", () => {
    state().moveFieldBefore("id", "id");
    state().moveFieldBefore("id", "ghost");
    state().moveFieldBefore("ghost", "id");
    expect(order()).toEqual(["id", "payload", "when"]);
  });

  it("move left/right swaps with the neighbouring shown column, skipping hidden ones", () => {
    state().toggleFieldVisibility("payload");
    state().moveFieldDown("id"); // neighbour is "when", the hidden "payload" in between doesn't count
    expect(visible()).toEqual(["when", "id"]);

    state().moveFieldUp("id");
    expect(visible()).toEqual(["id", "when"]);

    state().moveFieldUp("id"); // already first
    state().moveFieldDown("when"); // already last
    expect(visible()).toEqual(["id", "when"]);
  });

  it("new Derived Fields go at the end of the order and are shown", () => {
    state().toggleFieldVisibility("payload");
    state().addDefaultDateDerivedFields("when");
    expect(order()).toEqual(["id", "payload", "when", "when (ISO)", "when (local time)"]);
    expect(visible()).toEqual(["id", "when", "when (ISO)", "when (local time)"]);
  });

  it("Show all shows every column, each in its place", () => {
    state().addDefaultDateDerivedFields("when");
    state().toggleFieldVisibility("id");
    state().toggleFieldVisibility("when (ISO)");
    state().moveFieldBefore("when", "payload");
    expect(visible()).toEqual(["when", "payload", "when (local time)"]);

    state().showAllFields();
    expect(visible()).toEqual(["id", "when", "payload", "when (ISO)", "when (local time)"]);
  });

  it("Hide all empties the visible list but keeps the order, without touching parsed Records", () => {
    state().moveFieldBefore("when", "id");
    const before = state().records;
    state().hideAllFields();
    expect(visible()).toEqual([]);
    expect(order()).toEqual(["when", "id", "payload"]);
    expect(state().records).toBe(before);

    state().showAllFields();
    expect(visible()).toEqual(["when", "id", "payload"]);
  });

  it("Reset order puts the columns back in natural order: base first, then derived as added", () => {
    state().addDefaultDateDerivedFields("when");
    state().addUnescapeDerivedField("payload");
    state().toggleFieldVisibility("id");
    state().moveFieldBefore("when (local time)", "payload");
    state().moveFieldBefore("payload (unescaped)", "payload");

    state().resetFieldOrder();
    expect(order()).toEqual(["id", "payload", "when", "when (ISO)", "when (local time)", "payload (unescaped)"]);
    expect(visible()).toEqual(["payload", "when", "when (ISO)", "when (local time)", "payload (unescaped)"]);
  });

  it("a Profile saved before the order existed gets one when applied: shown columns first, then the rest", () => {
    const legacy = makeProfile();
    delete legacy.display.fieldOrder;
    legacy.display.visibleFieldKeys = ["when", "id"];
    load(RAW, legacy);

    expect(order()).toEqual(["when", "id", "payload"]);
    expect(visible()).toEqual(["when", "id"]);
    state().toggleFieldVisibility("payload");
    expect(visible()).toEqual(["when", "id", "payload"]);
  });
});

describe("dataset lifecycle and the wizard", () => {
  it("remembers where a dataset came from", () => {
    state().loadDataset(RAW, "events.log");
    expect(state().dataset).toEqual({ rawText: RAW, name: "events.log" });
  });

  it("replacing keeps everything on screen until a new dataset really loads", () => {
    const profile = load();
    state().addDefaultDateDerivedFields("when");
    state().selectAllVisible([0, 1]);
    const before = {
      dataset: state().dataset,
      records: state().records,
      activeProfile: state().activeProfile,
      selected: state().selectedRecordIndexes,
    };

    state().startReplacing();
    expect(state().replacing).toBe(true);
    expect(state().dataset).toBe(before.dataset);
    expect(state().records).toBe(before.records);
    expect(state().activeProfile).toBe(before.activeProfile);

    state().cancelReplacing();
    expect(state().replacing).toBe(false);
    expect(state().dataset).toBe(before.dataset);
    expect(state().records).toBe(before.records);
    expect(state().activeProfile).toBe(before.activeProfile);
    expect(state().selectedRecordIndexes).toBe(before.selected);
    expect(state().activeProfile!.id).toBe(profile.id);
  });

  it("loading a dataset while replacing swaps it in and leaves the replacing state", () => {
    load();
    state().startReplacing();
    state().loadDataset("a|b\n1|2", "other.log");

    expect(state().replacing).toBe(false);
    expect(state().dataset).toEqual({ rawText: "a|b\n1|2", name: "other.log" });
    expect(state().activeProfile).toBeNull();
    expect(state().records).toEqual([]);
    expect(state().wizardTarget).toBeNull();
  });

  it("starting to replace closes an open wizard", () => {
    load();
    state().openWizard("new");
    state().startReplacing();
    expect(state().wizardTarget).toBeNull();
  });

  it("opens and closes the wizard on a new or an existing profile", () => {
    const profile = load();
    state().openWizard("new");
    expect(state().wizardTarget).toBe("new");
    state().openWizard(profile);
    expect(state().wizardTarget).toBe(profile);
    state().closeWizard();
    expect(state().wizardTarget).toBeNull();
  });

  it("clearSelection deselects every row but keeps hidden rows hidden", () => {
    load();
    state().selectAllVisible([0, 1, 2]);
    state().hideSelectedRecords([0]);
    state().clearSelection();

    expect(state().selectedRecordIndexes.size).toBe(0);
    expect([...state().hiddenRecordIndexes]).toEqual([0]);
  });
});

describe("views", () => {
  const shown = () => state().activeProfile!.display.visibleFieldKeys;

  beforeEach(() => {
    load();
  });

  it("gives a Profile without views a Default view mirroring its columns", () => {
    const { views, activeViewId } = state().activeProfile!;
    expect(views).toHaveLength(1);
    expect(views![0]).toMatchObject({ name: "Default", visibleFieldKeys: ["id", "payload", "when"] });
    expect(activeViewId).toBe(views![0].id);
  });

  it("keeps each view's columns apart while labels stay shared", () => {
    state().toggleFieldVisibility("when"); // Default now: id, payload
    state().addView("Ids only"); // starts as a copy of what's on screen
    state().hideAllFields();
    state().toggleFieldVisibility("id");
    state().renameField("id", "Identifier");
    expect(shown()).toEqual(["id"]);

    const [first, second] = state().activeProfile!.views!;
    state().switchView(first.id);
    expect(shown()).toEqual(["id", "payload"]);
    expect(state().activeProfile!.display.fieldLabels).toEqual({ id: "Identifier" });

    state().switchView(second.id);
    expect(shown()).toEqual(["id"]);
  });

  it("a Derived Field added in one view is hidden in the others", () => {
    state().addView("Other");
    state().addUnescapeDerivedField("payload");
    expect(shown()).toContain("payload (unescaped)");

    state().switchView(state().activeProfile!.views![0].id);
    expect(shown()).not.toContain("payload (unescaped)");
    expect(state().activeProfile!.display.fieldOrder).toContain("payload (unescaped)");
  });

  it("renames and deletes views, but keeps the last one", () => {
    state().addView("Second");
    const [first, second] = state().activeProfile!.views!;
    state().renameView(second.id, "Renamed");
    expect(state().activeProfile!.views![1].name).toBe("Renamed");

    state().deleteView(second.id); // the active one: falls back to the first
    expect(state().activeProfile!.activeViewId).toBe(first.id);
    expect(state().activeProfile!.views).toHaveLength(1);

    state().deleteView(first.id);
    expect(state().activeProfile!.views).toHaveLength(1);
  });

  it("saves every view and reopens on the active one after a reload", () => {
    state().addView("Short");
    state().hideAllFields();
    state().toggleFieldVisibility("when");
    state().saveCurrentView();

    const saved = listProfiles()[0];
    expect(saved.views!.map((v) => v.name)).toEqual(["Default", "Short"]);

    state().loadDataset(RAW);
    state().applyProfile(saved);
    expect(state().activeProfile!.views![1].name).toBe("Short");
    expect(shown()).toEqual(["when"]);
    state().switchView(saved.views![0].id);
    expect(shown()).toEqual(["id", "payload", "when"]);
  });
});

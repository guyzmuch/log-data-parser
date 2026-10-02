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
    expect(state().activeProfile!.display.visibleFieldKeys).toEqual(["id", "when", "payload"]);

    state().moveFieldUp("payload");
    expect(state().activeProfile!.display.visibleFieldKeys).toEqual(["id", "payload", "when"]);
    state().moveFieldDown("id");
    expect(state().activeProfile!.display.visibleFieldKeys).toEqual(["payload", "id", "when"]);
    state().moveFieldUp("payload"); // already first: no-op
    expect(state().activeProfile!.display.visibleFieldKeys).toEqual(["payload", "id", "when"]);

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

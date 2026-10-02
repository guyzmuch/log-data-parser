import { describe, expect, it } from "vitest";
import { normalizeProfile } from "@/core/profile/validateProfile";
import { createDefaultDisplayConfig, createProfile } from "@/core/profile/createProfile";
import type { DelimiterParsingConfig } from "@/core/parsing/types";

function validProfile() {
  const parsing: DelimiterParsingConfig = {
    kind: "delimiter",
    delimiter: ",",
    hasHeaderRow: false,
    stripQuotes: false,
    trimBoundaryPartials: false,
    expectedFieldCount: 2,
  };
  return createProfile({ name: "test", parsing, display: createDefaultDisplayConfig(["a", "b"]) });
}

describe("normalizeProfile", () => {
  it("accepts a genuine Profile unchanged", () => {
    const profile = validProfile();
    expect(normalizeProfile(profile)).toEqual(profile);
  });

  it("keeps valid Derived Field specs, labels and search state", () => {
    const profile = validProfile();
    profile.display.derivedFieldSelections = [
      { kind: "date", sourceFieldKey: "a", representation: "iso" },
      { kind: "date", sourceFieldKey: "a", representation: "timezone", timezone: "Europe/Paris" },
      { kind: "unescape", sourceFieldKey: "b" },
      { kind: "json-key", sourceFieldKey: "b", jsonKey: "user" },
    ];
    profile.display.fieldLabels = { a: "Alpha" };
    profile.display.searchState = { term: "x", mode: "filter" };
    expect(normalizeProfile(profile)).toEqual(profile);
  });

  it.each([
    [null],
    [undefined],
    ["a string"],
    [42],
    [[]],
    [{}],
    [{ id: "1", name: "x", createdAt: "d", updatedAt: "d" }], // missing parsing/display
    [{ ...validProfile(), id: 123 }], // wrong type for id
    [{ ...validProfile(), parsing: "not-an-object" }],
    [{ ...validProfile(), parsing: { kind: "regex" } }], // unsupported parsing kind
    [{ ...validProfile(), parsing: { ...validProfile().parsing, delimiter: "xx" } }],
    [{ ...validProfile(), parsing: { ...validProfile().parsing, expectedFieldCount: "2" } }],
    [{ ...validProfile(), display: "not-an-object" }],
  ])("rejects %p", (value) => {
    expect(normalizeProfile(value)).toBeUndefined();
  });

  it("drops Derived Field specs of an unsupported kind or with missing parts, keeping the rest", () => {
    const profile = validProfile();
    const stored = {
      ...profile,
      display: {
        ...profile.display,
        derivedFieldSelections: [
          { kind: "trim", sourceFieldKey: "a" }, // removed kind
          { kind: "date", sourceFieldKey: "a", representation: "raw" }, // removed representation
          { kind: "json-key", sourceFieldKey: "a" }, // missing jsonKey
          { kind: "unescape" }, // missing sourceFieldKey
          "garbage",
          { kind: "unescape", sourceFieldKey: "a" },
        ],
      },
    };
    expect(normalizeProfile(stored)?.display.derivedFieldSelections).toEqual([{ kind: "unescape", sourceFieldKey: "a" }]);
  });

  it("defaults missing or malformed display arrays instead of rejecting the Profile", () => {
    const profile = validProfile();
    const stored = { ...profile, display: { visibleFieldKeys: "nope", searchState: { term: 1 } } };
    expect(normalizeProfile(stored)?.display).toEqual({
      visibleFieldKeys: [],
      fieldLabels: {},
      derivedFieldSelections: [],
    });
  });

  it("filters non-string visible keys and non-string labels", () => {
    const profile = validProfile();
    const stored = {
      ...profile,
      display: { ...profile.display, visibleFieldKeys: ["a", 3, null, "b"], fieldLabels: { a: "A", b: 7 } },
    };
    const display = normalizeProfile(stored)?.display;
    expect(display?.visibleFieldKeys).toEqual(["a", "b"]);
    expect(display?.fieldLabels).toEqual({ a: "A" });
  });
});

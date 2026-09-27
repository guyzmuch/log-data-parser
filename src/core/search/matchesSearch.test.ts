import { describe, expect, it } from "vitest";
import type { ParsedRecord } from "@/core/dataset/types";
import { matchesSearch } from "@/core/search/matchesSearch";

function record(): ParsedRecord {
  return {
    index: 0,
    raw: "",
    fields: [
      { key: "name", value: "Alice" },
      { key: "role", value: "Engineer" },
    ],
  };
}

describe("matchesSearch", () => {
  it("matches an empty term against every record", () => {
    expect(matchesSearch(record(), ["name", "role"], "")).toBe(true);
  });

  it("matches a whitespace-only term against every record", () => {
    expect(matchesSearch(record(), ["name", "role"], "   ")).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(matchesSearch(record(), ["name"], "alice")).toBe(true);
    expect(matchesSearch(record(), ["name"], "ALICE")).toBe(true);
  });

  it("matches a substring, not just a whole value", () => {
    expect(matchesSearch(record(), ["role"], "gine")).toBe(true);
  });

  it("matches against any visible field, not just the first", () => {
    expect(matchesSearch(record(), ["name", "role"], "engineer")).toBe(true);
  });

  it("does not match a field that isn't currently visible", () => {
    expect(matchesSearch(record(), ["role"], "alice")).toBe(false);
  });

  it("returns false when nothing matches", () => {
    expect(matchesSearch(record(), ["name", "role"], "zzz")).toBe(false);
  });
});

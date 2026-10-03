import { describe, expect, it } from "vitest";
import type { ParsedRecord } from "@/core/dataset/types";
import {
  addFieldFilter,
  enabledFilters,
  matchesFieldFilters,
  pruneFieldFilters,
  type FieldFilter,
} from "@/core/filters/fieldFilters";

function record(index: number, fields: Record<string, string>, parseErrorKeys: string[] = []): ParsedRecord {
  return {
    index,
    raw: "",
    fields: Object.entries(fields).map(([key, value]) => ({ key, value, ...(parseErrorKeys.includes(key) ? { parseError: true } : {}) })),
  };
}

const filter = (overrides: Partial<FieldFilter>): FieldFilter => ({
  id: "f1",
  key: "level",
  value: "ERROR",
  negate: false,
  disabled: false,
  ...overrides,
});

describe("matchesFieldFilters", () => {
  const error = record(0, { level: "ERROR", host: "a" });
  const info = record(1, { level: "INFO", host: "a" });

  it("keeps everything when there are no filters", () => {
    expect(matchesFieldFilters(error, [])).toBe(true);
  });

  it("'filter for' keeps only the records whose column has exactly that value", () => {
    expect(matchesFieldFilters(error, [filter({})])).toBe(true);
    expect(matchesFieldFilters(info, [filter({})])).toBe(false);
  });

  it("'filter out' keeps the records whose column has any other value", () => {
    expect(matchesFieldFilters(error, [filter({ negate: true })])).toBe(false);
    expect(matchesFieldFilters(info, [filter({ negate: true })])).toBe(true);
  });

  it("compares the whole value exactly: not as a search term, and case counts", () => {
    expect(matchesFieldFilters(record(2, { level: "ERROR: disk" }), [filter({})])).toBe(false);
    expect(matchesFieldFilters(record(3, { level: "error" }), [filter({})])).toBe(false);
    expect(matchesFieldFilters(record(4, { level: "ERROR " }), [filter({})])).toBe(false);
  });

  it("looks at that column only", () => {
    expect(matchesFieldFilters(record(5, { level: "INFO", host: "ERROR" }), [filter({})])).toBe(false);
  });

  it("needs every enabled filter to hold, and ignores disabled ones", () => {
    const both = [filter({ id: "a" }), filter({ id: "b", key: "host", value: "a" })];
    expect(matchesFieldFilters(error, both)).toBe(true);
    expect(matchesFieldFilters(record(6, { level: "ERROR", host: "b" }), both)).toBe(false);
    expect(matchesFieldFilters(record(6, { level: "ERROR", host: "b" }), [both[0], { ...both[1], disabled: true }])).toBe(true);
  });

  it("can filter for an empty cell", () => {
    const empty = [filter({ value: "" })];
    expect(matchesFieldFilters(record(7, { level: "" }), empty)).toBe(true);
    expect(matchesFieldFilters(error, empty)).toBe(false);
  });

  it("treats a Parse Error cell and a missing column as having no value", () => {
    const bad = record(8, { level: "oops" }, ["level"]);
    expect(matchesFieldFilters(bad, [filter({ value: "oops" })])).toBe(false);
    expect(matchesFieldFilters(bad, [filter({ value: "oops", negate: true })])).toBe(true);
    expect(matchesFieldFilters(record(9, { host: "a" }), [filter({})])).toBe(false);
    expect(matchesFieldFilters(record(9, { host: "a" }), [filter({ negate: true })])).toBe(true);
  });
});

describe("addFieldFilter", () => {
  it("appends a new filter", () => {
    const result = addFieldFilter([], "x", "level", "ERROR", false);
    expect(result).toEqual([{ id: "x", key: "level", value: "ERROR", negate: false, disabled: false }]);
  });

  it("does not list the same column and value twice: asking again turns it back on", () => {
    const existing = [filter({ disabled: true })];
    const result = addFieldFilter(existing, "new", "level", "ERROR", false);
    expect(result).toEqual([filter({ disabled: false })]);
  });

  it("flips the existing filter when the opposite is asked for", () => {
    const result = addFieldFilter([filter({})], "new", "level", "ERROR", true);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "f1", negate: true, disabled: false });
  });

  it("keeps filters on other values or columns apart", () => {
    const result = addFieldFilter([filter({})], "new", "level", "INFO", false);
    expect(result).toHaveLength(2);
    expect(addFieldFilter(result, "n2", "host", "ERROR", false)).toHaveLength(3);
  });
});

describe("enabledFilters / pruneFieldFilters", () => {
  it("lists the enabled filters", () => {
    const filters = [filter({ id: "a" }), filter({ id: "b", disabled: true })];
    expect(enabledFilters(filters).map((f) => f.id)).toEqual(["a"]);
  });

  it("drops the filters of columns that don't exist", () => {
    const filters = [filter({ id: "a" }), filter({ id: "b", key: "gone" })];
    expect(pruneFieldFilters(filters, new Set(["level"])).map((f) => f.id)).toEqual(["a"]);
  });
});

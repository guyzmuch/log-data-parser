import { describe, expect, it } from "vitest";
import type { ParsedRecord } from "@/core/dataset/types";
import { buildExportRows } from "@/core/export/buildExportRows";
import { createDefaultDisplayConfig } from "@/core/profile/createProfile";
import type { DisplayConfig } from "@/core/profile/types";

function record(index: number, name: string, value: string, opts?: { parseError?: boolean }): ParsedRecord {
  return {
    index,
    raw: "",
    fields: [
      { key: "name", value: name },
      { key: "value", value, ...(opts?.parseError ? { parseError: true } : {}) },
    ],
  };
}

function display(overrides: Partial<DisplayConfig> = {}): DisplayConfig {
  return { ...createDefaultDisplayConfig(["name", "value"]), ...overrides };
}

describe("buildExportRows", () => {
  it("uses the current Visible Fields, in order, as the header", () => {
    const result = buildExportRows([], display({ visibleFieldKeys: ["value", "name"] }), "all", new Set());
    expect(result.header).toEqual(["value", "name"]);
  });

  it("uses fieldLabels for the header when set", () => {
    const result = buildExportRows(
      [],
      display({ fieldLabels: { name: "Full Name" } }),
      "all",
      new Set(),
    );
    expect(result.header).toEqual(["Full Name", "value"]);
  });

  it("scope 'all' includes every record regardless of hidden state", () => {
    const records = [record(0, "a", "1"), record(1, "b", "2")];
    const result = buildExportRows(records, display(), "all", new Set([0]));
    expect(result.rows).toEqual([
      ["a", "1"],
      ["b", "2"],
    ]);
  });

  it("scope 'excluding-hidden' drops hidden records", () => {
    const records = [record(0, "a", "1"), record(1, "b", "2"), record(2, "c", "3")];
    const result = buildExportRows(records, display(), "excluding-hidden", new Set([1]));
    expect(result.rows).toEqual([
      ["a", "1"],
      ["c", "3"],
    ]);
  });

  it("scope 'matching-filter' only includes records matching an active Filter-mode search", () => {
    const records = [record(0, "alice", "1"), record(1, "bob", "2")];
    const result = buildExportRows(
      records,
      display({ searchState: { term: "ali", mode: "filter" } }),
      "matching-filter",
      new Set(),
    );
    expect(result.rows).toEqual([["alice", "1"]]);
  });

  it("scope 'matching-filter' behaves as 'all' when the search mode isn't Filter", () => {
    const records = [record(0, "alice", "1"), record(1, "bob", "2")];
    const result = buildExportRows(
      records,
      display({ searchState: { term: "ali", mode: "highlight" } }),
      "matching-filter",
      new Set(),
    );
    expect(result.rows).toHaveLength(2);
  });

  it("scope 'matching-filter' behaves as 'all' when there is no active search term", () => {
    const records = [record(0, "alice", "1"), record(1, "bob", "2")];
    const result = buildExportRows(
      records,
      display({ searchState: { term: "", mode: "filter" } }),
      "matching-filter",
      new Set(),
    );
    expect(result.rows).toHaveLength(2);
  });

  it("exports 'Invalid parse' for a Parse Error field, matching what the table shows", () => {
    const records = [record(0, "a", "not-a-date", { parseError: true })];
    const result = buildExportRows(records, display(), "all", new Set());
    expect(result.rows).toEqual([["a", "Invalid parse"]]);
  });

  describe("cell filters", () => {
    const records = [record(0, "a", "1"), record(1, "b", "2"), record(2, "a", "3")];
    const forA = { id: "f", key: "name", value: "a", negate: false, disabled: false };

    it("'Matching filter' keeps the records that pass the cell filters", () => {
      expect(buildExportRows(records, display(), "matching-filter", new Set(), new Map(), [forA]).rows).toEqual([
        ["a", "1"],
        ["a", "3"],
      ]);
      expect(buildExportRows(records, display(), "matching-filter", new Set(), new Map(), [{ ...forA, negate: true }]).rows).toEqual([["b", "2"]]);
    });

    it("ignores disabled filters, and the other scopes ignore all of them", () => {
      expect(buildExportRows(records, display(), "matching-filter", new Set(), new Map(), [{ ...forA, disabled: true }]).rows).toHaveLength(3);
      expect(buildExportRows(records, display(), "all", new Set(), new Map(), [forA]).rows).toHaveLength(3);
    });

    it("combines with a Filter-mode search", () => {
      const searching = display({ searchState: { term: "3", mode: "filter" } });
      expect(buildExportRows(records, searching, "matching-filter", new Set(), new Map(), [forA]).rows).toEqual([["a", "3"]]);
    });
  });

  describe("comments", () => {
    const records = [record(0, "a", "1"), record(1, "b", "2"), record(2, "c", "3")];

    it("adds a final comment column when a record has a comment, blank for the others", () => {
      const result = buildExportRows(records, display(), "all", new Set(), new Map([[1, "check this, odd"]]));
      expect(result.header).toEqual(["name", "value", "comment"]);
      expect(result.rows).toEqual([
        ["a", "1", ""],
        ["b", "2", "check this, odd"],
        ["c", "3", ""],
      ]);
    });

    it("adds no column when there are no comments, or none on the exported rows", () => {
      expect(buildExportRows(records, display(), "all", new Set()).header).toEqual(["name", "value"]);
      const result = buildExportRows(records, display(), "excluding-hidden", new Set([1]), new Map([[1, "hidden row"]]));
      expect(result.header).toEqual(["name", "value"]);
      expect(result.rows).toHaveLength(2);
    });

    it("avoids clashing with an existing column called comment", () => {
      const result = buildExportRows(
        records,
        display({ fieldLabels: { name: "comment" } }),
        "all",
        new Set(),
        new Map([[0, "x"]]),
      );
      expect(result.header).toEqual(["comment", "value", "comment (note)"]);
    });
  });

  it("only exports Visible Fields, dropping hidden columns", () => {
    const records = [record(0, "a", "1")];
    const result = buildExportRows(records, display({ visibleFieldKeys: ["name"] }), "all", new Set());
    expect(result.header).toEqual(["name"]);
    expect(result.rows).toEqual([["a"]]);
  });
});

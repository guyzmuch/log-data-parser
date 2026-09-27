import { describe, expect, it } from "vitest";
import { parseDataset } from "@/core/parsing/parseDataset";
import type { DelimiterParsingConfig } from "@/core/parsing/types";

function baseConfig(overrides: Partial<DelimiterParsingConfig> = {}): DelimiterParsingConfig {
  return {
    kind: "delimiter",
    delimiter: ",",
    hasHeaderRow: false,
    stripQuotes: false,
    trimBoundaryPartials: false,
    expectedFieldCount: 3,
    ...overrides,
  };
}

describe("parseDataset", () => {
  it("returns no records for empty input", () => {
    expect(parseDataset("", baseConfig())).toEqual({ fieldNames: [], records: [] });
  });

  it("parses every line into a Record when there is no header", () => {
    const result = parseDataset("a,b,c\nd,e,f", baseConfig());
    expect(result.records).toHaveLength(2);
    expect(result.records[0].fields.map((f) => f.value)).toEqual(["a", "b", "c"]);
    expect(result.records[1].fields.map((f) => f.value)).toEqual(["d", "e", "f"]);
  });

  it("consumes the first line as header names and excludes it from records", () => {
    const result = parseDataset("id,name,active\n1,foo,true\n2,bar,false", baseConfig({ hasHeaderRow: true }));
    expect(result.fieldNames).toEqual(["id", "name", "active"]);
    expect(result.records).toHaveLength(2);
    expect(result.records[0].fields.map((f) => f.key)).toEqual(["id", "name", "active"]);
    expect(result.records[0].fields.map((f) => f.value)).toEqual(["1", "foo", "true"]);
  });

  it("strips quotes from header names when both hasHeaderRow and stripQuotes are on", () => {
    const result = parseDataset('"id","name"\n1,foo', baseConfig({ hasHeaderRow: true, stripQuotes: true }));
    expect(result.fieldNames).toEqual(["id", "name"]);
  });

  it("applies boundary trim across the whole dataset when enabled", () => {
    // First line is a clipped record (2 fields instead of 3), rest are well-formed.
    const result = parseDataset(
      "b,c\na,b,c\nd,e,f",
      baseConfig({ trimBoundaryPartials: true, expectedFieldCount: 3 }),
    );
    expect(result.records).toHaveLength(2);
    expect(result.records[0].fields.map((f) => f.value)).toEqual(["a", "b", "c"]);
  });

  it("does not trim when trimBoundaryPartials is disabled", () => {
    const result = parseDataset("b,c\na,b,c\nd,e,f", baseConfig({ expectedFieldCount: 3 }));
    expect(result.records).toHaveLength(3);
  });
});

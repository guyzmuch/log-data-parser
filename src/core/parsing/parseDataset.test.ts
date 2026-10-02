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

  it("reports generic Field N names when there is no header and no explicit fieldNames", () => {
    // Regression: fieldNames used to stay [] whenever there was no header row,
    // even though every Record's Fields did have generic "Field N" keys.
    const result = parseDataset("a,b,c\nd,e,f", baseConfig());
    expect(result.fieldNames).toEqual(["Field 1", "Field 2", "Field 3"]);
  });

  it("reports the full per-record field-name list even when config.fieldNames only names a prefix", () => {
    // Regression: the aggregate fieldNames used to come from config.fieldNames
    // directly, silently truncating to its length whenever it was shorter
    // than the actual split — even though each Record's own Fields were
    // already correctly named/generic-fallback past that point.
    const result = parseDataset("a,b,c,d,e", baseConfig({ fieldNames: ["first", "second"] }));
    expect(result.fieldNames).toEqual(["first", "second", "Field 3", "Field 4", "Field 5"]);
  });

  it("reports [] fieldNames when boundary trim drops every record", () => {
    // Two records, both short of expectedFieldCount -> both are boundary records -> both dropped.
    const result = parseDataset("a\nb", baseConfig({ trimBoundaryPartials: true, expectedFieldCount: 3 }));
    expect(result.records).toHaveLength(0);
    expect(result.fieldNames).toEqual([]);
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

  it("keeps the extra columns of wider later Records when the first Record is short (ragged data)", () => {
    const result = parseDataset("a,b\nc,d,e,f\ng,h,i", baseConfig());
    expect(result.fieldNames).toEqual(["Field 1", "Field 2", "Field 3", "Field 4"]);
    // The short Records simply have no value for the missing Fields.
    expect(result.records[0].fields).toHaveLength(2);
    expect(result.records[1].fields).toHaveLength(4);
  });

  it("takes names for a ragged Dataset from the widest Record, with header names first", () => {
    const result = parseDataset("id,name\n1,alice\n2,bob,extra", baseConfig({ hasHeaderRow: true }));
    expect(result.fieldNames).toEqual(["id", "name", "Field 3"]);
  });
});

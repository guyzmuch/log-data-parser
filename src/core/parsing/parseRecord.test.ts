import { describe, expect, it } from "vitest";
import { parseRecord } from "@/core/parsing/parseRecord";
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

describe("cell trimming", () => {
  const values = (raw: string, overrides: Partial<DelimiterParsingConfig>) =>
    parseRecord({ index: 0, raw }, baseConfig(overrides)).fields.map((f) => f.value);

  it("trims cells when trimCells is on, without touching quotes", () => {
    expect(values(' a , "b" ', { trimCells: true })).toEqual(["a", '"b"']);
  });

  it("keeps blanks when trimCells is off", () => {
    expect(values(" a , b ", { trimCells: false })).toEqual([" a ", " b "]);
  });

  it("strips quotes without trimming when trimCells is off", () => {
    expect(values('"a", b ', { trimCells: false, stripQuotes: true })).toEqual(["a", " b "]);
  });

  it("trims and strips quotes when both are on", () => {
    expect(values(' "a" , b ', { trimCells: true, stripQuotes: true })).toEqual(["a", "b"]);
  });

  it("older profiles without trimCells trim exactly when they strip quotes", () => {
    expect(values(" a ", { stripQuotes: true })).toEqual(["a"]);
    expect(values(" a ", { stripQuotes: false })).toEqual([" a "]);
  });
});

describe("parseRecord", () => {
  it("splits a line into generically-named Fields when there are no fieldNames", () => {
    const result = parseRecord({ index: 0, raw: "a,b,c" }, baseConfig());
    expect(result.fields).toEqual([
      { key: "Field 1", value: "a" },
      { key: "Field 2", value: "b" },
      { key: "Field 3", value: "c" },
    ]);
  });

  it("uses provided fieldNames as Field keys", () => {
    const result = parseRecord(
      { index: 0, raw: "1,x,true" },
      baseConfig({ fieldNames: ["id", "name", "active"] }),
    );
    expect(result.fields.map((f) => f.key)).toEqual(["id", "name", "active"]);
  });

  it("strips quotes from values when stripQuotes is enabled", () => {
    const result = parseRecord(
      { index: 0, raw: '"a","b","c"' },
      baseConfig({ stripQuotes: true }),
    );
    expect(result.fields.map((f) => f.value)).toEqual(["a", "b", "c"]);
  });

  it("keeps quotes when stripQuotes is disabled", () => {
    const result = parseRecord({ index: 0, raw: '"a","b"' }, baseConfig());
    expect(result.fields.map((f) => f.value)).toEqual(['"a"', '"b"']);
  });

  it("preserves the raw line and index", () => {
    const result = parseRecord({ index: 7, raw: "a,b" }, baseConfig());
    expect(result.index).toBe(7);
    expect(result.raw).toBe("a,b");
  });
});

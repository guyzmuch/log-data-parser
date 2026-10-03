import { describe, expect, it } from "vitest";
import type { ParsedRecord } from "@/core/dataset/types";
import { colorFitByField, MAX_COLOR_VALUES } from "@/core/display/colorFit";

function rows(values: Record<string, string>[], parseErrorKeys: string[] = []): ParsedRecord[] {
  return values.map((row, index) => ({
    index,
    raw: "",
    fields: Object.entries(row).map(([key, value]) => ({ key, value, ...(parseErrorKeys.includes(key) ? { parseError: true } : {}) })),
  }));
}

describe("colorFitByField", () => {
  it("calls a column with a few different values that repeat good", () => {
    const fits = colorFitByField(rows([{ m: "GET" }, { m: "POST" }, { m: "GET" }, { m: "PUT" }, { m: "GET" }, { m: "POST" }]));
    expect(fits.get("m")).toEqual({ distinct: 3, status: "good" });
  });

  it("calls a short column whose values mostly occur once varied: allowed, not suggested", () => {
    const fits = colorFitByField(rows([{ h: "host-1" }, { h: "host-2" }, { h: "host-3" }, { h: "host-1" }]));
    expect(fits.get("h")).toEqual({ distinct: 3, status: "varied" });
  });

  it("counts values as they are colored: letter case and blanks don't make a new value", () => {
    const fits = colorFitByField(rows([{ l: "ERROR" }, { l: "error" }, { l: " error " }, { l: "INFO" }]));
    expect(fits.get("l")?.distinct).toBe(2);
  });

  it("flags a column of one value, and an empty one", () => {
    const fits = colorFitByField(rows([{ a: "x", b: "" }, { a: "x", b: "  " }]));
    expect(fits.get("a")?.status).toBe("single");
    expect(fits.get("b")?.status).toBe("empty");
  });

  it("accepts exactly MAX_COLOR_VALUES values and refuses one more", () => {
    // Every value appears twice, so the column is "good" up to the limit and "too-many" one value later.
    const make = (n: number) => rows(Array.from({ length: n * 2 }, (_, i) => ({ v: `v${i % n}` })));
    expect(colorFitByField(make(MAX_COLOR_VALUES)).get("v")).toEqual({ distinct: MAX_COLOR_VALUES, status: "good" });
    expect(colorFitByField(make(MAX_COLOR_VALUES + 1)).get("v")).toEqual({ distinct: MAX_COLOR_VALUES + 1, status: "too-many" });
  });

  it("looks at every Record, not only the first ones", () => {
    const records = rows([...Array.from({ length: 100 }, () => ({ v: "a" })), ...Array.from({ length: 30 }, (_, i) => ({ v: `late${i}` }))]);
    expect(colorFitByField(records).get("v")?.status).toBe("too-many");
  });

  it("stops counting past the limit, so the count stays small for an id column", () => {
    const records = rows(Array.from({ length: 5000 }, (_, i) => ({ id: `id-${i}` })));
    expect(colorFitByField(records).get("id")?.distinct).toBeLessThanOrEqual(MAX_COLOR_VALUES + 2);
  });

  it("ignores Parse Errors", () => {
    const fits = colorFitByField(rows([{ d: "bad" }, { d: "worse" }], ["d"]));
    expect(fits.get("d")?.status).toBe("empty");
  });
});

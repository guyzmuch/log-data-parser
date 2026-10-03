import { describe, expect, it } from "vitest";
import type { ParsedRecord } from "@/core/dataset/types";
import { maxValueLengths } from "@/core/dataset/valueLengths";

function record(index: number, fields: ParsedRecord["fields"]): ParsedRecord {
  return { index, raw: "", fields };
}

describe("maxValueLengths", () => {
  it("returns the longest value of each field across all records", () => {
    const records = [
      record(0, [
        { key: "a", value: "xx" },
        { key: "b", value: "longer value" },
      ]),
      record(1, [
        { key: "a", value: "xxxxx" },
        { key: "b", value: "y" },
      ]),
    ];
    expect(maxValueLengths(records)).toEqual(
      new Map([
        ["a", 5],
        ["b", 12],
      ]),
    );
  });

  it("counts a Parse Error cell as the text the table shows for it, not its empty value", () => {
    const records = [record(0, [{ key: "when (ISO)", value: "", parseError: true, sourceFieldKey: "when" }])];
    expect(maxValueLengths(records).get("when (ISO)")).toBe("Invalid parse".length);
  });

  it("copes with ragged records and no records", () => {
    expect(maxValueLengths([])).toEqual(new Map());
    const ragged = [record(0, [{ key: "a", value: "1" }]), record(1, [{ key: "a", value: "22" }, { key: "b", value: "333" }])];
    expect(maxValueLengths(ragged)).toEqual(
      new Map([
        ["a", 2],
        ["b", 3],
      ]),
    );
  });
});

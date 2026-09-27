import { describe, expect, it } from "vitest";
import type { ParsedRecord } from "@/core/dataset/types";
import { applyBoundaryTrim } from "@/core/parsing/applyBoundaryTrim";

function record(index: number, fieldCount: number): ParsedRecord {
  return {
    index,
    raw: `record-${index}`,
    fields: Array.from({ length: fieldCount }, (_, i) => ({ key: `Field ${i + 1}`, value: `v${i}` })),
  };
}

describe("applyBoundaryTrim", () => {
  it("drops a short first record", () => {
    const records = [record(0, 2), record(1, 3), record(2, 3)];
    expect(applyBoundaryTrim(records, 3).map((r) => r.index)).toEqual([1, 2]);
  });

  it("drops a short last record", () => {
    const records = [record(0, 3), record(1, 3), record(2, 1)];
    expect(applyBoundaryTrim(records, 3).map((r) => r.index)).toEqual([0, 1]);
  });

  it("drops both boundaries when both are short", () => {
    const records = [record(0, 1), record(1, 3), record(2, 1)];
    expect(applyBoundaryTrim(records, 3).map((r) => r.index)).toEqual([1]);
  });

  it("does not touch a short record in the middle", () => {
    const records = [record(0, 3), record(1, 1), record(2, 3)];
    expect(applyBoundaryTrim(records, 3).map((r) => r.index)).toEqual([0, 1, 2]);
  });

  it("does not drop anything when boundaries meet expectedFieldCount", () => {
    const records = [record(0, 3), record(1, 3), record(2, 3)];
    expect(applyBoundaryTrim(records, 3).map((r) => r.index)).toEqual([0, 1, 2]);
  });

  it("never drops the only record, even if short", () => {
    const records = [record(0, 1)];
    expect(applyBoundaryTrim(records, 3).map((r) => r.index)).toEqual([0]);
  });

  it("handles an empty list", () => {
    expect(applyBoundaryTrim([], 3)).toEqual([]);
  });
});

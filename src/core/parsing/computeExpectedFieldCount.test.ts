import { describe, expect, it } from "vitest";
import type { ParsedRecord } from "@/core/dataset/types";
import { computeExpectedFieldCount } from "@/core/parsing/computeExpectedFieldCount";

function record(fieldCount: number): ParsedRecord {
  return {
    index: 0,
    raw: "",
    fields: Array.from({ length: fieldCount }, (_, i) => ({ key: `Field ${i + 1}`, value: `v${i}` })),
  };
}

describe("computeExpectedFieldCount", () => {
  it("returns 0 for an empty sample", () => {
    expect(computeExpectedFieldCount([])).toBe(0);
  });

  it("returns the common count when all records agree", () => {
    expect(computeExpectedFieldCount([record(3), record(3), record(3)])).toBe(3);
  });

  it("returns the majority count when one record differs", () => {
    expect(computeExpectedFieldCount([record(3), record(3), record(2)])).toBe(3);
  });
});

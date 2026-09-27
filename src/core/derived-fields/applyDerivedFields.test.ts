import { describe, expect, it } from "vitest";
import type { ParsedRecord } from "@/core/dataset/types";
import { applyDerivedFields } from "@/core/derived-fields/applyDerivedFields";
import type { DerivedFieldSpec } from "@/core/derived-fields/types";

function record(index: number): ParsedRecord {
  return {
    index,
    raw: "",
    fields: [
      { key: "created", value: "2026-01-15T12:30:00.000Z" },
      { key: "name", value: "alice" },
    ],
  };
}

describe("applyDerivedFields", () => {
  it("leaves records unchanged when there are no specs", () => {
    const records = [record(0)];
    expect(applyDerivedFields(records, [])).toEqual(records);
  });

  it("appends derived fields after the base fields", () => {
    const specs: DerivedFieldSpec[] = [{ kind: "date", sourceFieldKey: "created", representation: "iso" }];
    const [result] = applyDerivedFields([record(0)], specs);
    expect(result.fields.map((f) => f.key)).toEqual(["created", "name", "created (ISO)"]);
  });

  it("does not derive from a field with no matching spec", () => {
    const specs: DerivedFieldSpec[] = [{ kind: "date", sourceFieldKey: "created", representation: "iso" }];
    const [result] = applyDerivedFields([record(0)], specs);
    expect(result.fields.some((f) => f.key.startsWith("name ("))).toBe(false);
  });

  it("is idempotent: recomputing with the same specs does not duplicate derived fields", () => {
    const specs: DerivedFieldSpec[] = [{ kind: "date", sourceFieldKey: "created", representation: "iso" }];
    const once = applyDerivedFields([record(0)], specs);
    const twice = applyDerivedFields(once, specs);
    expect(twice[0].fields.map((f) => f.key)).toEqual(["created", "name", "created (ISO)"]);
  });

  it("replaces derived fields entirely when recomputed with a different spec set", () => {
    const firstSpecs: DerivedFieldSpec[] = [{ kind: "date", sourceFieldKey: "created", representation: "iso" }];
    const secondSpecs: DerivedFieldSpec[] = [{ kind: "date", sourceFieldKey: "created", representation: "timezone" }];

    const afterFirst = applyDerivedFields([record(0)], firstSpecs);
    const afterSecond = applyDerivedFields(afterFirst, secondSpecs);

    expect(afterSecond[0].fields.map((f) => f.key)).toEqual(["created", "name", "created (local time)"]);
  });

  it("preserves record index and raw", () => {
    const specs: DerivedFieldSpec[] = [{ kind: "date", sourceFieldKey: "created", representation: "iso" }];
    const [result] = applyDerivedFields([{ ...record(5), raw: "the raw line" }], specs);
    expect(result.index).toBe(5);
    expect(result.raw).toBe("the raw line");
  });
});

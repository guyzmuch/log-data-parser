import { describe, expect, it } from "vitest";
import { isDerivedFieldSpec } from "@/core/derived-fields/isDerivedFieldSpec";

describe("isDerivedFieldSpec", () => {
  it.each([
    [{ kind: "date", sourceFieldKey: "a", representation: "iso" }],
    [{ kind: "date", sourceFieldKey: "a", representation: "timezone" }],
    [{ kind: "date", sourceFieldKey: "a", representation: "timezone", timezone: "Europe/Paris" }],
    [{ kind: "unescape", sourceFieldKey: "a" }],
    [{ kind: "json-key", sourceFieldKey: "a", jsonKey: "user" }],
  ])("accepts %p", (spec) => {
    expect(isDerivedFieldSpec(spec)).toBe(true);
  });

  it.each([
    [null],
    ["x"],
    [{}],
    [{ kind: "trim", sourceFieldKey: "a" }], // removed kind
    [{ kind: "date", sourceFieldKey: "a", representation: "raw" }], // removed representation
    [{ kind: "date", sourceFieldKey: "a", representation: "timezone", timezone: 3 }],
    [{ kind: "json-key", sourceFieldKey: "a" }],
    [{ kind: "unescape" }],
  ])("rejects %p", (spec) => {
    expect(isDerivedFieldSpec(spec)).toBe(false);
  });
});

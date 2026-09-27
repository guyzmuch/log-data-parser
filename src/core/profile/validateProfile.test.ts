import { describe, expect, it } from "vitest";
import { isProfile } from "@/core/profile/validateProfile";
import { createDefaultDisplayConfig, createProfile } from "@/core/profile/createProfile";
import type { DelimiterParsingConfig } from "@/core/parsing/types";

function validProfile() {
  const parsing: DelimiterParsingConfig = {
    kind: "delimiter",
    delimiter: ",",
    hasHeaderRow: false,
    stripQuotes: false,
    trimBoundaryPartials: false,
    expectedFieldCount: 2,
  };
  return createProfile({ name: "test", parsing, display: createDefaultDisplayConfig(["a", "b"]) });
}

describe("isProfile", () => {
  it("accepts a genuine Profile", () => {
    expect(isProfile(validProfile())).toBe(true);
  });

  it.each([
    [null],
    [undefined],
    ["a string"],
    [42],
    [[]],
    [{}],
    [{ id: "1", name: "x", createdAt: "d", updatedAt: "d" }], // missing parsing/display
    [{ ...validProfile(), id: 123 }], // wrong type for id
    [{ ...validProfile(), parsing: "not-an-object" }],
  ])("rejects %p", (value) => {
    expect(isProfile(value)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { derivedFieldKey } from "@/core/derived-fields/derivedFieldKey";

describe("derivedFieldKey", () => {
  it("names an ISO derived field", () => {
    expect(derivedFieldKey({ kind: "date", sourceFieldKey: "created", representation: "iso" })).toBe(
      "created (ISO)",
    );
  });

  it("names a timezone derived field after the explicit zone", () => {
    expect(
      derivedFieldKey({
        kind: "date",
        sourceFieldKey: "created",
        representation: "timezone",
        timezone: "Europe/Paris",
      }),
    ).toBe("created (Europe/Paris)");
  });

  it("falls back to a local-time label when no timezone is given", () => {
    expect(derivedFieldKey({ kind: "date", sourceFieldKey: "created", representation: "timezone" })).toBe(
      "created (local time)",
    );
  });
});

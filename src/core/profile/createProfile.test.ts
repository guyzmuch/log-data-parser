import { describe, expect, it } from "vitest";
import { createDefaultDisplayConfig, createProfile } from "@/core/profile/createProfile";
import type { DelimiterParsingConfig } from "@/core/parsing/types";

function parsingConfig(): DelimiterParsingConfig {
  return {
    kind: "delimiter",
    delimiter: ",",
    hasHeaderRow: true,
    stripQuotes: true,
    trimBoundaryPartials: true,
    expectedFieldCount: 3,
    fieldNames: ["id", "name", "active"],
  };
}

describe("createDefaultDisplayConfig", () => {
  it("makes every field visible, in the given order", () => {
    expect(createDefaultDisplayConfig(["id", "name", "active"])).toEqual({
      visibleFieldKeys: ["id", "name", "active"],
      fieldLabels: {},
      derivedFieldSelections: [],
    });
  });
});

describe("createProfile", () => {
  it("assigns a unique id and matching created/updated timestamps", () => {
    const display = createDefaultDisplayConfig(["id", "name", "active"]);
    const profile = createProfile({ name: "nginx access log", parsing: parsingConfig(), display });

    expect(profile.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(profile.createdAt).toBe(profile.updatedAt);
    expect(profile.name).toBe("nginx access log");
    expect(profile.parsing).toEqual(parsingConfig());
    expect(profile.display).toEqual(display);
  });

  it("gives two Profiles distinct ids", () => {
    const display = createDefaultDisplayConfig(["id"]);
    const a = createProfile({ name: "a", parsing: parsingConfig(), display });
    const b = createProfile({ name: "b", parsing: parsingConfig(), display });
    expect(a.id).not.toBe(b.id);
  });
});

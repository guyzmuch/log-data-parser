import { describe, expect, it } from "vitest";
import { ProfileImportError, exportProfileToJSON, importProfileFromJSON } from "@/core/persistence/profileFile";
import { createDefaultDisplayConfig, createProfile } from "@/core/profile/createProfile";
import type { DelimiterParsingConfig } from "@/core/parsing/types";

function makeProfile() {
  const parsing: DelimiterParsingConfig = {
    kind: "delimiter",
    delimiter: ",",
    hasHeaderRow: true,
    stripQuotes: true,
    trimBoundaryPartials: true,
    expectedFieldCount: 3,
    fieldNames: ["id", "name", "active"],
  };
  return createProfile({ name: "nginx access log", parsing, display: createDefaultDisplayConfig(["id", "name", "active"]) });
}

describe("exportProfileToJSON / importProfileFromJSON", () => {
  it("round-trips a Profile unchanged", async () => {
    const profile = makeProfile();
    const blob = exportProfileToJSON(profile);
    const imported = await importProfileFromJSON(blob);
    expect(imported).toEqual(profile);
  });

  it("rejects malformed JSON", async () => {
    const blob = new Blob(["{not valid json"], { type: "application/json" });
    await expect(importProfileFromJSON(blob)).rejects.toThrow(ProfileImportError);
  });

  it("rejects a file with no schema version", async () => {
    const blob = new Blob([JSON.stringify({ profile: makeProfile() })], { type: "application/json" });
    await expect(importProfileFromJSON(blob)).rejects.toThrow(ProfileImportError);
  });

  it("rejects a future/unsupported schema version", async () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 999, profile: makeProfile() })], {
      type: "application/json",
    });
    await expect(importProfileFromJSON(blob)).rejects.toThrow(/version/i);
  });

  it("rejects a payload whose profile is missing required fields", async () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, profile: { id: "1" } })], {
      type: "application/json",
    });
    await expect(importProfileFromJSON(blob)).rejects.toThrow(ProfileImportError);
  });
});

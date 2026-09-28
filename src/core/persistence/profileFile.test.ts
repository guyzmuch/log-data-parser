import { describe, expect, it } from "vitest";
import { ProfileImportError, exportProfilesToJSON, importProfilesFromJSON } from "@/core/persistence/profileFile";
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

describe("exportProfilesToJSON / importProfilesFromJSON", () => {
  it("round-trips a list of Profiles unchanged", async () => {
    const profiles = [makeProfile(), makeProfile()];
    const blob = exportProfilesToJSON(profiles);
    const imported = await importProfilesFromJSON(blob);
    expect(imported).toEqual(profiles);
  });

  it("rejects malformed JSON", async () => {
    const blob = new Blob(["{not valid json"], { type: "application/json" });
    await expect(importProfilesFromJSON(blob)).rejects.toThrow(ProfileImportError);
  });

  it("rejects a file with no schema version", async () => {
    const blob = new Blob([JSON.stringify({ profiles: [makeProfile()] })], { type: "application/json" });
    await expect(importProfilesFromJSON(blob)).rejects.toThrow(ProfileImportError);
  });

  it("rejects a future/unsupported schema version", async () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 999, profiles: [makeProfile()] })], {
      type: "application/json",
    });
    await expect(importProfilesFromJSON(blob)).rejects.toThrow(/version/i);
  });

  it("rejects an empty profiles list", async () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, profiles: [] })], { type: "application/json" });
    await expect(importProfilesFromJSON(blob)).rejects.toThrow(ProfileImportError);
  });

  it("rejects a payload where one profile is missing required fields", async () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, profiles: [makeProfile(), { id: "1" }] })], {
      type: "application/json",
    });
    await expect(importProfilesFromJSON(blob)).rejects.toThrow(ProfileImportError);
  });
});

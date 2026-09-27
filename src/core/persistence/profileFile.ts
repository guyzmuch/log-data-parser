import type { Profile } from "@/core/profile/types";
import { isProfile } from "@/core/profile/validateProfile";

const PROFILE_FILE_SCHEMA_VERSION = 1;

interface ProfileFilePayload {
  schemaVersion: number;
  profile: Profile;
}

export class ProfileImportError extends Error {}

export function exportProfileToJSON(profile: Profile): Blob {
  const payload: ProfileFilePayload = { schemaVersion: PROFILE_FILE_SCHEMA_VERSION, profile };
  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}

/** Accepts a Blob so both a browser File (upload input) and our own exported Blob round-trip through the same path. */
export async function importProfileFromJSON(file: Blob): Promise<Profile> {
  const text = await file.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ProfileImportError("File is not valid JSON.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new ProfileImportError("File does not contain a Profile.");
  }

  const { schemaVersion, profile } = parsed as Partial<ProfileFilePayload>;

  if (typeof schemaVersion !== "number") {
    throw new ProfileImportError("File is missing a schema version.");
  }
  if (schemaVersion !== PROFILE_FILE_SCHEMA_VERSION) {
    throw new ProfileImportError(`Unsupported Profile file version: ${schemaVersion}.`);
  }
  if (!isProfile(profile)) {
    throw new ProfileImportError("File does not contain a valid Profile.");
  }

  return profile;
}

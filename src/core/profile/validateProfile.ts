import type { Profile } from "@/core/profile/types";

/**
 * Shallow structural check — confirms the top-level shape is a Profile, not
 * a deep validation of every nested field. Good enough for v1's "did this
 * localStorage entry / imported file survive intact" use case.
 */
export function isProfile(value: unknown): value is Profile {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;

  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.createdAt === "string" &&
    typeof v.updatedAt === "string" &&
    typeof v.parsing === "object" &&
    v.parsing !== null &&
    typeof v.display === "object" &&
    v.display !== null
  );
}

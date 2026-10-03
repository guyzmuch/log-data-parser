import type { DisplayConfig, Profile } from "@/core/profile/types";
import type { ParsingConfig } from "@/core/parsing/types";

/** All parsed Fields start out visible, in parse order, with no labels/derived Fields/search state. */
export function createDefaultDisplayConfig(fieldNames: string[]): DisplayConfig {
  return {
    visibleFieldKeys: [...fieldNames],
    fieldOrder: [...fieldNames],
    fieldLabels: {},
    derivedFieldSelections: [],
  };
}

export function createProfile(params: { name: string; parsing: ParsingConfig; display: DisplayConfig }): Profile {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: params.name,
    parsing: params.parsing,
    display: params.display,
    createdAt: now,
    updatedAt: now,
  };
}

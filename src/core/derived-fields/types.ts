export type IanaTimeZone = string;

/**
 * Discriminated union so future kinds (base64 decode, JSON explode, ...)
 * can be added without restructuring DisplayConfig. Only "date" exists in v1.
 */
export interface DateDerivedFieldSpec {
  kind: "date";
  sourceFieldKey: string;
  // No "raw" representation: it would just duplicate the source Field's own
  // value as a second column, which is never useful — the source Field is
  // already right there.
  representation: "iso" | "timezone";
  /** IANA zone (e.g. "Europe/Paris"). Ignored unless representation is "timezone"; omitted there means browser-local. */
  timezone?: IanaTimeZone;
}

export type DerivedFieldSpec = DateDerivedFieldSpec;

/** How many hashed colors there are (the fixed tones below come on top of these). */
export const COLOR_COUNT = 7;

/**
 * Hue (degrees, OKLCH) of each hashed color. They all keep at least 30 degrees away from every tone hue below, so a
 * hashed value never looks like "ok", "error" or "warn". Lightness and chroma come from the theme.
 */
export const COLOR_HUES: readonly number[] = [110, 175, 210, 275, 297, 320, 345];

/**
 * Mixed into the hash. It was picked by trying seeds until the usual small sets of values that have no fixed color
 * (GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS, http/https, tcp/udp, login/logout/search/purchase, prod/staging/dev/test,
 * json/xml/csv, ...) all get different colors, and the five core HTTP methods are at least 35 degrees apart in hue.
 * A plain hash sends GET and POST to the same color. Changing it changes every hashed color, so leave it alone.
 */
const SEED = 41428;

/** A color of its own for values whose meaning is known, so "error" is red and "ok" is green in every column and file. */
export type Tone = "green" | "red" | "amber" | "blue" | "crimson" | "grey";

/**
 * Hue of each tone (grey has none: it is drawn without chroma). Crimson is the same hue as red, drawn as a solid, stronger
 * badge, so it stands out as "worse than error" without needing a hue of its own next to red.
 */
export const TONE_HUES: Record<Tone, number> = { green: 145, red: 25, amber: 75, blue: 245, crimson: 25, grey: 0 };

/**
 * Values with a fixed tone (lower case). Good and bad outcomes, then log levels from quiet to severe.
 * Everything not listed here gets a hashed color (see colorIndexOf). HTTP status codes are handled in toneOf.
 */
const FIXED_TONES: Record<string, Tone> = {
  ok: "green",
  success: "green",
  successful: "green",
  succeeded: "green",
  pass: "green",
  passed: "green",
  true: "green",
  yes: "green",
  up: "green",
  healthy: "green",

  fail: "red",
  failed: "red",
  failure: "red",
  false: "red",
  no: "red",
  down: "red",
  unhealthy: "red",
  denied: "red",

  trace: "grey",
  debug: "grey",
  info: "blue",
  notice: "blue",
  warn: "amber",
  warning: "amber",
  error: "red",
  err: "red",
  critical: "crimson",
  fatal: "crimson",
  severe: "crimson",
  emergency: "crimson",
  alert: "crimson",
};

/** HTTP status classes by their first digit: 1xx grey, 2xx green, 3xx blue, 4xx amber, 5xx red. */
const STATUS_TONES: Record<string, Tone> = { "1": "grey", "2": "green", "3": "blue", "4": "amber", "5": "red" };

/** The fixed tone of a value ("OK", " error ", "404", "5xx"...), or undefined when it has none. */
export function toneOf(value: string): Tone | undefined {
  const key = normalizeColorKey(value);
  if (Object.hasOwn(FIXED_TONES, key)) return FIXED_TONES[key];
  if (/^[1-5](?:\d\d|xx)$/.test(key)) return STATUS_TONES[key[0]];
  return undefined;
}

/** The text that is colored: blanks and letter case don't matter, so "error" and "ERROR " look the same. */
export function normalizeColorKey(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * The color (0 to COLOR_COUNT - 1) of a value. Deterministic and independent of the data around it:
 * the same text gets the same color in every column, file and session. FNV-1a with a final mix.
 */
export function colorIndexOf(value: string): number {
  let hash = (0x811c9dc5 ^ Math.imul(SEED, 0x9e3779b1)) >>> 0;
  for (const char of normalizeColorKey(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x2c1b3c6d) >>> 0;
  hash ^= hash >>> 12;
  return (hash >>> 0) % COLOR_COUNT;
}

/** How to draw a value: an id that is the same for the same color, its hue, whether it is grey, and whether it is drawn solid. */
export interface ValueColor {
  id: string;
  hue: number;
  neutral: boolean;
  strong: boolean;
}

/** The color of a value: its fixed tone if it has one, otherwise a hashed color. */
export function valueColor(value: string): ValueColor {
  const tone = toneOf(value);
  if (tone) return { id: tone, hue: TONE_HUES[tone], neutral: tone === "grey", strong: tone === "crimson" };
  const index = colorIndexOf(value);
  return { id: `h${index}`, hue: COLOR_HUES[index], neutral: false, strong: false };
}

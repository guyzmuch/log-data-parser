const PURE_DIGITS = /^\d+$/;

/**
 * Parses a Field's string value as a date, covering the v1-agreed minimal
 * set: Unix epoch (seconds or milliseconds) and whatever `Date.parse`
 * recognizes (chiefly ISO 8601) — see Q14 from the original design pass.
 *
 * `new Date(value)` behaves very differently for a numeric STRING vs a
 * NUMBER: `new Date("1700000000")` is Invalid Date, but `new Date(1700000000)`
 * (or `* 1000` for a seconds-based epoch) parses correctly. Since every Field
 * value is always a string, epoch timestamps need this numeric-string
 * detection first, or they silently fail to parse.
 */
export function parseFlexibleDate(value: string): Date {
  const trimmed = value.trim();

  if (PURE_DIGITS.test(trimmed)) {
    const asNumber = Number(trimmed);
    // More than 10 digits -> milliseconds since epoch; 10 or fewer -> seconds.
    const isMilliseconds = trimmed.length > 10;
    return new Date(isMilliseconds ? asNumber : asNumber * 1000);
  }

  return new Date(trimmed);
}

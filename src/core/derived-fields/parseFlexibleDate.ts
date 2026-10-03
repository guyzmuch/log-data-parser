const PURE_DIGITS = /^\d+$/;

const MONTH_OR_DAY_NAME =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i;

/** A string must match one of these (ISO 8601-ish, numeric with slashes, or containing a month/day name) to be tried as a date. */
const LOOKS_LIKE_A_DATE: RegExp[] = [
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:[.,]\d+)?)?)?\s*(?:Z|[+-]\d{2}(?::?\d{2})?)?$/i,
  /^\d{1,4}\/\d{1,2}\/\d{1,4}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/,
  MONTH_OR_DAY_NAME,
];

// A whole number only counts as a timestamp if, read as Unix seconds or as milliseconds, it lands
// between these years. Anything else (ids, counts, ports, durations, 9-digit serials...) is just a number.
// The two readings can't clash: seconds for these years are ~9.5e8 to 4.1e9, milliseconds ~9.5e11 to 4.1e12.
const EPOCH_FIRST_YEAR = 2000;
const EPOCH_LAST_YEAR = 2100; // exclusive
const EPOCH_MIN_SECONDS = Date.UTC(EPOCH_FIRST_YEAR, 0, 1) / 1000;
const EPOCH_MAX_SECONDS = Date.UTC(EPOCH_LAST_YEAR, 0, 1) / 1000;

/**
 * Parses a Field's string value as a date, covering the v1-agreed minimal
 * set: Unix epoch (seconds or milliseconds, years 2000 to 2099 — see above) and whatever
 * `Date.parse` recognizes (chiefly ISO 8601) — see Q14 from the original design pass.
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
    // Only realistic timestamps count. Short integers (ids, counts, durations, ports...)
    // must NOT read as dates in January 1970.
    const asNumber = Number(trimmed);
    if (asNumber >= EPOCH_MIN_SECONDS && asNumber < EPOCH_MAX_SECONDS) return new Date(asNumber * 1000);
    if (asNumber >= EPOCH_MIN_SECONDS * 1000 && asNumber < EPOCH_MAX_SECONDS * 1000) return new Date(asNumber);
    return new Date(Number.NaN);
  }

  // V8's legacy Date parser is far too forgiving: `new Date("host-01")` is
  // 1 Jan 2001 and `new Date("level-3")` is 1 Mar 2001. Only hand a string to
  // it when it at least *looks* like a date.
  if (!LOOKS_LIKE_A_DATE.some((pattern) => pattern.test(trimmed))) return new Date(Number.NaN);

  return new Date(trimmed);
}

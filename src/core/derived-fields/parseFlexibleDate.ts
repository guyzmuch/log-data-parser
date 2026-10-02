const PURE_DIGITS = /^\d+$/;

const MONTH_OR_DAY_NAME =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i;

/** A string must match one of these (ISO 8601-ish, numeric with slashes, or containing a month/day name) to be tried as a date. */
const LOOKS_LIKE_A_DATE: RegExp[] = [
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:[.,]\d+)?)?)?\s*(?:Z|[+-]\d{2}(?::?\d{2})?)?$/i,
  /^\d{1,4}\/\d{1,2}\/\d{1,4}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/,
  MONTH_OR_DAY_NAME,
];

// 9-10 digits: seconds (1973 to 2286). 12-13 digits: milliseconds (same span).
// 11 digits is ambiguous and 8 or fewer is too short to be a timestamp, so both are rejected.
const EPOCH_SECONDS_DIGITS = { min: 9, max: 10 };
const EPOCH_MILLIS_DIGITS = { min: 12, max: 13 };

/**
 * Parses a Field's string value as a date, covering the v1-agreed minimal
 * set: Unix epoch (9-10 digit seconds, 12-13 digit milliseconds) and whatever `Date.parse`
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
    // Only realistic epoch lengths count as timestamps. Short integers (ids,
    // counts, durations, ports...) must NOT read as dates in January 1970.
    const isSeconds = trimmed.length >= EPOCH_SECONDS_DIGITS.min && trimmed.length <= EPOCH_SECONDS_DIGITS.max;
    const isMilliseconds = trimmed.length >= EPOCH_MILLIS_DIGITS.min && trimmed.length <= EPOCH_MILLIS_DIGITS.max;
    if (!isSeconds && !isMilliseconds) return new Date(Number.NaN);

    const asNumber = Number(trimmed);
    return new Date(isMilliseconds ? asNumber : asNumber * 1000);
  }

  // V8's legacy Date parser is far too forgiving: `new Date("host-01")` is
  // 1 Jan 2001 and `new Date("level-3")` is 1 Mar 2001. Only hand a string to
  // it when it at least *looks* like a date.
  if (!LOOKS_LIKE_A_DATE.some((pattern) => pattern.test(trimmed))) return new Date(Number.NaN);

  return new Date(trimmed);
}

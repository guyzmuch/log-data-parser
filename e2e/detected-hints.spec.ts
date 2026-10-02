import { test } from "@playwright/test";
import { expectDetected, loadWithProfile, pasteWithProfile, type WizardChoices } from "./helpers";

// The "detected: ..." hint next to each column in the Columns panel. Labels: "date", "JSON",
// "escaped chars", "whitespace padding". Hints only propose — nothing is applied automatically.

test.use({ locale: "en-US", timezoneId: "UTC" });

const PIPE_WITH_HEADER: WizardChoices = { delimiter: "Pipe", header: true };

// ---------------------------------------------------------------------------
// One dataset, one column per behaviour. Clean data (no padding/quotes) so each
// test isolates the detector itself from the parsing issues covered elsewhere.
// ---------------------------------------------------------------------------
const COLUMNS = [
  "id", //            0: small integers
  "iso", //           1: ISO 8601 dates
  "epoch_s", //       2: epoch seconds (10 digits)
  "epoch_ms", //      3: epoch milliseconds (13 digits)
  "json", //          4: JSON objects
  "escaped", //       5: backslash escapes
  "plain", //         6: ordinary words
  "small_num", //     7: small integers that aren't ids (counts, durations)
  "mostly_dates", //  8: 3 of 4 values are dates
  "mostly_text", //   9: 1 of 4 values is a date
  "json_array", //   10: valid JSON, but arrays not objects
  "bad_json", //     11: broken JSON
] as const;

const ROWS = [
  [
    "1",
    "2026-01-15T12:30:00.000Z",
    "1768480200",
    "1768480200000",
    '{"user":"alice"}',
    'He said \\"hi\\"',
    "alpha",
    "2",
    "2026-01-15T12:30:00Z",
    "nope",
    "[1,2]",
    '{"a":',
  ],
  [
    "2",
    "2026-01-15T12:30:01.000Z",
    "1768480256",
    "1768480256000",
    '{"user":"bob"}',
    "tab\\there",
    "beta",
    "7",
    "2026-01-15T12:31:00Z",
    "words",
    "[3]",
    '{"a":1',
  ],
  [
    "3",
    "2026-01-15T12:30:02.000Z",
    "1768480318",
    "1768480318000",
    '{"user":"carol"}',
    "C:\\\\temp",
    "gamma",
    "12",
    "2026-01-15T12:32:00Z",
    "2026-01-15T12:30:00Z",
    '["x"]',
    "}",
  ],
  [
    "4",
    "2026-01-15T12:30:03.000Z",
    "1768480386",
    "1768480386000",
    '{"user":"dave"}',
    "nothing",
    "delta",
    "42",
    "not a date",
    "more",
    "[ ]",
    "{",
  ],
];

const DATASET = [COLUMNS.join("|"), ...ROWS.map((row) => row.join("|"))].join("\n");

test.describe("detected hints on a clean pasted dataset", () => {
  test.beforeEach(async ({ page }) => {
    await pasteWithProfile(page, DATASET, PIPE_WITH_HEADER);
  });

  test("ISO 8601 timestamps -> date", async ({ page }) => {
    await expectDetected(page, COLUMNS.indexOf("iso"), ["date"]);
  });

  test("epoch seconds (10 digits) -> date", async ({ page }) => {
    await expectDetected(page, COLUMNS.indexOf("epoch_s"), ["date"]);
  });

  test("epoch milliseconds (13 digits) -> date", async ({ page }) => {
    await expectDetected(page, COLUMNS.indexOf("epoch_ms"), ["date"]);
  });

  test("JSON objects -> JSON", async ({ page }) => {
    await expectDetected(page, COLUMNS.indexOf("json"), ["JSON"]);
  });

  test("backslash escapes -> escaped chars", async ({ page }) => {
    await expectDetected(page, COLUMNS.indexOf("escaped"), ["escaped chars"]);
  });

  test("plain words -> no hint", async ({ page }) => {
    await expectDetected(page, COLUMNS.indexOf("plain"), []);
  });

  test("a majority of dates (3 of 4) -> date", async ({ page }) => {
    await expectDetected(page, COLUMNS.indexOf("mostly_dates"), ["date"]);
  });

  test("a minority of dates (1 of 4) -> no hint", async ({ page }) => {
    await expectDetected(page, COLUMNS.indexOf("mostly_text"), []);
  });

  test("JSON arrays are not JSON objects -> no hint", async ({ page }) => {
    await expectDetected(page, COLUMNS.indexOf("json_array"), []);
  });

  test("broken JSON -> no hint", async ({ page }) => {
    await expectDetected(page, COLUMNS.indexOf("bad_json"), []);
  });

  // Not sure this fails today: parseFlexibleDate treats ANY all-digit string as an epoch (seconds if
  // <= 10 digits), with no minimum length — so a column of 1, 2, 3, 4 probably reads as dates in 1970.
  test("small integers (ids) are not timestamps -> no hint", async ({ page }) => {
    await expectDetected(page, COLUMNS.indexOf("id"), []);
  });

  test("small integers (counts, durations) are not timestamps -> no hint", async ({ page }) => {
    await expectDetected(page, COLUMNS.indexOf("small_num"), []);
  });
});

// ---------------------------------------------------------------------------
// The two sample files. Expected hints assume cells are trimmed at parse time
// (so no "whitespace padding" hint — see the open question on that detector).
// ---------------------------------------------------------------------------
test.describe("detected hints on the sample files", () => {
  const CHOICES: WizardChoices = { delimiter: "Pipe", header: true, stripQuotes: true };

  test("json-cell-pipe.log: date, -, JSON, -", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
    await expectDetected(page, 0, ["date"]); // timestamp
    await expectDetected(page, 1, []); // host
    await expectDetected(page, 2, ["JSON"]); // payload
    await expectDetected(page, 3, []); // level
  });

  test("json-cell-stringified-pipe.log: date, -, escaped chars, -", async ({ page }) => {
    await loadWithProfile(page, "json-cell-stringified-pipe.log", CHOICES);
    await expectDetected(page, 0, ["date"]); // epoch seconds
    await expectDetected(page, 1, []); // host
    // Still escaped after quote stripping, so it is "escaped chars", not parseable "JSON".
    await expectDetected(page, 2, ["escaped chars"]);
    await expectDetected(page, 3, []); // level
  });
});

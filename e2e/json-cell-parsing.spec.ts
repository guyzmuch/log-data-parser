import { expect, test } from "@playwright/test";
import {
  addTimezone,
  clickColumnAction,
  columnSlice,
  configureWizard,
  expectColumnLabels,
  headerCell,
  loadWithProfile,
  mainHeaders,
  mainRows,
  openWizard,
  pasteDataset,
  previewHeaders,
  previewRows,
  saveWizard,
  selectDelimiter,
  setCheckbox,
  uploadSample,
  type WizardChoices,
} from "./helpers";

// Date rendering ("local time" column) depends on the browser's locale/zone — pin both.
test.use({ locale: "en-US", timezoneId: "UTC" });

const BASE_COLUMNS = ["timestamp", "host", "payload", "level"];

// ---------------------------------------------------------------------------
// File 1: ISO timestamps + raw (unescaped) JSON
// ---------------------------------------------------------------------------
test.describe("json-cell-pipe.log (ISO timestamp, raw JSON)", () => {
  const FILE = "json-cell-pipe.log";
  const CHOICES: WizardChoices = { delimiter: "Pipe", header: true, stripQuotes: true };

  test("wizard output: correct column names and cell data", async ({ page }) => {
    await loadWithProfile(page, FILE, CHOICES);

    expect.soft(await mainHeaders(page)).toEqual(BASE_COLUMNS);
    await expectColumnLabels(page, BASE_COLUMNS);

    const rows = await mainRows(page);
    expect.soft(rows).toHaveLength(8);
    expect.soft(rows[0]).toEqual([
      "2026-01-15T12:30:00.000Z",
      "host-01",
      '{"user":"alice","action":"login","count":3}',
      "error",
    ]);
    expect.soft(rows[7]).toEqual([
      "2026-01-15T12:36:18.959Z",
      "host-08",
      '{"user":"heidi","action":"search","count":42}',
      "debug",
    ]);
  });

  test("date parsing on the timestamp column (ISO, local, extra timezone)", async ({ page }) => {
    await loadWithProfile(page, FILE, CHOICES);

    await clickColumnAction(page, 0, "Parse as date");
    // The new columns replace the raw one, right where it was.
    expect.soft(await mainHeaders(page)).toEqual(["timestamp (ISO)", "timestamp (local time)", "host", "payload", "level"]);

    let rows = await mainRows(page);
    expect.soft(columnSlice(rows, 0, 2)[0]).toEqual(["2026-01-15T12:30:00.000Z", "Jan 15, 2026, 12:30:00 PM"]);
    expect.soft(columnSlice(rows, 0, 2)[1]).toEqual(["2026-01-15T12:30:48.137Z", "Jan 15, 2026, 12:30:48 PM"]);

    // The timezone action is on the derived columns too, since the source column is hidden.
    await addTimezone(page, 0, "Europe/Paris");
    expect.soft(await mainHeaders(page)).toEqual([
      "timestamp (ISO)",
      "timestamp (local time)",
      "timestamp (Europe/Paris)",
      "host",
      "payload",
      "level",
    ]);

    rows = await mainRows(page);
    expect.soft(rows[0][2]).toBe("Jan 15, 2026, 1:30:00 PM");
    expect.soft(rows[1][2]).toBe("Jan 15, 2026, 1:30:48 PM");

    // No row is flagged as a parse error.
    await expect.soft(page.getByText("Invalid parse")).toHaveCount(0);
  });

  test("Split date and time gives a UTC date column and a UTC time column", async ({ page }) => {
    await loadWithProfile(page, FILE, CHOICES);

    await clickColumnAction(page, 0, "Split date and time");
    expect.soft(await mainHeaders(page)).toEqual(["timestamp (date)", "timestamp (time)", "host", "payload", "level"]);

    const rows = await mainRows(page);
    expect.soft(columnSlice(rows, 0, 2)[0]).toEqual(["2026-01-15", "12:30:00"]);
    expect.soft(columnSlice(rows, 0, 2)[1]).toEqual(["2026-01-15", "12:30:48.137"]);
    await expect.soft(page.getByText("Invalid parse")).toHaveCount(0);

    // The new columns say what they come from, and the split is not offered again from them.
    await expect(headerCell(page, 0)).toContainText("from timestamp · date");
    await headerCell(page, 0).getByRole("button", { name: /Column options/ }).click();
    await expect(page.getByRole("menuitem", { name: "Split date and time" })).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  test("the split can be added after Parse as date, from the new date columns, and both coexist", async ({ page }) => {
    await loadWithProfile(page, FILE, CHOICES);

    await clickColumnAction(page, 0, "Parse as date"); // the source column is hidden now
    await clickColumnAction(page, 0, "Split date and time"); // offered on the derived column
    expect.soft(await mainHeaders(page)).toEqual([
      "timestamp (ISO)",
      "timestamp (local time)",
      "timestamp (date)",
      "timestamp (time)",
      "host",
      "payload",
      "level",
    ]);
    const rows = await mainRows(page);
    expect.soft(columnSlice(rows, 0, 4)[0]).toEqual([
      "2026-01-15T12:30:00.000Z",
      "Jan 15, 2026, 12:30:00 PM",
      "2026-01-15",
      "12:30:00",
    ]);
  });

  test("the date column is made for filtering: one click keeps the rows of that day", async ({ page }) => {
    await loadWithProfile(page, FILE, CHOICES);
    await clickColumnAction(page, 0, "Split date and time");

    const cell = page.locator("main tbody tr:not([data-spacer])").first().locator("td").nth(2); // "timestamp (time)"
    await cell.hover();
    await cell.getByRole("button", { name: "Filter for value" }).click();
    await expect(page.getByTestId("filter-pill").first()).toHaveText("timestamp (time): 12:30:00");
    expect(await mainRows(page)).toHaveLength(1);
  });

  test("JSON parsing on the payload column", async ({ page }) => {
    await loadWithProfile(page, FILE, CHOICES);

    await clickColumnAction(page, 2, "Extract JSON keys");
    expect.soft(await mainHeaders(page)).toEqual([
      "timestamp",
      "host",
      "payload.user",
      "payload.action",
      "payload.count",
      "level",
    ]);

    const rows = await mainRows(page);
    const json = columnSlice(rows, 2, 3);
    expect.soft(json[0]).toEqual(["alice", "login", "3"]);
    expect.soft(json[1]).toEqual(["bob", "logout", "12"]);
    expect.soft(json[7]).toEqual(["heidi", "search", "42"]);
    await expect.soft(page.getByText("Invalid parse")).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// File 2: epoch-seconds timestamps + stringified (escaped, quoted) JSON
// ---------------------------------------------------------------------------
test.describe("json-cell-stringified-pipe.log (epoch timestamp, stringified JSON)", () => {
  const FILE = "json-cell-stringified-pipe.log";
  const CHOICES: WizardChoices = { delimiter: "Pipe", header: true, stripQuotes: true };

  test("wizard output: correct column names and cell data", async ({ page }) => {
    await loadWithProfile(page, FILE, CHOICES);

    expect.soft(await mainHeaders(page)).toEqual(BASE_COLUMNS);
    await expectColumnLabels(page, BASE_COLUMNS);

    const rows = await mainRows(page);
    expect.soft(rows).toHaveLength(8);
    // Quotes stripped, but the backslash escapes inside are still there (that's what "Strip escape characters" is for).
    expect.soft(rows[0]).toEqual([
      "1768480200",
      "host-01",
      '{\\"user\\":\\"alice\\",\\"action\\":\\"login\\",\\"count\\":3}',
      "error",
    ]);
  });

  test("date parsing on an epoch-seconds timestamp column", async ({ page }) => {
    await loadWithProfile(page, FILE, CHOICES);

    await clickColumnAction(page, 0, "Parse as date");
    const rows = await mainRows(page);
    expect.soft(columnSlice(rows, 0, 2)[0]).toEqual(["2026-01-15T12:30:00.000Z", "Jan 15, 2026, 12:30:00 PM"]);
    expect.soft(columnSlice(rows, 0, 2)[7]).toEqual(["2026-01-15T12:38:38.000Z", "Jan 15, 2026, 12:38:38 PM"]);
    await expect.soft(page.getByText("Invalid parse")).toHaveCount(0);
  });

  test("Strip escape characters on the payload column gives readable JSON text", async ({ page }) => {
    await loadWithProfile(page, FILE, CHOICES);

    await clickColumnAction(page, 2, "Strip escape characters");
    expect.soft(await mainHeaders(page)).toEqual(["timestamp", "host", "payload (unescaped)", "level"]);

    const rows = await mainRows(page);
    expect.soft(rows[0][2]).toBe('{"user":"alice","action":"login","count":3}');
    expect.soft(rows[7][2]).toBe('{"user":"heidi","action":"search","count":42}');
  });

  // A stringified-JSON column is only useful if the user can still pull its keys out. "Extract JSON keys"
  // runs on the base column (still escaped), so the JSON extraction has to cope with stringified objects.
  test("JSON parsing works on the stringified payload column", async ({ page }) => {
    await loadWithProfile(page, FILE, CHOICES);

    await clickColumnAction(page, 2, "Extract JSON keys");
    expect.soft(await mainHeaders(page)).toEqual([
      "timestamp",
      "host",
      "payload.user",
      "payload.action",
      "payload.count",
      "level",
    ]);

    const rows = await mainRows(page);
    expect.soft(columnSlice(rows, 2, 3)[0]).toEqual(["alice", "login", "3"]);
  });
});

// ---------------------------------------------------------------------------
// Escapes on clean (unpadded) pasted data — isolates Strip escape characters from the padding/quote issues.
// ---------------------------------------------------------------------------
test("Strip escape characters decodes \\\" and \\\\ in a pasted column", async ({ page }) => {
  await page.goto("/");
  await pasteDataset(page, ["id|message", '1|He said \\"hi\\"', "2|path C:\\\\temp\\\\file"].join("\n"));
  await openWizard(page);
  await configureWizard(page, { delimiter: "Pipe", header: true });
  await saveWizard(page);

  await clickColumnAction(page, 1, "Strip escape characters");
  const rows = await mainRows(page);
  expect.soft(rows[0][1]).toBe('He said "hi"');
  expect.soft(rows[1][1]).toBe("path C:\\temp\\file");
});

// ---------------------------------------------------------------------------
// Regressions for bugs found while testing the wizard and parsing
// ---------------------------------------------------------------------------
test.describe("regressions", () => {
  test("strip quotes also works when the quotes are surrounded by blanks", async ({ page }) => {
    await page.goto("/");
    await pasteDataset(page, ["host | level", ' "h1" | "error" ', ' "h2" | "warning" '].join("\n"));
    await openWizard(page);
    await configureWizard(page, { delimiter: "Pipe", header: true, stripQuotes: true });

    // Wizard preview: cells are trimmed first, then quotes removed.
    expect.soft(await previewRows(page)).toEqual([
      ["h1", "error"],
      ["h2", "warning"],
    ]);

    await saveWizard(page);
    expect.soft(await mainRows(page)).toEqual([
      ["h1", "error"],
      ["h2", "warning"],
    ]);
  });

  test("wizard preview shows the header row only once (small dataset)", async ({ page }) => {
    await page.goto("/");
    await uploadSample(page, "csv-with-header.csv");
    await openWizard(page);
    await setCheckbox(page, "First row is a header", true);

    expect(await previewHeaders(page)).toEqual(["id", "name", "role", "active"]);

    const rows = await previewRows(page);
    expect.soft(rows, "header line must not be repeated as a data row").not.toContainEqual(["id", "name", "role", "active"]);
    expect.soft(rows).toHaveLength(3);
  });

  test("header isn't duplicated when the wizard is reopened for a second file", async ({ page }) => {
    await page.goto("/");

    // 1st file: open the wizard, tick "use first line as header", dismiss.
    await uploadSample(page, "csv-with-header.csv");
    await openWizard(page);
    await setCheckbox(page, "First row is a header", true);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    // 2nd file, different shape (pipe-delimited).
    await uploadSample(page, "apm-transaction-log.log");
    await openWizard(page);

    // The wizard should be re-initialised for the new dataset: pipe detected, header toggle back off.
    await expect.soft(page.getByRole("dialog").getByRole("radio", { name: "Pipe", exact: true })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect.soft(page.getByRole("dialog").getByRole("checkbox", { name: "First row is a header" })).not.toBeChecked();
    await selectDelimiter(page, "Pipe");
    await setCheckbox(page, "First row is a header", true);

    const header = [
      "timestamp",
      "service",
      "transaction_id",
      "trace_id",
      "duration_ms",
      "status",
      "message",
    ];
    expect.soft(await previewHeaders(page)).toEqual(header);
    const rows = await previewRows(page);
    expect.soft(rows, "header line must not be repeated as a data row").not.toContainEqual(header);
    expect.soft(rows).toHaveLength(4);
  });
});

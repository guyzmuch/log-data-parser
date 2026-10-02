import { expect, test } from "@playwright/test";
import {
  clickColumnAction,
  columnGroup,
  columnSlice,
  configureWizard,
  expectColumnLabels,
  loadWithProfile,
  mainHeaders,
  mainRows,
  openWizard,
  pasteDataset,
  previewRows,
  saveWizard,
  selectDelimiter,
  setCheckbox,
  tableHeaders,
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

    await clickColumnAction(page, 0, "Force as date");
    expect.soft(await mainHeaders(page)).toEqual([...BASE_COLUMNS, "timestamp (ISO)", "timestamp (local time)"]);

    let rows = await mainRows(page);
    expect.soft(columnSlice(rows, 4, 2)[0]).toEqual(["2026-01-15T12:30:00.000Z", "Jan 15, 2026, 12:30:00 PM"]);
    expect.soft(columnSlice(rows, 4, 2)[1]).toEqual(["2026-01-15T12:30:48.137Z", "Jan 15, 2026, 12:30:48 PM"]);

    await columnGroup(page, 0).getByPlaceholder("e.g. Europe/Paris").fill("Europe/Paris");
    await columnGroup(page, 0).getByRole("button", { name: "Add timezone" }).click();
    expect.soft((await mainHeaders(page)).at(-1)).toBe("timestamp (Europe/Paris)");

    rows = await mainRows(page);
    expect.soft(rows[0][6]).toBe("Jan 15, 2026, 1:30:00 PM");
    expect.soft(rows[1][6]).toBe("Jan 15, 2026, 1:30:48 PM");

    // No row is flagged as a parse error.
    await expect.soft(page.getByText("Invalid parse")).toHaveCount(0);
  });

  test("JSON parsing on the payload column", async ({ page }) => {
    await loadWithProfile(page, FILE, CHOICES);

    await clickColumnAction(page, 2, "Force as JSON");
    expect.soft(await mainHeaders(page)).toEqual([...BASE_COLUMNS, "payload.user", "payload.action", "payload.count"]);

    const rows = await mainRows(page);
    const json = columnSlice(rows, 4, 3);
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
    // Quotes stripped, but the backslash escapes inside are still there (that's what "Strip escapes" is for).
    expect.soft(rows[0]).toEqual([
      "1768480200",
      "host-01",
      '{\\"user\\":\\"alice\\",\\"action\\":\\"login\\",\\"count\\":3}',
      "error",
    ]);
  });

  test("date parsing on an epoch-seconds timestamp column", async ({ page }) => {
    await loadWithProfile(page, FILE, CHOICES);

    await clickColumnAction(page, 0, "Force as date");
    const rows = await mainRows(page);
    expect.soft(columnSlice(rows, 4, 2)[0]).toEqual(["2026-01-15T12:30:00.000Z", "Jan 15, 2026, 12:30:00 PM"]);
    expect.soft(columnSlice(rows, 4, 2)[7]).toEqual(["2026-01-15T12:38:38.000Z", "Jan 15, 2026, 12:38:38 PM"]);
    await expect.soft(page.getByText("Invalid parse")).toHaveCount(0);
  });

  test("Strip escapes on the payload column gives readable JSON text", async ({ page }) => {
    await loadWithProfile(page, FILE, CHOICES);

    await clickColumnAction(page, 2, "Strip escapes");
    expect.soft((await mainHeaders(page)).at(-1)).toBe("payload (unescaped)");

    const rows = await mainRows(page);
    expect.soft(rows[0][4]).toBe('{"user":"alice","action":"login","count":3}');
    expect.soft(rows[7][4]).toBe('{"user":"heidi","action":"search","count":42}');
  });

  // Interpretation, not a confirmed requirement: a stringified-JSON column is only useful if the
  // user can still pull its keys out. Today "Force as JSON" runs on the base column (still escaped,
  // so JSON.parse fails) and Derived Fields can't be chained (unescape -> JSON).
  test("JSON parsing works on the stringified payload column", async ({ page }) => {
    await loadWithProfile(page, FILE, CHOICES);

    await clickColumnAction(page, 2, "Force as JSON");
    expect.soft(await mainHeaders(page)).toEqual([...BASE_COLUMNS, "payload.user", "payload.action", "payload.count"]);

    const rows = await mainRows(page);
    expect.soft(columnSlice(rows, 4, 3)[0]).toEqual(["alice", "login", "3"]);
  });
});

// ---------------------------------------------------------------------------
// Escapes on clean (unpadded) pasted data — isolates Strip escapes from the padding/quote issues.
// ---------------------------------------------------------------------------
test("Strip escapes decodes \\\" and \\\\ in a pasted column", async ({ page }) => {
  await page.goto("/");
  await pasteDataset(page, ["id|message", '1|He said \\"hi\\"', "2|path C:\\\\temp\\\\file"].join("\n"));
  await openWizard(page);
  await configureWizard(page, { delimiter: "Pipe", header: true });
  await saveWizard(page);

  await clickColumnAction(page, 1, "Strip escapes");
  const rows = await mainRows(page);
  expect.soft(rows[0][2]).toBe('He said "hi"');
  expect.soft(rows[1][2]).toBe("path C:\\temp\\file");
});

// ---------------------------------------------------------------------------
// Known bugs (written to FAIL until fixed)
// ---------------------------------------------------------------------------
test.describe("known bugs", () => {
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

    const dialogTable = page.getByRole("dialog").locator("table");
    expect(await tableHeaders(dialogTable)).toEqual(["id", "name", "role", "active"]);

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

    // The wizard should be re-initialised for the new dataset: pipe detected...
    await expect.soft(page.getByRole("dialog").getByRole("combobox")).toHaveText(/Pipe/);
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
    expect.soft(await tableHeaders(page.getByRole("dialog").locator("table"))).toEqual(header);
    const rows = await previewRows(page);
    expect.soft(rows, "header line must not be repeated as a data row").not.toContainEqual(header);
    expect.soft(rows).toHaveLength(4);
  });
});

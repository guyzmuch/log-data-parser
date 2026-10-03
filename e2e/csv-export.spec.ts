import { expect, test } from "@playwright/test";
import {
  chooseExportScope,
  clickColumnAction,
  exportCsvLines,
  hideRows,
  loadWithProfile,
  renameColumn,
  searchFor,
  type WizardChoices,
} from "./helpers";

test.use({ locale: "en-US", timezoneId: "UTC" });

const CHOICES: WizardChoices = { delimiter: "Pipe", header: true, stripQuotes: true };

/** First cell (the host) of each exported data row. */
const hostsOf = (lines: string[]) => lines.slice(1).map((line) => line.split(",")[1]);

test.describe("CSV export scopes", () => {
  test("'All records' keeps hidden rows, 'Excluding hidden' drops them", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
    await hideRows(page, [0, 1]);

    expect(hostsOf(await exportCsvLines(page))).toHaveLength(8);

    await chooseExportScope(page, "Excluding hidden");
    expect(hostsOf(await exportCsvLines(page))).toEqual(["host-03", "host-04", "host-05", "host-06", "host-07", "host-08"]);
  });

  test("'Matching filter' exports only the rows the Filter search keeps", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
    await searchFor(page, "error", "Filter");

    await chooseExportScope(page, "Matching filter");
    const lines = await exportCsvLines(page);
    expect(hostsOf(lines)).toEqual(["host-01", "host-02", "host-04", "host-06"]);
    expect(lines[0]).toBe("timestamp,host,payload,level");
  });

  test("'Matching filter' without an active Filter exports everything, and says so", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
    await chooseExportScope(page, "Matching filter");

    // No search at all, then a Highlight-mode search: neither narrows the export.
    expect(hostsOf(await exportCsvLines(page))).toHaveLength(8);
    await searchFor(page, "error", "Highlight");
    expect(hostsOf(await exportCsvLines(page))).toHaveLength(8);

    await page.getByRole("button", { name: "Export scope" }).click();
    await expect(page.getByRole("menuitemradio", { name: /Matching filter/ })).toContainText("no filter: all");
  });

  test("the scope and the Filter combine with hidden rows", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
    await hideRows(page, [0]); // host-01 is an "error" row
    await searchFor(page, "error", "Filter");

    await chooseExportScope(page, "Matching filter");
    // Matching filter looks at the search only, so the hidden error row is still exported...
    expect(hostsOf(await exportCsvLines(page))).toEqual(["host-01", "host-02", "host-04", "host-06"]);
    // ...while "Excluding hidden" ignores the search.
    await chooseExportScope(page, "Excluding hidden");
    expect(hostsOf(await exportCsvLines(page))).toHaveLength(7);
  });
});

test.describe("CSV export columns", () => {
  test("the header and columns follow what is shown: order, hidden columns and renamed labels", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);

    await clickColumnAction(page, 2, "Hide column"); // payload
    await clickColumnAction(page, 2, "Move left"); // level: timestamp, level, host
    await renameColumn(page, 2, "Host name");

    const lines = await exportCsvLines(page);
    expect(lines[0]).toBe("timestamp,level,Host name");
    expect(lines[1]).toBe("2026-01-15T12:30:00.000Z,error,host-01");
    expect(lines).toHaveLength(9);
  });
});

test.describe("CSV export of a padded, quoted pipe file", () => {
  test("header and cells are trimmed and unquoted (no padding leaks into the file)", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);

    const lines = await exportCsvLines(page);
    expect.soft(lines).toHaveLength(9); // header + 8 rows
    expect.soft(lines[0]).toBe("timestamp,host,payload,level");
    // The JSON cell contains commas and quotes, so it is quoted with doubled quotes (RFC 4180).
    expect.soft(lines[1]).toBe(
      '2026-01-15T12:30:00.000Z,host-01,"{""user"":""alice"",""action"":""login"",""count"":3}",error',
    );
    expect.soft(lines[8]).toBe(
      '2026-01-15T12:36:18.959Z,host-08,"{""user"":""heidi"",""action"":""search"",""count"":42}",debug',
    );
    for (const line of lines) {
      expect.soft(line, "no line starts or ends with a blank").toBe(line.trim());
    }
  });

  test("derived columns are exported with clean names and values", async ({ page }) => {
    await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
    await clickColumnAction(page, 2, "Extract JSON keys");
    await clickColumnAction(page, 0, "Parse as date");

    const lines = await exportCsvLines(page);
    const header = lines[0].split(",");
    // Each derived group sits where its (now hidden) source was.
    expect.soft(header.slice(0, 2)).toEqual(["timestamp (ISO)", "timestamp (local time)"]);
    expect.soft(header.slice(2)).toEqual(["host", "payload.user", "payload.action", "payload.count", "level"]);
    // Local time is "Jan 15, 2026, 12:30:00 PM" — it contains a comma, so it is quoted.
    expect.soft(lines[1]).toBe('2026-01-15T12:30:00.000Z,"Jan 15, 2026, 12:30:00 PM",host-01,alice,login,3,error');
  });

  test("the stringified file exports readable data after Strip escape characters", async ({ page }) => {
    await loadWithProfile(page, "json-cell-stringified-pipe.log", CHOICES);
    await clickColumnAction(page, 2, "Strip escape characters");

    const lines = await exportCsvLines(page);
    expect.soft(lines[0]).toBe("timestamp,host,payload (unescaped),level");
    expect.soft(lines[1]).toBe('1768480200,host-01,"{""user"":""alice"",""action"":""login"",""count"":3}",error');
  });
});

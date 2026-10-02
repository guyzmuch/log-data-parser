import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { clickColumnAction, loadWithProfile, type WizardChoices } from "./helpers";

test.use({ locale: "en-US", timezoneId: "UTC" });

const CHOICES: WizardChoices = { delimiter: "Pipe", header: true, stripQuotes: true };

/** Clicks "Export CSV" and returns the downloaded file's lines (CSV rows are \r\n-separated). */
async function exportCsvLines(page: Page): Promise<string[]> {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export CSV/ }).click();
  const download = await downloadPromise;
  const content = await readFile(await download.path(), "utf8");
  return content.split("\r\n");
}

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
    await clickColumnAction(page, 2, "Force as JSON");
    await clickColumnAction(page, 0, "Force as date");

    const lines = await exportCsvLines(page);
    const header = lines[0].split(",");
    expect.soft(header.slice(0, 4)).toEqual(["timestamp", "host", "payload", "level"]);
    expect.soft(header.slice(4, 7)).toEqual(["payload.user", "payload.action", "payload.count"]);
    expect.soft(header.slice(7)).toEqual(["timestamp (ISO)", "timestamp (local time)"]);
    // Local time is "Jan 15, 2026, 12:30:00 PM" — it contains a comma, so it is quoted.
    expect.soft(lines[1]).toContain(',alice,login,3,2026-01-15T12:30:00.000Z,"Jan 15, 2026, 12:30:00');
  });

  test("the stringified file exports readable data after Strip escapes", async ({ page }) => {
    await loadWithProfile(page, "json-cell-stringified-pipe.log", CHOICES);
    await clickColumnAction(page, 2, "Strip escapes");

    const lines = await exportCsvLines(page);
    expect.soft(lines[0]).toBe("timestamp,host,payload,level,payload (unescaped)");
    expect.soft(lines[1]).toBe(
      '1768480200,host-01,"{\\""user\\"":\\""alice\\"",\\""action\\"":\\""login\\"",\\""count\\"":3}",error,' +
        '"{""user"":""alice"",""action"":""login"",""count"":3}"',
    );
  });
});

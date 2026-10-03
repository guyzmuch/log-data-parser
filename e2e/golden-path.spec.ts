import { expect, test } from "@playwright/test";
import {
  chooseExportScope,
  clickColumnAction,
  exportCsvLines,
  hideRows,
  mainHeaders,
  mainRows,
  pasteDataset,
  previewHeaders,
  saveWizard,
  searchFor,
  setCheckbox,
} from "./helpers";

test.use({ locale: "en-US", timezoneId: "UTC" });

// One bad timestamp on purpose: it must show "Invalid parse" once the column is parsed as a date.
const DATA = [
  "timestamp,user,action,status",
  "2026-01-15T12:30:00Z,alice,login,ok",
  "2026-01-15T12:31:00Z,bob,upload,error",
  "not-a-date,carol,delete,ok",
  "2026-01-15T12:33:00Z,dave,login,error",
  "2026-01-15T12:34:00Z,erin,logout,ok",
].join("\n");

const BASE_HEADERS = ["timestamp", "user", "action", "status"];
const USERS = ["alice", "bob", "carol", "dave", "erin"];

test("golden path: paste, split, derive, search, hide, export", async ({ page }) => {
  await test.step("paste a small log", async () => {
    await page.goto("/");
    await pasteDataset(page, DATA);
    await expect(page.locator("header")).toContainText("Pasted text");
    await expect(page.locator("header")).toContainText("6 lines");
  });

  await test.step("the wizard detects the delimiter and previews the columns", async () => {
    await page.getByRole("button", { name: /^New profile/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("radio", { name: "Comma", exact: true })).toHaveAttribute("aria-checked", "true");
    await expect(dialog).toContainText("Auto-detected: comma");

    // Without "first row is a header" the first line is data and the columns are generic.
    expect(await previewHeaders(page)).toEqual(["Field 1", "Field 2", "Field 3", "Field 4"]);
    await setCheckbox(page, "First row is a header", true);
    expect(await previewHeaders(page)).toEqual(BASE_HEADERS);

    await dialog.getByRole("textbox").first().fill("Golden path");
    await saveWizard(page);
  });

  await test.step("the table shows the expected columns and rows", async () => {
    expect(await mainHeaders(page)).toEqual(BASE_HEADERS);
    const rows = await mainRows(page);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual(["2026-01-15T12:30:00Z", "alice", "login", "ok"]);
    expect(rows.map((row) => row[1])).toEqual(USERS);
  });

  const originalRows = await mainRows(page);

  await test.step("hide a column, then show it again: its place and the data are untouched", async () => {
    await clickColumnAction(page, 2, "Hide column"); // action
    expect(await mainHeaders(page)).toEqual(["timestamp", "user", "status"]);

    await page.getByRole("button", { name: /^Columns/ }).click();
    await page.getByRole("button", { name: "Show column action" }).click();
    await page.keyboard.press("Escape");

    expect(await mainHeaders(page)).toEqual(BASE_HEADERS);
    expect(await mainRows(page)).toEqual(originalRows);
  });

  await test.step("parse the timestamp column as a date; the bad value is flagged", async () => {
    await clickColumnAction(page, 0, "Parse as date");
    expect(await mainHeaders(page)).toEqual([...BASE_HEADERS, "timestamp (ISO)", "timestamp (local time)"]);

    const rows = await mainRows(page);
    expect(rows[0][4]).toBe("2026-01-15T12:30:00.000Z");
    expect(rows[1][4]).toBe("2026-01-15T12:31:00.000Z");
    expect(rows[2].slice(4)).toEqual(["Invalid parse", "Invalid parse"]);
    expect(rows[3][4]).toBe("2026-01-15T12:33:00.000Z");
    await expect(page.getByText("Invalid parse")).toHaveCount(2);
  });

  await test.step("search: Highlight keeps the rows, Filter narrows them", async () => {
    await searchFor(page, "login", "Highlight");
    await expect(page.locator("main tbody tr")).toHaveCount(5);
    await expect(page.locator("main mark")).toHaveCount(2);

    await searchFor(page, "login", "Filter");
    expect((await mainRows(page)).map((row) => row[1])).toEqual(["alice", "dave"]);
  });

  await test.step("select rows and hide them", async () => {
    await searchFor(page, "", "Filter");
    await hideRows(page, [0, 1]); // alice and bob
    expect((await mainRows(page)).map((row) => row[1])).toEqual(["carol", "dave", "erin"]);
    await expect(page.getByText("2 rows hidden")).toBeVisible();
  });

  await test.step("export with each scope", async () => {
    // All records: hidden rows included, derived columns included, the bad date as its own text.
    const all = await exportCsvLines(page);
    expect(all[0]).toBe("timestamp,user,action,status,timestamp (ISO),timestamp (local time)");
    expect(all).toHaveLength(6);
    expect(all[3].startsWith("not-a-date,carol,delete,ok,Invalid parse,Invalid parse")).toBe(true);

    await chooseExportScope(page, "Excluding hidden");
    const visible = await exportCsvLines(page);
    expect(visible).toHaveLength(4);
    expect(visible.slice(1).map((line) => line.split(",")[1])).toEqual(["carol", "dave", "erin"]);

    // Matching filter follows the Filter search (and ignores which rows are hidden).
    await searchFor(page, "login", "Filter");
    await chooseExportScope(page, "Matching filter");
    const matching = await exportCsvLines(page);
    expect(matching.slice(1).map((line) => line.split(",")[1])).toEqual(["alice", "dave"]);
  });

  await test.step("unhide everything", async () => {
    await searchFor(page, "", "Filter");
    await page.getByRole("button", { name: "Unhide" }).click();
    await expect(page.locator("main tbody tr")).toHaveCount(5);
    await expect(page.getByText(/rows? hidden/)).toHaveCount(0);
  });
});

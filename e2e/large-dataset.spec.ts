import { expect, test, type Page } from "@playwright/test";
import { configureWizard, exportCsvLines, openWizard, saveWizard, searchFor, type WizardChoices } from "./helpers";

test.use({ locale: "en-US", timezoneId: "UTC" });

// The table only renders the rows near the viewport, so a big log must behave like a small one.
const LINES = 30_000;
const CHOICES: WizardChoices = { delimiter: "Pipe", header: true, stripQuotes: true };
const LEVELS = ["info", "info", "info", "warning", "error", "debug"];
const START = Date.parse("2026-01-15T12:00:00Z");

const timestampOf = (i: number) => new Date(START + i * 1500).toISOString();

function bigLog(): Buffer {
  const lines = ["timestamp|host|payload|level"];
  for (let i = 0; i < LINES; i++) {
    lines.push(`${timestampOf(i)}|host-${i % 400}|{"user":"user${i % 97}","count":${i % 50}}|${LEVELS[i % LEVELS.length]}`);
  }
  return Buffer.from(lines.join("\n"));
}

const renderedRows = (page: Page) => page.locator("main table tbody tr:not([data-spacer])");
const scrollBox = (page: Page) => page.locator("main table").locator("xpath=ancestor::div[contains(@class,'overflow-auto')][1]");

async function scrollTo(page: Page, rowFromTop: number) {
  await scrollBox(page).evaluate((box, top) => (box.scrollTop = top), rowFromTop * 36);
}

async function loadBigLog(page: Page) {
  await page.goto("/");
  await page.locator('input[type="file"][accept=".csv,.tsv,.log,.txt"]').setInputFiles({
    name: "big.log",
    mimeType: "text/plain",
    buffer: bigLog(),
  });
  await expect(page.getByRole("heading", { name: "Choose how to split this data" })).toBeVisible();
  await expect(page.locator("header")).toContainText(`${LINES + 1} lines`);
  await openWizard(page);
  await configureWizard(page, CHOICES);
  await saveWizard(page);
  await expect(renderedRows(page).first()).toBeVisible();
}

test.describe(`a ${LINES.toLocaleString("en-US")}-line log`, () => {
  test("only a window of rows is in the DOM, and the scroll bar still covers all of them", async ({ page }) => {
    await loadBigLog(page);

    const count = await renderedRows(page).count();
    expect(count).toBeGreaterThan(10);
    expect(count).toBeLessThan(120);
    await expect(page.locator("main table")).toHaveAttribute("aria-rowcount", String(LINES + 1));

    // Spacer rows make the scrollable height the real list height: 30,000 rows of 36px.
    const scrollHeight = await scrollBox(page).evaluate((box) => box.scrollHeight);
    expect(scrollHeight).toBeGreaterThan(LINES * 36);
    expect(scrollHeight).toBeLessThan(LINES * 36 + 200); // plus the header and borders
  });

  test("scrolling to the middle and to the end shows the right rows", async ({ page }) => {
    await loadBigLog(page);
    const firstCell = (row: number) => renderedRows(page).nth(row).locator("td").nth(1);

    await expect(firstCell(0)).toHaveText(timestampOf(0));

    await scrollTo(page, 15_000);
    const ordinals = () => renderedRows(page).locator("td:first-child span.tabular-nums").allTextContents();
    await expect.poll(async () => (await ordinals()).includes("15001")).toBe(true);
    // Each rendered row carries the data of its own position.
    await expect(renderedRows(page).filter({ hasText: timestampOf(15_000) })).toHaveCount(1);

    await scrollBox(page).evaluate((box) => (box.scrollTop = box.scrollHeight));
    await expect(renderedRows(page).last().locator("td").nth(1)).toHaveText(timestampOf(LINES - 1));
    await expect(renderedRows(page).last()).toContainText(String(LINES));
    expect(await renderedRows(page).count()).toBeLessThan(120);
  });

  test("columns keep their width while scrolling", async ({ page }) => {
    await loadBigLog(page);
    const widths = () => page.locator("main thead th").evaluateAll((ths) => ths.map((th) => Math.round(th.getBoundingClientRect().width)));
    const before = await widths();

    await scrollTo(page, 12_345);
    await expect(renderedRows(page).filter({ hasText: timestampOf(12_345) })).toHaveCount(1);
    expect(await widths()).toEqual(before);
  });

  test("select all, shift-click ranges and hiding work on every row, not just the rendered ones", async ({ page }) => {
    await loadBigLog(page);

    await page.getByRole("checkbox", { name: "Select all visible rows" }).click();
    await expect(page.getByText(`${LINES} selected`)).toBeVisible();
    await page.getByRole("button", { name: "Clear" }).click();

    // A shift-click range from the first row to the last one, which is far outside the DOM window.
    await renderedRows(page).first().getByRole("checkbox").click();
    await scrollBox(page).evaluate((box) => (box.scrollTop = box.scrollHeight));
    await renderedRows(page).last().getByRole("checkbox").click({ modifiers: ["Shift"] });
    await expect(page.getByText(`${LINES} selected`)).toBeVisible();

    await page.getByRole("button", { name: "Hide selected" }).click();
    await expect(page.getByText("All records are hidden.")).toBeVisible();
    await page.getByRole("button", { name: "Unhide" }).click();
    await expect(renderedRows(page).first()).toBeVisible();
    await expect(page.locator("main table")).toHaveAttribute("aria-rowcount", String(LINES + 1));
  });

  test("Filter narrows the list and brings the view back to a valid window", async ({ page }) => {
    await loadBigLog(page);
    await scrollTo(page, 20_000);
    await expect(renderedRows(page).filter({ hasText: timestampOf(20_000) })).toHaveCount(1);

    await searchFor(page, "error", "Filter");
    // One row in six is an error: 5,000 of 30,000. The old scroll position is now past the end of the list.
    await expect(page.locator("main table")).toHaveAttribute("aria-rowcount", String(LINES / 6 + 1));
    await expect(renderedRows(page).first()).toBeVisible();
    expect(await renderedRows(page).count()).toBeLessThan(120);

    await scrollBox(page).evaluate((box) => (box.scrollTop = box.scrollHeight));
    await expect(renderedRows(page).last()).toContainText("error");
  });

  test("Highlight marks only the rows in the window, and Parse as date still reaches every row", async ({ page }) => {
    await loadBigLog(page);
    await searchFor(page, "host-1", "Highlight");
    expect(await page.locator("main mark").count()).toBeLessThan(120);
    await searchFor(page, "", "Highlight");

    await page.locator("main thead th").nth(1).getByRole("button", { name: /Column options/ }).click();
    await page.getByRole("menuitem", { name: /Parse as date/ }).click();
    await scrollBox(page).evaluate((box) => (box.scrollTop = box.scrollHeight));
    await expect(renderedRows(page).last().locator("td").nth(1)).toHaveText(timestampOf(LINES - 1));
  });

  test("export writes every row, rendered or not", async ({ page }) => {
    await loadBigLog(page);
    const lines = await exportCsvLines(page);
    expect(lines).toHaveLength(LINES + 1);
    expect(lines[0]).toBe("timestamp,host,payload,level");
    expect(lines.at(-1)?.startsWith(timestampOf(LINES - 1))).toBe(true);
  });
});

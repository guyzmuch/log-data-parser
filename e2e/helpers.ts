import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";

const SAMPLES_DIR = path.join(process.cwd(), "public", "samples");
const FILE_INPUT = 'input[type="file"][accept=".csv,.tsv,.log,.txt"]';

export type DelimiterLabel = "Comma" | "Tab" | "Pipe" | "Semicolon" | "Space";

export interface WizardChoices {
  delimiter: DelimiterLabel;
  header?: boolean;
  stripQuotes?: boolean;
  /** Defaults to the value of stripQuotes. */
  trimCells?: boolean;
}

/** Whitespace-collapsed text: rendered HTML hides padding, and Intl may emit narrow no-break spaces. */
export const norm = (text: string) => text.replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------
// Loading a Dataset and a Profile
// ---------------------------------------------------------------------------

/** The empty state is where files and pasted text go in; from a loaded Dataset, "Replace…" leads back to it. */
async function ensureEmptyState(page: Page) {
  if ((await page.locator(FILE_INPUT).count()) === 0) {
    await page.getByRole("button", { name: "Replace…" }).click();
  }
}

async function waitForProfileChoice(page: Page) {
  await expect(page.getByRole("heading", { name: "Choose how to split this data" })).toBeVisible();
}

export async function uploadSample(page: Page, fileName: string) {
  await ensureEmptyState(page);
  await page.locator(FILE_INPUT).setInputFiles(path.join(SAMPLES_DIR, fileName));
  await waitForProfileChoice(page);
}

export async function pasteDataset(page: Page, text: string) {
  await ensureEmptyState(page);
  await page.locator("textarea").fill(text);
  await page.getByRole("button", { name: "Parse pasted data" }).click();
  await waitForProfileChoice(page);
}

/** Opens the Profile wizard on a new profile, from the chooser if it's showing, else from the profile menu. */
export async function openWizard(page: Page) {
  const fromChooser = page.getByRole("button", { name: /^New profile/ });
  if (await fromChooser.isVisible()) {
    await fromChooser.click();
  } else {
    await page.getByRole("button", { name: /^Profile/ }).click();
    await page.getByRole("menuitem", { name: /New profile/ }).click();
  }
  await expect(page.getByRole("dialog")).toBeVisible();
}

export async function setCheckbox(page: Page, name: string, checked: boolean) {
  const box = page.getByRole("dialog").getByRole("checkbox", { name });
  if (checked) await box.check();
  else await box.uncheck();
}

export async function selectDelimiter(page: Page, label: DelimiterLabel) {
  await page.getByRole("dialog").getByRole("radio", { name: label, exact: true }).click();
}

export async function configureWizard(page: Page, choices: WizardChoices) {
  await selectDelimiter(page, choices.delimiter);
  await setCheckbox(page, "First row is a header", choices.header ?? false);
  // Trimming is on by default in the wizard; tests ask for it explicitly, tied to stripQuotes unless said otherwise.
  await setCheckbox(page, "Trim cells", choices.trimCells ?? choices.stripQuotes ?? false);
  // "Strip surrounding quotes" isn't offered when CSV quoting rules are on (the parser already removes them).
  const quotes = page.getByRole("dialog").getByRole("checkbox", { name: "Strip surrounding quotes" });
  if ((await quotes.count()) > 0) await setCheckbox(page, "Strip surrounding quotes", choices.stripQuotes ?? false);
}

export async function saveWizard(page: Page) {
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

/** Upload → wizard → save, the common start of every flow. */
export async function loadWithProfile(page: Page, fileName: string, choices: WizardChoices) {
  await page.goto("/");
  await uploadSample(page, fileName);
  await openWizard(page);
  await configureWizard(page, choices);
  await saveWizard(page);
}

/** Paste → wizard → save. */
export async function pasteWithProfile(page: Page, text: string, choices: WizardChoices) {
  await page.goto("/");
  await pasteDataset(page, text);
  await openWizard(page);
  await configureWizard(page, choices);
  await saveWizard(page);
}

/** Applies an existing profile by name: from the chooser when it's showing, else from the profile menu. */
export async function chooseProfile(page: Page, name: string) {
  const fromChooser = page.getByRole("button", { name, exact: true });
  if (await fromChooser.isVisible()) {
    await fromChooser.click();
  } else {
    await page.getByRole("button", { name: /^Profile/ }).click();
    await page.getByRole("menuitemradio", { name, exact: true }).click();
  }
}

// ---------------------------------------------------------------------------
// Reading the tables
// ---------------------------------------------------------------------------

/** Wizard preview: first header/cell is the "#" column, so it's dropped. */
export async function previewHeaders(page: Page): Promise<string[]> {
  const headers = await page.getByRole("dialog").locator("table thead th").allTextContents();
  return headers.map(norm).slice(1);
}

export async function previewRows(page: Page): Promise<string[][]> {
  const rows = page.getByRole("dialog").locator("table tbody tr");
  const count = await rows.count();
  const result: string[][] = [];
  for (let i = 0; i < count; i++) {
    result.push((await rows.nth(i).locator("td").allTextContents()).map(norm).slice(1));
  }
  return result;
}

/** The i-th column header of the main table (0 = first data column, after the row-select/# cell). */
export function headerCell(page: Page, index: number): Locator {
  return page.locator("main thead th").nth(index + 1);
}

/** Main data table column names, read from each header's label (not its hints, caption or menu). */
export async function mainHeaders(page: Page): Promise<string[]> {
  const labels = await page.locator('main thead th [data-testid="column-label"]').evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-label") ?? ""),
  );
  return labels.map(norm);
}

/**
 * Main data table, as many rows as are rendered (the table is windowed, so a long list renders only the
 * rows near the viewport). The first cell of each row is the row-select checkbox and "#", so it's dropped;
 * the empty filler cell and the spacer rows are not data.
 */
export async function mainRows(page: Page): Promise<string[][]> {
  const rows = page.locator("main table tbody tr:not([data-spacer]):not([data-extra])");
  const count = await rows.count();
  const result: string[][] = [];
  for (let i = 0; i < count; i++) {
    result.push((await rows.nth(i).locator('td:not([aria-hidden="true"]):not([data-comment])').allTextContents()).map(norm).slice(1));
  }
  return result;
}

/** Values of columns [from, from+count) for every row. */
export function columnSlice(rows: string[][], from: number, count: number): string[][] {
  return rows.map((row) => row.slice(from, from + count));
}

// ---------------------------------------------------------------------------
// Column headers: labels, hints, and the per-column menu
// ---------------------------------------------------------------------------

/** Column labels exactly as stored (the attribute keeps any padding that HTML rendering would collapse). */
export async function expectColumnLabels(page: Page, labels: string[]) {
  for (const [i, label] of labels.entries()) {
    await expect
      .soft(headerCell(page, i).getByTestId("column-label"), `column label #${i + 1}`)
      .toHaveAttribute("data-label", label);
  }
}

/**
 * The detection chips on a column header ("date", "JSON", "escaped chars"), in order.
 * An empty list means no chip is rendered at all.
 */
export async function expectDetected(page: Page, columnIndex: number, labels: string[]) {
  const hints = headerCell(page, columnIndex).getByTestId("detected-hint");
  const name = `detected hints of column #${columnIndex + 1}`;
  if (labels.length === 0) {
    await expect.soft(hints, name).toHaveCount(0);
  } else {
    await expect.soft(hints, name).toHaveText(labels);
  }
}

async function openColumnMenu(page: Page, columnIndex: number) {
  await headerCell(page, columnIndex).getByRole("button", { name: /Column options/ }).click();
}

/** Clicks an item in a column's header menu: "Parse as date", "Extract JSON keys", "Strip escape characters", … */
export async function clickColumnAction(page: Page, columnIndex: number, action: string) {
  await openColumnMenu(page, columnIndex);
  await page.getByRole("menuitem", { name: action }).click();
}

export async function renameColumn(page: Page, columnIndex: number, label: string) {
  await clickColumnAction(page, columnIndex, "Rename column");
  const input = headerCell(page, columnIndex).getByRole("textbox", { name: "Column name" });
  await input.fill(label);
  await input.press("Enter");
}

/** Opens the "Add timezone" dialog for a date column and submits `timezone` (the dialog stays open on an error). */
export async function addTimezone(page: Page, columnIndex: number, timezone: string) {
  await clickColumnAction(page, columnIndex, "Add timezone");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Timezone" }).fill(timezone);
  await dialog.getByRole("button", { name: "Add timezone" }).click();
}

// ---------------------------------------------------------------------------
// Search, row selection, export and downloads
// ---------------------------------------------------------------------------

/** Types a search and picks Highlight or Filter mode. An empty term clears the search. */
export async function searchFor(page: Page, term: string, mode: "Highlight" | "Filter" = "Highlight") {
  await page.getByPlaceholder("Search visible columns…").fill(term);
  await page.getByRole("radio", { name: mode }).click();
}

/** Selects the rows at these positions among the rendered rows (0 = first shown row) and hides them. */
export async function hideRows(page: Page, positions: number[]) {
  const checkboxes = page.getByRole("checkbox", { name: /^Select row/ });
  for (const position of positions) await checkboxes.nth(position).click();
  await page.getByRole("button", { name: "Hide selected" }).click();
}

export async function chooseExportScope(page: Page, label: "All records" | "Excluding hidden" | "Matching filter") {
  await page.getByRole("button", { name: "Export scope" }).click();
  await page.getByRole("menuitemradio", { name: new RegExp(label) }).click();
}

/** Runs `trigger` (which must start a download) and returns the downloaded file's text. */
export async function captureDownload(page: Page, trigger: () => Promise<void>): Promise<string> {
  const downloadPromise = page.waitForEvent("download");
  await trigger();
  const download = await downloadPromise;
  return readFile(await download.path(), "utf8");
}

/** Clicks "Export CSV" and returns the downloaded file's lines (CSV rows are \r\n-separated). */
export async function exportCsvLines(page: Page): Promise<string[]> {
  const content = await captureDownload(page, () => page.getByRole("button", { name: /^Export CSV/ }).click());
  return content.split("\r\n");
}

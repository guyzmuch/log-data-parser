import path from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";

const SAMPLES_DIR = path.join(process.cwd(), "public", "samples");
const FILE_INPUT = 'input[type="file"][accept=".csv,.tsv,.log,.txt"]';

export type DelimiterLabel = "Comma" | "Tab" | "Pipe" | "Semicolon" | "Space";

export interface WizardChoices {
  delimiter: DelimiterLabel;
  header?: boolean;
  stripQuotes?: boolean;
}

/** Whitespace-collapsed text: rendered HTML hides padding, and Intl may emit narrow no-break spaces. */
export const norm = (text: string) => text.replace(/\s+/g, " ").trim();

export async function uploadSample(page: Page, fileName: string) {
  await page.locator(FILE_INPUT).setInputFiles(path.join(SAMPLES_DIR, fileName));
  await expect(page.getByRole("button", { name: /New profile/ })).toBeVisible();
}

export async function pasteDataset(page: Page, text: string) {
  await page.locator("textarea").fill(text);
  await page.getByRole("button", { name: "Parse pasted data" }).click();
  await expect(page.getByRole("button", { name: /New profile/ })).toBeVisible();
}

export async function openWizard(page: Page) {
  await page.getByRole("button", { name: /New profile/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

export async function setCheckbox(page: Page, name: string, checked: boolean) {
  const box = page.getByRole("dialog").getByRole("checkbox", { name });
  if (checked) await box.check();
  else await box.uncheck();
}

export async function selectDelimiter(page: Page, label: DelimiterLabel) {
  await page.getByRole("dialog").getByRole("combobox").click();
  await page.getByRole("option", { name: new RegExp(label) }).click();
}

export async function configureWizard(page: Page, choices: WizardChoices) {
  await selectDelimiter(page, choices.delimiter);
  await setCheckbox(page, "First row is a header", choices.header ?? false);
  await setCheckbox(page, "Strip surrounding quotes", choices.stripQuotes ?? false);
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

export async function tableHeaders(table: Locator): Promise<string[]> {
  return (await table.locator("thead th").allTextContents()).map(norm);
}

/** Main data table: first header/cell is the row-select checkbox, so it's dropped. */
export async function mainHeaders(page: Page): Promise<string[]> {
  return (await tableHeaders(page.locator("main table"))).slice(1);
}

export async function mainRows(page: Page): Promise<string[][]> {
  const rows = page.locator("main table tbody tr");
  const count = await rows.count();
  const result: string[][] = [];
  for (let i = 0; i < count; i++) {
    result.push((await rows.nth(i).locator("td").allTextContents()).map(norm).slice(1));
  }
  return result;
}

export async function previewRows(page: Page): Promise<string[][]> {
  const rows = page.getByRole("dialog").locator("table tbody tr");
  const count = await rows.count();
  const result: string[][] = [];
  for (let i = 0; i < count; i++) {
    result.push((await rows.nth(i).locator("td").allTextContents()).map(norm));
  }
  return result;
}

/** The i-th base column's block in the "Columns" panel (label input, action buttons, derived rows). */
export function columnGroup(page: Page, index: number): Locator {
  return page.getByText("Columns", { exact: true }).locator("xpath=..").locator("xpath=./div").nth(index);
}

/** Column i's label as typed in the Columns panel (an <input>, so padding is NOT collapsed). */
export async function expectColumnLabels(page: Page, labels: string[]) {
  for (const [i, label] of labels.entries()) {
    await expect.soft(columnGroup(page, i).locator("input").first(), `Columns panel label #${i + 1}`).toHaveValue(label);
  }
}

/**
 * The "detected: ..." hint next to a column (labels as shown in ColumnControls:
 * "date", "JSON", "escaped chars", "whitespace padding"). An empty list means no hint is rendered at all.
 */
export async function expectDetected(page: Page, columnIndex: number, labels: string[]) {
  const hint = columnGroup(page, columnIndex).getByText(/^detected:/);
  const name = `"detected" hint of column #${columnIndex + 1}`;
  if (labels.length === 0) {
    await expect.soft(hint, name).toHaveCount(0);
  } else {
    await expect.soft(hint, name).toHaveText(`detected: ${labels.join(", ")}`);
  }
}

export async function clickColumnAction(page: Page, columnIndex: number, action: string) {
  await columnGroup(page, columnIndex).getByRole("button", { name: action, exact: true }).click();
}

/** Values of columns [from, from+count) for every row. */
export function columnSlice(rows: string[][], from: number, count: number): string[][] {
  return rows.map((row) => row.slice(from, from + count));
}

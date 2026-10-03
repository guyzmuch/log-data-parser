import { expect, test } from "@playwright/test";
import {
  chooseProfile,
  exportCsvLines,
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
} from "./helpers";

test.use({ locale: "en-US", timezoneId: "UTC" });

const QUOTED_FILE = "quoted-fields.csv";
const HEADERS = ["id", "name", "note", "amount"];
// Cells as the table shows them (line breaks collapse to a space in rendered text).
const QUOTED_ROWS = [
  ["1", "Smith, John", 'Said "hello" twice', "1200.50"],
  ["2", "Doe, Jane", "Two lines: the second one", "75"],
  ["3", "Plain Person", "no quotes at all", "0"],
  ["4", "Last, First", "", "12"],
];

const quotedFields = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog").getByRole("checkbox", { name: "Quoted fields (CSV rules)" });

test.describe("a .csv file", () => {
  test("starts with CSV quoting rules on, and the preview keeps quoted commas and line breaks in their cells", async ({
    page,
  }) => {
    await page.goto("/");
    await uploadSample(page, QUOTED_FILE);
    await openWizard(page);

    await expect(quotedFields(page)).toBeChecked();
    await setCheckbox(page, "First row is a header", true);
    expect(await previewHeaders(page)).toEqual(HEADERS);
    expect(await previewRows(page)).toEqual(QUOTED_ROWS);
    await expect(page.getByRole("dialog")).toContainText("4 columns");
    await expect(page.getByRole("dialog")).toContainText("sampled rows");
  });

  test("the saved profile reads the whole file the same way, and the table shows it", async ({ page }) => {
    await page.goto("/");
    await uploadSample(page, QUOTED_FILE);
    await openWizard(page);
    await setCheckbox(page, "First row is a header", true);
    await saveWizard(page);

    expect(await mainHeaders(page)).toEqual(HEADERS);
    expect(await mainRows(page)).toEqual(QUOTED_ROWS);
    // The two-line note is one record: five lines in the file, four rows in the table.
    await expect(page.locator("header")).toContainText("6 lines");
    await expect(page.getByRole("checkbox", { name: /^Select row/ })).toHaveCount(4);
  });

  test("with the option off, the same file splits at every comma inside quotes", async ({ page }) => {
    await page.goto("/");
    await uploadSample(page, QUOTED_FILE);
    await openWizard(page);
    await quotedFields(page).uncheck();
    await setCheckbox(page, "First row is a header", true);

    // 4 header names, but the quoted commas add columns: the widest row decides.
    expect((await previewHeaders(page)).length).toBeGreaterThan(4);
    await expect(page.getByRole("dialog")).toContainText("sampled line");
  });

  test("the quote-stripping option is only offered when the parser doesn't already remove the quotes", async ({ page }) => {
    await page.goto("/");
    await uploadSample(page, QUOTED_FILE);
    await openWizard(page);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("checkbox", { name: "Trim cells" })).toBeChecked();
    await expect(dialog.getByRole("checkbox", { name: "Strip surrounding quotes" })).toHaveCount(0);

    await quotedFields(page).uncheck();
    await expect(dialog.getByRole("checkbox", { name: "Strip surrounding quotes" })).toBeVisible();
  });

  test("the built-in CSV profile uses CSV quoting rules too", async ({ page }) => {
    await page.goto("/");
    await uploadSample(page, QUOTED_FILE);
    await chooseProfile(page, "CSV with header (built-in)");

    expect(await mainHeaders(page)).toEqual(HEADERS);
    expect(await mainRows(page)).toEqual(QUOTED_ROWS);
  });

  test("a sample chip loads the quoted-fields file", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /CSV with quoted fields/ }).click();
    await expect(page.locator("header")).toContainText(QUOTED_FILE);
  });
});

test.describe("other sources keep the plain splitter by default", () => {
  test("pasted text has no file name, so the option starts off", async ({ page }) => {
    await page.goto("/");
    await pasteDataset(page, 'a,b\n"x,y",2');
    await openWizard(page);
    await expect(quotedFields(page)).not.toBeChecked();
  });

  test("a .log file starts with the option off, and it can be turned on", async ({ page }) => {
    await page.goto("/");
    await uploadSample(page, "aws-alb-access-log.log");
    await openWizard(page);
    await expect(quotedFields(page)).not.toBeChecked();

    // The quoted request field ("GET https://… HTTP/1.1") is one cell once the rules are on.
    await selectDelimiter(page, "Space");
    const plain = (await previewHeaders(page)).length;
    await quotedFields(page).check();
    expect((await previewHeaders(page)).length).toBeLessThan(plain);
    expect(JSON.stringify(await previewRows(page))).toContain("GET https://");
  });

  test("an old profile (no option saved) stays plain when edited", async ({ page }) => {
    await page.goto("/");
    await uploadSample(page, "csv-with-header.csv");
    await page.getByRole("button", { name: "New profile…" }).click();
    await quotedFields(page).uncheck();
    await setCheckbox(page, "First row is a header", true);
    await saveWizard(page);

    await page.getByRole("button", { name: /Edit parsing/ }).click();
    await expect(quotedFields(page)).not.toBeChecked();
  });

  test("a profile saved with the option on remembers it", async ({ page }) => {
    await page.goto("/");
    await uploadSample(page, QUOTED_FILE);
    await openWizard(page);
    await setCheckbox(page, "First row is a header", true);
    await saveWizard(page);

    await page.getByRole("button", { name: /Edit parsing/ }).click();
    await expect(quotedFields(page)).toBeChecked();
  });
});

test.describe("CSV export", () => {
  test("a quoted file round-trips: exporting it writes the same cells back, quoted where needed", async ({ page }) => {
    await page.goto("/");
    await uploadSample(page, QUOTED_FILE);
    await openWizard(page);
    await setCheckbox(page, "First row is a header", true);
    await setCheckbox(page, "Trim cells", false);
    await saveWizard(page);

    const lines = await exportCsvLines(page);
    expect(lines[0]).toBe("id,name,note,amount");
    expect(lines[1]).toBe('1,"Smith, John","Said ""hello"" twice",1200.50');
    // The note with a line break is one quoted cell: the row ends with \r\n, the break inside the cell is a bare \n.
    expect(lines[2]).toBe('2,"Doe, Jane","Two lines:\nthe second one",75');
    expect(lines[3]).toBe("3,Plain Person,no quotes at all,0");
    // "Trim cells" is off here, so the space inside the quotes in the file is kept as data.
    expect(lines[4]).toBe('4,"Last, First ",,12');
    expect(lines).toHaveLength(5);
  });
});

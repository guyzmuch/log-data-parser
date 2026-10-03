import { expect, test } from "@playwright/test";
import { exportCsvLines, loadWithProfile, mainRows, type WizardChoices } from "./helpers";

test.use({ locale: "en-US", timezoneId: "UTC" });

const CHOICES: WizardChoices = { delimiter: "Pipe", header: true, stripQuotes: true };

// With a header row, the first data record is line 1, and that is the number the row controls carry.
test("the comment column is hidden until the Comments button turns it on, and hiding it keeps the comments", async ({ page }) => {
  await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
  const toggle = page.getByRole("button", { name: /^Comments/ });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("columnheader", { name: "Comment" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /comment on row/ })).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("columnheader", { name: "Comment" })).toBeVisible();
  await page.getByRole("button", { name: "Add comment on row 1" }).click();
  await page.getByRole("textbox", { name: "Comment on row 1" }).fill("kept");
  await page.keyboard.press("Enter");
  await expect(toggle).toContainText("1");

  // Hidden again: no column, but the remark is still there and still exported.
  await toggle.click();
  await expect(page.getByRole("button", { name: /comment on row/ })).toHaveCount(0);
  expect((await exportCsvLines(page))[1]).toMatch(/,kept$/);
  await toggle.click();
  await expect(page.getByRole("button", { name: "Edit comment on row 1" })).toHaveText("kept");
});

test("a remark can be typed on a row, edited, and is exported as an extra column", async ({ page }) => {
  await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
  await page.getByRole("button", { name: /^Comments/ }).click();

  // Typing a comment does not select the row, and the comment column is not part of the data.
  await page.getByRole("button", { name: "Add comment on row 2" }).click();
  await page.getByRole("textbox", { name: "Comment on row 2" }).fill("suspicious login, check with security");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Edit comment on row 2" })).toHaveText("suspicious login, check with security");
  await expect(page.getByText(/selected/)).toHaveCount(0);
  expect((await mainRows(page))[1]).toHaveLength(4);

  // Escape cancels an edit.
  await page.getByRole("button", { name: "Edit comment on row 2" }).click();
  await page.getByRole("textbox", { name: "Comment on row 2" }).fill("changed my mind");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Edit comment on row 2" })).toHaveText("suspicious login, check with security");

  // Leaving the box saves it (here by moving on to another row); a blank comment removes it.
  await page.getByRole("button", { name: "Add comment on row 3" }).click();
  await page.getByRole("textbox", { name: "Comment on row 3" }).fill("second note");
  await page.getByRole("button", { name: "Edit comment on row 2" }).click();
  await expect(page.getByRole("button", { name: "Edit comment on row 3" })).toHaveText("second note");
  await page.getByRole("textbox", { name: "Comment on row 2" }).fill("");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Add comment on row 2" })).toBeVisible();

  await page.getByRole("button", { name: "Add comment on row 1" }).click();
  await page.getByRole("textbox", { name: "Comment on row 1" }).fill("first, with a comma");
  await page.keyboard.press("Enter");

  const lines = await exportCsvLines(page);
  expect(lines[0]).toBe("timestamp,host,payload,level,comment");
  expect(lines[1].endsWith(',"first, with a comma"')).toBe(true);
  expect(lines[2].endsWith(",error")).toBe(false);
  expect(lines[2].endsWith(",")).toBe(true); // no comment: the extra cell is empty
  expect(lines[3].endsWith(",second note")).toBe(true);
});

test("without any comment the export has no comment column", async ({ page }) => {
  await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
  expect((await exportCsvLines(page))[0]).toBe("timestamp,host,payload,level");
});

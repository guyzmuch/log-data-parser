import { expect, test } from "@playwright/test";
import {
  clickColumnAction,
  columnGroup,
  loadWithProfile,
  mainHeaders,
  mainRows,
  openWizard,
  uploadSample,
  type WizardChoices,
} from "./helpers";

test.use({ locale: "en-US", timezoneId: "UTC" });

const CHOICES: WizardChoices = { delimiter: "Pipe", header: true, stripQuotes: true };

test("Edit parsing keeps the labels and Derived Fields already set up on the Profile", async ({ page }) => {
  await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
  await clickColumnAction(page, 0, "Force as date");
  await clickColumnAction(page, 2, "Force as JSON");
  await columnGroup(page, 1).locator("input").first().fill("Host");

  const headersBefore = await mainHeaders(page);
  expect(headersBefore).toContain("Host");
  expect(headersBefore).toContain("timestamp (ISO)");
  expect(headersBefore).toContain("payload.user");

  // Re-open the wizard on the active Profile and just save it (renaming the profile).
  await page.getByRole("button", { name: /Edit parsing/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("textbox").first().fill("Renamed profile");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  expect(await mainHeaders(page)).toEqual(headersBefore);
  expect((await mainRows(page))[0]).toContain("alice");
});

test("Edit parsing keeps a built-in's field names for data without a header row", async ({ page }) => {
  await page.goto("/");
  await uploadSample(page, "linux-syslog.log");
  await page.getByRole("button", { name: "Linux syslog (approximate, built-in)", exact: true }).click();

  const headersBefore = await mainHeaders(page);
  expect(headersBefore.slice(0, 5)).toEqual(["month", "day", "time", "host", "process"]);

  await page.getByRole("button", { name: /Edit parsing/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  expect((await mainHeaders(page)).slice(0, 5)).toEqual(["month", "day", "time", "host", "process"]);
});

test("Save view on a built-in forks a copy instead of duplicating the built-in", async ({ page }) => {
  await page.goto("/");
  await uploadSample(page, "csv-with-header.csv");
  await page.getByRole("button", { name: "CSV with header (built-in)", exact: true }).click();

  await page.getByRole("button", { name: "Save view" }).click();

  // The built-in is still there exactly once, next to a user copy that is now active.
  await expect(page.getByRole("button", { name: "CSV with header (built-in)", exact: true })).toHaveCount(1);
  const copy = page.getByRole("button", { name: "CSV with header (built-in) (copy)", exact: true });
  await expect(copy).toHaveCount(1);

  // It survives a reload (it really is in localStorage under its own id).
  await page.reload();
  await uploadSample(page, "csv-with-header.csv");
  await expect(page.getByRole("button", { name: "CSV with header (built-in) (copy)", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "CSV with header (built-in)", exact: true })).toHaveCount(1);
});

test("an unknown timezone is rejected with a message instead of making every row 'Invalid parse'", async ({ page }) => {
  await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
  await clickColumnAction(page, 0, "Force as date");
  const headersBefore = await mainHeaders(page);

  await columnGroup(page, 0).getByPlaceholder("e.g. Europe/Paris").fill("Paris");
  await columnGroup(page, 0).getByRole("button", { name: "Add timezone" }).click();

  await expect(columnGroup(page, 0).getByText(/not a known timezone/)).toBeVisible();
  expect(await mainHeaders(page)).toEqual(headersBefore);
  await expect(page.getByText("Invalid parse")).toHaveCount(0);

  // Typing again clears the message, and a real zone works.
  await columnGroup(page, 0).getByPlaceholder("e.g. Europe/Paris").fill("Europe/Paris");
  await expect(columnGroup(page, 0).getByText(/not a known timezone/)).toHaveCount(0);
  await columnGroup(page, 0).getByRole("button", { name: "Add timezone" }).click();
  expect((await mainHeaders(page)).at(-1)).toBe("timestamp (Europe/Paris)");
});

test("'Hide selected' only acts on rows the filter currently shows", async ({ page }) => {
  await loadWithProfile(page, "json-cell-pipe.log", CHOICES);
  const rowCheckboxes = page.getByRole("checkbox", { name: /^Select row/ });
  await expect(rowCheckboxes).toHaveCount(8);

  // Select the first three rows, then filter down to a row that isn't one of them.
  for (const i of [0, 1, 2]) await rowCheckboxes.nth(i).click();
  await page.getByPlaceholder("Search visible columns…").fill("host-08");
  await page.getByRole("radio", { name: "Filter" }).click();

  await expect(page.locator("main table tbody tr")).toHaveCount(1);
  const hideButton = page.getByRole("button", { name: /^Hide selected/ });
  await expect(hideButton).toHaveText("Hide selected (0)");
  await expect(hideButton).toBeDisabled();

  // Clearing the filter brings the selection back into view — and now it can be hidden.
  await page.getByPlaceholder("Search visible columns…").fill("");
  await expect(hideButton).toHaveText("Hide selected (3)");
  await hideButton.click();
  await expect(page.locator("main table tbody tr")).toHaveCount(5);
});

test("a new profile's wizard starts with its toggles off, whatever the last profile used", async ({ page }) => {
  await loadWithProfile(page, "json-cell-pipe.log", CHOICES);

  await openWizard(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("checkbox", { name: "First row is a header" })).not.toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "Strip surrounding quotes" })).not.toBeChecked();
});

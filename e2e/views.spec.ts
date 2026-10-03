import { expect, test, type Page } from "@playwright/test";
import { clickColumnAction, configureWizard, mainHeaders, openWizard, saveWizard, uploadSample, type WizardChoices } from "./helpers";

test.use({ locale: "en-US", timezoneId: "UTC" });

const FILE = "json-cell-pipe.log";
const CHOICES: WizardChoices = { delimiter: "Pipe", header: true, stripQuotes: true };

async function createProfile(page: Page) {
  await page.goto("/");
  await uploadSample(page, FILE);
  await openWizard(page);
  await configureWizard(page, CHOICES);
  await page.getByRole("dialog").getByRole("textbox").first().fill("Pipe log");
  await saveWizard(page);
}

async function chooseView(page: Page, name: string) {
  await page.getByRole("button", { name: /^View:/ }).click();
  await page.getByRole("menuitemradio", { name }).click();
}

async function addView(page: Page, name: string) {
  await page.getByRole("button", { name: /^View:/ }).click();
  await page.getByRole("menuitem", { name: "Save as new view…" }).click();
  await page.getByRole("textbox", { name: "View name" }).fill(name);
  await page.getByRole("button", { name: "Add view" }).click();
}

test("a profile keeps several column layouts, switchable and saved with it", async ({ page }) => {
  await createProfile(page);
  const all = await mainHeaders(page);
  await expect(page.getByRole("button", { name: "View: Default" })).toBeVisible();

  await addView(page, "Short");
  await expect(page.getByRole("button", { name: "View: Short" })).toBeVisible();
  await clickColumnAction(page, 1, "Hide column");
  await clickColumnAction(page, 1, "Hide column");
  const short = await mainHeaders(page);
  expect(short).toHaveLength(all.length - 2);

  await chooseView(page, "Default");
  expect(await mainHeaders(page)).toEqual(all);
  await chooseView(page, "Short");
  expect(await mainHeaders(page)).toEqual(short);

  await page.getByRole("button", { name: "Save view" }).click();
  await page.reload();
  await uploadSample(page, FILE);
  await page.getByRole("button", { name: "Pipe log", exact: true }).click();
  await expect(page.getByRole("button", { name: "View: Short" })).toBeVisible();
  expect(await mainHeaders(page)).toEqual(short);
  await chooseView(page, "Default");
  expect(await mainHeaders(page)).toEqual(all);
});

test("a view can be renamed and deleted, but not the last one", async ({ page }) => {
  await createProfile(page);
  await addView(page, "Second");

  await page.getByRole("button", { name: /^View:/ }).click();
  await page.getByRole("menuitem", { name: "Rename this view…" }).click();
  await page.getByRole("textbox", { name: "View name" }).fill("Renamed");
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(page.getByRole("button", { name: "View: Renamed" })).toBeVisible();

  await page.getByRole("button", { name: /^View:/ }).click();
  await page.getByRole("menuitem", { name: "Delete this view" }).click();
  await expect(page.getByRole("button", { name: "View: Default" })).toBeVisible();

  await page.getByRole("button", { name: /^View:/ }).click();
  await expect(page.getByRole("menuitem", { name: "Delete this view" })).toBeDisabled();
});

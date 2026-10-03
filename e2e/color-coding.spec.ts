import { expect, test, type Page } from "@playwright/test";
import {
  clickColumnAction,
  headerCell,
  loadWithProfile,
  mainRows,
  openWizard,
  configureWizard,
  pasteDataset,
  saveWizard,
  uploadSample,
  type WizardChoices,
} from "./helpers";

test.use({ locale: "en-US", timezoneId: "UTC" });

const FILE = "json-cell-pipe.log"; // timestamp | host | payload | level (4 levels in 8 rows)
const CHOICES: WizardChoices = { delimiter: "Pipe", header: true, stripQuotes: true };

const badges = (page: Page) => page.locator("main tbody [data-color-badge]");
const colorOf = (page: Page, text: string) =>
  page.locator("main tbody [data-color-badge]", { hasText: new RegExp(`^${text}$`) }).first().getAttribute("data-color-badge");

async function openMenu(page: Page, columnIndex: number) {
  await headerCell(page, columnIndex).getByRole("button", { name: /Column options/ }).click();
}

test("a column with a few different values is suggested, and color-coding gives each value its own color", async ({ page }) => {
  await loadWithProfile(page, FILE, CHOICES);

  // "level" has 4 different values: it gets the hint chip and the suggested (marked) menu item.
  await expect(headerCell(page, 3).getByTestId("color-hint")).toHaveText("few values");
  await expect(headerCell(page, 3).getByTestId("color-hint")).toHaveAttribute("title", /4 different values/);
  // Columns whose values are all different (timestamps, hosts) are not suggested, even though 8 is under the limit.
  await expect(headerCell(page, 0).getByTestId("color-hint")).toHaveCount(0);
  await expect(headerCell(page, 1).getByTestId("color-hint")).toHaveCount(0);
  await openMenu(page, 3);
  await expect(page.getByRole("menuitem", { name: /Color-code values.*detected/ })).toBeVisible();
  await page.getByRole("menuitem", { name: /Color-code values/ }).click();

  // Every cell of the column is a badge; same text -> same color, different text -> different color.
  await expect(badges(page)).toHaveCount(8);
  const rows = await mainRows(page);
  const levels = rows.map((row) => row[3]);
  expect(new Set(levels).size).toBe(4);
  const error = await colorOf(page, "error");
  const info = await colorOf(page, "info");
  expect(error).not.toBeNull();
  expect(error).not.toBe(info);
  expect(await page.locator("main tbody [data-color-badge]", { hasText: /^error$/ }).evaluateAll((els) => new Set(els.map((e) => e.getAttribute("data-color-badge"))).size)).toBe(1);

  // The badge keeps the text readable and tinted.
  const style = await badges(page).first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(style).not.toBe("rgba(0, 0, 0, 0)");

  // Menu now offers to stop, and the hint chip is gone (it is already on).
  await openMenu(page, 3);
  await expect(page.getByRole("menuitem", { name: "Stop color-coding" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Stop color-coding" }).click();
  await expect(badges(page)).toHaveCount(0);
});

test("a column with too many different values is greyed out, with the reason on hover", async ({ page }) => {
  const lines = ["id|kind", ...Array.from({ length: 20 }, (_, i) => `${i}|k${i % 2}`)];
  await page.goto("/");
  await pasteDataset(page, lines.join("\n"));
  await openWizard(page);
  await configureWizard(page, { delimiter: "Pipe", header: true, stripQuotes: true });
  await saveWizard(page);

  // "id" has 20 different values (more than there are colors): disabled, explained, and no hint chip.
  await expect(headerCell(page, 0).getByTestId("color-hint")).toHaveCount(0);
  await openMenu(page, 0);
  const blocked = page.getByTestId("color-code-blocked");
  await expect(blocked).toHaveAttribute("title", /Too many different values/);
  await expect(blocked.getByRole("menuitem", { name: /Color-code values/ })).toBeDisabled();
  await expect(blocked).toContainText("over 12 values");
  await page.keyboard.press("Escape");

  // "kind" has 2: still available.
  await expect(headerCell(page, 1).getByTestId("color-hint")).toBeVisible();
  await openMenu(page, 1);
  await expect(page.getByTestId("color-code-blocked")).toHaveCount(0);
});

test("the Columns popover shows the same states", async ({ page }) => {
  const lines = ["id|kind", ...Array.from({ length: 20 }, (_, i) => `${i}|k${i % 2}`)];
  await page.goto("/");
  await pasteDataset(page, lines.join("\n"));
  await openWizard(page);
  await configureWizard(page, { delimiter: "Pipe", header: true, stripQuotes: true });
  await saveWizard(page);

  await page.getByRole("button", { name: /^Columns/ }).click();
  await expect(page.getByRole("button", { name: "Color-code values: id" })).toBeDisabled();
  await page.getByRole("button", { name: "Color-code values: kind" }).click();
  await expect(page.getByRole("button", { name: "Stop color-coding: kind" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(badges(page)).toHaveCount(20);
});

test("the same text gets the same color in different columns, and it works on a second line", async ({ page }) => {
  await page.goto("/");
  await pasteDataset(page, ["a|b|c", "GET|GET|x", "POST|POST|y", "GET|PUT|z"].join("\n"));
  await openWizard(page);
  await configureWizard(page, { delimiter: "Pipe", header: true, stripQuotes: true });
  await saveWizard(page);

  await clickColumnAction(page, 0, "Color-code values");
  await clickColumnAction(page, 1, "Color-code values");
  const all = await badges(page).evaluateAll((els) => els.map((e) => [e.textContent, e.getAttribute("data-color-badge")]));
  const colorsOfGet = new Set(all.filter(([text]) => text === "GET").map(([, color]) => color));
  expect(colorsOfGet.size).toBe(1); // 3 GET badges across two columns, one color
  expect(new Set(all.map(([, color]) => color)).size).toBe(3); // GET, POST, PUT all differ

  await clickColumnAction(page, 1, "Show on a second line");
  await expect(page.locator("main tbody tr[data-extra] [data-color-badge]")).toHaveCount(3);
});

test("values with a known meaning keep one color everywhere: ok green, error red, levels and statuses in step", async ({ page }) => {
  await page.goto("/");
  await pasteDataset(
    page,
    [
      "result|level|status",
      "ok|DEBUG|200",
      "fail|INFO|301",
      "success|WARN|404",
      "error|ERROR|500",
      "true|FATAL|204",
      "false|ERROR|503",
    ].join("\n"),
  );
  await openWizard(page);
  await configureWizard(page, { delimiter: "Pipe", header: true, stripQuotes: true });
  await saveWizard(page);
  for (const column of [0, 1, 2]) await clickColumnAction(page, column, "Color-code values");

  const toneOf = async (text: string) =>
    page.locator("main tbody [data-color-badge]", { hasText: new RegExp(`^${text}$`) }).first().getAttribute("data-color-badge");

  // Good and bad outcomes, in any word.
  for (const good of ["ok", "success", "true"]) expect(await toneOf(good)).toBe("green");
  for (const bad of ["fail", "error", "false"]) expect(await toneOf(bad)).toBe("red");
  // Log levels: quiet to severe.
  expect(await toneOf("DEBUG")).toBe("grey");
  expect(await toneOf("INFO")).toBe("blue");
  expect(await toneOf("WARN")).toBe("amber");
  expect(await toneOf("ERROR")).toBe("red");
  expect(await toneOf("FATAL")).toBe("crimson");
  // HTTP statuses follow the same scheme: 2xx green, 3xx blue, 4xx amber, 5xx red.
  expect(await toneOf("200")).toBe("green");
  expect(await toneOf("301")).toBe("blue");
  expect(await toneOf("404")).toBe("amber");
  expect(await toneOf("503")).toBe("red");
});

test("it is part of the view: saved with it, and other views keep their own", async ({ page }) => {
  await loadWithProfile(page, FILE, CHOICES);
  await clickColumnAction(page, 3, "Color-code values");
  await expect(badges(page)).toHaveCount(8);

  await page.getByRole("button", { name: /^View:/ }).click();
  await page.getByRole("menuitem", { name: "Save as new view…" }).click();
  await page.getByRole("textbox", { name: "View name" }).fill("Plain");
  await page.getByRole("button", { name: "Add view" }).click();
  await clickColumnAction(page, 3, "Stop color-coding");
  await expect(badges(page)).toHaveCount(0);

  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await page.reload();
  await uploadSample(page, FILE);
  await page.getByRole("button", { name: "Untitled profile", exact: true }).click();
  await expect(page.getByRole("button", { name: "View: Plain" })).toBeVisible();
  await expect(badges(page)).toHaveCount(0);

  await page.getByRole("button", { name: /^View:/ }).click();
  await page.getByRole("menuitemradio", { name: "Default" }).click();
  await expect(badges(page)).toHaveCount(8);
});

test("search highlight still works inside a badge", async ({ page }) => {
  await loadWithProfile(page, FILE, CHOICES);
  await clickColumnAction(page, 3, "Color-code values");
  await page.getByPlaceholder("Search visible columns…").fill("err");
  await expect(page.locator("main tbody [data-color-badge] mark").first()).toHaveText("err");
});

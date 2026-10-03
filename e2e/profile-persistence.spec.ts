import { expect, test, type Page } from "@playwright/test";
import {
  captureDownload,
  clickColumnAction,
  configureWizard,
  mainHeaders,
  mainRows,
  openWizard,
  renameColumn,
  saveWizard,
  searchFor,
  uploadSample,
  type WizardChoices,
} from "./helpers";

test.use({ locale: "en-US", timezoneId: "UTC" });

const FILE = "json-cell-pipe.log";
const CHOICES: WizardChoices = { delimiter: "Pipe", header: true, stripQuotes: true };
const PROFILE_NAME = "Pipe log";
const IMPORT_INPUT = 'input[type="file"][accept=".json"]';

/** A profile file as the app exports it, for tests that need to hand-craft one. */
function profileFile(profiles: unknown[], schemaVersion: unknown = 1): string {
  return JSON.stringify({ schemaVersion, profiles });
}

function craftedProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "crafted-1",
    name: "Crafted",
    parsing: {
      kind: "delimiter",
      delimiter: ",",
      hasHeaderRow: true,
      stripQuotes: true,
      trimBoundaryPartials: false,
      expectedFieldCount: 4,
    },
    display: { visibleFieldKeys: [], fieldLabels: {}, derivedFieldSelections: [] },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Upload the sample, create a profile through the wizard under `name`, and leave it applied. */
async function createProfile(page: Page, name = PROFILE_NAME) {
  await page.goto("/");
  await uploadSample(page, FILE);
  await openWizard(page);
  await configureWizard(page, CHOICES);
  await page.getByRole("dialog").getByRole("textbox").first().fill(name);
  await saveWizard(page);
}

/** After a reload: load the sample again and pick `name` from the chooser. */
async function reloadAndApply(page: Page, name = PROFILE_NAME) {
  await page.reload();
  await uploadSample(page, FILE);
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.locator("main table")).toBeVisible();
}

async function importProfileFile(page: Page, content: string) {
  await page.locator(IMPORT_INPUT).setInputFiles({
    name: "profiles.json",
    mimeType: "application/json",
    buffer: Buffer.from(content),
  });
}

async function exportProfilesFile(page: Page): Promise<string> {
  return captureDownload(page, async () => {
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Export your profiles" }).click();
  });
}

test.describe("saved profiles survive a reload", () => {
  test("a profile is listed again and reproduces the table", async ({ page }) => {
    await createProfile(page);
    const headers = await mainHeaders(page);
    const rows = await mainRows(page);

    await reloadAndApply(page);
    expect(await mainHeaders(page)).toEqual(headers);
    expect(await mainRows(page)).toEqual(rows);
  });

  test("'Save view' keeps labels, hidden columns, derived columns and the search", async ({ page }) => {
    await createProfile(page);
    await clickColumnAction(page, 0, "Parse as date");
    await renameColumn(page, 1, "Host");
    await clickColumnAction(page, 2, "Hide column"); // payload
    await searchFor(page, "error", "Filter");
    const headers = await mainHeaders(page);
    const rows = await mainRows(page);
    expect(headers).toEqual(["timestamp", "Host", "level", "timestamp (ISO)", "timestamp (local time)"]);
    expect(rows).toHaveLength(4);

    await page.getByRole("button", { name: "Save view" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();

    await reloadAndApply(page);
    expect(await mainHeaders(page)).toEqual(headers);
    expect(await mainRows(page)).toEqual(rows);
    await expect(page.getByPlaceholder("Search visible columns…")).toHaveValue("error");
    await expect(page.getByRole("radio", { name: "Filter" })).toHaveAttribute("aria-checked", "true");
  });

  test("changes that were not saved are gone after a reload", async ({ page }) => {
    await createProfile(page);
    const headers = await mainHeaders(page);

    await clickColumnAction(page, 0, "Parse as date");
    await renameColumn(page, 1, "Host");
    await searchFor(page, "error", "Filter");

    await reloadAndApply(page);
    expect(await mainHeaders(page)).toEqual(headers);
    await expect(page.getByPlaceholder("Search visible columns…")).toHaveValue("");
  });

  test("hidden profiles stay hidden", async ({ page }) => {
    await page.goto("/");
    await uploadSample(page, FILE);
    const builtIn = "CSV with header (built-in)";

    await page.getByRole("button", { name: /^Profile/ }).click();
    await page.getByRole("menuitem", { name: /Manage profiles/ }).click();
    await page.getByRole("button", { name: `Hide ${builtIn}` }).click();
    await page.keyboard.press("Escape");

    await page.reload();
    await uploadSample(page, FILE);
    await expect(page.getByRole("button", { name: builtIn, exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show hidden profiles (1)" })).toBeVisible();
  });
});

test.describe("exporting profiles", () => {
  test("the export holds your saved profiles, including the saved view", async ({ page }) => {
    await createProfile(page);
    await renameColumn(page, 1, "Host");
    await page.getByRole("button", { name: "Save view" }).click();

    const file = JSON.parse(await exportProfilesFile(page));
    expect(file.schemaVersion).toBe(1);
    expect(file.profiles).toHaveLength(1);
    const [profile] = file.profiles;
    expect(profile.name).toBe(PROFILE_NAME);
    expect(profile.parsing).toMatchObject({ kind: "delimiter", delimiter: "|", hasHeaderRow: true, stripQuotes: true });
    expect(profile.display.fieldLabels).toEqual({ host: "Host" });
    expect(profile.display.fieldOrder).toEqual(["timestamp", "host", "payload", "level"]);
    // Built-in profiles are bundled with the app, not exported.
    expect(JSON.stringify(file)).not.toContain("builtin:");
  });

  test("there is nothing to export until a profile has been saved", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("menuitem", { name: "Export your profiles" })).toHaveAttribute("aria-disabled", "true");
  });
});

test.describe("importing profiles", () => {
  test("export, wipe the browser's storage, import: the profile behaves the same", async ({ page }) => {
    await createProfile(page);
    await clickColumnAction(page, 0, "Parse as date");
    await clickColumnAction(page, 2, "Extract JSON keys");
    await page.getByRole("button", { name: "Save view" }).click();
    const headers = await mainHeaders(page);
    const rows = await mainRows(page);
    const exported = await exportProfilesFile(page);

    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await uploadSample(page, FILE);
    await expect(page.getByRole("button", { name: PROFILE_NAME, exact: true })).toHaveCount(0);

    await importProfileFile(page, exported);
    await page.getByRole("button", { name: PROFILE_NAME, exact: true }).click();
    expect(await mainHeaders(page)).toEqual(headers);
    expect(await mainRows(page)).toEqual(rows);

    // And it is saved, not just in memory.
    await reloadAndApply(page);
    expect(await mainHeaders(page)).toEqual(headers);
  });

  test("importing the same file twice doesn't duplicate the profile", async ({ page }) => {
    await createProfile(page);
    const exported = await exportProfilesFile(page);

    await page.reload();
    await uploadSample(page, FILE);
    await importProfileFile(page, exported);
    await importProfileFile(page, exported);
    await expect(page.getByRole("button", { name: PROFILE_NAME, exact: true })).toHaveCount(1);
  });

  test("a profile that carries a built-in's id is saved as a copy", async ({ page }) => {
    await page.goto("/");
    await uploadSample(page, "csv-with-header.csv");
    const builtIn = "CSV with header (built-in)";

    await importProfileFile(page, profileFile([craftedProfile({ id: "builtin:csv-with-header", name: "Mine" })]));
    await expect(page.getByRole("button", { name: "Mine (imported)", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: builtIn, exact: true })).toHaveCount(1);
  });

  test("an out-of-date profile is repaired instead of breaking the page", async ({ page }) => {
    await page.goto("/");
    await uploadSample(page, "csv-with-header.csv");

    await importProfileFile(
      page,
      profileFile([
        craftedProfile({
          display: {
            visibleFieldKeys: ["id", "name", "id (trimmed)", "name (unescaped)"],
            fieldLabels: {},
            derivedFieldSelections: [
              { kind: "trim", sourceFieldKey: "id" }, // a kind that no longer exists
              { kind: "unescape", sourceFieldKey: "name" },
            ],
          },
        }),
      ]),
    );
    await page.getByRole("button", { name: "Crafted", exact: true }).click();

    expect(await mainHeaders(page)).toEqual(["id", "name", "name (unescaped)"]);
    expect(await mainRows(page)).toHaveLength(3);
  });

  test("a profile with an unusable parsing config is refused", async ({ page }) => {
    await page.goto("/");
    await uploadSample(page, "csv-with-header.csv");

    await importProfileFile(page, profileFile([craftedProfile({ parsing: { kind: "regex" } })]));
    await expect(page.locator("header").getByRole("alert")).toHaveText("File does not contain valid Profiles.");
  });

  for (const [label, content, message] of [
    ["not JSON", "this is not json", "File is not valid JSON."],
    ["no schema version", JSON.stringify({ profiles: [craftedProfile()] }), "File is missing a schema version."],
    ["an unsupported version", profileFile([craftedProfile()], 99), "Unsupported Profile file version: 99."],
    ["no profiles in it", profileFile([]), "File does not contain valid Profiles."],
  ] as const) {
    test(`a file that is ${label} shows an error and changes nothing`, async ({ page }) => {
      await page.goto("/");
      await uploadSample(page, "csv-with-header.csv");

      await importProfileFile(page, content);
      await expect(page.locator("header").getByRole("alert")).toHaveText(message);
      await expect(page.getByRole("button", { name: "Crafted", exact: true })).toHaveCount(0);

      // A good file afterwards clears the message.
      await importProfileFile(page, profileFile([craftedProfile()]));
      await expect(page.locator("header").getByRole("alert")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Crafted", exact: true })).toBeVisible();
    });
  }
});

import { expect, test } from "@playwright/test";
import { openWizard, pasteDataset, setCheckbox } from "./helpers";

// A wide and tall dataset, so the wizard's preview box overflows in both directions.
const COLUMN_COUNT = 14;
const header = Array.from({ length: COLUMN_COUNT }, (_, i) => `column_number_${i + 1}`).join(",");
const rows = Array.from({ length: 30 }, (_, r) =>
  Array.from({ length: COLUMN_COUNT }, (_, c) => `row_${r + 1}_value_in_column_${c + 1}`).join(","),
);
const DATASET = [header, ...rows].join("\n");

test("wizard preview: the horizontal scrollbar belongs to the visible preview box, not the full-height table", async ({
  page,
}) => {
  await page.goto("/");
  await pasteDataset(page, DATASET);
  await openWizard(page);
  await setCheckbox(page, "First row is a header", true);

  const tableContainer = page.getByRole("dialog").locator('[data-slot="table-container"]');
  const previewBox = tableContainer.locator("xpath=..");

  // The data overflows the box both ways...
  const box = await previewBox.evaluate((el) => ({
    overflowsX: el.scrollWidth > el.clientWidth,
    overflowsY: el.scrollHeight > el.clientHeight,
    overflowX: getComputedStyle(el).overflowX,
  }));
  expect(box.overflowsX).toBe(true);
  expect(box.overflowsY).toBe(true);
  expect(box.overflowX).toBe("auto");

  // ...so the box itself must be the only horizontal scroller. If the table's own wrapper scrolls
  // horizontally, its scrollbar sits at the bottom of the whole table and is only reachable after
  // scrolling the box down.
  const wrapperOverflowX = await tableContainer.evaluate((el) => getComputedStyle(el).overflowX);
  expect(wrapperOverflowX).toBe("visible");

  // The scrollbar is on screen without scrolling: the box shows a horizontal scrollbar at its own bottom edge
  // (offsetHeight includes it, clientHeight doesn't), while still scrolled to the top.
  const { scrollTop, scrollbarThickness } = await previewBox.evaluate((el) => ({
    scrollTop: el.scrollTop,
    scrollbarThickness: (el as HTMLElement).offsetHeight - el.clientHeight,
  }));
  expect(scrollTop).toBe(0);
  expect(scrollbarThickness).toBeGreaterThan(0);
});

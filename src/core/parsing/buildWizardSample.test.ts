import { describe, expect, it } from "vitest";
import { buildWizardSample } from "@/core/parsing/buildWizardSample";

describe("buildWizardSample", () => {
  it("returns an empty array for empty input", () => {
    expect(buildWizardSample("", 3)).toEqual([]);
  });

  it("always puts the dataset's true first line at index 0", () => {
    const raw = Array.from({ length: 20 }, (_, i) => `line-${i}`).join("\n");
    const sample = buildWizardSample(raw, 5);
    expect(sample[0]).toBe("line-0");
  });

  it("fills the rest of the sample from the middle, not the tail", () => {
    // 20 lines, middle sample of 5 with buildWizardSample's own PREVIEW_SAMPLE_SIZE-equivalent -> indexes 7..11 per sampleMiddleLines.
    const raw = Array.from({ length: 20 }, (_, i) => `line-${i}`).join("\n");
    const sample = buildWizardSample(raw, 5);
    expect(sample).not.toContain("line-19"); // never the true last line
    expect(sample.slice(1)).toEqual(["line-7", "line-8", "line-9", "line-10", "line-11"]);
  });

  it("regression: the header candidate (index 0) is never a body row from the middle of a large dataset", () => {
    // This is the exact shape of the reported bug: a real header row on line 0,
    // and enough body rows that a middle-only sample would never include line 0.
    const raw = ["Date,Kind,Cost", ...Array.from({ length: 100 }, (_, i) => `2026-01-01,${i},row`)].join("\n");
    const sample = buildWizardSample(raw, 8);
    expect(sample[0]).toBe("Date,Kind,Cost");
  });
});

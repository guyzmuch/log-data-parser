import { describe, expect, it } from "vitest";
import {
  hasColumnOption,
  keysWithOption,
  normalizeColumnOptions,
  pruneColumnOptions,
  setColumnOption,
} from "@/core/profile/columnOptions";

describe("setColumnOption / hasColumnOption", () => {
  it("adds options without touching the input, and removes empty entries", () => {
    const empty = undefined;
    const one = setColumnOption(empty, "a", "colorCode", true);
    expect(one).toEqual({ a: { colorCode: true } });

    const two = setColumnOption(one, "a", "secondLine", true);
    expect(two).toEqual({ a: { colorCode: true, secondLine: true } });
    expect(one).toEqual({ a: { colorCode: true } });

    const back = setColumnOption(setColumnOption(two, "a", "colorCode", false), "a", "secondLine", false);
    expect(back).toBeUndefined();
  });

  it("answers per column and option", () => {
    const map = { a: { colorCode: true } };
    expect(hasColumnOption(map, "a", "colorCode")).toBe(true);
    expect(hasColumnOption(map, "a", "secondLine")).toBe(false);
    expect(hasColumnOption(map, "b", "colorCode")).toBe(false);
    expect(hasColumnOption(undefined, "a", "colorCode")).toBe(false);
  });
});

describe("keysWithOption", () => {
  it("lists keys in the given order, ignoring keys that are not in it", () => {
    const map = { c: { secondLine: true }, a: { secondLine: true }, z: { secondLine: true } };
    expect(keysWithOption(map, "secondLine", ["a", "b", "c"])).toEqual(["a", "c"]);
  });
});

describe("pruneColumnOptions", () => {
  it("keeps only known columns, and returns undefined when none are left", () => {
    const map = { a: { colorCode: true }, gone: { secondLine: true } };
    expect(pruneColumnOptions(map, new Set(["a", "b"]))).toEqual({ a: { colorCode: true } });
    expect(pruneColumnOptions(map, new Set(["b"]))).toBeUndefined();
    expect(pruneColumnOptions(undefined, new Set(["a"]))).toBeUndefined();
  });
});

describe("normalizeColumnOptions", () => {
  it("keeps known options set to true and drops everything else", () => {
    expect(
      normalizeColumnOptions({
        a: { colorCode: true, secondLine: false, bogus: true },
        b: "nope",
        c: null,
        d: { colorCode: "yes" },
      }),
    ).toEqual({ a: { colorCode: true } });
  });

  it("rejects non-objects", () => {
    expect(normalizeColumnOptions(undefined)).toBeUndefined();
    expect(normalizeColumnOptions("x")).toBeUndefined();
    expect(normalizeColumnOptions(["a"])).toBeUndefined();
  });

  it("folds the older secondLineKeys list in as secondLine", () => {
    expect(normalizeColumnOptions({ a: { colorCode: true } }, ["a", "b", 3])).toEqual({
      a: { colorCode: true, secondLine: true },
      b: { secondLine: true },
    });
  });
});

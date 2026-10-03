import { describe, expect, it } from "vitest";
import { currentFieldOrder, moveBefore, naturalFieldOrder, visibleInOrder } from "@/core/profile/fieldOrder";
import type { DisplayConfig } from "@/core/profile/types";

function display(overrides: Partial<DisplayConfig> = {}): DisplayConfig {
  return { visibleFieldKeys: [], fieldLabels: {}, derivedFieldSelections: [], ...overrides };
}

describe("naturalFieldOrder", () => {
  it("lists each base column followed by its Derived Fields, in the order they were added", () => {
    const result = naturalFieldOrder(
      ["a", "b"],
      display({
        derivedFieldSelections: [
          { kind: "unescape", sourceFieldKey: "b" },
          { kind: "date", sourceFieldKey: "a", representation: "iso" },
          { kind: "date", sourceFieldKey: "a", representation: "timezone" },
        ],
      }),
    );
    expect(result).toEqual(["a", "a (ISO)", "a (local time)", "b", "b (unescaped)"]);
  });
});

describe("currentFieldOrder", () => {
  it("uses the stored order when there is one", () => {
    expect(currentFieldOrder(display({ fieldOrder: ["b", "a"], visibleFieldKeys: ["a"] }), ["a", "b"])).toEqual(["b", "a"]);
  });

  it("falls back to shown columns first, then the rest in natural order", () => {
    expect(currentFieldOrder(display({ visibleFieldKeys: ["c", "a"] }), ["a", "b", "c"])).toEqual(["c", "a", "b"]);
  });
});

describe("visibleInOrder", () => {
  it("keeps only the shown keys, in the given order", () => {
    expect(visibleInOrder(["a", "b", "c", "d"], new Set(["d", "b"]))).toEqual(["b", "d"]);
  });
});

describe("moveBefore", () => {
  const order = ["a", "b", "c", "d"];

  it("moves a key forward, backward and to the end", () => {
    expect(moveBefore(order, "d", "b")).toEqual(["a", "d", "b", "c"]);
    expect(moveBefore(order, "a", "c")).toEqual(["b", "a", "c", "d"]);
    expect(moveBefore(order, "b", null)).toEqual(["a", "c", "d", "b"]);
  });

  it("returns the order unchanged for a no-op or an unknown key", () => {
    expect(moveBefore(order, "a", "a")).toBe(order);
    expect(moveBefore(order, "x", "a")).toBe(order);
    expect(moveBefore(order, "a", "x")).toBe(order);
  });

  it("doesn't mutate its input", () => {
    moveBefore(order, "d", "a");
    expect(order).toEqual(["a", "b", "c", "d"]);
  });
});

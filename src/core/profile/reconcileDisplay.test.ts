import { describe, expect, it } from "vitest";
import { reconcileDisplay } from "@/core/profile/reconcileDisplay";
import type { DisplayConfig } from "@/core/profile/types";

function display(overrides: Partial<DisplayConfig> = {}): DisplayConfig {
  return { visibleFieldKeys: [], fieldLabels: {}, derivedFieldSelections: [], ...overrides };
}

describe("reconcileDisplay", () => {
  it("makes everything visible when nothing is set yet (e.g. a built-in template)", () => {
    expect(reconcileDisplay(display(), ["a", "b"]).visibleFieldKeys).toEqual(["a", "b"]);
  });

  it("keeps the saved order and drops visible keys the Dataset doesn't have", () => {
    const result = reconcileDisplay(display({ visibleFieldKeys: ["b", "ghost", "a"] }), ["a", "b", "c"]);
    expect(result.visibleFieldKeys).toEqual(["b", "a"]);
  });

  it("leaves a base column the Profile never saw hidden (it can't tell new from deliberately hidden)", () => {
    const result = reconcileDisplay(display({ visibleFieldKeys: ["a"] }), ["a", "b"]);
    expect(result.visibleFieldKeys).toEqual(["a"]);
  });

  it("shows everything when none of the saved visible keys exist in this Dataset", () => {
    const result = reconcileDisplay(display({ visibleFieldKeys: ["x", "y"] }), ["a", "b"]);
    expect(result.visibleFieldKeys).toEqual(["a", "b"]);
  });

  it("drops Derived Field specs whose source column doesn't exist, and their visible keys", () => {
    const result = reconcileDisplay(
      display({
        visibleFieldKeys: ["a", "gone (unescaped)", "a (unescaped)"],
        derivedFieldSelections: [
          { kind: "unescape", sourceFieldKey: "gone" },
          { kind: "unescape", sourceFieldKey: "a" },
        ],
      }),
      ["a", "b"],
    );
    expect(result.derivedFieldSelections).toEqual([{ kind: "unescape", sourceFieldKey: "a" }]);
    expect(result.visibleFieldKeys).toEqual(["a", "a (unescaped)"]);
  });

  it("drops duplicate specs and specs of an unsupported kind", () => {
    const result = reconcileDisplay(
      display({
        derivedFieldSelections: [
          { kind: "unescape", sourceFieldKey: "a" },
          { kind: "unescape", sourceFieldKey: "a" },
          { kind: "trim", sourceFieldKey: "a" } as never,
        ],
      }),
      ["a"],
    );
    expect(result.derivedFieldSelections).toEqual([{ kind: "unescape", sourceFieldKey: "a" }]);
  });

  it("drops a Derived Field whose key collides with a base column", () => {
    const result = reconcileDisplay(
      display({ derivedFieldSelections: [{ kind: "json-key", sourceFieldKey: "a", jsonKey: "b" }] }),
      ["a", "a.b"],
    );
    expect(result.derivedFieldSelections).toEqual([]);
  });

  it("keeps the saved column order, hidden columns included, so a hidden column keeps its place", () => {
    const result = reconcileDisplay(
      display({ fieldOrder: ["c", "a", "b"], visibleFieldKeys: ["c", "b"] }),
      ["a", "b", "c"],
    );
    expect(result.fieldOrder).toEqual(["c", "a", "b"]);
    expect(result.visibleFieldKeys).toEqual(["c", "b"]);
  });

  it("puts the shown columns in the saved order even if visibleFieldKeys disagrees with it", () => {
    const result = reconcileDisplay(
      display({ fieldOrder: ["a", "b", "c"], visibleFieldKeys: ["c", "a"] }),
      ["a", "b", "c"],
    );
    expect(result.visibleFieldKeys).toEqual(["a", "c"]);
  });

  it("appends columns the saved order has never seen, and drops ones the Dataset doesn't have", () => {
    const result = reconcileDisplay(
      display({ fieldOrder: ["b", "ghost", "a"], visibleFieldKeys: ["a"] }),
      ["a", "b", "c"],
    );
    expect(result.fieldOrder).toEqual(["b", "a", "c"]);
    expect(result.visibleFieldKeys).toEqual(["a"]);
  });

  it("for a Profile saved without an order, starts it with the shown columns and then the rest", () => {
    const result = reconcileDisplay(display({ visibleFieldKeys: ["c", "a"] }), ["a", "b", "c"]);
    expect(result.fieldOrder).toEqual(["c", "a", "b"]);
  });

  it("carries labels and search state over untouched", () => {
    const result = reconcileDisplay(
      display({ fieldLabels: { a: "Alpha" }, searchState: { term: "x", mode: "highlight" } }),
      ["a"],
    );
    expect(result.fieldLabels).toEqual({ a: "Alpha" });
    expect(result.searchState).toEqual({ term: "x", mode: "highlight" });
  });
});

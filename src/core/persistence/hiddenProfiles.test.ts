// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { listHiddenProfileIds, setHiddenProfileIds } from "@/core/persistence/hiddenProfiles";

beforeEach(() => {
  localStorage.clear();
});

describe("hiddenProfiles persistence", () => {
  it("returns an empty list when nothing has been saved", () => {
    expect(listHiddenProfileIds()).toEqual([]);
  });

  it("round-trips a list of ids", () => {
    setHiddenProfileIds(["builtin:csv-with-header", "abc-123"]);
    expect(listHiddenProfileIds()).toEqual(["builtin:csv-with-header", "abc-123"]);
  });

  it("overwrites the previous list rather than merging", () => {
    setHiddenProfileIds(["a"]);
    setHiddenProfileIds(["b"]);
    expect(listHiddenProfileIds()).toEqual(["b"]);
  });

  it("survives corrupt JSON in storage by treating it as empty", () => {
    localStorage.setItem("log-data-parser:hidden-profile-ids", "{not valid json");
    expect(listHiddenProfileIds()).toEqual([]);
  });

  it("drops non-string entries rather than failing", () => {
    localStorage.setItem("log-data-parser:hidden-profile-ids", JSON.stringify(["good", 42, null, "also-good"]));
    expect(listHiddenProfileIds()).toEqual(["good", "also-good"]);
  });

  it("treats a non-array payload as empty", () => {
    localStorage.setItem("log-data-parser:hidden-profile-ids", JSON.stringify({ not: "an array" }));
    expect(listHiddenProfileIds()).toEqual([]);
  });
});

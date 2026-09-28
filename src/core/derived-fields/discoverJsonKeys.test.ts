import { describe, expect, it } from "vitest";
import { discoverJsonKeys } from "@/core/derived-fields/discoverJsonKeys";

describe("discoverJsonKeys", () => {
  it("returns keys from a single JSON object value", () => {
    expect(discoverJsonKeys(['{"a":1,"b":2}'])).toEqual(["a", "b"]);
  });

  it("unions keys across multiple values, first-seen order, no duplicates", () => {
    expect(discoverJsonKeys(['{"a":1}', '{"b":2}', '{"a":3,"c":4}'])).toEqual(["a", "b", "c"]);
  });

  it("skips values that aren't valid JSON objects", () => {
    expect(discoverJsonKeys(["not json", '{"a":1}', "[1,2]", "42"])).toEqual(["a"]);
  });

  it("returns an empty array when nothing parses as a JSON object", () => {
    expect(discoverJsonKeys(["not json", "also not"])).toEqual([]);
  });

  it("returns an empty array for an empty sample", () => {
    expect(discoverJsonKeys([])).toEqual([]);
  });
});

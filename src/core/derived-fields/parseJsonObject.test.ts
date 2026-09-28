import { describe, expect, it } from "vitest";
import { stringifyJsonValue, tryParseJsonObject } from "@/core/derived-fields/parseJsonObject";

describe("tryParseJsonObject", () => {
  it("parses a valid JSON object", () => {
    expect(tryParseJsonObject('{"a":1,"b":"two"}')).toEqual({ a: 1, b: "two" });
  });

  it("rejects a JSON array", () => {
    expect(tryParseJsonObject("[1,2,3]")).toBeUndefined();
  });

  it("rejects a bare JSON primitive", () => {
    expect(tryParseJsonObject("42")).toBeUndefined();
    expect(tryParseJsonObject('"just a string"')).toBeUndefined();
  });

  it("rejects null", () => {
    expect(tryParseJsonObject("null")).toBeUndefined();
  });

  it("rejects invalid JSON", () => {
    expect(tryParseJsonObject("not json")).toBeUndefined();
  });

  it("rejects an empty string", () => {
    expect(tryParseJsonObject("")).toBeUndefined();
  });
});

describe("stringifyJsonValue", () => {
  it("passes a string through unchanged", () => {
    expect(stringifyJsonValue("hello")).toBe("hello");
  });

  it("stringifies numbers and booleans", () => {
    expect(stringifyJsonValue(42)).toBe("42");
    expect(stringifyJsonValue(true)).toBe("true");
  });

  it("renders null as the string 'null'", () => {
    expect(stringifyJsonValue(null)).toBe("null");
  });

  it("renders undefined (key absent) as an empty string", () => {
    expect(stringifyJsonValue(undefined)).toBe("");
  });

  it("JSON-stringifies nested objects/arrays rather than exploding them further", () => {
    expect(stringifyJsonValue({ nested: true })).toBe('{"nested":true}');
    expect(stringifyJsonValue([1, 2, 3])).toBe("[1,2,3]");
  });
});

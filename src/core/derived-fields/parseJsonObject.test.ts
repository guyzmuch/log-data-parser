import { describe, expect, it } from "vitest";
import { stringifyJsonValue, tryParseJsonObject, tryParseJsonObjectLenient } from "@/core/derived-fields/parseJsonObject";

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

describe("tryParseJsonObjectLenient", () => {
  it("parses plain JSON like the strict version", () => {
    expect(tryParseJsonObjectLenient('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses a stringified object whose quotes were already stripped (backslash escapes left over)", () => {
    expect(tryParseJsonObjectLenient('{\\"user\\":\\"alice\\",\\"count\\":3}')).toEqual({ user: "alice", count: 3 });
  });

  it("parses a fully quoted stringified object", () => {
    expect(tryParseJsonObjectLenient('"{\\"user\\":\\"alice\\"}"')).toEqual({ user: "alice" });
  });

  it("tolerates blanks around a stringified object", () => {
    expect(tryParseJsonObjectLenient(' {\\"a\\":1} ')).toEqual({ a: 1 });
  });

  it("still rejects arrays, primitives and garbage", () => {
    expect(tryParseJsonObjectLenient("[1,2]")).toBeUndefined();
    expect(tryParseJsonObjectLenient('"just a string"')).toBeUndefined();
    expect(tryParseJsonObjectLenient('{"a":')).toBeUndefined();
    expect(tryParseJsonObjectLenient("")).toBeUndefined();
  });

  it("the strict version still refuses a stringified object (so the detector reports escapes, not JSON)", () => {
    expect(tryParseJsonObject('{\\"a\\":1}')).toBeUndefined();
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

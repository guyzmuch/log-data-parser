import { describe, expect, it } from "vitest";
import { splitDelimitedLine, stripQuotesFromValue } from "@/core/parsing/delimiter";

describe("splitDelimitedLine", () => {
  it("splits on comma", () => {
    expect(splitDelimitedLine("a,b,c", ",")).toEqual(["a", "b", "c"]);
  });

  it("splits on tab", () => {
    expect(splitDelimitedLine("a\tb\tc", "\t")).toEqual(["a", "b", "c"]);
  });

  it("splits on pipe", () => {
    expect(splitDelimitedLine("a|b|c", "|")).toEqual(["a", "b", "c"]);
  });

  it("splits on semicolon", () => {
    expect(splitDelimitedLine("a;b;c", ";")).toEqual(["a", "b", "c"]);
  });

  // TODO: not implemented (see TODO in delimiter.ts / docs/project_idea.md Advanced section).
  // splitDelimitedLine is a plain string split, so a delimiter inside a quoted
  // CSV value currently splits incorrectly instead of being treated as one field.
  it.skip("does not split on a delimiter inside a quoted value (RFC4180-style)", () => {
    expect(splitDelimitedLine('a,"b,c",d', ",")).toEqual(["a", "b,c", "d"]);
  });
});

describe("stripQuotesFromValue", () => {
  it("strips matching double quotes", () => {
    expect(stripQuotesFromValue('"hello"')).toBe("hello");
  });

  it("strips matching single quotes", () => {
    expect(stripQuotesFromValue("'hello'")).toBe("hello");
  });

  it("leaves unquoted values untouched", () => {
    expect(stripQuotesFromValue("hello")).toBe("hello");
  });

  it("leaves mismatched quote characters untouched", () => {
    expect(stripQuotesFromValue("\"hello'")).toBe("\"hello'");
  });

  it("leaves a single quote character untouched", () => {
    expect(stripQuotesFromValue('"')).toBe('"');
  });

  it("strips quotes surrounded by blanks (trim first, then unquote)", () => {
    expect(stripQuotesFromValue(' "hello" ')).toBe("hello");
  });

  it("trims blanks around an unquoted value", () => {
    expect(stripQuotesFromValue("  hello ")).toBe("hello");
  });

  it("keeps blanks inside the quotes", () => {
    expect(stripQuotesFromValue('" hello "')).toBe(" hello ");
  });

  it("turns a blank-only value into an empty string", () => {
    expect(stripQuotesFromValue("   ")).toBe("");
  });
});

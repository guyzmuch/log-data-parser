import { describe, expect, it } from "vitest";
import { unescapeStringified } from "@/core/derived-fields/unescapeStringified";

describe("unescapeStringified", () => {
  it("unescapes double quotes", () => {
    expect(unescapeStringified('He said \\"hi\\"')).toBe('He said "hi"');
  });

  it("unescapes backslashes", () => {
    expect(unescapeStringified("C:\\\\Users")).toBe("C:\\Users");
  });

  it("unescapes newlines and tabs", () => {
    expect(unescapeStringified("line1\\nline2\\tindented")).toBe("line1\nline2\tindented");
  });

  it("leaves a plain string with no escapes untouched", () => {
    expect(unescapeStringified("plain value")).toBe("plain value");
  });

  it("drops the backslash for an unrecognized escape, keeping the character", () => {
    expect(unescapeStringified("\\q")).toBe("q");
  });

  it("handles an empty string", () => {
    expect(unescapeStringified("")).toBe("");
  });
});

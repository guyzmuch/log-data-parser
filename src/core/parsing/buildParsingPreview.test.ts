import { describe, expect, it } from "vitest";
import { buildParsingPreview } from "@/core/parsing/buildParsingPreview";

describe("buildParsingPreview", () => {
  it("parses with the chosen delimiter and no header", () => {
    const { config, parsed } = buildParsingPreview("a,b,c\nd,e,f", {
      delimiter: ",",
      hasHeaderRow: false,
      stripQuotes: false,
      trimBoundaryPartials: false,
    });

    expect(config.delimiter).toBe(",");
    expect(config.expectedFieldCount).toBe(3);
    expect(parsed.fieldNames).toEqual(["Field 1", "Field 2", "Field 3"]);
    expect(parsed.records).toHaveLength(2);
  });

  it("consumes the header row when hasHeaderRow is set", () => {
    const { parsed } = buildParsingPreview("id,name\n1,alice\n2,bob", {
      delimiter: ",",
      hasHeaderRow: true,
      stripQuotes: false,
      trimBoundaryPartials: false,
    });

    expect(parsed.fieldNames).toEqual(["id", "name"]);
    expect(parsed.records).toHaveLength(2);
  });

  it("strips quotes when requested", () => {
    const { parsed } = buildParsingPreview('"a","b"', {
      delimiter: ",",
      hasHeaderRow: false,
      stripQuotes: true,
      trimBoundaryPartials: false,
    });

    expect(parsed.records[0].fields.map((f) => f.value)).toEqual(["a", "b"]);
  });

  it("computes expectedFieldCount from the untrimmed sample, so trimming still has a stable target", () => {
    // First line is short; without computing expectedFieldCount pre-trim, trimming would have nothing to compare against.
    const { config, parsed } = buildParsingPreview("b\na,b,c\nd,e,f", {
      delimiter: ",",
      hasHeaderRow: false,
      stripQuotes: false,
      trimBoundaryPartials: true,
    });

    expect(config.expectedFieldCount).toBe(3);
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0].fields.map((f) => f.value)).toEqual(["a", "b", "c"]);
  });

  it("does not trim when trimBoundaryPartials is off, even with a short boundary line", () => {
    const { parsed } = buildParsingPreview("b\na,b,c\nd,e,f", {
      delimiter: ",",
      hasHeaderRow: false,
      stripQuotes: false,
      trimBoundaryPartials: false,
    });

    expect(parsed.records).toHaveLength(3);
  });

  it("keeps field names handed in from an existing Profile when there is no header row", () => {
    const { config, parsed } = buildParsingPreview("1.2.3.4 GET 200", {
      delimiter: " ",
      hasHeaderRow: false,
      stripQuotes: false,
      trimBoundaryPartials: false,
      fieldNames: ["client_ip", "method"],
    });

    expect(config.fieldNames).toEqual(["client_ip", "method"]);
    expect(parsed.fieldNames).toEqual(["client_ip", "method", "Field 3"]);
  });

  it("lets a header row override the handed-in field names", () => {
    const { parsed } = buildParsingPreview("id,name\n1,alice", {
      delimiter: ",",
      hasHeaderRow: true,
      stripQuotes: false,
      trimBoundaryPartials: false,
      fieldNames: ["old_a", "old_b"],
    });

    expect(parsed.fieldNames).toEqual(["id", "name"]);
  });

  it("leaves config.fieldNames unset when none are given", () => {
    const { config } = buildParsingPreview("a,b", {
      delimiter: ",",
      hasHeaderRow: false,
      stripQuotes: false,
      trimBoundaryPartials: false,
    });
    expect("fieldNames" in config).toBe(false);
  });
});

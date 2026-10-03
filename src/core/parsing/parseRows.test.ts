import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { toCSVBlob } from "@/core/export/toCSVBlob";
import { parseQuotedRows, toRawRows } from "@/core/parsing/parseRows";

describe("parseQuotedRows", () => {
  it("splits plain rows and cells", () => {
    expect(parseQuotedRows("a,b,c\n1,2,3", ",")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("keeps a delimiter inside quotes in the cell (the case the plain splitter gets wrong)", () => {
    expect(parseQuotedRows('a,"b,c",d', ",")).toEqual([["a", "b,c", "d"]]);
  });

  it("keeps a line break inside quotes in the cell, so the row spans several lines", () => {
    expect(parseQuotedRows('id,note\n1,"first\nsecond"\n2,plain', ",")).toEqual([
      ["id", "note"],
      ["1", "first\nsecond"],
      ["2", "plain"],
    ]);
  });

  it("reads a doubled quote inside quotes as one literal quote", () => {
    expect(parseQuotedRows('"say ""hi""",x', ",")).toEqual([['say "hi"', "x"]]);
  });

  it("handles CRLF line endings", () => {
    expect(parseQuotedRows("a,b\r\n1,2\r\n", ",")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("drops the one empty row a final newline adds, but keeps blank lines inside the text", () => {
    expect(parseQuotedRows("a\n\nb\n", ",")).toEqual([["a"], [""], ["b"]]);
    expect(parseQuotedRows("a\nb", ",")).toEqual([["a"], ["b"]]);
  });

  it("returns no rows for empty text", () => {
    expect(parseQuotedRows("", ",")).toEqual([]);
  });

  it.each([
    ["tab", "\t"],
    ["pipe", "|"],
    ["semicolon", ";"],
    ["space", " "],
  ] as const)("uses the %s delimiter, with quotes protecting it", (_name, delimiter) => {
    const text = `a${delimiter}"b${delimiter}c"${delimiter}d`;
    expect(parseQuotedRows(text, delimiter)).toEqual([["a", `b${delimiter}c`, "d"]]);
  });

  it("parses a quoted space-delimited access log line into one request cell", () => {
    const line = '1.2.3.4 - - [15/Jan/2026:12:30:00 +0000] "GET /index.html HTTP/1.1" 200 512';
    expect(parseQuotedRows(line, " ")[0]).toEqual([
      "1.2.3.4",
      "-",
      "-",
      "[15/Jan/2026:12:30:00",
      "+0000]",
      "GET /index.html HTTP/1.1",
      "200",
      "512",
    ]);
  });

  it("drops a byte-order mark at the start of the file instead of leaving it in the first header name", () => {
    expect(parseQuotedRows("﻿id,name\n1,a", ",")[0]).toEqual(["id", "name"]);
  });

  it("returns ragged rows as they are", () => {
    expect(parseQuotedRows("a,b,c\n1,2\n1,2,3,4", ",")).toEqual([["a", "b", "c"], ["1", "2"], ["1", "2", "3", "4"]]);
  });

  it("does not throw on an unterminated quote", () => {
    expect(() => parseQuotedRows('a,"never closed\nb,c', ",")).not.toThrow();
    expect(parseQuotedRows('a,"never closed\nb,c', ",")[0][0]).toBe("a");
  });

  it("leaves a quote in the middle of an unquoted cell alone", () => {
    expect(parseQuotedRows('say "hi",x', ",")).toEqual([['say "hi"', "x"]]);
  });

  it("leaves blanks around a quoted cell in place (trimming is the config's job)", () => {
    expect(parseQuotedRows('a, "b" ,c', ",")).toEqual([["a", ' "b" ', "c"]]);
  });
});

describe("toRawRows", () => {
  it("numbers rows from 0 and keeps the original line as `raw` when splitting by line", () => {
    expect(toRawRows("a,b\n1,2", ",", false)).toEqual([
      { index: 0, raw: "a,b", values: ["a", "b"] },
      { index: 1, raw: "1,2", values: ["1", "2"] },
    ]);
  });

  it("numbers quoted rows by row, not by physical line, and rebuilds `raw` from the cells", () => {
    expect(toRawRows('a,b\n"x\ny",2\nz,3', ",", true)).toEqual([
      { index: 0, raw: "a,b", values: ["a", "b"] },
      { index: 1, raw: "x\ny,2", values: ["x\ny", "2"] },
      { index: 2, raw: "z,3", values: ["z", "3"] },
    ]);
  });

  it("splits a quoted comma differently from the plain splitter", () => {
    expect(toRawRows('a,"b,c"', ",", false)[0].values).toEqual(["a", '"b', 'c"']);
    expect(toRawRows('a,"b,c"', ",", true)[0].values).toEqual(["a", "b,c"]);
  });
});

describe("export and import agree", () => {
  const TRICKY = [
    ["plain", "with,comma", 'with "quotes"', "multi\nline", "multi\r\nline"],
    ["", " leading space", "trailing space ", "tab\there", "ünïcödé ✓"],
    ["=1+2", "-5", "  ", '""', ","],
  ];

  it("reads back exactly what the CSV export wrote, whatever the cells contain", async () => {
    const header = ["a", "b", "c", "d", "e"];
    const csv = await toCSVBlob(header, TRICKY).text();

    expect(parseQuotedRows(csv, ",")).toEqual([header, ...TRICKY]);
  });

  it("the export is what PapaParse itself reads back as the same table", async () => {
    const csv = await toCSVBlob(["x"], [["a,b"], ['c"d']]).text();
    expect(Papa.parse<string[]>(csv, { delimiter: "," }).data).toEqual([["x"], ["a,b"], ['c"d']]);
  });
});

import { describe, expect, it } from "vitest";
import { toCSVBlob } from "@/core/export/toCSVBlob";

async function blobText(blob: Blob): Promise<string> {
  return blob.text();
}

describe("toCSVBlob", () => {
  it("joins header and rows with commas and CRLF line endings", async () => {
    const blob = toCSVBlob(["name", "role"], [["alice", "engineer"]]);
    expect(await blobText(blob)).toBe("name,role\r\nalice,engineer");
  });

  it("leaves plain fields unquoted", async () => {
    const blob = toCSVBlob(["a"], [["plain value"]]);
    expect(await blobText(blob)).toBe("a\r\nplain value");
  });

  it("quotes a field containing a comma", async () => {
    const blob = toCSVBlob(["a"], [["has,comma"]]);
    expect(await blobText(blob)).toBe('a\r\n"has,comma"');
  });

  it("quotes and doubles internal quotes for a field containing a quote", async () => {
    const blob = toCSVBlob(["a"], [['say "hi"']]);
    expect(await blobText(blob)).toBe('a\r\n"say ""hi"""');
  });

  it("quotes a field containing a newline", async () => {
    const blob = toCSVBlob(["a"], [["line1\nline2"]]);
    expect(await blobText(blob)).toBe('a\r\n"line1\nline2"');
  });

  it("quotes a field containing a carriage return", async () => {
    const blob = toCSVBlob(["a"], [["line1\rline2"]]);
    expect(await blobText(blob)).toBe('a\r\n"line1\rline2"');
  });

  it("sets a csv content type", () => {
    const blob = toCSVBlob(["a"], [["1"]]);
    expect(blob.type).toBe("text/csv;charset=utf-8;");
  });

  it("handles no rows", async () => {
    const blob = toCSVBlob(["a", "b"], []);
    expect(await blobText(blob)).toBe("a,b");
  });
});

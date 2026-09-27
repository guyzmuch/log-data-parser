import type { RecordLine } from "@/core/dataset/types";

/** Splits raw text into lines, handling \n, \r\n and \r, and dropping one trailing blank line from a final newline. */
export function splitIntoRecords(rawText: string): RecordLine[] {
  if (rawText === "") return [];

  const lines = rawText.split(/\r\n|\r|\n/);
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.map((raw, index) => ({ index, raw }));
}

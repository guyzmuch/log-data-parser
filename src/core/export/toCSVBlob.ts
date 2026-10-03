import Papa from "papaparse";

/** Always comma-delimited (that's what "CSV" means for export), independent of the Profile's own parsing delimiter. */
export function toCSVBlob(header: string[], rows: string[][]): Blob {
  const csvText = Papa.unparse([header, ...rows], { delimiter: ",", newline: "\r\n" });
  return new Blob([csvText], { type: "text/csv;charset=utf-8;" });
}

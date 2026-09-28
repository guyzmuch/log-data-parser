const NEEDS_QUOTING = /[",\r\n]/;

function escapeCsvField(value: string): string {
  if (NEEDS_QUOTING.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Always comma-delimited (that's what "CSV" means for export), independent of the Profile's own parsing delimiter. */
export function toCSVBlob(header: string[], rows: string[][]): Blob {
  const lines = [header, ...rows].map((row) => row.map(escapeCsvField).join(","));
  const csvText = lines.join("\r\n");
  return new Blob([csvText], { type: "text/csv;charset=utf-8;" });
}

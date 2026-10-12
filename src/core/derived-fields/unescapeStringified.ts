const ESCAPE_REPLACEMENTS: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  f: "\f",
  '"': '"',
  "/": "/",
  "\\": "\\",
};

/**
 * Un-escapes the backslash sequences of a stringified value (e.g. a cell copy-pasted from JSON:
 * `He said \"hi\"\n` -> `He said "hi"` + a real newline): the JSON escapes, `\uXXXX` included. An
 * unrecognized escape (e.g. `\q`) keeps its following character but drops the backslash.
 */
export function unescapeStringified(value: string): string {
  return value.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_match, escape: string) =>
    escape.length === 5 ? String.fromCharCode(parseInt(escape.slice(1), 16)) : (ESCAPE_REPLACEMENTS[escape] ?? escape),
  );
}

/** `C:\new\temp` or `\\server\share`: backslashes that separate folders, not escapes. */
const WINDOWS_PATH = /^(?:[A-Za-z]:\\(?!\\)|\\\\[^\\])/;

const ESCAPE_SEQUENCE = /\\(?:["\\/nrt]|u[0-9a-fA-F]{4})/;

/** Whether a value looks stringified: it has escape sequences, and isn't a Windows path whose `\n` starts a folder name. */
export function hasEscapeSequences(value: string): boolean {
  return ESCAPE_SEQUENCE.test(value) && !WINDOWS_PATH.test(value.trim());
}

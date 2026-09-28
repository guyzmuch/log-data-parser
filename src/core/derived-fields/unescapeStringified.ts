const ESCAPE_REPLACEMENTS: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  '"': '"',
  "\\": "\\",
};

/**
 * Un-escapes common backslash sequences from a stringified value (e.g. a
 * cell copy-pasted from JSON: `He said \"hi\"\n` -> `He said "hi"` + a real
 * newline). Only handles the common cases in ESCAPE_REPLACEMENTS — nothing
 * fancier (no unicode \uXXXX escapes), matching the project's "nothing
 * fancy" v1 scope. An unrecognized escape (e.g. `\q`) keeps its following
 * character but drops the backslash, same as JSON.parse would.
 */
export function unescapeStringified(value: string): string {
  return value.replace(/\\(.)/g, (_match, char: string) => ESCAPE_REPLACEMENTS[char] ?? char);
}

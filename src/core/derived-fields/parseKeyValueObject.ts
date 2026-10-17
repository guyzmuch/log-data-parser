const KEY_START = /[A-Za-z_]/;
const KEY_CHAR = /[\w.:-]/;

/** Index of the `}` closing the `{` at `open`, skipping over quoted values; -1 when it never closes. */
function findClosingBrace(text: string, open: number): number {
  let inQuotes = false;
  for (let i = open + 1; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === "\\") i++;
      else if (char === '"') inQuotes = false;
    } else if (char === '"') inQuotes = true;
    else if (char === "{") return -1; // nested braces: not a flat label set
    else if (char === "}") return i;
  }
  return -1;
}

/** Reads a `"..."` value starting at `start`, resolving \" \\ \n \t \r; returns the value and the index after the closing quote. */
function readQuoted(inner: string, start: number): { value: string; end: number } | undefined {
  let value = "";
  for (let i = start + 1; i < inner.length; i++) {
    const char = inner[i];
    if (char === '"') return { value, end: i + 1 };
    if (char === "\\" && i + 1 < inner.length) {
      const next = inner[++i];
      value += next === "n" ? "\n" : next === "t" ? "\t" : next === "r" ? "\r" : next;
    } else value += char;
  }
  return undefined;
}

function parsePairs(inner: string): Record<string, string> | undefined {
  const pairs: Record<string, string> = {};
  let count = 0;
  let i = 0;

  while (i < inner.length) {
    while (i < inner.length && (inner[i] === "," || /\s/.test(inner[i]))) i++;
    if (i >= inner.length) break;

    if (!KEY_START.test(inner[i])) return undefined;
    const keyStart = i;
    while (i < inner.length && KEY_CHAR.test(inner[i])) i++;
    const key = inner.slice(keyStart, i);

    while (i < inner.length && inner[i] === " ") i++;
    if (inner[i] !== "=") return undefined;
    i++;
    while (i < inner.length && inner[i] === " ") i++;

    if (inner[i] === '"') {
      const quoted = readQuoted(inner, i);
      if (!quoted) return undefined;
      pairs[key] = quoted.value;
      i = quoted.end;
    } else {
      const valueStart = i;
      while (i < inner.length && inner[i] !== ",") i++;
      pairs[key] = inner.slice(valueStart, i).trim();
    }
    count++;
  }

  return count > 0 ? pairs : undefined;
}

export interface KeyValueSet {
  pairs: Record<string, string>;
  /** The text before and after the `{…}`, joined by a space and trimmed (`http_requests_total 10482 1768480200123`). */
  text: string;
}

/**
 * Finds the first `{key="value",count=34}` label set of `text` — Prometheus labels, or any JSON-like `{}` using
 * `=` instead of `:`. Values are quoted (with \" \\ escapes) or bare (read up to the next comma). The text around
 * the braces is returned as `text`, so a whole Prometheus line (`http_requests_total{job="api"} 10 1768480200123`) works.
 * Returns undefined when there is no flat, well-formed set of at least one `key=value` pair (so real JSON doesn't match).
 */
export function findKeyValueSet(text: string): KeyValueSet | undefined {
  const open = text.indexOf("{");
  if (open === -1) return undefined;
  const close = findClosingBrace(text, open);
  if (close === -1) return undefined;
  const pairs = parsePairs(text.slice(open + 1, close));
  if (!pairs) return undefined;
  const outside = [text.slice(0, open), text.slice(close + 1)].map((part) => part.trim());
  return { pairs, text: outside.filter((part) => part !== "").join(" ") };
}

/** The `key=value` pairs of the first set in `text`, see findKeyValueSet. */
export function tryParseKeyValueObject(text: string): Record<string, string> | undefined {
  return findKeyValueSet(text)?.pairs;
}

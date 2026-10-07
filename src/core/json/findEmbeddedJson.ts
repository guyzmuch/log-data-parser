import { unescapeStringified } from "@/core/derived-fields/unescapeStringified";

export type JsonContainer = Record<string, unknown> | unknown[];

export interface EmbeddedJson {
  json: JsonContainer;
  /** The cell's text before the JSON. */
  before: string;
  /** The cell's text after the JSON. */
  after: string;
}

/** How many `{` / `[` positions are tried before giving up on a cell, so a line full of brackets stays cheap. */
const MAX_CANDIDATES = 32;

function isContainer(value: unknown): value is JsonContainer {
  return typeof value === "object" && value !== null;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses text as a JSON object or array, also when it is that JSON stored as a JSON string (`"{\"a\":1}"`). */
export function parseJsonContainer(text: string): JsonContainer | undefined {
  try {
    let parsed: unknown = JSON.parse(text);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    return isContainer(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Like parseJsonContainer, but also accepts JSON whose quotes were left escaped (`{\"a\":1}`). */
export function parseJsonContainerLenient(text: string): JsonContainer | undefined {
  return parseJsonContainer(text) ?? (text.includes('\\"') ? parseJsonContainer(unescapeStringified(text)) : undefined);
}

/** Index of the bracket closing the one at `start`, skipping brackets inside "strings". -1 when it never closes. */
function closingBracket(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === "\\") i++;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === "{" || char === "[") {
      depth++;
    } else if (char === "}" || char === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * JSON found in the middle of text has to look like data: an object, or an array of objects. Without that,
 * a log prefix such as `[42]` would count as a JSON array.
 */
function isEmbeddable(json: JsonContainer): boolean {
  return !Array.isArray(json) || (json.length > 0 && json.every(isPlainObject));
}

function scan(text: string): EmbeddedJson | undefined {
  let attempts = 0;
  for (let i = 0; i < text.length && attempts < MAX_CANDIDATES; i++) {
    const char = text[i];
    if (char !== "{" && char !== "[") continue;
    attempts++;
    const end = closingBracket(text, i);
    if (end === -1) continue;
    const json = parseJsonContainer(text.slice(i, end + 1));
    if (json && isEmbeddable(json)) return { json, before: text.slice(0, i), after: text.slice(end + 1) };
  }
  return undefined;
}

/**
 * The first JSON object or array in a cell, with the text around it. The whole cell can be the JSON (also
 * stored as a string, or with escaped quotes), or the JSON can sit inside text such as
 * `10002 [error] [client]: {"message":"…"}`. Undefined when the cell holds no JSON.
 */
export function findEmbeddedJson(value: string): EmbeddedJson | undefined {
  if (!value.includes("{") && !value.includes("[")) return undefined;

  const whole = parseJsonContainerLenient(value.trim());
  if (whole) return { json: whole, before: "", after: "" };

  return scan(value) ?? (value.includes('\\"') ? scan(unescapeStringified(value)) : undefined);
}

/** Whether a cell has JSON inside text (not the whole cell being JSON), for the "JSON in text" hint. */
export function hasJsonInText(value: string): boolean {
  const found = findEmbeddedJson(value);
  return found !== undefined && (found.before.trim() !== "" || found.after.trim() !== "");
}

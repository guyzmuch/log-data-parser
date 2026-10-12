/** Standard or URL-safe base64, with or without its `=` padding. */
const BASE64 = /^[A-Za-z0-9+/_-]+={0,2}$/;

/** Control characters (tab and line breaks aside) and the replacement character: what binary data turns into. */
const UNREADABLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F�]/;

/** Values shorter than this are not suggested for decoding: too many short words and ids are valid base64 by chance. */
const MIN_DETECTED_LENGTH = 12;

/**
 * Decodes a base64 value (standard or URL-safe, padding optional) as UTF-8 text. Undefined when it isn't
 * base64, or decodes to binary data rather than readable text.
 */
export function decodeBase64Text(value: string): string | undefined {
  const trimmed = value.trim();
  if (!BASE64.test(trimmed)) return undefined;

  const standard = trimmed.replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/");
  if (standard.length % 4 === 1) return undefined;
  const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, "=");

  try {
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return UNREADABLE.test(text) ? undefined : text;
  } catch {
    return undefined;
  }
}

/** Whether a value looks like base64-encoded text, for the "base64" hint: long enough, and decodes to readable text. */
export function looksLikeBase64(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= MIN_DETECTED_LENGTH && !/^\d+$/.test(trimmed) && decodeBase64Text(trimmed) !== undefined;
}

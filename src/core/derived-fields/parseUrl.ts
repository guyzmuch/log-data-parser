export const URL_PARTS = ["protocol", "hostname", "port", "pathname", "search"] as const;
export type UrlPart = (typeof URL_PARTS)[number];

export interface ParsedUrl {
  /** "https" (no colon); empty for a path with no host. */
  protocol: string;
  hostname: string;
  /** Only when written in the URL: `https://x.com` has none, even though it means 443. */
  port: string;
  pathname: string;
  /** The raw query string with its "?" (`?q=a%20b&page=2`); empty when there is none. */
  search: string;
  /** The decoded query parameters. Empty when there are none. */
  params: Record<string, string>;
}

// scheme://authority/path?query#fragment, whole string, no blanks.
const ABSOLUTE_URL = /^([a-z][a-z0-9+.-]*):\/\/([^/?#\s]*)([^?#\s]*)(\?[^#\s]*)?(?:#\S*)?$/i;
// An absolute path: starts with a single "/" (a "//" would be a protocol-relative URL, with a host).
const PATH_URL = /^(\/(?!\/)[^?#\s]*)(\?[^#\s]*)?(?:#\S*)?$/;
// Inside text: the first absolute URL, or a path that carries a query string (a bare "/word" in text is too vague).
const EMBEDDED_ABSOLUTE_URL = /[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/i;
const EMBEDDED_PATH_WITH_QUERY = /(?:^|\s)(\/(?!\/)[^\s"'<>?#]*\?[^\s"'<>#=]+=[^\s"'<>#]*)/;
const TRAILING_PUNCTUATION = /[.,;:!)\]]+$/;

function decode(part: string): string {
  const spaced = part.replace(/\+/g, " ");
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced; // a stray "%": keep the text as it is
  }
}

/**
 * Splits a query string (no "?") into decoded parameters: `+` and %-escapes are decoded, a repeated name keeps
 * all its values joined by a comma, a name with no `=` (`debug`) has an empty value, an empty name is dropped.
 */
export function parseQueryString(query: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const part of query.split("&")) {
    const equals = part.indexOf("=");
    const name = decode(equals === -1 ? part : part.slice(0, equals));
    if (name === "") continue;
    const value = equals === -1 ? "" : decode(part.slice(equals + 1));
    params[name] = name in params ? `${params[name]},${value}` : value;
  }
  return params;
}

/** Host and port out of `user:pass@host:8080` / `[::1]:8080`; undefined when the authority isn't well-formed. */
function parseAuthority(authority: string): { hostname: string; port: string } | undefined {
  const hostAndPort = authority.slice(authority.lastIndexOf("@") + 1);
  const match = /^(\[[^\]]*\]|[^:]*)(?::(\d*))?$/.exec(hostAndPort);
  return match ? { hostname: match[1], port: match[2] ?? "" } : undefined;
}

function build(protocol: string, hostname: string, port: string, pathname: string, rawSearch: string | undefined): ParsedUrl {
  const search = rawSearch === "?" ? "" : (rawSearch ?? "");
  return { protocol, hostname, port, pathname, search, params: parseQueryString(search.slice(1)) };
}

function parseWhole(text: string): ParsedUrl | undefined {
  const absolute = ABSOLUTE_URL.exec(text);
  if (absolute) {
    const [, protocol, authority, pathname, search] = absolute;
    const host = parseAuthority(authority);
    if (!host || (host.hostname === "" && pathname === "")) return undefined;
    return build(protocol.toLowerCase(), host.hostname, host.port, pathname, search);
  }

  const path = PATH_URL.exec(text);
  return path ? build("", "", "", path[1], path[2]) : undefined;
}

/**
 * Parses a URL into protocol, hostname, port, pathname, search and decoded query parameters. The whole value can
 * be an absolute URL (`https://shop.example.com:8443/search?q=boots`) or just a path (`/search?q=boots`, `/login`),
 * in which case protocol, hostname and port are empty. A URL (or a path with a query string) inside text is found too:
 * `GET /search?q=a HTTP/1.1`. Returns undefined when the value holds none.
 */
export function tryParseUrl(text: string): ParsedUrl | undefined {
  const trimmed = text.trim();
  const whole = parseWhole(trimmed);
  if (whole) return whole;

  const absolute = EMBEDDED_ABSOLUTE_URL.exec(trimmed);
  if (absolute) return parseWhole(absolute[0].replace(TRAILING_PUNCTUATION, ""));

  const path = EMBEDDED_PATH_WITH_QUERY.exec(trimmed);
  return path ? parseWhole(path[1]) : undefined;
}

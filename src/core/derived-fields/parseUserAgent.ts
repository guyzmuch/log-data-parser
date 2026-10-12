/** What a user agent string tells. A part it doesn't tell is "". */
export interface UserAgentInfo {
  browser: string;
  browserVersion: string;
  os: string;
  /** "desktop", "mobile", "tablet", "bot", or "" when it can't be told (e.g. a command-line tool). */
  device: string;
}

export type UserAgentPart = keyof UserAgentInfo;

interface Rule {
  name: string;
  /** Group 1, when present, is the version. */
  pattern: RegExp;
}

const BOTS =
  /\b(Googlebot|bingbot|DuckDuckBot|YandexBot|Baiduspider|Applebot|AhrefsBot|SemrushBot|facebookexternalhit|Twitterbot|Slackbot|GPTBot|ClaudeBot)(?:\/([\d.]+))?/i;

/** HTTP clients and command-line tools: they put their name and version first, `curl/8.4.0`. */
const TOOLS =
  /^(curl|Wget|python-requests|Python-urllib|okhttp|Go-http-client|PostmanRuntime|axios|node-fetch|undici|Apache-HttpClient|insomnia|HTTPie|Java)\/([\d.]+)/i;

/**
 * Browsers, most specific first: most user agents also name the browsers they descend from (Edge says
 * "Chrome" and "Safari", Chrome says "Safari"), so the first match wins.
 */
const BROWSERS: Rule[] = [
  { name: "Edge", pattern: /\bEdg(?:e|A|iOS)?\/([\d.]+)/ },
  { name: "Opera", pattern: /\b(?:OPR|Opera)\/([\d.]+)/ },
  { name: "Samsung Internet", pattern: /\bSamsungBrowser\/([\d.]+)/ },
  { name: "Yandex Browser", pattern: /\bYaBrowser\/([\d.]+)/ },
  { name: "Vivaldi", pattern: /\bVivaldi\/([\d.]+)/ },
  { name: "Chrome", pattern: /\bCriOS\/([\d.]+)/ },
  { name: "Firefox", pattern: /\bFxiOS\/([\d.]+)/ },
  { name: "Firefox", pattern: /\bFirefox\/([\d.]+)/ },
  { name: "Chromium", pattern: /\bChromium\/([\d.]+)/ },
  { name: "Chrome", pattern: /\bChrome\/([\d.]+)/ },
  { name: "Safari", pattern: /\bVersion\/([\d.]+).*\bSafari\// },
  { name: "Internet Explorer", pattern: /\bMSIE ([\d.]+)/ },
  { name: "Internet Explorer", pattern: /\bTrident\/.*\brv:([\d.]+)/ },
];

const WINDOWS_VERSIONS: Record<string, string> = {
  "10.0": "Windows 10/11", // Windows 11 still says "Windows NT 10.0"
  "6.3": "Windows 8.1",
  "6.2": "Windows 8",
  "6.1": "Windows 7",
  "6.0": "Windows Vista",
  "5.2": "Windows XP",
  "5.1": "Windows XP",
};

/** Mobile systems before their desktop relatives: iOS says "like Mac OS X", Android says "Linux". */
function osOf(ua: string): string {
  let match = /Windows Phone(?: OS)? ([\d.]+)/.exec(ua);
  if (match) return `Windows Phone ${match[1]}`;
  match = /Windows NT ([\d.]+)/.exec(ua);
  if (match) return WINDOWS_VERSIONS[match[1]] ?? `Windows NT ${match[1]}`;
  if (/\bWindows\b/.test(ua)) return "Windows";
  match = /(?:iPhone|CPU) OS (\d+(?:_\d+)*)/.exec(ua);
  if (match) return `iOS ${match[1].replace(/_/g, ".")}`;
  if (/\b(?:iPhone|iPad|iPod)\b/.test(ua)) return "iOS";
  match = /Android ([\d.]+)/.exec(ua);
  if (match) return `Android ${match[1]}`;
  if (/\bAndroid\b/.test(ua)) return "Android";
  if (/\bCrOS\b/.test(ua)) return "ChromeOS";
  match = /Mac OS X (\d+(?:[_.]\d+)*)/.exec(ua);
  if (match) return `macOS ${match[1].replace(/_/g, ".")}`;
  if (/\bMacintosh\b/.test(ua)) return "macOS";
  if (/\bLinux\b/.test(ua)) return "Linux";
  return "";
}

function deviceOf(ua: string, os: string): string {
  if (/\b(?:iPad|Tablet|PlayBook|Silk)\b/.test(ua) || (/\bAndroid\b/.test(ua) && !/\bMobile\b/.test(ua))) return "tablet";
  if (/\b(?:Mobi|Mobile|iPhone|iPod|Windows Phone)\b/.test(ua)) return "mobile";
  if (/^(?:Windows|macOS|Linux|ChromeOS)/.test(os)) return "desktop";
  return "";
}

const EMPTY: UserAgentInfo = { browser: "", browserVersion: "", os: "", device: "" };

/**
 * Splits a user agent string into browser, version, OS and device, with a fixed set of patterns for the
 * common browsers, bots and HTTP tools. A blank or "-" value (no user agent sent) gives blanks.
 */
export function parseUserAgent(value: string): UserAgentInfo {
  const ua = value.trim();
  if (ua === "" || ua === "-") return EMPTY;

  const bot = BOTS.exec(ua);
  if (bot) return { browser: bot[1], browserVersion: bot[2] ?? "", os: "", device: "bot" };

  const tool = TOOLS.exec(ua);
  if (tool) return { browser: tool[1], browserVersion: tool[2], os: osOf(ua), device: "" };

  const os = osOf(ua);
  const rule = BROWSERS.find((candidate) => candidate.pattern.test(ua));
  const version = rule ? (rule.pattern.exec(ua)?.[1] ?? "") : "";
  return { browser: rule?.name ?? "", browserVersion: version, os, device: deviceOf(ua, os) };
}

/** Whether a value looks like a user agent string, for the "user agent" hint. */
export function looksLikeUserAgent(value: string): boolean {
  const ua = value.trim();
  return /^(?:Mozilla|Opera)\/\d/.test(ua) || TOOLS.test(ua) || BOTS.test(ua);
}

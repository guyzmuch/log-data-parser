import { describe, expect, it } from "vitest";
import { parseQueryString, tryParseUrl } from "@/core/derived-fields/parseUrl";

describe("tryParseUrl: absolute URLs", () => {
  it("parses every part of a full URL, dropping the fragment", () => {
    expect(tryParseUrl("https://shop.example.com:8443/search/boots?q=hiking+boots&page=2#results")).toEqual({
      protocol: "https",
      hostname: "shop.example.com",
      port: "8443",
      pathname: "/search/boots",
      search: "?q=hiking+boots&page=2",
      params: { q: "hiking boots", page: "2" },
    });
  });

  it("leaves the port empty when the URL doesn't write one", () => {
    expect(tryParseUrl("https://shop.example.com/cart")).toMatchObject({ hostname: "shop.example.com", port: "" });
  });

  it("keeps an explicit default port as written", () => {
    expect(tryParseUrl("https://shop.example.com:443/cart")?.port).toBe("443");
  });

  it("handles a URL with no path, no query, or neither", () => {
    expect(tryParseUrl("http://localhost:3000")).toMatchObject({ hostname: "localhost", port: "3000", pathname: "", search: "" });
    expect(tryParseUrl("https://x.com?a=1")).toMatchObject({ pathname: "", search: "?a=1", params: { a: "1" } });
    expect(tryParseUrl("https://x.com/a/b")).toMatchObject({ pathname: "/a/b", search: "", params: {} });
  });

  it("lowercases the protocol but keeps the host as written", () => {
    expect(tryParseUrl("HTTPS://Shop.Example.com/A")).toMatchObject({ protocol: "https", hostname: "Shop.Example.com", pathname: "/A" });
  });

  it("drops credentials and reads IPv4, IPv6 and non-http schemes", () => {
    expect(tryParseUrl("https://user:secret@example.com:81/x")).toMatchObject({ hostname: "example.com", port: "81" });
    expect(tryParseUrl("http://10.0.1.11:9100/metrics")).toMatchObject({ hostname: "10.0.1.11", port: "9100" });
    expect(tryParseUrl("http://[::1]:8080/x")).toMatchObject({ hostname: "[::1]", port: "8080" });
    expect(tryParseUrl("ftp://files.example.com/pub/a.txt")).toMatchObject({ protocol: "ftp", pathname: "/pub/a.txt" });
  });

  it("treats a lone ? as no query", () => {
    expect(tryParseUrl("https://x.com/a?")).toMatchObject({ search: "", params: {} });
  });

  it("rejects malformed authorities and empty ones", () => {
    for (const value of ["http://", "http://a:b:c/x", "http://host:port/x", "://x.com"]) {
      expect(tryParseUrl(value), value).toBeUndefined();
    }
  });
});

describe("tryParseUrl: paths without a host", () => {
  it("parses a path with a query, leaving protocol, hostname and port empty", () => {
    expect(tryParseUrl("/cart/add?sku=BT-4471&qty=2")).toEqual({
      protocol: "",
      hostname: "",
      port: "",
      pathname: "/cart/add",
      search: "?sku=BT-4471&qty=2",
      params: { sku: "BT-4471", qty: "2" },
    });
  });

  it("parses paths with no query: params stay empty", () => {
    for (const value of ["/checkout", "/login", "/api", "/health", "/", "/api/v2/users/42"]) {
      expect(tryParseUrl(value), value).toMatchObject({ pathname: value, search: "", params: {}, hostname: "" });
    }
  });

  it("is not fooled by a protocol-relative // prefix or a fragment", () => {
    expect(tryParseUrl("//cdn.example.com/a")).toBeUndefined();
    expect(tryParseUrl("/docs#install")).toMatchObject({ pathname: "/docs", search: "" });
  });
});

describe("tryParseUrl: URLs inside text", () => {
  it("finds a path with a query in a request line", () => {
    expect(tryParseUrl("GET /search?q=a&sort=asc HTTP/1.1")).toMatchObject({ pathname: "/search", params: { q: "a", sort: "asc" } });
  });

  it("finds an absolute URL in text, without trailing punctuation", () => {
    expect(tryParseUrl('Referrer: "https://www.google.com/search?q=boots".')).toMatchObject({
      hostname: "www.google.com",
      params: { q: "boots" },
    });
    expect(tryParseUrl("see (https://x.com/a?b=1), then")).toMatchObject({ hostname: "x.com", params: { b: "1" } });
  });

  it("does not take a bare path or a file path in a sentence for a URL", () => {
    expect(tryParseUrl("error while reading /var/log/syslog today")).toBeUndefined();
    expect(tryParseUrl("GET /health HTTP/1.1")).toBeUndefined();
  });

  it("rejects text without a URL", () => {
    for (const value of ["", "   ", "plain text", "why? because", "a/b/c", "foo=bar&x=1", "2026-01-15T12:30:00Z", "12:30:00", "01/15/2026", "mailto:a@b.com"]) {
      expect(tryParseUrl(value), value).toBeUndefined();
    }
  });
});

describe("tryParseUrl: query parameters", () => {
  it("decodes + and %-escapes, and keeps a stray % as it is", () => {
    expect(tryParseUrl("/s?q=red+boots%20%26+socks&x=100%")?.params).toEqual({ q: "red boots & socks", x: "100%" });
  });

  it("decodes an encoded URL nested in a parameter without parsing it further", () => {
    expect(tryParseUrl("/login?redirect=%2Faccount%2Forders%3Fstatus%3Dopen&lang=fr")?.params).toEqual({
      redirect: "/account/orders?status=open",
      lang: "fr",
    });
  });

  it("joins repeated names, and gives a name without = or with an empty value an empty string", () => {
    expect(tryParseUrl("/s?tag=a&tag=b&debug&empty=")?.params).toEqual({ tag: "a,b", debug: "", empty: "" });
  });

  it("keeps = signs inside a value and unusual parameter names", () => {
    expect(tryParseUrl("/s?token=abc==&$filter=a+eq+1&list[]=1")?.params).toEqual({
      token: "abc==",
      $filter: "a eq 1",
      "list[]": "1",
    });
  });

  it("drops empty names and empty segments", () => {
    expect(tryParseUrl("/s?=1&&a=2&")?.params).toEqual({ a: "2" });
  });

  it("parses the search of a URL with a fragment containing ?", () => {
    expect(tryParseUrl("/a?x=1#frag?y=2")?.params).toEqual({ x: "1" });
  });
});

describe("parseQueryString", () => {
  it("returns an empty object for an empty string", () => {
    expect(parseQueryString("")).toEqual({});
  });
});

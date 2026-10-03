import { describe, expect, it } from "vitest";
import {
  COLOR_COUNT,
  COLOR_HUES,
  colorIndexOf,
  normalizeColorKey,
  TONE_HUES,
  toneOf,
  valueColor,
} from "@/core/display/valueColor";

describe("colorIndexOf (the hashed colors)", () => {
  it("is deterministic and always in range", () => {
    for (const value of ["GET", "x", "", "日本語", "a very long value ".repeat(50)]) {
      const index = colorIndexOf(value);
      expect(index).toBe(colorIndexOf(value));
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(COLOR_COUNT);
    }
  });

  it("has a hue for every color", () => {
    expect(COLOR_HUES).toHaveLength(COLOR_COUNT);
  });

  it("ignores letter case and surrounding blanks", () => {
    expect(colorIndexOf("  Post ")).toBe(colorIndexOf("post"));
    expect(normalizeColorKey("  Error ")).toBe("error");
  });

  it("is pinned: these values keep these colors, because the seed must not change by accident", () => {
    expect(["get", "post", "put", "delete", "patch"].map(colorIndexOf)).toEqual([6, 1, 4, 2, 0]);
  });

  it("keeps every hashed color well away from the hue of every fixed tone", () => {
    const circular = (a: number, b: number) => Math.min(Math.abs(a - b) % 360, 360 - (Math.abs(a - b) % 360));
    for (const hue of COLOR_HUES) {
      for (const tone of ["green", "red", "amber", "blue", "crimson"] as const) {
        expect(circular(hue, TONE_HUES[tone]), `${hue} vs ${tone}`).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it.each([
    ["HTTP methods", ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]],
    ["protocols", ["http", "https"]],
    ["transports", ["tcp", "udp"]],
    ["actions", ["login", "logout", "search", "purchase"]],
    ["environments", ["prod", "staging", "dev", "test"]],
    ["formats", ["json", "xml", "csv"]],
  ])("gives the usual %s different colors", (_name, values) => {
    expect(new Set(values.map(colorIndexOf)).size).toBe(values.length);
  });

  it("spreads many different values over most of the colors", () => {
    const used = new Set(Array.from({ length: 200 }, (_, i) => colorIndexOf(`value-${i}`)));
    expect(used.size).toBe(COLOR_COUNT);
  });
});

describe("toneOf (values with a fixed color)", () => {
  it.each([
    ["good outcomes are green", ["ok", "success", "succeeded", "pass", "passed", "true", "yes", "up", "healthy"], "green"],
    ["bad outcomes are red", ["fail", "failed", "failure", "false", "no", "down", "unhealthy", "denied"], "red"],
    ["quiet log levels are grey", ["trace", "debug"], "grey"],
    ["info levels are blue", ["info", "notice"], "blue"],
    ["warnings are amber", ["warn", "warning"], "amber"],
    ["errors are red, like a failure", ["error", "err"], "red"],
    ["severe levels are crimson", ["critical", "fatal", "severe", "emergency", "alert"], "crimson"],
    ["2xx statuses are green", ["200", "201", "204", "299", "2xx"], "green"],
    ["3xx statuses are blue", ["301", "304", "3xx"], "blue"],
    ["4xx statuses are amber", ["400", "404", "429", "4xx"], "amber"],
    ["5xx statuses are red", ["500", "502", "503", "5xx"], "red"],
    ["1xx statuses are grey", ["100", "101", "1xx"], "grey"],
  ] as const)("%s", (_name, values, tone) => {
    for (const value of values) expect(toneOf(value), value).toBe(tone);
  });

  it("ignores letter case and blanks", () => {
    expect(toneOf("  OK ")).toBe("green");
    expect(toneOf("ERROR")).toBe("red");
    expect(toneOf("Warning")).toBe("amber");
  });

  it("has no tone for anything else, including numbers that are not statuses", () => {
    for (const value of ["GET", "login", "host-01", "", "42", "99", "600", "1000", "20", "6xx", "constructor", "toString"]) {
      expect(toneOf(value), value).toBeUndefined();
    }
  });
});

describe("valueColor", () => {
  it("uses the tone when there is one, so a meaning has the same color in every column", () => {
    expect(valueColor("ok")).toEqual(valueColor("SUCCESS"));
    expect(valueColor("error")).toEqual(valueColor("500"));
    expect(valueColor("warn")).toEqual(valueColor("404"));
    expect(valueColor("ok").id).toBe("green");
    expect(valueColor("fail").id).toBe("red");
    expect(valueColor("debug").neutral).toBe(true);
    expect(valueColor("info").neutral).toBe(false);
  });

  it("draws the severe levels as a solid, stronger red", () => {
    expect(valueColor("fatal")).toMatchObject({ id: "crimson", hue: TONE_HUES.red, strong: true });
    expect(valueColor("error").strong).toBe(false);
  });

  it("falls back to the hashed color for everything else", () => {
    expect(valueColor("POST")).toEqual({ id: "h1", hue: COLOR_HUES[1], neutral: false, strong: false });
  });

  it("keeps good and bad apart, and the log levels in order", () => {
    const ids = (values: string[]) => values.map((value) => valueColor(value).id);
    expect(ids(["ok", "fail"])).toEqual(["green", "red"]);
    expect(ids(["true", "false"])).toEqual(["green", "red"]);
    expect(ids(["success", "error"])).toEqual(["green", "red"]);
    expect(ids(["yes", "no"])).toEqual(["green", "red"]);
    expect(ids(["debug", "info", "warn", "error", "fatal"])).toEqual(["grey", "blue", "amber", "red", "crimson"]);
    expect(ids(["200", "301", "404", "500"])).toEqual(["green", "blue", "amber", "red"]);
  });
});

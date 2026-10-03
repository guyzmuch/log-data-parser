import { describe, expect, it } from "vitest";
import type { Field } from "@/core/dataset/types";
import { computeDerivedFields } from "@/core/derived-fields/computeDerivedFields";
import type { DerivedFieldSpec } from "@/core/derived-fields/types";

const KNOWN_INSTANT = "2026-01-15T12:30:00.000Z";

function field(value: string): Field {
  return { key: "created", value };
}

describe("computeDerivedFields", () => {
  it("returns nothing for specs that don't target this field", () => {
    const specs: DerivedFieldSpec[] = [{ kind: "date", sourceFieldKey: "other", representation: "iso" }];
    expect(computeDerivedFields(field(KNOWN_INSTANT), specs)).toEqual([]);
  });

  it("formats a valid value as ISO 8601", () => {
    const specs: DerivedFieldSpec[] = [{ kind: "date", sourceFieldKey: "created", representation: "iso" }];
    const [result] = computeDerivedFields(field(KNOWN_INSTANT), specs);
    expect(result).toEqual({ key: "created (ISO)", value: KNOWN_INSTANT, sourceFieldKey: "created" });
  });

  it("formats a valid value in an explicit timezone", () => {
    const specs: DerivedFieldSpec[] = [
      { kind: "date", sourceFieldKey: "created", representation: "timezone", timezone: "Europe/Paris" },
    ];
    const [result] = computeDerivedFields(field(KNOWN_INSTANT), specs);
    const expected = new Intl.DateTimeFormat(undefined, {
      timeZone: "Europe/Paris",
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(KNOWN_INSTANT));
    expect(result).toEqual({ key: "created (Europe/Paris)", value: expected, sourceFieldKey: "created" });
  });

  it("marks an unparseable value as a Parse Error for iso/timezone representations", () => {
    const specs: DerivedFieldSpec[] = [
      { kind: "date", sourceFieldKey: "created", representation: "iso" },
      { kind: "date", sourceFieldKey: "created", representation: "timezone" },
    ];
    const results = computeDerivedFields(field("not a date"), specs);
    expect(results).toEqual([
      { key: "created (ISO)", value: "", sourceFieldKey: "created", parseError: true },
      { key: "created (local time)", value: "", sourceFieldKey: "created", parseError: true },
    ]);
  });

  it("marks an invalid IANA timezone as a Parse Error rather than throwing", () => {
    const specs: DerivedFieldSpec[] = [
      { kind: "date", sourceFieldKey: "created", representation: "timezone", timezone: "Not/AZone" },
    ];
    const [result] = computeDerivedFields(field(KNOWN_INSTANT), specs);
    expect(result).toEqual({ key: "created (Not/AZone)", value: "", sourceFieldKey: "created", parseError: true });
  });

  it("computes the full default pair for a valid date in one call", () => {
    const specs: DerivedFieldSpec[] = [
      { kind: "date", sourceFieldKey: "created", representation: "iso" },
      { kind: "date", sourceFieldKey: "created", representation: "timezone" },
    ];
    const results = computeDerivedFields(field(KNOWN_INSTANT), specs);
    expect(results.map((f) => f.key)).toEqual(["created (ISO)", "created (local time)"]);
    expect(results.every((f) => f.parseError === undefined)).toBe(true);
  });

  describe("utc date and time split", () => {
    const split: DerivedFieldSpec[] = [
      { kind: "date", sourceFieldKey: "created", representation: "utc-date" },
      { kind: "date", sourceFieldKey: "created", representation: "utc-time" },
    ];
    const values = (value: string) => computeDerivedFields(field(value), split).map((f) => f.value);

    it("splits an instant into its UTC date and time", () => {
      expect(computeDerivedFields(field(KNOWN_INSTANT), split)).toEqual([
        { key: "created (date)", value: "2026-01-15", sourceFieldKey: "created" },
        { key: "created (time)", value: "12:30:00", sourceFieldKey: "created" },
      ]);
    });

    it("keeps milliseconds only when there are some", () => {
      expect(values("2026-01-15T12:30:48.137Z")).toEqual(["2026-01-15", "12:30:48.137"]);
      expect(values("2026-01-15T12:30:48.100Z")).toEqual(["2026-01-15", "12:30:48.100"]);
    });

    it("converts epoch seconds and milliseconds", () => {
      expect(values("1768480200")).toEqual(["2026-01-15", "12:30:00"]);
      expect(values("1768480200137")).toEqual(["2026-01-15", "12:30:00.137"]);
    });

    it("uses UTC whatever the offset written in the value", () => {
      // 23:30 at +02:00 is 21:30 UTC the same day; 01:30 at +02:00 is 23:30 UTC the day before.
      expect(values("2026-01-15T23:30:00+02:00")).toEqual(["2026-01-15", "21:30:00"]);
      expect(values("2026-01-16T01:30:00+02:00")).toEqual(["2026-01-15", "23:30:00"]);
    });

    it("marks an unparseable value as a Parse Error in both columns", () => {
      expect(computeDerivedFields(field("not a date"), split)).toEqual([
        { key: "created (date)", value: "", sourceFieldKey: "created", parseError: true },
        { key: "created (time)", value: "", sourceFieldKey: "created", parseError: true },
      ]);
    });
  });

  describe("unescape", () => {
    it("un-escapes common backslash sequences", () => {
      const specs: DerivedFieldSpec[] = [{ kind: "unescape", sourceFieldKey: "created" }];
      const [result] = computeDerivedFields(field('He said \\"hi\\"'), specs);
      expect(result).toEqual({ key: "created (unescaped)", value: 'He said "hi"', sourceFieldKey: "created" });
    });
  });

  describe("json-key", () => {
    it("extracts a top-level key from a JSON object value", () => {
      const specs: DerivedFieldSpec[] = [{ kind: "json-key", sourceFieldKey: "created", jsonKey: "userId" }];
      const [result] = computeDerivedFields(field('{"userId":"u-123","name":"alice"}'), specs);
      expect(result).toEqual({ key: "created.userId", value: "u-123", sourceFieldKey: "created" });
    });

    it("marks non-JSON input as a Parse Error", () => {
      const specs: DerivedFieldSpec[] = [{ kind: "json-key", sourceFieldKey: "created", jsonKey: "userId" }];
      const [result] = computeDerivedFields(field("not json"), specs);
      expect(result).toEqual({ key: "created.userId", value: "", sourceFieldKey: "created", parseError: true });
    });

    it("returns an empty (not error) value when the key is simply absent on this record", () => {
      const specs: DerivedFieldSpec[] = [{ kind: "json-key", sourceFieldKey: "created", jsonKey: "missingKey" }];
      const [result] = computeDerivedFields(field('{"userId":"u-123"}'), specs);
      expect(result).toEqual({ key: "created.missingKey", value: "", sourceFieldKey: "created" });
      expect(result.parseError).toBeUndefined();
    });
  });
});

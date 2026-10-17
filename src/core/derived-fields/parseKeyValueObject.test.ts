import { describe, expect, it } from "vitest";
import { findKeyValueSet, tryParseKeyValueObject } from "@/core/derived-fields/parseKeyValueObject";

describe("tryParseKeyValueObject", () => {
  it("parses quoted and bare values", () => {
    expect(tryParseKeyValueObject('{foo="bar",count=34}')).toEqual({ foo: "bar", count: "34" });
  });

  it("finds the label set inside a whole Prometheus line", () => {
    const line = 'http_requests_total{job="api",instance="10.0.1.11:9100",status="200"} 10482 1768480200123';
    expect(tryParseKeyValueObject(line)).toEqual({ job: "api", instance: "10.0.1.11:9100", status: "200" });
  });

  it("keeps commas, braces and escaped quotes inside quoted values", () => {
    expect(tryParseKeyValueObject('{msg="a, b} \\"c\\"",n=1}')).toEqual({ msg: 'a, b} "c"', n: "1" });
  });

  it("tolerates spaces around separators and an empty quoted value", () => {
    expect(tryParseKeyValueObject('{ a = "x" , b=  2 , c="" }')).toEqual({ a: "x", b: "2", c: "" });
  });

  it("returns the text around the braces, joined and trimmed", () => {
    const line = 'http_requests_total{job="api"} 10482 1768480200123';
    expect(findKeyValueSet(line)?.text).toBe("http_requests_total 10482 1768480200123");
    expect(findKeyValueSet('{foo="bar"}')?.text).toBe("");
    expect(findKeyValueSet('before {foo="bar"}')?.text).toBe("before");
  });

  it("rejects JSON, empty sets, unclosed or nested braces and non key=value text", () => {
    for (const value of ['{"a":1}', "{}", '{a="b"', '{a={b="c"}}', "{foo}", "plain text", "{1=2}", '{a="b}']) {
      expect(tryParseKeyValueObject(value), value).toBeUndefined();
    }
  });
});

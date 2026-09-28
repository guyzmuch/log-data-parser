import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDataset } from "@/core/parsing/parseDataset";
import { createDefaultDisplayConfig, createProfile } from "@/core/profile/createProfile";
import { BUILT_IN_PROFILES, isBuiltInProfile } from "@/core/profile/builtInProfiles";

const SAMPLES_DIR = fileURLToPath(new URL("../../../public/samples/", import.meta.url));

function readSample(filename: string): string {
  // Sample files end with a trailing newline; parseDataset already drops
  // exactly one trailing blank line, so no trimming needed here.
  return readFileSync(`${SAMPLES_DIR}${filename}`, "utf-8");
}

function findBuiltIn(id: string) {
  const profile = BUILT_IN_PROFILES.find((p) => p.id === id);
  if (!profile) throw new Error(`built-in Profile not found: ${id}`);
  return profile;
}

describe("BUILT_IN_PROFILES", () => {
  it("includes at least one built-in Profile", () => {
    expect(BUILT_IN_PROFILES.length).toBeGreaterThan(0);
  });

  it("every built-in Profile id is recognized by isBuiltInProfile", () => {
    for (const profile of BUILT_IN_PROFILES) {
      expect(isBuiltInProfile(profile)).toBe(true);
    }
  });

  it("a regular user Profile is not mistaken for a built-in one", () => {
    const userProfile = createProfile({
      name: "mine",
      parsing: BUILT_IN_PROFILES[0].parsing,
      display: createDefaultDisplayConfig([]),
    });
    expect(isBuiltInProfile(userProfile)).toBe(false);
  });

  describe("csv-with-header", () => {
    it("correctly parses public/samples/csv-with-header.csv", () => {
      const profile = findBuiltIn("builtin:csv-with-header");
      const { fieldNames, records } = parseDataset(readSample("csv-with-header.csv"), profile.parsing);

      expect(fieldNames).toEqual(["id", "name", "role", "active"]);
      expect(records).toHaveLength(3);
      expect(records[0].fields.map((f) => f.value)).toEqual(["1", "alice", "engineer", "true"]);
    });
  });

  describe("aws-alb-access-log (approximate)", () => {
    it("parses public/samples/aws-alb-access-log.log, one Record per line", () => {
      const profile = findBuiltIn("builtin:aws-alb-access-log");
      const { records } = parseDataset(readSample("aws-alb-access-log.log"), profile.parsing);
      expect(records).toHaveLength(3);
    });

    it("documents the known fragmentation: the quoted multi-word request field splits into extra columns", () => {
      // Real ALB access logs have 29 documented fields; our naive space-split
      // produces more than that once "GET http://... HTTP/1.1" (3 tokens
      // inside one quoted field) gets split apart — see the module doc
      // comment in builtInProfiles.ts.
      const profile = findBuiltIn("builtin:aws-alb-access-log");
      const { records } = parseDataset(readSample("aws-alb-access-log.log"), profile.parsing);
      expect(records[0].fields.length).toBeGreaterThan(29);
    });

    it("names the reliably-aligned prefix fields, then falls back to generic naming past the fragmentation point", () => {
      const profile = findBuiltIn("builtin:aws-alb-access-log");
      const { records } = parseDataset(readSample("aws-alb-access-log.log"), profile.parsing);
      const keys = records[0].fields.map((f) => f.key);
      expect(keys.slice(0, 12)).toEqual([
        "type",
        "time",
        "elb",
        "client_port",
        "target_port",
        "request_processing_time",
        "target_processing_time",
        "response_processing_time",
        "elb_status_code",
        "target_status_code",
        "received_bytes",
        "sent_bytes",
      ]);
      expect(keys[12]).toBe("Field 13"); // the fragmenting "request" field, left generic
    });
  });

  describe("linux-syslog (approximate)", () => {
    it("parses public/samples/linux-syslog.log, one Record per line", () => {
      const profile = findBuiltIn("builtin:linux-syslog");
      const { records } = parseDataset(readSample("linux-syslog.log"), profile.parsing);
      expect(records).toHaveLength(4);
    });

    it("documents the known fragmentation: the free-text message splits into many extra columns", () => {
      const profile = findBuiltIn("builtin:linux-syslog");
      const { records } = parseDataset(readSample("linux-syslog.log"), profile.parsing);
      // Conceptually ~5 fields (month, day, time, host, process[pid]:, then message) —
      // the free-text message alone blows well past that.
      expect(records[0].fields.length).toBeGreaterThan(6);
    });

    it("names the reliably-aligned prefix fields, then falls back to generic naming past the fragmentation point", () => {
      const profile = findBuiltIn("builtin:linux-syslog");
      const { records } = parseDataset(readSample("linux-syslog.log"), profile.parsing);
      const keys = records[0].fields.map((f) => f.key);
      expect(keys.slice(0, 5)).toEqual(["month", "day", "time", "host", "process"]);
      expect(keys[5]).toBe("Field 6"); // the fragmenting free-text message, left generic
    });
  });

  describe("apache-combined-logstash (approximate)", () => {
    it("parses public/samples/apache-combined-logstash.log, one Record per line", () => {
      const profile = findBuiltIn("builtin:apache-combined-logstash");
      const { records } = parseDataset(readSample("apache-combined-logstash.log"), profile.parsing);
      expect(records).toHaveLength(3);
    });

    it("documents the known fragmentation: quoted request/referrer/user-agent fields split into extra columns", () => {
      const profile = findBuiltIn("builtin:apache-combined-logstash");
      const { records } = parseDataset(readSample("apache-combined-logstash.log"), profile.parsing);
      // Conceptually 9 fields (client, ident, authuser, [timestamp], "request", status, bytes, "referrer", "user-agent").
      expect(records[0].fields.length).toBeGreaterThan(9);
    });

    it("names the reliably-aligned prefix fields, then falls back to generic naming past the fragmentation point", () => {
      const profile = findBuiltIn("builtin:apache-combined-logstash");
      const { records } = parseDataset(readSample("apache-combined-logstash.log"), profile.parsing);
      const keys = records[0].fields.map((f) => f.key);
      expect(keys.slice(0, 5)).toEqual(["client_ip", "ident", "authuser", "timestamp_date", "timestamp_offset"]);
      expect(keys[5]).toBe("Field 6"); // the fragmenting quoted "request" field, left generic
    });
  });

  describe("apm-transaction-log", () => {
    it("cleanly parses public/samples/apm-transaction-log.log (no quoting/fragmentation issue by design)", () => {
      const profile = findBuiltIn("builtin:apm-transaction-log");
      const { fieldNames, records } = parseDataset(readSample("apm-transaction-log.log"), profile.parsing);

      expect(fieldNames).toEqual(["timestamp", "service", "transaction_id", "trace_id", "duration_ms", "status", "message"]);
      expect(records).toHaveLength(4);
      expect(records[0].fields.map((f) => f.value)).toEqual([
        "2026-01-15T12:30:00.000Z",
        "checkout-service",
        "txn-88231",
        "trace-4471a",
        "142",
        "success",
        "Payment captured",
      ]);
    });
  });
});

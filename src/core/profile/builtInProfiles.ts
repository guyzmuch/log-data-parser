import type { DerivedFieldSpec } from "@/core/derived-fields/types";
import type { Profile } from "@/core/profile/types";

/** Ids of built-in Profiles all share this prefix — see Built-in Profile in CONTEXT.md. */
const BUILT_IN_ID_PREFIX = "builtin:";

// Fixed, not `new Date().toISOString()` — a built-in Profile's timestamps
// must be stable across every app load, not regenerated each time.
const FIXED_TIMESTAMP = "2026-01-01T00:00:00.000Z";

function emptyDisplay(): Profile["display"] {
  return { visibleFieldKeys: [], fieldLabels: {}, derivedFieldSelections: [] };
}

/**
 * Ready-made Profile templates shipped with the app (see Built-in Profile in
 * CONTEXT.md). `visibleFieldKeys: []` is intentional: unlike a user Profile,
 * a built-in isn't tied to any specific Dataset's Field names ahead of time —
 * the store defaults to "everything visible" the first time it's actually
 * applied to real data (see applyProfile in useAppStore.ts).
 *
 * Three of these are marked "(approximate)": our parser is delimiter-split
 * only, not quote-aware (see splitDelimitedLine's TODO and the Advanced
 * section of docs/project_idea.md). AWS ALB/S3 access logs, classic Linux
 * syslog, and Apache/Nginx combined logs (the shape Logstash most commonly
 * ingests) all have a quoted or free-text field containing embedded spaces —
 * splitting on space fragments that field into several extra columns instead
 * of one. Shipped anyway, deliberately, with the limitation named in the
 * Profile itself rather than hidden — still a useful starting point, just
 * not a clean one.
 *
 * Their `fieldNames` only cover the PREFIX of fields that reliably stays
 * aligned — up to (not including) the first field that fragments. Everything
 * from there on falls back to generic "fieldN" naming, which parseRecord
 * already does for free (`config.fieldNames?.[i] ?? genericFieldName(i + 1)` — a
 * shorter fieldNames array than the actual split simply runs out and falls
 * through). This gives real names where they're trustworthy without
 * pretending to know what a shifted, post-fragmentation column actually
 * holds. A real fix needs quote-aware / regex-based parsing, both already
 * deferred past v1.
 *
 * Matching sample files live in public/samples/ (one per Profile here).
 */
export const BUILT_IN_PROFILES: Profile[] = [
  {
    id: `${BUILT_IN_ID_PREFIX}csv-with-header`,
    name: "CSV with header (built-in)",
    parsing: {
      kind: "delimiter",
      delimiter: ",",
      hasHeaderRow: true,
      stripQuotes: true,
      // Real CSV: quoted cells may contain commas and line breaks.
      quoteAware: true,
      trimBoundaryPartials: false,
      expectedFieldCount: 0,
    },
    display: emptyDisplay(),
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
  },
  {
    id: `${BUILT_IN_ID_PREFIX}aws-alb-access-log`,
    name: "AWS ALB access log (approximate, built-in)",
    parsing: {
      kind: "delimiter",
      delimiter: " ",
      hasHeaderRow: false,
      stripQuotes: false,
      trimBoundaryPartials: false,
      expectedFieldCount: 0,
      // Real field 13, "request", is the first to fragment (it's a quoted
      // "METHOD URL PROTOCOL" — always 3+ tokens) — everything from there
      // shifts, so only the reliably-aligned fields 1-12 get named.
      fieldNames: [
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
      ],
    },
    display: emptyDisplay(),
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
  },
  {
    id: `${BUILT_IN_ID_PREFIX}linux-syslog`,
    name: "Linux syslog (approximate, built-in)",
    parsing: {
      kind: "delimiter",
      delimiter: " ",
      hasHeaderRow: false,
      stripQuotes: false,
      trimBoundaryPartials: false,
      expectedFieldCount: 0,
      // The free-text message (everything after "process[pid]:") is the
      // first to fragment — only the 5 fields before it are named.
      fieldNames: ["month", "day", "time", "host", "process"],
    },
    display: emptyDisplay(),
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
  },
  {
    id: `${BUILT_IN_ID_PREFIX}apache-combined-logstash`,
    name: "Apache/Nginx combined log — Logstash-style (approximate, built-in)",
    parsing: {
      kind: "delimiter",
      delimiter: " ",
      hasHeaderRow: false,
      stripQuotes: true,
      trimBoundaryPartials: false,
      expectedFieldCount: 0,
      // The quoted "request" field is the first to fragment — the bracketed
      // timestamp before it isn't quote-stripped (brackets, not quotes) so it
      // stays as two tokens too, named individually rather than left generic.
      fieldNames: ["client_ip", "ident", "authuser", "timestamp_date", "timestamp_offset"],
    },
    display: emptyDisplay(),
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
  },
  {
    id: `${BUILT_IN_ID_PREFIX}prometheus-same-metric`,
    name: "Prometheus text format — one metric (built-in)",
    parsing: {
      kind: "delimiter",
      // Split on spaces into "name{labels}", value, timestamp. Approximate: a label value containing a space
      // would fragment the line (quote-aware splitting only handles a quote at the start of a cell).
      // The Derived Fields below then split "name{labels}" into the metric name and one column per label.
      delimiter: " ",
      hasHeaderRow: false,
      stripQuotes: false,
      trimBoundaryPartials: false,
      expectedFieldCount: 0,
      fieldNames: ["metric_labels", "value", "timestamp"],
    },
    display: {
      // "metric_labels" is hidden: the metric name and the label columns replace it.
      visibleFieldKeys: [
        "metric_labels (text)",
        "value",
        "timestamp (local time)",
        "metric_labels.job",
        "metric_labels.instance",
        "metric_labels.method",
        "metric_labels.status",
        "metric_labels.handler",
        "metric_labels.env",
      ],
      fieldLabels: {
        "timestamp (local time)": "time",
        "metric_labels (text)": "metric",
        "metric_labels.job": "job",
        "metric_labels.instance": "instance",
        "metric_labels.method": "method",
        "metric_labels.status": "status",
        "metric_labels.handler": "handler",
        "metric_labels.env": "env",
      },
      derivedFieldSelections: [
        // Only the local time: the raw epoch "timestamp" and an ISO column are left out.
        { kind: "date", sourceFieldKey: "timestamp", representation: "timezone" },
        { kind: "key-value-text", sourceFieldKey: "metric_labels" },
        ...["job", "instance", "method", "status", "handler", "env"].map(
          (key): DerivedFieldSpec => ({ kind: "key-value-key", sourceFieldKey: "metric_labels", key }),
        ),
      ],
    },
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
  },
  {
    id: `${BUILT_IN_ID_PREFIX}apm-transaction-log`,
    name: "APM transaction log — generic (built-in)",
    parsing: {
      kind: "delimiter",
      delimiter: "|",
      hasHeaderRow: true,
      stripQuotes: false,
      trimBoundaryPartials: false,
      expectedFieldCount: 0,
    },
    display: emptyDisplay(),
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
  },
];

export function isBuiltInProfile(profile: Profile): boolean {
  return profile.id.startsWith(BUILT_IN_ID_PREFIX);
}

# Context: log-data-parser

A client-only (no backend) tool for parsing and exploring log/data files in the browser — upload or paste data, split it into columns, search/filter/hide, and save reusable configurations as Profiles.

## Glossary

### Dataset
The whole blob of content a user has uploaded or pasted in one go. Ephemeral by default (see open questions) — not the same as a Profile, which is what gets saved.

### Record
One line within a Dataset. For delimited data this corresponds to one row; for raw logs it's simply one line of text before any splitting happens.

### Field
One named value within a Record, produced by applying a Profile's parsing configuration (e.g. splitting a Record on a delimiter). Distinct from a "column," which is the *display* projection of a Field across all Records.

### Derived Field
A Field computed from another Field rather than produced directly by splitting a Record — e.g. when a parsed Field looks like (or is manually marked as) a timestamp, the Profile proposes Derived Fields for it: ISO 8601 conversion and browser-local-timezone conversion, both by default. (Earlier in implementation a third default — a "raw" passthrough copy of the source value — was tried and dropped: it just duplicated the source Field as a second column, which is never useful since the source Field is already there.) The user can additionally add further timezone-specific Derived Fields for the same source Field (e.g. a fixed "Europe/Paris" conversion alongside the local one) — not limited to a single override. All *proposed* Derived Fields exist as parsed data regardless of whether they're shown; the user decides per Profile which ones become Visible Fields (see Field vs. Visible Field, below). Future transform ideas (base64 decode, JSON explosion — see project_idea.md) are also Derived Fields, deferred past v1.

### Field vs. Visible Field
Parsing a Dataset with a Profile produces the full set of Fields for every Record (including all proposed Derived Fields) — this is the *parsed data*, and it doesn't shrink based on what's shown. A Profile's display config then selects a subset of those as **Visible Fields** — the columns actually rendered, in a given order. This mirrors Kibana's index-fields-vs-displayed-columns split: hiding a Field never discards it from the parsed data, it only removes it from view, and re-showing it later needs no re-parsing.

### Parse Error
The state of a cell whose source value could not be converted for a Derived Field (e.g. a Field manually marked "parse as date" whose value fails `new Date(value)`). Shown in the cell as an "Invalid parse" message, styled to stand out (e.g. red). v1 ships this one built-in error state only; a general user-defined cell-tagging/class system (e.g. per-line comments) is a future idea, not v1 scope.

### Hidden Record
A Record the user has manually removed from view (via multi-select, e.g. ctrl/shift-click) within the current session. Session-only — never saved to the Profile, since a Record's identity isn't stable across different Datasets and a Profile is meant to be reused across them.

### Search
A single text input (not per-column) that matches a term against the value of any Visible Field in a Record. Has a mode toggle: **Highlight** (mark matching values, show all Records) or **Filter** (show only Records with a match).

### Export Scope
A select with three options controlling which Records get included in a CSV export (columns exported are always the current Visible Fields): **All Records** (default), **Excluding Hidden** (drop session-hidden Records), or **Matching Filter** (only Records currently matching an active Search filter). These are distinct, independent scopes the user picks one of — not combinable toggles.

### Expected Field Count
The number of Fields a Profile's parsing config produces for a well-formed Record. Used as the ground truth for detecting a truncated boundary Record (see partial-entry trimming, Profile): a first/last Record with fewer Fields than this is treated as partial. Not computed from majority-vote across the Dataset — a Profile is reused across Datasets and its shape is already known.

### Profile
A saved, reusable configuration a user creates and can pick (or create new) when loading a Dataset. Combines:
- **Parsing config** — how to split a Record into Fields (v1: delimiter-based only; regex-based deferred, see Future Ideas in project_idea.md).
- **Display config** — which Fields are visible, their order, search/highlight state, etc.

Also holds toggles for quote-stripping and partial first/last-Record trimming (trimming compares against the Profile's Expected Field Count, not a majority vote). When a Profile is being created/configured for a new shape of data, the app should preview using Records from the *middle* of the pasted/uploaded content, not the first or last — a copy-paste often clips the very start or end of a line, and building the parsing config off a clipped line would poison the config.

Note: earlier in design discussion this was split into two concepts ("Parsing Rule" vs "Profile"); the user confirmed these should be merged — a Profile is the single saved thing that governs both parsing and display for a given data shape. One Profile applies to an entire Dataset (no per-line/mixed-format parsing in v1).

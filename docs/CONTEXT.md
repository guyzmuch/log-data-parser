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
A Field computed from another Field rather than produced directly by splitting a Record. Four kinds exist:
- **date** — ISO 8601 conversion and a timezone conversion (default: browser-local; the user can add further timezone-specific ones for the same source Field, e.g. a fixed "Europe/Paris" alongside the local one — additive, not a single override). (Earlier a third default — a "raw" passthrough copy — was tried and dropped: it just duplicated the source Field, never useful since the source Field is already there.)
- **trim** — leading/trailing whitespace stripped.
- **unescape** — common backslash escape sequences resolved (`\"`, `\\`, `\n`, `\t`, `\r`) — for a value copy-pasted out of a stringified/escaped source.
- **json-key** — one top-level key extracted from a source Field parsed as a JSON object; one Derived Field per discovered key (nested objects/arrays are stringified back, not recursively exploded further).

Separately from Derived Fields, the parsing rule can mark a column as **"may contain JSON"**: its JSON (nested, inside text, with root-level arrays shown as sub-rows) is parsed into ordinary columns when the Profile is applied — see [JSON_PARSING.md](./JSON_PARSING.md).

All of these are opt-in per Field via a "force as X" action — none apply automatically. A **column-pattern detector** (`detectColumnPatterns`) samples a Field's actual values and surfaces which of these look applicable (majority-vote over the sample, same technique as Expected Field Count) as an informational hint next to the Field in the Columns panel — it only ever *suggests*, never auto-applies; the user still clicks the relevant "force as" action. Known false positive: a column of small integers (e.g. a short numeric id) can look like a valid Unix-epoch-seconds date to the detector, since it genuinely does parse as one.

All *proposed* Derived Fields exist as parsed data regardless of whether they're shown; the user decides per Profile which ones become Visible Fields (see Field vs. Visible Field, below). Derived Fields are always computed from a base Field, not chained from another Derived Field (v1 doesn't support that).

### Field vs. Visible Field
Parsing a Dataset with a Profile produces the full set of Fields for every Record (including all proposed Derived Fields) — this is the *parsed data*, and it doesn't shrink based on what's shown. A Profile's display config then selects a subset of those as **Visible Fields** — the columns actually rendered, in a given order. This mirrors Kibana's index-fields-vs-displayed-columns split: hiding a Field never discards it from the parsed data, it only removes it from view, and re-showing it later needs no re-parsing.

### Parse Error
The state of a cell whose source value couldn't be converted for a Derived Field — a date spec whose value fails to parse, or a json-key spec whose value isn't valid JSON. (A json-key spec whose JSON parses fine but is simply missing that particular key on a given Record is *not* a Parse Error — an empty value, since different Records can legitimately have different JSON shapes.) Shown in the cell as an "Invalid parse" message, styled to stand out (e.g. red). Trim and unescape can't fail, so they never produce a Parse Error. A general user-defined cell-tagging/class system (e.g. per-line comments) is still a future idea, not v1 scope.

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

### Built-in Profile
A Profile shipped with the app itself rather than created by the user — a ready-made template for a common data shape (e.g. "CSV with header"). Built-in Profiles are always offered in the Profile picker alongside the user's own, additively — they never disappear once the user has created their own Profiles. They're fixed presets: applying one to a Dataset works like any other Profile, but they aren't tied to any specific dataset's exact Field names ahead of time (their display config starts with no Visible Fields set, and defaults to "everything visible" the first time they're actually applied to real data).

### Hidden Profile
A Profile (built-in or user-created) the user has removed from the Profile picker's normal view. Distinct from Hidden Record: this hides a *Profile* from the *picker list*, not a *Record* from the *table*. Unlike Hidden Record, Hidden Profile is a persistent preference (survives reload) — it lives outside any single Profile, since it needs to apply to Profiles generally, including built-ins. The picker has a toggle to reveal hidden Profiles again (and un-hide them from there), so hiding is always reversible.

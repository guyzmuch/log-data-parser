# Implementation Plan: log-data-parser (v1)

Greenfield Next.js static-export app. No existing code — this defines the initial structure from scratch, biased toward keeping the parsing/Profile domain logic as framework-free TypeScript so it can be unit-tested without a browser/DOM and reused if the UI layer ever changes. Domain vocabulary throughout (Dataset, Record, Field, Derived Field, Profile, etc.) is defined in [CONTEXT.md](./CONTEXT.md).

## 0. Guiding architectural decisions

- **Domain logic lives outside React.** `src/core/` holds plain TS modules for Dataset, Record, Field, Profile, parsing, and derived-field computation. Zero imports from `react` or `next` in this directory. UI components call into it but never re-implement its logic.
- **Fields never shrink on hide.** The parse step produces the full `Field[]` per `Record` (including all proposed Derived Fields) once, stored in Dataset-scoped state. "Visible Fields" is purely an ordered list of Field keys living in Profile display config; hiding/showing/reordering only touches that list — O(1), no re-parse, no mutation of parsed Records. This must be modeled as two clearly separate pieces of state from day one (a `ParsedDataset` and a `Profile.display`), not derived from a single `visible: boolean` flag on each Field, so it's structurally impossible to accidentally drop parsed data when hiding a column.
- **Profile is the single saved unit** combining parsing config + display config, per CONTEXT.md's merged definition. No separate "Parsing Rule" entity.
- **Static export constraint.** `next.config` uses `output: 'export'`. No API routes, no server actions, no `next/image` optimization loader (`unoptimized: true` if ever needed). All persistence is `localStorage` + file download/upload — plain `<input type=file>` and Blob download links, no File System Access API needed.
- **Extensibility seams for deferred items** (regex parsing, mixed-format datasets, multi-dataset join, JSON/base64 cell transforms): keep `ParsingConfig` and `DerivedFieldSpec` as discriminated unions (`{ kind: 'delimiter', ... }`, `{ kind: 'date', ... }`) so a `{ kind: 'regex' }` or `{ kind: 'json-explode' }` variant can be added later without restructuring. Don't hardcode "delimiter" assumptions into generic Dataset/Record/Profile types.

## 1. Phased build order

### Phase A — Project scaffold
- `create-next-app` (TypeScript, App Router, ESLint), then convert `next.config` to `output: 'export'`, `images.unoptimized: true`, `trailingSlash: true` (so static routes resolve cleanly under Apache).
- Install & init shadcn/ui (`components.json`, Tailwind). Add the component set needed later: `button`, `input`, `select`, `dialog`, `toggle`, `toggle-group`, `table`, `checkbox`, `label`, `badge`, `tabs`, `separator`. Data-grid is hand-built on shadcn `table` — no heavy grid library needed for v1 (Dataset is in-memory only; revisit virtualization only if perf requires it).
- Playwright install (`npm init playwright@latest`), `webServer` config serving the static `out/` directory (e.g. via `npx serve`) rather than `next dev`.
- Folder structure:
  ```
  src/
    app/                    # Next.js routes (thin, mostly one page for v1)
    core/
      dataset/              # Dataset, Record, Field types + construction
      parsing/              # delimiter parser, header/quote/trim logic
      profile/              # Profile type, defaults, validation
      derived-fields/       # date/timezone derivation, Parse Error logic
      persistence/          # localStorage + JSON export/import
      search/               # highlight/filter matching logic
      export/               # CSV export scope logic
    components/
      ui/                    # shadcn-generated primitives
      dataset-input/         # upload/paste UI
      profile-wizard/        # creation/config wizard
      data-table/             # table rendering, column controls
      search-bar/
      export-menu/
    state/                   # app-level state (Dataset + active Profile + session state)
  e2e/                       # Playwright specs
  ```
- **Verify:** `npm run build` produces static `out/`; a placeholder page renders; `npx playwright test` runs a trivial smoke spec against the served `out/`.

### Phase B — Core parsing engine (pure TS, no React)
`src/core/dataset/`, `src/core/parsing/`:
- Types: `Dataset { rawText: string }`, `RecordLine { index: number; raw: string }`, `Field { key: string; value: string; sourceFieldKey?: string /* for derived */ }`, `ParsedRecord { index: number; raw: string; fields: Field[] }`.
- `ParsingConfig` discriminated union, v1 variant: `{ kind: 'delimiter'; delimiter: ','|'\t'|'|'|';'; hasHeaderRow: boolean; stripQuotes: boolean; trimBoundaryPartials: boolean; expectedFieldCount: number; fieldNames?: string[] }`.
- `splitIntoRecords(rawText): RecordLine[]` — handle `\n`/`\r\n`.
- `parseRecord(line, config): ParsedRecord` — delimiter split, quote-stripping, header-name application.
- `applyBoundaryTrim(records, config)` — compares only first and last record's field count against `expectedFieldCount`; drops/flags if short. Must NOT do majority-vote.
- `detectDelimiter(sampleLines): Delimiter` — auto-detect among comma/tab/pipe/semicolon by frequency consistency across sample lines.
- `sampleMiddleLines(rawText, count): string[]` — used by the wizard preview; picks from the middle, not head/tail.
- `computeExpectedFieldCount(sampleRecords): number` — derived during wizard config from the middle sample, then frozen into the Profile.
- **Verify:** Unit tests (Vitest) covering: comma/tab/pipe/semicolon splitting, quote stripping, header detection, boundary trim on short first/last record, delimiter auto-detect on ambiguous samples, middle-sampling on odd/even line counts. Highest-value phase to test thoroughly — everything else builds on it, zero UI dependency.

### Phase C — Profile type + persistence
`src/core/profile/`, `src/core/persistence/`:
- `Profile { id, name, parsing: ParsingConfig, display: DisplayConfig, createdAt, updatedAt }`.
- `DisplayConfig { visibleFieldKeys: string[]; fieldOrder: string[]; fieldLabels: Record<string,string>; derivedFieldSelections: DerivedFieldSelection[]; searchState?: { term, mode: 'highlight'|'filter' } }`. Keep `visibleFieldKeys` as an explicit ordered array (order = display order), so reorder and show/hide are the same operation and Fields are never touched.
- `localStorageProfileStore.ts`: `listProfiles()`, `saveProfile()`, `deleteProfile()`, `loadProfile()` — namespaced localStorage key, JSON-serialized array, schema-version field for future migration safety.
- `profileFile.ts`: `exportProfileToJSON(profile): Blob`, `importProfileFromJSON(file): Promise<Profile>` with validation (reject malformed JSON, missing fields, version mismatch).
- **Verify:** Unit tests with a localStorage mock for save/list/delete round-trip; export→import round-trip equality; rejection of malformed import JSON.

### Phase D — Basic table UI (read-only rendering)
`src/components/data-table/`, `src/state/`:
- App state (Zustand recommended over context, to avoid prop-drilling): `dataset`, `parsedRecords`, `activeProfile`, session-only `hiddenRecordIndexes: Set<number>`, `search: {term, mode}`.
- `DatasetInput`: textarea for paste + `<input type=file>` for upload, both producing `Dataset.rawText`.
- On Dataset + Profile ready, run `parseRecord` once for every line → store full `ParsedRecord[]` in state. This is the "parse happens once" boundary — hide/show/reorder never touch this array again.
- `DataTable`: renders header from `Profile.display.fieldOrder` filtered to `visibleFieldKeys`, body from `parsedRecords`, using shadcn `table`.
- Column show/hide/reorder controls (toggle list + up/down buttons for v1 — drag-and-drop is a nice-to-have, not required) writing only to `activeProfile.display`. Inline rename writes to `display.fieldLabels`.
- **Verify:** Manual check in dev server. Use a hardcoded/manual Profile here to unblock table work before the wizard (Phase E) exists.

### Phase E — Profile creation/config wizard
`src/components/profile-wizard/`:
- Multi-step `dialog` wizard (LibreOffice-CSV-import style), driven by `src/core/parsing`:
  1. Delimiter selection — auto-detected (via `detectDelimiter` on middle sample) with override.
  2. Toggles — header-row detection, quote-stripping, boundary-trim — each re-runs `parseRecord` over the middle sample live so the preview updates instantly.
  3. Preview table of the middle sample with computed `expectedFieldCount`.
  4. Name + save → writes a new `Profile`.
- Same component for "create new" and "edit existing Profile's parsing config."
- Dataset-load flow: pick an existing Profile from storage, or launch the wizard to create one.
- **Verify:** Manual check against a few sample blobs (CSV, TSV, pipe-delimited); Playwright covers the golden path in Phase J.

### Phase F — Derived Fields (date parsing) + Parse Error state
`src/core/derived-fields/`:
- `DerivedFieldSpec` union, v1 variant: `{ kind: 'date'; sourceFieldKey: string; representation: 'raw'|'iso'|'timezone'; timezone?: string /* IANA, e.g. 'Europe/Paris'; omitted = browser-local */ }`.
- `computeDerivedFields(field, specs): Field[]` — `new Date(field.value)` per spec; `isNaN(date.getTime())` → `Field` with `parseError: true` instead of a value; else format per representation (`toISOString()` for ISO, `Intl.DateTimeFormat` with `timeZone` for timezone/local).
- "Force this Field as date" UI action (per-column header menu) adds the default trio (raw/ISO/local) to `Profile.display.derivedFieldSelections`, re-runs derivation over already-parsed Records (cheap, in-place — no re-parse of raw text). "Add timezone" appends one more spec — additive, never replacing.
- Parse Error cells render distinctly (red text/badge, "Invalid parse") — a render-time check on the `Field`, not a separate tracking system.
- **Verify:** Unit tests for `computeDerivedFields` — valid date across representations, invalid value → `parseError`, timezone formatting correctness for a fixed known instant. Manual/Playwright check of "force as date" → "add timezone" flow.

### Phase G — Search (Highlight / Filter)
`src/core/search/`, `src/components/search-bar/`:
- `matchesSearch(record, visibleFieldKeys, term): boolean` — case-insensitive substring match against Visible Fields' current values only.
- `SearchBar`: one text input + `toggle-group` for Highlight/Filter, writing session search state (copied into `Profile.display.searchState` on save).
- `DataTable` consumes it: Filter excludes non-matching rows from render (doesn't touch `parsedRecords`/`hiddenRecordIndexes`); Highlight wraps matches in a mark-equivalent span, still renders all rows.
- **Verify:** Unit tests for `matchesSearch` (case-insensitivity, matches-any-visible-field, ignores hidden fields). Manual/Playwright check toggling modes.

### Phase H — Row hiding (session-only)
Mostly `src/state/` + `DataTable` interaction layer:
- `hiddenRecordIndexes: Set<number>` (stubbed in Phase D), never written into `Profile`.
- Selection: click selects one, ctrl-click toggles, shift-click range-selects. "Hide selected" moves selection into `hiddenRecordIndexes`; "Unhide all" clears it. Resets automatically when a new Dataset loads.
- Table render filters out hidden rows (composes with Filter-mode search exclusion — both are independent view-layer exclusions over the same immutable `parsedRecords`).
- **Verify:** Manual/Playwright check of ctrl/shift multi-select and hide; unit test if selection-range logic is extracted as a pure function (`computeRangeSelection(anchorIndex, clickIndex, modifierKeys)`).

### Phase I — CSV export with scope select
`src/core/export/`, `src/components/export-menu/`:
- `buildExportRows(parsedRecords, display, scope: 'all'|'excluding-hidden'|'matching-filter', hiddenRecordIndexes, search)` — columns always from current Visible Fields/order; row selection branches on scope (matching-filter with no active Filter-mode term behaves as All — disable/explain that in the UI).
- `toCSVBlob(header, rows): Blob` — proper CSV escaping (delimiter/quote/newline in a field).
- `ExportMenu`: 3-way select + "Export CSV" button, Blob download via an anchor `download` attribute — pure client-side.
- **Verify:** Unit tests for `buildExportRows` per scope and for CSV escaping edge cases. Manual/Playwright check of the actual download.

### Phase J — Playwright e2e (golden path)
`e2e/`:
- `golden-path.spec.ts`: paste a small multi-line sample → wizard (delimiter auto-detect, confirm toggles) → save Profile → table renders expected columns/rows → hide a Field → re-show it (assert underlying data unaffected) → force a column as date → verify Derived Field columns appear and a bad value shows Parse Error → search + toggle Highlight/Filter → multi-select rows and hide → export CSV with each of the 3 scopes and assert downloaded content.
- `profile-persistence.spec.ts`: save Profile, reload, confirm it's listed; export to JSON, clear localStorage, import back, confirm identical behavior.
- **Verify:** these specs run against the static-exported `out/` served locally — matching actual Apache deployment, not `next dev`.

### Phase K — Built-in sample Profiles + sample data
Not designed yet — what goes into each Profile, and what the sample files look like, is a decision for when we're actually at this phase (needs its own scoping pass, likely revisiting real-world format examples for each target). Placeholder scope:
- A small set of ready-made Profiles ("pre-profile for common parsing" from `docs/project_idea.md`) shipped with the app for common log/data shapes — candidates: plain CSV, Logstash/JSON-line logs, AWS (e.g. CloudTrail or ALB access logs — which AWS format(s) TBD).
- A matching sample data file per built-in Profile, small enough to commit to the repo, realistic enough to exercise that Profile's parsing config (delimiter/header/quote/trim/derived-timestamp settings).
- Tests (Vitest) asserting each built-in Profile actually parses its paired sample file into the expected Fields/Record count — regression coverage so a Profile default can't silently drift from the sample it's supposed to handle.
- Needs a decision on where built-in Profiles live/load from (bundled JSON in the repo vs. seeded into localStorage on first run) and whether they're user-editable copies or fixed presets — revisit `src/core/profile/` structure then.
- **Verify:** TBD alongside the design pass — likely Vitest for the parse-matches-sample assertions, plus a manual/Playwright check that built-in Profiles show up and are selectable in the Profile-picker UI from Phase E.

## 2. Sequencing notes

- Phases A–C have no UI and should be fully unit-tested before component work starts — this is where domain-model correctness (Field-vs-Visible-Field separation, Expected Field Count semantics, boundary trim) gets locked in cheaply.
- Phase D deliberately excludes the wizard (uses a hardcoded Profile) so it can proceed in parallel with E if desired.
- Phase F depends only on B/C's types, not on E.
- G and H are independent of each other; both depend on D.
- I depends on G and H's state plus D's display config.
- J should be written incrementally alongside D–I, with the full golden-path spec assembled once I lands as a regression net.
- K depends on B (parsing engine, to validate samples parse correctly) and E (Profile picker UI, to surface built-ins) — do it last; it's additive polish, not a blocker for the rest of v1.

## Critical files
- `CONTEXT.md` — domain vocabulary, authoritative
- `src/core/dataset/types.ts` — Dataset/Record/Field/ParsedRecord (load-bearing domain model)
- `src/core/parsing/parseRecord.ts` — delimiter split, quote-stripping, boundary trim, expected-field-count logic
- `src/core/profile/types.ts` — Profile/ParsingConfig/DisplayConfig (Field-vs-Visible-Field separation lives here)
- `src/state/useAppStore.ts` — single source of truth wiring the parsing engine to UI
- `next.config.ts` — static export configuration governing Apache deployability

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
- **Verify:** Manual check against a few sample blobs (CSV, TSV, pipe-delimited); Playwright covers the golden path in Phase N.

### Phase F — Derived Fields (date parsing) + Parse Error state
`src/core/derived-fields/`:
- `DerivedFieldSpec` union, v1 variant: `{ kind: 'date'; sourceFieldKey: string; representation: 'iso'|'timezone'; timezone?: string /* IANA, e.g. 'Europe/Paris'; omitted = browser-local */ }`. (A `'raw'` representation was dropped: it only duplicated the source column.) Further kinds were added later — see Phase F2.
- `computeDerivedFields(field, specs): Field[]` — `parseFlexibleDate(field.value)` per spec; `isNaN(date.getTime())` → `Field` with `parseError: true` instead of a value; else format per representation (`toISOString()` for ISO, `Intl.DateTimeFormat` with `timeZone` for timezone/local).
- "Force as date" UI action (per-column action row in the Columns panel) adds the default pair (ISO/local) to `Profile.display.derivedFieldSelections`, re-runs derivation over already-parsed Records (cheap, in-place — no re-parse of raw text). "Add timezone" appends one more spec — additive, never replacing.
- Parse Error cells render distinctly (red text/badge, "Invalid parse") — a render-time check on the `Field`, not a separate tracking system.
- **Verify:** Unit tests for `computeDerivedFields` — valid date across representations, invalid value → `parseError`, timezone formatting correctness for a fixed known instant. Manual/Playwright check of "force as date" → "add timezone" flow.

### Phase F2 — Cell-level parsing, column-pattern detection, and e2e hardening — done
Added after F, driven by real-usage feedback (padded/quoted/stringified-JSON log cells). Not in the original plan.

Derived Fields (`src/core/derived-fields/`):
- New `DerivedFieldSpec` kinds: `unescape` (decodes `\"`, `\\`, `\n`, `\t`, `\r`) and `json-key` (one spec per top-level key discovered by `discoverJsonKeys`; nested values are stringified, not exploded). Exposed as "Strip escapes" and "Force as JSON" in the Columns panel.
- A `trim` Derived Field kind and its "Trim" button existed briefly and was **removed**: trimming now happens at parse time (below), so a second `(trimmed)` column was redundant, and it couldn't chain with other Derived Fields anyway.
- JSON extraction is lenient (`tryParseJsonObjectLenient`): it also accepts a stringified object (`{\"a\":1}` or a fully quoted `"{\"a\":1}"`). This is the chosen alternative to real Derived Field chaining (unescape → JSON), which remains unsupported — Derived Fields only read base Fields. The strict `tryParseJsonObject` is kept for the detector.
- `detectColumnPatterns` + the "detected: …" hint next to each column (`date`, `JSON`, `escaped chars`, `whitespace padding`): majority vote (≥ 50 %) over the first 50 values. Hints only propose; nothing is applied automatically.
- `parseFlexibleDate` tightened: all-digit strings only count as epochs at 9–10 digits (seconds) or 12–13 digits (milliseconds) — short integers (ids, counts, durations) are not dates, and 11 digits is rejected as ambiguous. Non-numeric strings must also *look* like a date (ISO-ish, numeric with slashes, or containing a month/weekday name) before `Date` sees them, because V8 reads `host-01` as 1 Jan 2001.

Parsing / wizard fixes:
- **"Strip surrounding quotes" now trims blanks first, then strips one quote pair** (`stripQuotesFromValue`) for both cells and header names, so padded cells like ` "a" ` work and column names/CSV export carry no padding. Trimming only happens when that option is ticked; a general opt-in "trim all cells" option stays on the Phase L list.
- `buildWizardSample` = true first line + middle sample of the *remaining* lines, so a small dataset no longer lists its header line twice in the preview.
- The wizard's state lives in `WizardForm`, mounted inside `DialogContent`, so it's rebuilt on every open (delimiter re-detected, toggles reset) instead of leaking the previous Dataset's choices.
- The wizard preview box is the only scroller (the shadcn `Table` container's own `overflow-x-auto` is neutralised there), so its horizontal scrollbar is always visible.

Tests:
- `e2e/helpers.ts` plus specs `json-cell-parsing`, `detected-hints`, `csv-export`, `wizard-preview-scroll` (against the sample files `json-cell-pipe.log` / `json-cell-stringified-pipe.log` in `public/samples/` and pasted datasets). These cover part of Phase N's golden path early — see Phase N.
- Unit tests for every function above.

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

### Phase J — Built-in sample Profiles + sample data — done
Decisions made:
- Built-in Profiles are bundled as plain TS constants (`src/core/profile/builtInProfiles.ts`), not seeded into localStorage — avoids duplicate-on-load/versioning issues. Ids are prefixed `builtin:` (`isBuiltInProfile()` checks this).
- They're **fixed presets, always offered additively** alongside the user's own in the picker (never disappear once the user has their own) — see Built-in Profile in CONTEXT.md.
- A built-in's `display.visibleFieldKeys` starts empty (it isn't tied to any specific Dataset's Field names ahead of time); `applyProfile` in `useAppStore.ts` now falls back to "everything visible" whenever a Profile's `visibleFieldKeys` is empty at apply time — a general fix, not built-in-specific.
- Editing a built-in via the wizard **forks into a new user Profile** rather than overwriting the built-in's id (which has no localStorage slot to write to) — `ProfileWizard.tsx` checks `isBuiltInProfile(initialProfile)` and always creates fresh in that case, pre-filling the name as `"<built-in name> (copy)"`.
- Added, on top of the original scope: any Profile (built-in or user) can be **hidden from the picker**, with a "Show hidden (N)" toggle to reveal and unhide them again. Persists across reloads via a separate localStorage key (`src/core/persistence/hiddenProfiles.ts`) — deliberately not part of any single Profile, since it needs to apply across all of them. See Hidden Profile in CONTEXT.md (distinct from Hidden Record).
- Regression tests (`builtInProfiles.test.ts`) read the real bundled sample files (not inline fixtures) and assert each Profile parses them as expected.
- **Added `" "` (space) as a supported `Delimiter`** (`src/core/parsing/types.ts`, `DELIMITER_CANDIDATES`, and the wizard's delimiter Select) — every real-world log format added below is space-delimited, and space simply hadn't been in the original comma/tab/pipe/semicolon set. Low-risk, well-motivated addition, not a deferred decision.
- Five built-ins now, each with a matching sample file in `public/samples/` (chosen as the location — not `temps/`, which is the user's own gitignored scratch space — so these could later be offered as in-app "try this sample" downloads for free, being plain static assets):
  - `csv-with-header` — clean, no caveats.
  - `aws-alb-access-log` (approximate) — real AWS ALB access log format. The quoted multi-word `request` field fragments into extra columns (our parser isn't quote-aware); test pins this down explicitly (`records[0].fields.length` > the true 29-field schema) rather than hiding it.
  - `linux-syslog` (approximate) — classic RFC3164-style syslog; the free-text message field fragments the same way.
  - `apache-combined-logstash` (approximate) — Apache/Nginx combined log format, the shape Logstash most commonly ingests; quoted request/referrer/user-agent fields fragment.
  - `apm-transaction-log` — a generic, pipe-delimited transaction/trace log invented for this project (no real APM tool — Elastic APM, Datadog, New Relic, etc. — shares one standard text format, and most APM data is JSON, not delimited). Clean by construction since the sample data was authored to avoid the pipe character in free-text fields.
  - The three "(approximate)" ones deliberately have no `fieldNames` set — assigning confident semantic labels (e.g. "user_agent") to columns that will hold shifted/wrong data for realistic input would be worse than generic "Field N" names.

Still open, deliberately deferred: broader AWS format coverage (CloudTrail is JSON, out of scope for a delimiter-only parser; S3 access logs have the same quoting issue as ALB) and any real quote-aware parsing fix for the three approximate ones — both future work, not v1.

### Phase K — Code review — done
A structured pass over everything built in A–J and F2 before any UI rework starts, so the rework builds on a known-clean base rather than compounding on top of anything sloppy. Run as `/code-review` against the whole diff since project start (findings triaged, then fixed or moved to Phase L), covering: consistency of the store-mutation patterns in `useAppStore.ts`, any dead code or leftover duplication (e.g. the `derivedFieldKey` re-derivation risk noted in `ColumnControls.tsx`), test coverage gaps, and whether the "nothing fancy" simplifications taken along the way still hold up under real usage feedback gathered so far. Known items to check, from Phase F2:
- Stored `derivedFieldSelections` are never validated on load, so a Profile saved with a since-removed kind (e.g. `trim`) would break `computeDerivedFields`.
- The `whitespace padding` detector has no matching action and can no longer fire for data parsed with "Strip quotes" on — keep or drop.
- Derived Fields can't be chained (they only read base Fields); the lenient JSON parser is a workaround.
- `useAppStore.ts` action patterns (`addXDerivedField` are near-identical).

**Outcome** (`/code-review` at high effort over `src/` and `e2e/`; 10 findings, all addressed):
- Stored/imported Profiles go through `normalizeProfile` (replaces `isProfile`): a bad `parsing` rejects the Profile, a bad `display` is repaired and unsupported Derived Field kinds are dropped (`isDerivedFieldSpec`). `applyProfile` and the wizard's save then run `reconcileDisplay`, which drops specs/visible keys that don't match the Dataset's actual Fields.
- "Save view" on a built-in forks it into a user "(copy)" instead of storing it under the built-in's id.
- "Edit parsing…" keeps labels, Derived Fields, visible columns and search (reconciled), and keeps the Profile's `fieldNames` through the preview.
- `parseDataset` takes the column list from the *widest* Record, so ragged data no longer loses columns.
- "Hide selected" only hides selected rows the filter currently shows (`hideSelectedRecords(visibleIndexes)`).
- Timezones are validated (`isValidTimeZone`) in the UI (inline message) and the store.
- Performance: cached `Intl.DateTimeFormat` per timezone, one JSON/date parse per cell shared by all its specs, specs grouped by source Field, "detected" hints memoised on `records`. Table virtualization was not added then; it was measured afterwards and added in Phase M (see "Row windowing").
- Cleanup: dropped the unused `fieldNames` store field, merged the `add*DerivedField` actions into one dedup-by-key `addDerivedFields` plus an `updateDisplay` helper (also guards against a derived key colliding with a base column), removed `loadProfile`, the `whitespace padding` detector, and the rawText variant of `sampleMiddleLines` (it now takes a line array).
- Tests: `useAppStore.test.ts` (the store had none), plus unit tests for each new function and `e2e/profile-editing.spec.ts`. Vitest now includes `src/**/*.test.ts`.
- Kept on purpose: `deleteProfile` is still unused — there is no delete-Profile UI yet (added to Phase L).

### Phase L — Improvement list — done (scoped by a design review, then built in M)
Turn the running "improvement seen while working" list in `docs/project_idea.md` into a scoped, ordered set of concrete changes — the planning pass that Phase M then executes. Scoped through a design review of the live page (screenshots + mockups); what was taken into Phase M, and what was left out, is listed under Phase M below. Candidates that were on the list:
- Widen the interface layout.
- Better UI for column selection generally.
- Shift-click to unselect a range of *columns* in the Columns panel (distinct from the existing row shift-click).
- "Hide all" / "show all" columns buttons.
- Search/filter columns by name to toggle them, Kibana-style.
- Column order top-to-bottom display + drag-and-drop reordering (replacing the current up/down-button reorder).
- Support multiple saved views per Profile (a bigger data-model change — Profile currently has exactly one display config; this needs its own design pass on what a "view" is relative to a Profile).
- Collapse/hide the dataset-input area once data is parsed (tab it away or similar), instead of always showing the paste/upload box.
- Kibana-style filter in/out by a cell's exact content (click a cell value to add it as a filter).
- An opt-in (not default) "trim all cells" option, independent of "Strip quotes" (which already trims).
- Quote-aware splitting (a delimiter inside a quoted value), which would also fix the three "approximate" built-in Profiles.
- Real chaining of Derived Fields (unescape → JSON → date), if the lenient-JSON workaround proves too narrow.
- A way to delete a saved Profile (`deleteProfile` exists in persistence but nothing calls it).
- Delimiter auto-detection is fooled by padded delimiters: for `a | b | c` data the space scores higher than the pipe, so the wizard preselects "Space". Needs a smarter heuristic (e.g. ignore blanks next to another delimiter candidate).
- **Verify:** TBD — this phase's own output is the scoped plan for Phase M, not code.

### Phase M — UI rework — done
Implements the design review. The page used to be one stack of panels (dataset box, profile buttons, Columns block, search, export, table); it is now an app shell: top bar, toolbar, and a table that fills the rest of the window.

Layout and flow (`src/components/app-shell/`, `src/app/page.tsx`):
- **Empty state** (`DatasetInput.tsx`): drop zone + "Choose file…", paste box, and one-click samples from `public/samples/`. After loading it disappears (the "collapse the dataset input" item); **Replace…** in the top bar brings it back. `Dataset` gained an optional `name`. Replace… is non-destructive: the current data, profile and column setup stay in the store (`replacing` flag) and a "Back to <file>" button returns to them; only loading something new replaces them.
- **Top bar** (`TopBar.tsx`): file chip (name, lines, columns), a **profile dropdown** (`ProfileMenu.tsx`: your profiles, built-ins, "New profile…", "Manage profiles…"), "Edit parsing…", "Save view", and a "…" menu for importing/exporting profiles. Hiding profiles moved into `ManageProfilesDialog.tsx`.
- Between loading a file and picking a profile, `ProfileChooser.tsx` offers the profiles and "New profile…". The wizard is mounted once (`ProfileWizardHost.tsx`) and driven by `wizardTarget` in the store.
- **Toolbar** (`TableToolbar.tsx`): search with Highlight/Filter, selection and hidden-row chips that only appear when they apply (`SelectionChips.tsx`), the Columns popover, and Export CSV with a scope dropdown.

The table and its columns (`src/components/data-table/`):
- Sticky header, a "#" column (ordinal among parsed records) next to the row checkbox, tinted Derived Field columns captioned "from payload · JSON", and one scroll box so both scrollbars are always on screen.
- **Per-column header menu** (`ColumnHeader.tsx`) replaces the Columns block: rename (inline), hide, move left/right, and Derive new column (Parse as date, Extract JSON keys, Strip escape characters, Add timezone…). Detection chips ("date", "JSON", "escaped chars") sit on the header, and the detected derivation is offered first, marked "detected". Timezones are added through `TimezoneDialog.tsx`.
- **Columns popover** (`ColumnsPopover.tsx`): find by name, show all / hide all / reset order, eye toggles, and drag-and-drop reordering. A hidden column keeps its place: `DisplayConfig.fieldOrder` holds the full column order (hidden columns included) and `visibleFieldKeys` is its shown subset, so hiding and re-showing a column puts it back where it was (`core/profile/fieldOrder.ts`; `reconcileDisplay` fills `fieldOrder` for Profiles saved without it). Backed by new store actions `moveFieldBefore`, `showAllFields`, `hideAllFields`, `resetFieldOrder` (and `clearSelection`, `clearDataset`).
- `useVisibleRecords` and `useDetectedPatterns` hooks give the table and toolbar one shared definition of "visible rows" and one memoised detection pass.

Wizard (`ProfileWizard.tsx`): a wide two-column dialog (options left, preview right), delimiter as a segmented control with the auto-detected one named, each toggle with a one-line explanation (the quote option is now "Trim cells & strip quotes"), "#" column in the preview.

Look and feel:
- The project's shadcn **amber** theme is kept (amber primary, ring and pale-amber accent; the logo square, selected segmented items and checked boxes use it too). The design review had proposed a neutral near-black primary; that was a misreading of "use the shadcn colour scheme" and was reverted. Known trade-off: white text on the amber primary is roughly 3:1, below the 4.5:1 target for small text — dark text on the amber buttons would fix it if that ever matters. The squared "radix-lyra" style is kept.
- Interface text is sans (Geist) at `text-sm`; mono is only for cell values and column names. All sizes are Tailwind rem sizes, so they follow the browser's font-size setting.
- New UI primitives: `dropdown-menu.tsx`, `popover.tsx` (Radix, styled like the existing ones). `ColumnControls.tsx` and `ProfilePicker.tsx` are gone.

Tests: the e2e helpers (`e2e/helpers.ts`) were rewritten around the new controls (header menu, Replace…, profile menu), and `e2e/workspace.spec.ts` covers the empty state, header menu, Columns popover (including drag-and-drop), profile management and export scope. Unit tests cover the new store actions.

Row windowing (added after measuring): the first version rendered every row, and timing it on generated logs showed the cost growing in step with the row count (about 5 s to open and 2.7 s per Highlight keystroke at 25k rows, 225k DOM nodes). `DataTable.tsx` now renders only the rows near the viewport (`useWindowedRows`, `windowRange.ts`) between two spacer rows that keep the scroll height real. That needs fixed 36px rows and column widths that don't depend on the rendered rows, so the table uses `table-layout: fixed` with a width per column taken from its longest value (`maxValueLengths`, clamped to 8–80 characters, longer values are cut with "…"; there is no column resizing yet). After the change, at 50k rows: about 0.2 s to open, 64 ms per keystroke, 0.5 s to add a derived column, 17 ms per scroll frame, and a constant ~550 DOM nodes. Selection, shift-click ranges, hiding and export work on record indexes, so they cover every row. `aria-rowcount` / `aria-rowindex` keep the table's size known to screen readers. Spacer height is rows × 36px, so a list beyond roughly 900k rows would exceed the browser's maximum element height.

Left out on purpose: shift-click range selection of *columns*, multiple saved views per Profile, Kibana-style filter by clicking a cell, the opt-in "trim all cells" option, value badges (a column of severities could get colour later), a delete-profile action, fixing delimiter auto-detection for padded data, and resizable columns. The Columns popover lists every column in table order, Derived Fields tagged "from …". Grouping them indented under their source (tried, then reverted) is deferred until the column-reordering model is reworked.

### Phase N — Playwright e2e (golden path) — done
Finished after the UI rework: `e2e/search.spec.ts` (Highlight/Filter, what is searched), `e2e/csv-export.spec.ts` (all three scopes with their content, and the columns/labels/order the file follows), `e2e/profile-persistence.spec.ts` (saved profiles and "Save view" across reloads, exporting profiles, the export → wipe storage → import round trip, built-in-id forks, repair of out-of-date profiles, and every import error message) and `e2e/golden-path.spec.ts` (the whole flow in one test, step by step, including the "Invalid parse" cell). Shared helpers live in `e2e/helpers.ts`. `e2e/large-dataset.spec.ts` covers a 30,000-line log (windowed DOM, scrolling to the middle and end, stable column widths, selection and hiding across all rows, Filter, derived columns, export). The suite runs against the static `out/` build (85 tests). The original plan text follows for reference.
Mostly covered by the specs written along the way: Phase F2's (upload/paste → wizard → table, date/JSON/unescape, "detected" hints, CSV export), Phase K's `profile-editing.spec.ts`, and Phase M's `workspace.spec.ts` (empty state, header menu, Columns popover, profile menu, export scope). Still to write here: search Highlight/Filter, CSV export content for the other two scopes, importing/exporting profile files, and a final end-to-end spec tying the golden path together. The UI has now been reshaped, so this is the right time.
`e2e/`:
- `golden-path.spec.ts`: paste a small multi-line sample → wizard (delimiter auto-detect, confirm toggles) → save Profile → table renders expected columns/rows → hide a Field → re-show it (assert underlying data unaffected) → force a column as date → verify Derived Field columns appear and a bad value shows Parse Error → search + toggle Highlight/Filter → multi-select rows and hide → export CSV with each of the 3 scopes and assert downloaded content.
- `profile-persistence.spec.ts`: save Profile, reload, confirm it's listed; export to JSON, clear localStorage, import back, confirm identical behavior.
- **Verify:** these specs run against the static-exported `out/` served locally — matching actual Apache deployment, not `next dev`.
- Deliberately sequenced after K/L/M: writing this against UI that's about to be reworked (drag-and-drop reordering, column search/filter, tabbed input area, etc.) would mean re-doing most of its selectors and flows once that rework lands — better to encode the golden path once the interface shape is actually settled.

## 2. Sequencing notes

- Phases A–C have no UI and should be fully unit-tested before component work starts — this is where domain-model correctness (Field-vs-Visible-Field separation, Expected Field Count semantics, boundary trim) gets locked in cheaply.
- Phase D deliberately excludes the wizard (uses a hardcoded Profile) so it can proceed in parallel with E if desired.
- Phase F depends only on B/C's types, not on E.
- G and H are independent of each other; both depend on D.
- I depends on G and H's state plus D's display config.
- J depends on B (parsing engine, to validate samples parse correctly) and E (Profile picker UI, to surface built-ins) — additive polish, not a blocker for the rest of v1, but scheduled next since it's cheap and doesn't touch anything K/L/M will rework.
- K (code review) should happen before L/M so the rework starts from a clean, reviewed base.
- L (improvement list) must land before M (UI rework) — M has no scope of its own until L produces one.
- N (Playwright e2e) intentionally comes last: it's the phase most expensive to redo, so it should encode the UI's shape only once K/L/M have already reshaped it.

## Critical files
- `CONTEXT.md` — domain vocabulary, authoritative
- `src/core/dataset/types.ts` — Dataset/Record/Field/ParsedRecord (load-bearing domain model)
- `src/core/parsing/parseRecord.ts` — delimiter split, quote-stripping, boundary trim, expected-field-count logic
- `src/core/profile/types.ts` — Profile/ParsingConfig/DisplayConfig (Field-vs-Visible-Field separation lives here)
- `src/state/useAppStore.ts` — single source of truth wiring the parsing engine to UI
- `next.config.ts` — static export configuration governing Apache deployability

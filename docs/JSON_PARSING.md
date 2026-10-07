# JSON parsing in the parsing rule

Design notes for parsing JSON — nested, hidden inside text, with arrays — straight from the Profile's parsing rule.
Domain words (Field, Derived Field, Profile…) are those of [CONTEXT.md](./CONTEXT.md).

## The problem

Starting point: a log like this (sample: `temps/sample_complex.log`, richer test file: `temps/sample_json_nested.log`):

```
"INFO","01/01/2026","00:00:01","10001 [global] [42] [10000]: on message"
"INFO","01/01/2026","00:00:04","10002 [error] [sample_client] [10000]: {""message"":""field is not allowed"",…,""trace"":""[{\""Raw_Trace\"":…,\""line\"":10,…},{…},{…}]""}"
```

What the app could not do before:

| # | Problem | Before |
|---|---|---|
| 1 | The 4th column is text followed by JSON: `10002 [error] [sample_client] [10000]: {…}` | "Extract JSON keys" gave a Parse Error: the cell isn't pure JSON |
| 2 | `trace` is a JSON array stored as a string inside the JSON | Shown as one raw string; Derived Fields can't be chained |
| 3 | `trace` holds several objects (3 here), not all with the same keys (the second one has no `type`) | No way to show several values per cell |

Splitting the line itself already worked with the quote-aware (CSV) option.

Wanted output (first idea from the user), with the trace items as sub-rows of the record:

```
type,date,time,info,info.message,info.code,info.host_name,info.user_agent,info.trace,info.trace.Raw_Trace,info.trace.column,…
```

## Options discussed

### Reading JSON inside JSON

- **Chaining Derived Fields** (click "Extract JSON keys" again on `info.trace`): rejected. Derived Fields are always
  computed from a base Field, a rule that keeps applying a Profile simple.
- **A path per column** (`info` → `trace` → *decode the string* → each item → `line`): what the first proposal
  suggested for Derived Fields.
- **Chosen:** do it in the *parsing rule* instead, before the view. A column flagged "may contain JSON" is parsed
  as soon as the Profile is applied, at every level, so the resulting columns are ordinary parsed columns (filters,
  search, color-coding, "Parse as date"… all work on them).

### Showing arrays

The items of an array don't fit in one cell. Three options were compared on the sample:

- **A — nested table**: a small table with its own header under the record, one row per item.
- **B — lined up in the parent's columns**: the record takes one line per item, the `info.trace[].*` columns
  show the items, the other columns only fill the first line.
- **C — joined**: all items in one cell.

First recommendation was A for display, B for export. First decision: B by default, A and C as options, per array.

**Revised after trying it**: on screen, **A is the default and B the only other option; C was removed**. B's export
(one CSV line per item) was disliked — the CSV now always puts an array in **one cell, one item per line** (what C
exported). Also found while testing: the A/B/C switch hidden in the column menu was hard to find, hence the
"Show as sub-rows" button directly on each nested table's bar.

## Decisions (from the Q&A)

Parsing rule:
- Each column can be marked **"may contain JSON"** (`ParsingConfig.jsonFieldKeys`). When JSON is detected in the
  sample (whole cell, or inside text) the column is tagged "detected" in the wizard, but **not ticked**: the user
  decides (first version pre-ticked it; changed after testing).
- JSON is found **even inside text**: from the first `{` / `[` to its matching closing bracket. Inside text it must
  look like data (an object, or an array of objects), so a `[42]` in a log prefix is not taken as JSON.
- JSON stored as a string (`"{\"a\":1}"`) or with escaped quotes (`{\"a\":1}`) is decoded too.
- **The text outside the JSON gets its own column**, `info (text)`, on top of the JSON columns (text before and
  after the JSON, joined). A cell without JSON puts all its text there.
- Only the **first** JSON of a cell is parsed; anything after it stays in `info (text)`.
- The source column (`info`) is kept, **hidden by default** (shown again from the Columns popover).
- Every key found becomes a column. Keys never seen before (new file, same Profile) are added **visible, after
  their source column**.
- The table page's "Extract JSON keys" (top level only, Derived Fields) stays for old Profiles and quick looks;
  a new header-menu entry **"Parse JSON (all levels)"** turns the parsing-rule option on for a column without
  re-creating the Profile ("Stop parsing JSON" turns it off).

Nested data:
- Objects are flattened to `info.a.b.c` **up to 5 levels deep**. Deeper objects stay as JSON text (limit chosen
  for readability, "might be overkill but we need a limit").
- **Only arrays at the root of the JSON are split into items** (e.g. `trace`). Deeper arrays stay as JSON text;
  objects inside array items are still flattened.
- Columns of an array are marked with `[]`: `info.trace[].line`, `info.trace[].foo.bar`. An array of plain values
  gives one column `info.tags[]`. A cell that is a JSON array itself gives `info[].…`.

Display (per array, saved in the view, in `columnOptions["info.trace[]"].arrayMode`):
- **A, "Nested table"** (default): a collapsible table per array under the record (two arrays → two tables). Closed
  by default; its bar has "Open all / Close all" and a **"Show as sub-rows"** button, since its columns leave the
  main header.
- **B, "Sub-rows"**: the array's columns are in the main table, one line per item inside the record. Two arrays in
  the same record share those lines by position (line 1 = `trace[0]` and `tags[0]`…). The column's menu
  ("Show the … items as") switches back to a nested table.
- ~~C, "Joined"~~: removed.

Behaviour:
- **Filter / search**: a record matches if any of its items matches (e.g. a filter matching `page_c`, the third item,
  keeps the whole record). A cell filter on an item value matches the record when any item has that value.
- **Hiding, selection, comments**: on the whole record (all its lines).
- **Sorting**: not available on array columns (the header menu says so). There is no sorting in the app yet anyway.
- **Search in Filter mode also highlights** the matched text (it used to highlight only in Highlight mode).
- **Alternating grey rows**, per record: all the lines of a record share the shade.

CSV export (revised, see above): always **one CSV line per record**, an array column being **one cell with one item
per line**, whatever the table shows. (Earlier: B gave one CSV line per item, and A was merged with a message.)

## Implementation

Core (`src/core/json/`):
- `findEmbeddedJson.ts` — finds the first JSON object/array in a cell (whole, stringified, escaped, or inside text)
  with the text before/after it. Also `hasJsonInText` for the "JSON in text" column hint.
- `flattenJson.ts` — one cell's JSON → `scalars` (column → value) and `arrays` (array key → items), with the depth
  and root-array rules above.
- `expandJsonFields.ts` — applied by `parseRawRows` when `jsonFieldKeys` is set: adds the JSON columns of every
  Record right after their source, plus `(text)`. Two passes, so every Record's array columns get the same number
  of items (missing keys → empty item). Returns `jsonColumns` (column → source, array key, text?).
- `placeJsonColumns.ts` — puts never-seen JSON columns after their source, visible, hiding the source the first
  time. Runs before `reconcileDisplay` (which would add them at the end, hidden), on the display and every view.
- `arrayColumns.ts` — array key of a column, item counts per record.

Data model:
- `Field.items?: string[]` — one value per item for an array column; `value` is the items joined with `\n`
  (so search, length and the CSV export work unchanged).
- `ParsingConfig.jsonFieldKeys?: string[]`, `ParsedDataset.jsonColumns?`, `ColumnOptions.arrayMode` (on the array key).
- Derived Fields of an array column ("Parse as date" on `info.trace[].time`) are computed item by item and belong
  to the same array.

UI:
- `DataTable.tsx` — records now have **variable heights** (sub-row lines, nested tables), so the row windowing works
  from a list of record offsets (`computeVariableWindow`, `useWindowedRows(offsets, …)`). Sub-row lines have their
  own filter buttons. Zebra stripes, highlight in Filter mode.
- `ShowAsSubRowsButton.tsx`, `ColumnHeader.tsx` (array mode radio, JSON caption, "Parse JSON (all levels)"),
  `ProfileWizard.tsx` ("May contain JSON" list; the preview shows the split only, the JSON columns are left to the
  table; preview columns cut at `PREVIEW_MAX_CHARS`).
- Store: `jsonColumns`, `expandedArrayTables` (session), `setArrayMode`, `toggleArrayTable`, `setArrayTablesOpen`,
  `setJsonParsing`.

## Known limits / later

- Column order of JSON keys is the order they are first met across the records.
- Tests: not written yet for this feature (implementation validated by hand first); existing tests were not updated.
- The prefix `10002 [error] [sample_client] [10000]` still needs regex parsing (see the improvement list in
  `project_idea.md`) to get e.g. the level `error` into its own column.

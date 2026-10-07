import type { Field, ParsedRecord } from "@/core/dataset/types";
import { findEmbeddedJson } from "@/core/json/findEmbeddedJson";
import { flattenJson, type FlatJson } from "@/core/json/flattenJson";
import type { JsonColumns } from "@/core/json/types";

/** Key of the column holding a JSON column's text outside the JSON, e.g. "info (text)". */
export function jsonTextKey(sourceKey: string): string {
  return `${sourceKey} (text)`;
}

export interface JsonExpansion {
  fieldNames: string[];
  records: ParsedRecord[];
  jsonColumns: JsonColumns;
}

/** The text around the JSON, as one value. */
function joinText(before: string, after: string): string {
  return [before.trim(), after.trim()].filter((part) => part !== "").join(" ");
}

interface CellExpansion {
  text: string;
  flat?: FlatJson;
}

/**
 * The parsing rule's "may contain JSON" option, applied to already-split Records: each cell of the flagged
 * columns is searched for JSON, which becomes columns of its own placed right after the source column (see
 * flattenJson for their names), plus a "(text)" column with the text outside the JSON. The source column is
 * kept as it was. Every Record that has a root-level array gets the same number of items in every column of
 * that array, so the items line up.
 */
export function expandJsonFields(fieldNames: string[], records: ParsedRecord[], jsonFieldKeys: string[]): JsonExpansion {
  const sources = new Set(jsonFieldKeys.filter((key) => fieldNames.includes(key)));
  if (sources.size === 0) return { fieldNames, records, jsonColumns: {} };

  const taken = new Set(fieldNames);
  const jsonColumns: JsonColumns = {};
  // Columns in the order they were first met, per source column.
  const columnsBySource = new Map<string, string[]>([...sources].map((source) => [source, []]));
  const columnsByArray = new Map<string, string[]>();

  function register(key: string, sourceKey: string, extra: { arrayKey?: string; text?: boolean } = {}): boolean {
    if (jsonColumns[key]) return true;
    if (taken.has(key)) return false; // a split column already has this name
    taken.add(key);
    jsonColumns[key] = { sourceKey, ...extra };
    columnsBySource.get(sourceKey)!.push(key);
    if (extra.arrayKey) {
      const list = columnsByArray.get(extra.arrayKey) ?? [];
      list.push(key);
      columnsByArray.set(extra.arrayKey, list);
    }
    return true;
  }

  // First pass: find the JSON of every cell and learn every column.
  const expansions = records.map((record) => {
    const cells = new Map<string, CellExpansion>();
    for (const field of record.fields) {
      if (!sources.has(field.key)) continue;
      const found = findEmbeddedJson(field.value);
      const cell: CellExpansion = found
        ? { text: joinText(found.before, found.after), flat: flattenJson(found.json, field.key) }
        : { text: field.value };
      cells.set(field.key, cell);
      if (cell.text !== "") register(jsonTextKey(field.key), field.key, { text: true });
      if (!cell.flat) continue;
      for (const key of cell.flat.scalars.keys()) register(key, field.key);
      for (const [arrayKey, items] of cell.flat.arrays) {
        for (const item of items) {
          for (const key of item.keys()) register(key, field.key, { arrayKey });
        }
      }
    }
    return cells;
  });

  // Second pass: build each Record's Fields, the JSON ones right after their source.
  const expandedRecords = records.map((record, i) => {
    const cells = expansions[i];
    if (cells.size === 0) return record;

    const fields: Field[] = [];
    for (const field of record.fields) {
      fields.push(field);
      const cell = cells.get(field.key);
      if (!cell) continue;

      const textKey = jsonTextKey(field.key);
      if (cell.text !== "" && jsonColumns[textKey]?.text) fields.push({ key: textKey, value: cell.text });
      if (!cell.flat) continue;

      for (const [key, value] of cell.flat.scalars) {
        if (jsonColumns[key]?.sourceKey === field.key && !jsonColumns[key].arrayKey) fields.push({ key, value });
      }
      for (const [arrayKey, items] of cell.flat.arrays) {
        for (const key of columnsByArray.get(arrayKey) ?? []) {
          const values = items.map((item) => item.get(key) ?? "");
          fields.push({ key, value: values.join("\n"), items: values });
        }
      }
    }
    return { ...record, fields };
  });

  const expandedNames = fieldNames.flatMap((name) => [name, ...(columnsBySource.get(name) ?? [])]);
  return { fieldNames: expandedNames, records: expandedRecords, jsonColumns };
}

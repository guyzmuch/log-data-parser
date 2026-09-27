"use client";

import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { matchesSearch } from "@/core/search/matchesSearch";
import { useAppStore } from "@/state/useAppStore";

/** Wraps every case-insensitive occurrence of `term` in `value` with a <mark>. */
function highlightMatches(value: string, term: string): ReactNode {
  const needle = term.trim();
  if (needle === "") return value;

  const lowerValue = value.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let index = lowerValue.indexOf(lowerNeedle, cursor);

  while (index !== -1) {
    if (index > cursor) parts.push(value.slice(cursor, index));
    parts.push(
      <mark key={index} className="bg-primary/30 text-inherit">
        {value.slice(index, index + needle.length)}
      </mark>,
    );
    cursor = index + needle.length;
    index = lowerValue.indexOf(lowerNeedle, cursor);
  }
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts;
}

export function DataTable() {
  const records = useAppStore((s) => s.records);
  const activeProfile = useAppStore((s) => s.activeProfile);

  if (!activeProfile || records.length === 0) {
    return <p className="text-xs text-muted-foreground">No data parsed yet.</p>;
  }

  const { visibleFieldKeys, fieldLabels, searchState } = activeProfile.display;
  const term = searchState?.term ?? "";
  const mode = searchState?.mode ?? "highlight";

  const visibleRecords =
    mode === "filter" ? records.filter((record) => matchesSearch(record, visibleFieldKeys, term)) : records;

  if (visibleRecords.length === 0) {
    return <p className="text-xs text-muted-foreground">No records match your search.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {visibleFieldKeys.map((key) => (
            <TableHead key={key}>{fieldLabels[key] ?? key}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {visibleRecords.map((record) => (
          <TableRow key={record.index}>
            {visibleFieldKeys.map((key) => {
              const field = record.fields.find((f) => f.key === key);
              if (field?.parseError) {
                return (
                  <TableCell key={key} className="text-destructive">
                    Invalid parse
                  </TableCell>
                );
              }
              const value = field?.value ?? "";
              return <TableCell key={key}>{mode === "highlight" ? highlightMatches(value, term) : value}</TableCell>;
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

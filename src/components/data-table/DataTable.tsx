"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppStore } from "@/state/useAppStore";

export function DataTable() {
  const records = useAppStore((s) => s.records);
  const activeProfile = useAppStore((s) => s.activeProfile);

  if (!activeProfile || records.length === 0) {
    return <p className="text-xs text-muted-foreground">No data parsed yet.</p>;
  }

  const { visibleFieldKeys, fieldLabels } = activeProfile.display;

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
        {records.map((record) => (
          <TableRow key={record.index}>
            {visibleFieldKeys.map((key) => {
              const field = record.fields.find((f) => f.key === key);
              return <TableCell key={key}>{field?.value ?? ""}</TableCell>;
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

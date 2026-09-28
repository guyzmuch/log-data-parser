"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildExportRows } from "@/core/export/buildExportRows";
import { toCSVBlob } from "@/core/export/toCSVBlob";
import type { ExportScope } from "@/core/export/types";
import { downloadBlob } from "@/lib/downloadBlob";
import { useAppStore } from "@/state/useAppStore";

const SCOPE_LABELS: Record<ExportScope, string> = {
  all: "All records",
  "excluding-hidden": "Excluding hidden",
  "matching-filter": "Matching filter",
};

export function ExportMenu() {
  const [scope, setScope] = useState<ExportScope>("all");
  const records = useAppStore((s) => s.records);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const hiddenRecordIndexes = useAppStore((s) => s.hiddenRecordIndexes);

  if (!activeProfile) return null;

  const { searchState } = activeProfile.display;
  const filterActive = searchState?.mode === "filter" && (searchState.term.trim() ?? "") !== "";
  const { header, rows } = buildExportRows(records, activeProfile.display, scope, hiddenRecordIndexes);

  function handleExport() {
    const blob = toCSVBlob(header, rows);
    const filename = `${activeProfile!.name.replace(/[^a-z0-9-_]+/gi, "_") || "export"}.csv`;
    downloadBlob(blob, filename);
  }

  return (
    <div className="flex items-center gap-2 border border-input p-2">
      <Select value={scope} onValueChange={(value) => setScope(value as ExportScope)}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SCOPE_LABELS) as ExportScope[]).map((candidate) => (
            <SelectItem key={candidate} value={candidate}>
              {SCOPE_LABELS[candidate]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" onClick={handleExport} disabled={rows.length === 0}>
        Export CSV ({rows.length} row{rows.length === 1 ? "" : "s"})
      </Button>
      {scope === "matching-filter" && !filterActive && (
        <p className="text-xs text-muted-foreground">No active filter — exporting all records.</p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { CaretDownIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildExportRows } from "@/core/export/buildExportRows";
import { toCSVBlob } from "@/core/export/toCSVBlob";
import type { ExportScope } from "@/core/export/types";
import { enabledFilters } from "@/core/filters/fieldFilters";
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
  const recordComments = useAppStore((s) => s.recordComments);
  const fieldFilters = useAppStore((s) => s.fieldFilters);

  if (!activeProfile) return null;

  const { searchState } = activeProfile.display;
  const filterActive =
    (searchState?.mode === "filter" && (searchState.term.trim() ?? "") !== "") || enabledFilters(fieldFilters).length > 0;
  const { header, rows } = buildExportRows(records, activeProfile.display, scope, hiddenRecordIndexes, recordComments, fieldFilters);

  function handleExport() {
    const blob = toCSVBlob(header, rows);
    const filename = `${activeProfile!.name.replace(/[^a-z0-9-_]+/gi, "_") || "export"}.csv`;
    downloadBlob(blob, filename);
  }

  return (
    <div className="flex items-center">
      <Button onClick={handleExport} disabled={rows.length === 0} className="h-8">
        <DownloadSimpleIcon />
        Export CSV · {rows.length} {rows.length === 1 ? "row" : "rows"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Export scope" className="-ml-px">
            <CaretDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Rows to export</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={scope} onValueChange={(value) => setScope(value as ExportScope)}>
            {(Object.keys(SCOPE_LABELS) as ExportScope[]).map((candidate) => (
              <DropdownMenuRadioItem key={candidate} value={candidate}>
                {SCOPE_LABELS[candidate]}
                {candidate === "matching-filter" && !filterActive && (
                  <span className="ml-auto text-xs text-muted-foreground">no filter: all</span>
                )}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

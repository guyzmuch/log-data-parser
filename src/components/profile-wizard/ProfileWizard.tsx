"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildParsingPreview } from "@/core/parsing/buildParsingPreview";
import { buildWizardSample } from "@/core/parsing/buildWizardSample";
import { detectDelimiter } from "@/core/parsing/detectDelimiter";
import { parseDataset } from "@/core/parsing/parseDataset";
import type { Delimiter } from "@/core/parsing/types";
import { createDefaultDisplayConfig, createProfile } from "@/core/profile/createProfile";
import type { Profile } from "@/core/profile/types";

const DELIMITER_LABELS: Record<Delimiter, string> = {
  ",": "Comma ( , )",
  "\t": "Tab",
  "|": "Pipe ( | )",
  ";": "Semicolon ( ; )",
};

const PREVIEW_SAMPLE_SIZE = 8;

interface ProfileWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasetRawText: string;
  /** When set, the wizard edits this Profile's parsing config instead of creating a new one. */
  initialProfile?: Profile;
  onSave: (profile: Profile) => void;
}

export function ProfileWizard({ open, onOpenChange, datasetRawText, initialProfile, onSave }: ProfileWizardProps) {
  // True first line (for correct header preview) + body rows sampled from
  // the middle (not head/tail, since a copy-paste often clips a boundary
  // line — see Profile in CONTEXT.md).
  const sample = useMemo(() => buildWizardSample(datasetRawText, PREVIEW_SAMPLE_SIZE), [datasetRawText]);
  const sampleRawText = useMemo(() => sample.join("\n"), [sample]);

  const [name, setName] = useState(initialProfile?.name ?? "Untitled profile");
  const [delimiter, setDelimiter] = useState<Delimiter>(
    initialProfile?.parsing.delimiter ?? detectDelimiter(sample),
  );
  const [hasHeaderRow, setHasHeaderRow] = useState(initialProfile?.parsing.hasHeaderRow ?? false);
  const [stripQuotes, setStripQuotes] = useState(initialProfile?.parsing.stripQuotes ?? false);
  const [trimBoundaryPartials, setTrimBoundaryPartials] = useState(
    initialProfile?.parsing.trimBoundaryPartials ?? false,
  );

  const preview = useMemo(
    () => buildParsingPreview(sampleRawText, { delimiter, hasHeaderRow, stripQuotes, trimBoundaryPartials }),
    [sampleRawText, delimiter, hasHeaderRow, stripQuotes, trimBoundaryPartials],
  );

  function handleSave() {
    // Field names for the saved display config come from parsing the real,
    // full Dataset with the chosen config — not from preview.parsed, which
    // is only a small sample and must never leak into what gets saved.
    const { fieldNames: realFieldNames } = parseDataset(datasetRawText, preview.config);

    // Parsing config changed, so the field set may have too — display config
    // is regenerated fresh rather than trying to remap stale visible/hidden
    // keys onto a potentially different field set.
    const display = createDefaultDisplayConfig(realFieldNames);
    const profile: Profile = initialProfile
      ? { ...initialProfile, name, parsing: preview.config, display, updatedAt: new Date().toISOString() }
      : createProfile({ name, parsing: preview.config, display });

    onSave(profile);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initialProfile ? "Edit profile" : "New profile"}</DialogTitle>
          <DialogDescription>
            Configure how this data is split into columns. The preview below uses a sample from the middle of
            your data.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <label className="w-32 shrink-0 text-xs text-muted-foreground">Profile name</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} className="flex-1" />
          </div>

          <div className="flex items-center gap-2">
            <label className="w-32 shrink-0 text-xs text-muted-foreground">Delimiter</label>
            <Select value={delimiter} onValueChange={(value) => setDelimiter(value as Delimiter)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DELIMITER_LABELS) as Delimiter[]).map((candidate) => (
                  <SelectItem key={candidate} value={candidate}>
                    {DELIMITER_LABELS[candidate]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={hasHeaderRow} onCheckedChange={(checked) => setHasHeaderRow(checked === true)} />
              First row is a header
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox checked={stripQuotes} onCheckedChange={(checked) => setStripQuotes(checked === true)} />
              Strip surrounding quotes
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={trimBoundaryPartials}
                onCheckedChange={(checked) => setTrimBoundaryPartials(checked === true)}
              />
              Drop a clipped first/last line
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">
              Preview ({preview.parsed.fieldNames.length} columns detected)
            </p>
            <div className="max-h-64 min-w-0 overflow-auto border border-input">
              <Table>
                <TableHeader>
                  <TableRow>
                    {preview.parsed.fieldNames.map((key) => (
                      <TableHead key={key}>{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.parsed.records.map((record) => (
                    <TableRow key={record.index}>
                      {preview.parsed.fieldNames.map((key) => {
                        const field = record.fields.find((f) => f.key === key);
                        return <TableCell key={key}>{field?.value ?? ""}</TableCell>;
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={name.trim().length === 0}>
            Save profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

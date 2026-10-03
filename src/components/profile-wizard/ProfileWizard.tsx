"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CheckIcon } from "@phosphor-icons/react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { buildParsingPreview } from "@/core/parsing/buildParsingPreview";
import { buildWizardSample, sampleWithFirst } from "@/core/parsing/buildWizardSample";
import { detectDelimiter } from "@/core/parsing/detectDelimiter";
import { parseDataset } from "@/core/parsing/parseDataset";
import { toRawRows } from "@/core/parsing/parseRows";
import type { Delimiter } from "@/core/parsing/types";
import { isBuiltInProfile } from "@/core/profile/builtInProfiles";
import { createDefaultDisplayConfig, createProfile } from "@/core/profile/createProfile";
import { reconcileDisplay } from "@/core/profile/reconcileDisplay";
import type { Profile } from "@/core/profile/types";

const DELIMITER_LABELS: Record<Delimiter, string> = {
  ",": "Comma",
  "\t": "Tab",
  "|": "Pipe",
  ";": "Semicolon",
  " ": "Space",
};

/** The character itself, shown next to each delimiter's name so it's recognisable at a glance. */
const DELIMITER_GLYPHS: Record<Delimiter, string> = {
  ",": ",",
  "\t": "⇥",
  "|": "|",
  ";": ";",
  " ": "␣",
};

const PREVIEW_SAMPLE_SIZE = 8;

interface ProfileWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasetRawText: string;
  /** The dataset's file name, if it came from a file (a ".csv" name turns CSV quoting rules on by default). */
  datasetName?: string;
  /** When set, the wizard edits this Profile's parsing config instead of creating a new one. */
  initialProfile?: Profile;
  onSave: (profile: Profile) => void;
}

/**
 * The Dialog shell only. All the wizard's state lives in WizardForm, which
 * Radix mounts inside DialogContent — so it's created fresh every time the
 * dialog opens. That re-runs delimiter detection and resets the toggles for
 * whichever Dataset/Profile is being configured, instead of carrying over
 * the previous Dataset's choices.
 */
export function ProfileWizard({
  open,
  onOpenChange,
  datasetRawText,
  datasetName,
  initialProfile,
  onSave,
}: ProfileWizardProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <WizardForm
          onOpenChange={onOpenChange}
          datasetRawText={datasetRawText}
          datasetName={datasetName}
          initialProfile={initialProfile}
          onSave={onSave}
        />
      </DialogContent>
    </Dialog>
  );
}

type WizardFormProps = Omit<ProfileWizardProps, "open">;

interface ToggleRowProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  title: string;
  children: ReactNode;
}

/** A checkbox with a title and a one-line explanation, as a single label. */
function ToggleRow({ checked, onCheckedChange, title, children }: ToggleRowProps) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 border-t border-border py-3 first:border-t-0 first:pt-0">
      <Checkbox
        className="mt-0.5"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <span className="grid gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="text-xs/relaxed text-muted-foreground">{children}</span>
      </span>
    </label>
  );
}

/** Whether a dataset's name (a file name) ends in ".csv". Pasted text has no name. */
function isCsvFileName(name: string | undefined): boolean {
  return name !== undefined && /\.csv$/i.test(name);
}

function WizardForm({ onOpenChange, datasetRawText, datasetName, initialProfile, onSave }: WizardFormProps) {
  // True first line (for correct header preview) + body rows sampled from
  // the middle (not head/tail, since a copy-paste often clips a boundary
  // line — see Profile in CONTEXT.md).
  const sample = useMemo(() => buildWizardSample(datasetRawText, PREVIEW_SAMPLE_SIZE), [datasetRawText]);
  const sampleRawText = useMemo(() => sample.join("\n"), [sample]);
  const detectedDelimiter = useMemo(() => detectDelimiter(sample), [sample]);

  // Editing a built-in Profile always forks into a new one on save (it has
  // no localStorage slot of its own to overwrite) — name the fork clearly
  // rather than silently reusing the built-in's exact display name.
  const editingBuiltIn = initialProfile !== undefined && isBuiltInProfile(initialProfile);

  const [name, setName] = useState(
    editingBuiltIn ? `${initialProfile!.name} (copy)` : (initialProfile?.name ?? "Untitled profile"),
  );
  const [delimiter, setDelimiter] = useState<Delimiter>(initialProfile?.parsing.delimiter ?? detectedDelimiter);
  const [hasHeaderRow, setHasHeaderRow] = useState(initialProfile?.parsing.hasHeaderRow ?? false);
  const [stripQuotes, setStripQuotes] = useState(initialProfile?.parsing.stripQuotes ?? false);
  const [trimBoundaryPartials, setTrimBoundaryPartials] = useState(
    initialProfile?.parsing.trimBoundaryPartials ?? false,
  );
  // A new profile for a ".csv" file starts with CSV quoting rules on; an existing profile keeps its own choice.
  const [quoteAware, setQuoteAware] = useState(
    initialProfile ? initialProfile.parsing.quoteAware === true : isCsvFileName(datasetName),
  );

  // Quoted fields can hold line breaks, so a CSV preview can't sample *lines*: the whole text is split into
  // rows (re-done only when the delimiter changes) and the sample is taken from the rows.
  const quotedRows = useMemo(
    () => (quoteAware ? toRawRows(datasetRawText, delimiter, true) : null),
    [quoteAware, datasetRawText, delimiter],
  );
  const sampleRows = useMemo(
    () => (quotedRows ? sampleWithFirst(quotedRows, PREVIEW_SAMPLE_SIZE) : toRawRows(sampleRawText, delimiter, false)),
    [quotedRows, sampleRawText, delimiter],
  );

  const preview = useMemo(
    () =>
      buildParsingPreview(sampleRows, {
        delimiter,
        hasHeaderRow,
        stripQuotes,
        trimBoundaryPartials,
        quoteAware,
        // Names a Profile was given (e.g. a built-in's) survive an edit; a header row overrides them.
        fieldNames: initialProfile?.parsing.fieldNames,
      }),
    [sampleRows, delimiter, hasHeaderRow, stripQuotes, trimBoundaryPartials, quoteAware, initialProfile],
  );

  function handleSave() {
    // Field names for the saved display config come from parsing the real,
    // full Dataset with the chosen config — not from preview.parsed, which
    // is only a small sample and must never leak into what gets saved.
    const { fieldNames: realFieldNames } = parseDataset(datasetRawText, preview.config);

    // A new Profile starts with everything visible. When editing an existing one, keep what the user
    // set up (labels, Derived Fields, visible columns, search) and only drop what no longer matches
    // the Fields the new parsing config produces.
    const display = initialProfile
      ? reconcileDisplay(initialProfile.display, realFieldNames)
      : createDefaultDisplayConfig(realFieldNames);
    const profile: Profile =
      initialProfile && !editingBuiltIn
        ? { ...initialProfile, name, parsing: preview.config, display, updatedAt: new Date().toISOString() }
        : createProfile({ name, parsing: preview.config, display });

    onSave(profile);
    onOpenChange(false);
  }

  return (
    <>
      <DialogHeader className="border-b border-border px-6 pt-5 pb-4">
        <DialogTitle className="text-base">
          {editingBuiltIn ? "Duplicate built-in profile" : initialProfile ? "Edit profile" : "New profile"}
        </DialogTitle>
        <DialogDescription>
          How should this data split into columns? The preview updates as you change options, and uses a sample from
          the middle of your data.
        </DialogDescription>
      </DialogHeader>

      <div className="grid min-h-0 overflow-y-auto md:grid-cols-[17rem_minmax(0,1fr)]">
        <div className="grid content-start gap-5 border-b border-border p-6 md:border-r md:border-b-0">
          <div className="grid gap-1.5">
            <label htmlFor="profile-name" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Profile name
            </label>
            <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Delimiter</span>
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={0}
              value={delimiter}
              onValueChange={(value) => value && setDelimiter(value as Delimiter)}
              className="flex-wrap"
              aria-label="Delimiter"
            >
              {(Object.keys(DELIMITER_LABELS) as Delimiter[]).map((candidate) => (
                <ToggleGroupItem key={candidate} value={candidate} aria-label={DELIMITER_LABELS[candidate]}>
                  {DELIMITER_LABELS[candidate]}
                  <span aria-hidden className="font-mono text-base leading-none opacity-70">
                    {DELIMITER_GLYPHS[candidate]}
                  </span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {delimiter === detectedDelimiter && <CheckIcon className="size-3.5" />}
              Auto-detected: {DELIMITER_LABELS[detectedDelimiter].toLowerCase()}
            </p>
          </div>

          <div>
            <ToggleRow title="Quoted fields (CSV rules)" checked={quoteAware} onCheckedChange={setQuoteAware}>
              A delimiter or line break inside &quot;quotes&quot; stays in the cell. The quotes themselves are removed.
            </ToggleRow>
            <ToggleRow title="First row is a header" checked={hasHeaderRow} onCheckedChange={setHasHeaderRow}>
              Use the first row as column names.
            </ToggleRow>
            <ToggleRow
              title={quoteAware ? "Trim cells" : "Trim cells & strip quotes"}
              checked={stripQuotes}
              onCheckedChange={setStripQuotes}
            >
              {quoteAware
                ? "Removes blanks around each cell."
                : "Removes blanks around each cell, then one pair of surrounding quotes."}
            </ToggleRow>
            <ToggleRow
              title="Drop a clipped first/last line"
              checked={trimBoundaryPartials}
              onCheckedChange={setTrimBoundaryPartials}
            >
              For pasted logs that were cut off mid-line.
            </ToggleRow>
          </div>
        </div>

        <div className="grid min-w-0 content-start gap-2 p-6">
          <p className="text-sm">
            <span className="font-medium">Preview</span>{" "}
            <span className="text-muted-foreground">
              · {sampleRows.length} sampled {quoteAware ? "row" : "line"}
              {sampleRows.length === 1 ? "" : "s"} · {preview.parsed.fieldNames.length}{" "}
              {preview.parsed.fieldNames.length === 1 ? "column" : "columns"} detected
            </span>
          </p>
          {/* This box is the preview's only scroller: the shadcn Table wraps itself in an
              overflow-x-auto container whose horizontal scrollbar would otherwise sit at the
              bottom of the full-height table, off-screen until the box is scrolled down. */}
          <div className="max-h-[26rem] min-w-0 overflow-auto border border-border [&_[data-slot=table-container]]:overflow-visible">
            <Table className="text-[0.8125rem]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="sticky top-0 w-10 bg-muted text-right text-xs text-muted-foreground">#</TableHead>
                  {preview.parsed.fieldNames.map((key) => (
                    <TableHead key={key} className="sticky top-0 bg-muted px-3 font-mono font-semibold">
                      {key}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.parsed.records.map((record, i) => (
                  <TableRow key={record.index}>
                    <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{i + 1}</TableCell>
                    {preview.parsed.fieldNames.map((key) => {
                      const field = record.fields.find((f) => f.key === key);
                      return (
                        <TableCell key={key} className="px-3 font-mono">
                          {field?.value ?? ""}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <DialogFooter className="border-t border-border px-6 py-4">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={name.trim().length === 0}>
          Save profile
        </Button>
      </DialogFooter>
    </>
  );
}

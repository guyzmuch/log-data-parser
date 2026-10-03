"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { DotsThreeIcon, FileTextIcon } from "@phosphor-icons/react";
import { ProfileMenu } from "@/components/profile-wizard/ProfileMenu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportProfilesToJSON, importProfilesFromJSON, ProfileImportError } from "@/core/persistence/profileFile";
import { isBuiltInProfile } from "@/core/profile/builtInProfiles";
import { createProfile } from "@/core/profile/createProfile";
import { splitIntoRecords } from "@/core/parsing/splitIntoRecords";
import { downloadBlob } from "@/lib/downloadBlob";
import { useAppStore } from "@/state/useAppStore";

/** The app's one top bar: what's open, which profile is applied, and the less-used actions. */
export function TopBar() {
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const dataset = useAppStore((s) => s.dataset);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const baseFieldNames = useAppStore((s) => s.baseFieldNames);
  const savedProfiles = useAppStore((s) => s.savedProfiles);
  const replacing = useAppStore((s) => s.replacing);
  const startReplacing = useAppStore((s) => s.startReplacing);
  const openWizard = useAppStore((s) => s.openWizard);
  const saveCurrentView = useAppStore((s) => s.saveCurrentView);
  const importSavedProfiles = useAppStore((s) => s.importSavedProfiles);
  const [justSaved, setJustSaved] = useState(false);

  const lineCount = useMemo(() => (dataset ? splitIntoRecords(dataset.rawText).length : 0), [dataset]);

  function handleExportAll() {
    downloadBlob(exportProfilesToJSON(savedProfiles), "log-data-parser-profiles.json");
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const imported = await importProfilesFromJSON(file);
      setImportError(null);
      // An imported Profile that happens to carry a built-in id (e.g.
      // re-importing a previously-exported built-in) has no localStorage
      // slot to overwrite — fork it into a genuine new Profile, same as
      // editing a built-in via the wizard does.
      const toSave = imported.map((profile) =>
        isBuiltInProfile(profile)
          ? createProfile({ name: `${profile.name} (imported)`, parsing: profile.parsing, display: profile.display })
          : profile,
      );
      importSavedProfiles(toSave);
    } catch (error) {
      setImportError(error instanceof ProfileImportError ? error.message : "Could not import this file.");
    }
  }

  return (
    <header className="shrink-0 border-b border-border">
      <div className="flex min-h-13 flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2">
        <div className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight">
          <span aria-hidden className="size-4 bg-primary" />
          log-data-parser
        </div>

        {dataset && (
          <>
            <span aria-hidden className="h-5 w-px bg-border" />
            <div className="flex h-8 items-center gap-2 border border-border bg-muted/50 px-2.5 text-sm">
              <FileTextIcon className="size-4 text-muted-foreground" />
              <span className="max-w-56 truncate font-medium">{dataset.name ?? "Pasted text"}</span>
              <span className="text-muted-foreground">
                · {lineCount} {lineCount === 1 ? "line" : "lines"}
                {activeProfile && ` · ${baseFieldNames.length} ${baseFieldNames.length === 1 ? "column" : "columns"}`}
              </span>
            </div>
            {!replacing && (
              <Button variant="ghost" className="text-muted-foreground" onClick={startReplacing}>
                Replace…
              </Button>
            )}
          </>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {dataset && !replacing && <ProfileMenu />}
          {activeProfile && !replacing && (
            <>
              <Button variant="outline" onClick={() => openWizard(activeProfile)}>
                Edit parsing…
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  saveCurrentView();
                  setJustSaved(true);
                  setTimeout(() => setJustSaved(false), 1500);
                }}
              >
                {justSaved ? "Saved" : "Save view"}
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More">
                <DotsThreeIcon weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => importInputRef.current?.click()}>Import profiles…</DropdownMenuItem>
              <DropdownMenuItem disabled={savedProfiles.length === 0} onSelect={handleExportAll}>
                Export your profiles
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
            aria-label="Import profiles file"
          />
        </div>
      </div>

      {importError && (
        <p role="alert" className="border-t border-border bg-destructive/10 px-5 py-2 text-sm text-destructive">
          {importError}
        </p>
      )}
    </header>
  );
}

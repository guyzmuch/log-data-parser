"use client";

import { useState, type FormEvent } from "react";
import { CaretDownIcon, RowsIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/state/useAppStore";

type NameTarget = { kind: "new" } | { kind: "rename"; viewId: string; name: string };

/** Switch between the profile's saved column layouts, add one, rename or delete the current one. */
export function ViewMenu() {
  const activeProfile = useAppStore((s) => s.activeProfile);
  const switchView = useAppStore((s) => s.switchView);
  const addView = useAppStore((s) => s.addView);
  const renameView = useAppStore((s) => s.renameView);
  const deleteView = useAppStore((s) => s.deleteView);
  const [nameTarget, setNameTarget] = useState<NameTarget | null>(null);

  const views = activeProfile?.views;
  if (!activeProfile || !views) return null;
  const active = views.find((view) => view.id === activeProfile.activeViewId) ?? views[0];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" aria-label={`View: ${active.name}`}>
            <RowsIcon />
            <span className="text-muted-foreground">View</span>
            <span className="max-w-40 truncate">{active.name}</span>
            <CaretDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Column layouts</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={active.id} onValueChange={switchView}>
            {views.map((view) => (
              <DropdownMenuRadioItem key={view.id} value={view.id}>
                {view.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setNameTarget({ kind: "new" })}>Save as new view…</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setNameTarget({ kind: "rename", viewId: active.id, name: active.name })}>
            Rename this view…
          </DropdownMenuItem>
          <DropdownMenuItem disabled={views.length <= 1} onSelect={() => deleteView(active.id)}>
            Delete this view
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={nameTarget !== null} onOpenChange={(open) => !open && setNameTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          {nameTarget && (
            <NameForm
              target={nameTarget}
              onSubmit={(name) => {
                if (nameTarget.kind === "new") addView(name);
                else renameView(nameTarget.viewId, name);
                setNameTarget(null);
              }}
              onCancel={() => setNameTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Kept inside DialogContent so the draft is fresh each time the dialog opens.
function NameForm({ target, onSubmit, onCancel }: { target: NameTarget; onSubmit: (name: string) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(target.kind === "rename" ? target.name : "");
  const isNew = target.kind === "new";

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (draft.trim()) onSubmit(draft.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{isNew ? "Save as new view" : "Rename view"}</DialogTitle>
        <DialogDescription>
          {isNew
            ? "Starts from the columns shown now. Use “Save view” to keep it with the profile."
            : "A view is a saved choice of shown columns and their order."}
        </DialogDescription>
      </DialogHeader>
      <Input autoFocus placeholder="e.g. Errors only" aria-label="View name" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={draft.trim() === ""}>
          {isNew ? "Add view" : "Rename"}
        </Button>
      </DialogFooter>
    </form>
  );
}

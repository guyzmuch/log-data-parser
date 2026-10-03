"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { isValidTimeZone } from "@/core/derived-fields/isValidTimeZone";
import { useAppStore } from "@/state/useAppStore";

interface TimezoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Key of the base Field the extra timezone column is derived from. */
  sourceFieldKey: string;
  sourceLabel: string;
}

/** Asks for an IANA timezone and adds it as one more date Derived Field — additive, never replacing. */
export function TimezoneDialog({ open, onOpenChange, sourceFieldKey, sourceLabel }: TimezoneDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <TimezoneForm sourceFieldKey={sourceFieldKey} sourceLabel={sourceLabel} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

// Kept inside DialogContent so the draft and error are fresh each time the dialog opens.
function TimezoneForm({
  sourceFieldKey,
  sourceLabel,
  onDone,
}: {
  sourceFieldKey: string;
  sourceLabel: string;
  onDone: () => void;
}) {
  const addTimezoneDerivedField = useAppStore((s) => s.addTimezoneDerivedField);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const timezone = draft.trim();
    if (!timezone) return;
    if (!isValidTimeZone(timezone)) {
      setError(`"${timezone}" is not a known timezone (use a name like Europe/Paris).`);
      return;
    }
    addTimezoneDerivedField(sourceFieldKey, timezone);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Add a timezone</DialogTitle>
        <DialogDescription>
          Adds one more column showing <span className="font-mono">{sourceLabel}</span> in that timezone.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Input
          autoFocus
          placeholder="e.g. Europe/Paris"
          aria-label="Timezone"
          aria-invalid={error ? true : undefined}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError("");
          }}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={draft.trim() === ""}>
          Add timezone
        </Button>
      </DialogFooter>
    </form>
  );
}

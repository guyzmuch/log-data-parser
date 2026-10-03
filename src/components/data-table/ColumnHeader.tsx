"use client";

import { useRef, useState, type KeyboardEvent, type RefObject } from "react";
import {
  ArrowElbowDownRightIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BackspaceIcon,
  BracketsCurlyIcon,
  ClockIcon,
  DotsThreeVerticalIcon,
  EyeSlashIcon,
  GlobeIcon,
  PencilSimpleIcon,
} from "@phosphor-icons/react";
import { PATTERN_LABELS } from "@/components/data-table/useDetectedPatterns";
import { TimezoneDialog } from "@/components/data-table/TimezoneDialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColumnPatternKind } from "@/core/derived-fields/detectColumnPatterns";
import { derivedFieldKey } from "@/core/derived-fields/derivedFieldKey";
import type { DerivedFieldSpec } from "@/core/derived-fields/types";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/state/useAppStore";

const DERIVED_KIND_LABELS: Record<DerivedFieldSpec["kind"], string> = {
  date: "date",
  "json-key": "JSON",
  unescape: "unescaped",
};

interface RenameInputProps {
  initial: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

function RenameInput({ initial, inputRef, onCommit, onCancel }: RenameInputProps) {
  const [value, setValue] = useState(initial);
  const finished = useRef(false);

  function finish(commit: boolean) {
    if (finished.current) return;
    finished.current = true;
    if (commit) onCommit(value);
    else onCancel();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") finish(true);
    else if (event.key === "Escape") finish(false);
  }

  return (
    <Input
      ref={inputRef}
      aria-label="Column name"
      className="h-7 w-44 font-mono text-[0.8125rem]"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => finish(true)}
    />
  );
}

interface ColumnHeaderProps {
  fieldKey: string;
  /** Detected patterns for this column (base columns only). */
  detected: ColumnPatternKind[];
  isFirst: boolean;
  isLast: boolean;
}

/** A column's title cell: its name, what was detected in it, and a menu with everything you can do to the column. */
export function ColumnHeader({ fieldKey, detected, isFirst, isLast }: ColumnHeaderProps) {
  const activeProfile = useAppStore((s) => s.activeProfile);
  const toggleFieldVisibility = useAppStore((s) => s.toggleFieldVisibility);
  const toggleSecondLine = useAppStore((s) => s.toggleSecondLine);
  const moveFieldUp = useAppStore((s) => s.moveFieldUp);
  const moveFieldDown = useAppStore((s) => s.moveFieldDown);
  const renameField = useAppStore((s) => s.renameField);
  const addDefaultDateDerivedFields = useAppStore((s) => s.addDefaultDateDerivedFields);
  const addJsonKeyDerivedFields = useAppStore((s) => s.addJsonKeyDerivedFields);
  const addUnescapeDerivedField = useAppStore((s) => s.addUnescapeDerivedField);

  const [renaming, setRenaming] = useState(false);
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const keepFocusOffTrigger = useRef(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  if (!activeProfile) return null;
  const { fieldLabels, derivedFieldSelections } = activeProfile.display;

  const labelOf = (key: string) => fieldLabels[key] ?? key;
  const label = labelOf(fieldKey);
  const derivedSpec = derivedFieldSelections.find((spec) => derivedFieldKey(spec) === fieldKey);
  const fromThisField = derivedFieldSelections.filter((spec) => spec.sourceFieldKey === fieldKey);
  const hasDate = fromThisField.some((spec) => spec.kind === "date");
  const hasJson = fromThisField.some((spec) => spec.kind === "json-key");
  const hasUnescape = fromThisField.some((spec) => spec.kind === "unescape");

  const suggest = "bg-accent font-semibold";
  const detectedTag = <span className="ml-auto border border-border bg-background px-1 text-[0.6875rem] font-medium text-muted-foreground">detected</span>;

  return (
    <div className="flex min-w-0 flex-col gap-0.5 py-1">
      <div className="flex min-w-0 items-center gap-1.5">
        {renaming ? (
          <RenameInput
            initial={label}
            inputRef={renameInputRef}
            onCommit={(value) => {
              renameField(fieldKey, value.trim() === "" ? fieldKey : value.trim());
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <span data-testid="column-label" data-label={label} title={label} className="min-w-0 truncate font-mono text-[0.8125rem] font-semibold">
            {label}
          </span>
        )}
        {!renaming &&
          detected.map((kind) => (
            <span
              key={kind}
              data-testid="detected-hint"
              title={`Detected: ${PATTERN_LABELS[kind]}`}
              className="border border-border bg-background px-1 text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase"
            >
              {PATTERN_LABELS[kind]}
            </span>
          ))}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Column options for ${label}`}
              className="ml-auto grid size-6 shrink-0 place-items-center text-muted-foreground outline-none hover:bg-border hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring aria-expanded:bg-border aria-expanded:text-foreground"
            >
              <DotsThreeVerticalIcon className="size-4" weight="bold" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-64"
            onCloseAutoFocus={(event) => {
              // After "Rename column", focus the input (with its text selected) instead of handing
              // focus back to the menu trigger. It has to happen here: while the menu is open it
              // keeps focus trapped, so an autoFocus on mount gets pulled away.
              if (keepFocusOffTrigger.current) {
                event.preventDefault();
                keepFocusOffTrigger.current = false;
                renameInputRef.current?.focus();
                renameInputRef.current?.select();
              }
            }}
          >
            <DropdownMenuItem
              onSelect={() => {
                keepFocusOffTrigger.current = true;
                setRenaming(true);
              }}
            >
              <PencilSimpleIcon />
              Rename column
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toggleFieldVisibility(fieldKey)}>
              <EyeSlashIcon />
              Hide column
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toggleSecondLine(fieldKey)}>
              <ArrowElbowDownRightIcon />
              Show on a second line
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isFirst} onSelect={() => moveFieldUp(fieldKey)}>
              <ArrowLeftIcon />
              Move left
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isLast} onSelect={() => moveFieldDown(fieldKey)}>
              <ArrowRightIcon />
              Move right
            </DropdownMenuItem>

            {derivedSpec?.kind === "date" && (
              <>
                <DropdownMenuSeparator />
                {/* The source column is usually hidden once derived from, so its timezone action is offered here too. */}
                <DropdownMenuItem onSelect={() => setTimezoneOpen(true)}>
                  <GlobeIcon />
                  Add timezone…
                </DropdownMenuItem>
              </>
            )}

            {!derivedSpec && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Derive new column</DropdownMenuLabel>
                {hasDate ? (
                  <DropdownMenuItem onSelect={() => setTimezoneOpen(true)}>
                    <GlobeIcon />
                    Add timezone…
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className={cn(detected.includes("date") && suggest)}
                    onSelect={() => addDefaultDateDerivedFields(fieldKey)}
                  >
                    <ClockIcon />
                    Parse as date
                    {detected.includes("date") && detectedTag}
                  </DropdownMenuItem>
                )}
                {!hasJson && (
                  <DropdownMenuItem
                    className={cn(detected.includes("json") && suggest)}
                    onSelect={() => addJsonKeyDerivedFields(fieldKey)}
                  >
                    <BracketsCurlyIcon />
                    Extract JSON keys
                    {detected.includes("json") && detectedTag}
                  </DropdownMenuItem>
                )}
                {!hasUnescape && (
                  <DropdownMenuItem
                    className={cn(detected.includes("stringified-escapes") && suggest)}
                    onSelect={() => addUnescapeDerivedField(fieldKey)}
                  >
                    <BackspaceIcon />
                    Strip escape characters
                    {detected.includes("stringified-escapes") && detectedTag}
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {derivedSpec && (
        <span className="truncate text-[0.6875rem] font-normal text-muted-foreground">
          from {labelOf(derivedSpec.sourceFieldKey)} · {DERIVED_KIND_LABELS[derivedSpec.kind]}
        </span>
      )}

      {(hasDate || derivedSpec?.kind === "date") && (
        <TimezoneDialog
          open={timezoneOpen}
          onOpenChange={setTimezoneOpen}
          sourceFieldKey={derivedSpec ? derivedSpec.sourceFieldKey : fieldKey}
          sourceLabel={derivedSpec ? labelOf(derivedSpec.sourceFieldKey) : label}
        />
      )}
    </div>
  );
}

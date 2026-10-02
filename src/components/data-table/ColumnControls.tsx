"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { detectColumnPatterns, type ColumnPatternKind } from "@/core/derived-fields/detectColumnPatterns";
import { derivedFieldKey } from "@/core/derived-fields/derivedFieldKey";
import { isValidTimeZone } from "@/core/derived-fields/isValidTimeZone";
import { useAppStore } from "@/state/useAppStore";

const PATTERN_LABELS: Record<ColumnPatternKind, string> = {
  date: "date",
  json: "JSON",
  "stringified-escapes": "escaped chars",
};

const SAMPLE_SIZE = 50;

interface FieldRowProps {
  fieldKey: string;
  indented?: boolean;
}

function FieldRow({ fieldKey, indented }: FieldRowProps) {
  const activeProfile = useAppStore((s) => s.activeProfile);
  const toggleFieldVisibility = useAppStore((s) => s.toggleFieldVisibility);
  const moveFieldUp = useAppStore((s) => s.moveFieldUp);
  const moveFieldDown = useAppStore((s) => s.moveFieldDown);
  const renameField = useAppStore((s) => s.renameField);

  if (!activeProfile) return null;
  const { visibleFieldKeys, fieldLabels } = activeProfile.display;

  const visible = visibleFieldKeys.includes(fieldKey);
  const position = visibleFieldKeys.indexOf(fieldKey);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${indented ? "ml-6 border-l border-input pl-2" : ""}`}>
      <Checkbox checked={visible} onCheckedChange={() => toggleFieldVisibility(fieldKey)} />
      <Input
        className="h-6 w-40"
        value={fieldLabels[fieldKey] ?? fieldKey}
        onChange={(event) => renameField(fieldKey, event.target.value)}
      />
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={!visible || position <= 0}
        onClick={() => moveFieldUp(fieldKey)}
        aria-label={`Move ${fieldKey} up`}
      >
        ↑
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={!visible || position === visibleFieldKeys.length - 1}
        onClick={() => moveFieldDown(fieldKey)}
        aria-label={`Move ${fieldKey} down`}
      >
        ↓
      </Button>
    </div>
  );
}

export function ColumnControls() {
  const baseFieldNames = useAppStore((s) => s.baseFieldNames);
  const records = useAppStore((s) => s.records);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const addDefaultDateDerivedFields = useAppStore((s) => s.addDefaultDateDerivedFields);
  const addTimezoneDerivedField = useAppStore((s) => s.addTimezoneDerivedField);
  const addUnescapeDerivedField = useAppStore((s) => s.addUnescapeDerivedField);
  const addJsonKeyDerivedFields = useAppStore((s) => s.addJsonKeyDerivedFields);

  const [timezoneDrafts, setTimezoneDrafts] = useState<Record<string, string>>({});
  const [timezoneErrors, setTimezoneErrors] = useState<Record<string, string>>({});

  // Detection looks at the parsed values only, so it must not re-run on every search/timezone keystroke
  // (those change the store/state but not `records`).
  const detectedByField = useMemo(() => {
    const detected: Record<string, ColumnPatternKind[]> = {};
    for (const baseKey of baseFieldNames) {
      const sampleValues = records
        .slice(0, SAMPLE_SIZE)
        .flatMap((record) => record.fields.filter((f) => f.key === baseKey).map((f) => f.value));
      detected[baseKey] = detectColumnPatterns(sampleValues);
    }
    return detected;
  }, [baseFieldNames, records]);

  if (!activeProfile || baseFieldNames.length === 0) return null;

  const { derivedFieldSelections } = activeProfile.display;

  return (
    <div className="flex flex-col gap-1 border border-input p-2">
      <p className="text-xs font-medium text-muted-foreground">Columns</p>
      {baseFieldNames.map((baseKey) => {
        const derivedForField = derivedFieldSelections.filter((spec) => spec.sourceFieldKey === baseKey);
        const hasDate = derivedForField.some((spec) => spec.kind === "date");
        const hasUnescape = derivedForField.some((spec) => spec.kind === "unescape");
        const hasJson = derivedForField.some((spec) => spec.kind === "json-key");

        const detected = detectedByField[baseKey] ?? [];

        return (
          <div key={baseKey} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <FieldRow fieldKey={baseKey} />
              {detected.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  detected: {detected.map((kind) => PATTERN_LABELS[kind]).join(", ")}
                </span>
              )}
            </div>

            <div className="ml-6 flex flex-wrap items-center gap-1">
              {!hasDate && (
                <Button variant="outline" size="xs" onClick={() => addDefaultDateDerivedFields(baseKey)}>
                  Force as date
                </Button>
              )}
              {!hasJson && (
                <Button variant="outline" size="xs" onClick={() => addJsonKeyDerivedFields(baseKey)}>
                  Force as JSON
                </Button>
              )}
              {!hasUnescape && (
                <Button variant="outline" size="xs" onClick={() => addUnescapeDerivedField(baseKey)}>
                  Strip escapes
                </Button>
              )}
            </div>

            {derivedForField.map((spec) => (
              <FieldRow key={derivedFieldKey(spec)} fieldKey={derivedFieldKey(spec)} indented />
            ))}

            {hasDate && (
              <div className="ml-6 flex items-center gap-1 border-l border-input pl-2">
                <Input
                  className="h-6 w-36"
                  placeholder="e.g. Europe/Paris"
                  value={timezoneDrafts[baseKey] ?? ""}
                  aria-invalid={timezoneErrors[baseKey] ? true : undefined}
                  onChange={(event) => {
                    setTimezoneDrafts((prev) => ({ ...prev, [baseKey]: event.target.value }));
                    setTimezoneErrors((prev) => ({ ...prev, [baseKey]: "" }));
                  }}
                />
                <Button
                  variant="outline"
                  size="xs"
                  disabled={!timezoneDrafts[baseKey]?.trim()}
                  onClick={() => {
                    const timezone = timezoneDrafts[baseKey]?.trim();
                    if (!timezone) return;
                    if (!isValidTimeZone(timezone)) {
                      setTimezoneErrors((prev) => ({ ...prev, [baseKey]: `"${timezone}" is not a known timezone (use e.g. Europe/Paris).` }));
                      return;
                    }
                    addTimezoneDerivedField(baseKey, timezone);
                    setTimezoneDrafts((prev) => ({ ...prev, [baseKey]: "" }));
                  }}
                >
                  Add timezone
                </Button>
                {timezoneErrors[baseKey] && <span className="text-xs text-destructive">{timezoneErrors[baseKey]}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

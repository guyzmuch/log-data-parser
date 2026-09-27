"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/state/useAppStore";

export function ColumnControls() {
  const fieldNames = useAppStore((s) => s.fieldNames);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const toggleFieldVisibility = useAppStore((s) => s.toggleFieldVisibility);
  const moveFieldUp = useAppStore((s) => s.moveFieldUp);
  const moveFieldDown = useAppStore((s) => s.moveFieldDown);
  const renameField = useAppStore((s) => s.renameField);

  if (!activeProfile || fieldNames.length === 0) return null;

  const { visibleFieldKeys, fieldLabels } = activeProfile.display;

  return (
    <div className="flex flex-col gap-1 border border-input p-2">
      <p className="text-xs font-medium text-muted-foreground">Columns</p>
      {fieldNames.map((key) => {
        const visible = visibleFieldKeys.includes(key);
        const position = visibleFieldKeys.indexOf(key);
        return (
          <div key={key} className="flex items-center gap-2">
            <Checkbox checked={visible} onCheckedChange={() => toggleFieldVisibility(key)} />
            <Input
              className="h-6 w-40"
              value={fieldLabels[key] ?? key}
              onChange={(event) => renameField(key, event.target.value)}
            />
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={!visible || position <= 0}
              onClick={() => moveFieldUp(key)}
              aria-label={`Move ${key} up`}
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={!visible || position === visibleFieldKeys.length - 1}
              onClick={() => moveFieldDown(key)}
              aria-label={`Move ${key} down`}
            >
              ↓
            </Button>
          </div>
        );
      })}
    </div>
  );
}

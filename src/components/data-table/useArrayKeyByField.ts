"use client";

import { useMemo } from "react";
import { buildArrayKeyByField } from "@/core/json/arrayColumns";
import { useAppStore } from "@/state/useAppStore";

/** The JSON array each array column belongs to, by Field key (see buildArrayKeyByField). */
export function useArrayKeyByField(): Map<string, string> {
  const jsonColumns = useAppStore((s) => s.jsonColumns);
  const derivedFieldSelections = useAppStore((s) => s.activeProfile?.display.derivedFieldSelections);
  return useMemo(() => buildArrayKeyByField(jsonColumns, derivedFieldSelections ?? []), [jsonColumns, derivedFieldSelections]);
}

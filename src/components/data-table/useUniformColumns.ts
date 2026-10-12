"use client";

import { useMemo } from "react";
import { uniformFields, type UniformColumn } from "@/core/dataset/uniformFields";
import { useAppStore } from "@/state/useAppStore";

/** Chip text for a uniform column. */
export const UNIFORM_LABELS: Record<UniformColumn["kind"], string> = {
  empty: "empty",
  same: "same value",
};

/** Tooltip explaining a uniform column's chip. */
export function uniformTitle(uniform: UniformColumn): string {
  return uniform.kind === "empty"
    ? "Every value in this column is blank: you can hide it"
    : `Every row has the same value (“${uniform.value}”): you can hide it`;
}

/**
 * The columns (Derived Fields included) that are blank or hold the same value in every Record. Memoised on
 * `records`, so it doesn't re-run on search or display changes.
 */
export function useUniformColumns(): Map<string, UniformColumn> {
  const records = useAppStore((s) => s.records);
  return useMemo(() => uniformFields(records), [records]);
}

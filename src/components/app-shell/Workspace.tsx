"use client";

import { DataTable } from "@/components/data-table/DataTable";
import { TableToolbar } from "@/components/data-table/TableToolbar";
import { DatasetInput } from "@/components/dataset-input/DatasetInput";
import { ProfileChooser } from "@/components/profile-wizard/ProfileChooser";
import { useAppStore } from "@/state/useAppStore";

/** Everything under the top bar: the empty state, the profile chooser, or the table with its toolbar. */
export function Workspace() {
  const dataset = useAppStore((s) => s.dataset);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const replacing = useAppStore((s) => s.replacing);

  if (!dataset || replacing) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DatasetInput />
      </div>
    );
  }
  if (!activeProfile) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ProfileChooser />
      </div>
    );
  }
  return (
    <>
      <TableToolbar />
      <DataTable />
    </>
  );
}

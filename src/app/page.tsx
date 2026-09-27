import { ColumnControls } from "@/components/data-table/ColumnControls";
import { DataTable } from "@/components/data-table/DataTable";
import { DatasetInput } from "@/components/dataset-input/DatasetInput";
import { ProfilePicker } from "@/components/profile-wizard/ProfilePicker";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <h1 className="text-lg font-semibold">log-data-parser</h1>
      <DatasetInput />
      <ProfilePicker />
      <ColumnControls />
      <DataTable />
    </main>
  );
}

import { TopBar } from "@/components/app-shell/TopBar";
import { Workspace } from "@/components/app-shell/Workspace";
import { ProfileWizardHost } from "@/components/profile-wizard/ProfileWizardHost";

export default function Home() {
  return (
    <main className="flex h-full min-h-0 flex-col">
      <TopBar />
      <Workspace />
      <ProfileWizardHost />
    </main>
  );
}

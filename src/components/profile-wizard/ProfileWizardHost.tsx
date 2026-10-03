"use client";

import { ProfileWizard } from "@/components/profile-wizard/ProfileWizard";
import { useAppStore } from "@/state/useAppStore";

/** Mounts the one Profile wizard for the whole app, driven by the store's `wizardTarget`. */
export function ProfileWizardHost() {
  const dataset = useAppStore((s) => s.dataset);
  const wizardTarget = useAppStore((s) => s.wizardTarget);
  const closeWizard = useAppStore((s) => s.closeWizard);
  const saveAndApplyProfile = useAppStore((s) => s.saveAndApplyProfile);

  if (!dataset) return null;

  return (
    <ProfileWizard
      open={wizardTarget !== null}
      onOpenChange={(open) => !open && closeWizard()}
      datasetRawText={dataset.rawText}
      datasetName={dataset.name}
      initialProfile={wizardTarget === "new" || wizardTarget === null ? undefined : wizardTarget}
      onSave={saveAndApplyProfile}
    />
  );
}

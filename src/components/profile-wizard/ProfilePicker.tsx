"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ProfileWizard } from "@/components/profile-wizard/ProfileWizard";
import type { Profile } from "@/core/profile/types";
import { useAppStore } from "@/state/useAppStore";

/** "new" opens the wizard in create mode; a Profile opens it in edit mode; null keeps it closed. */
type WizardTarget = Profile | "new" | null;

export function ProfilePicker() {
  const [wizardTarget, setWizardTarget] = useState<WizardTarget>(null);
  const dataset = useAppStore((s) => s.dataset);
  const savedProfiles = useAppStore((s) => s.savedProfiles);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const applyProfile = useAppStore((s) => s.applyProfile);
  const saveAndApplyProfile = useAppStore((s) => s.saveAndApplyProfile);
  const saveCurrentView = useAppStore((s) => s.saveCurrentView);

  const [justSaved, setJustSaved] = useState(false);

  if (!dataset) return null;

  return (
    <div className="flex flex-col gap-2 border border-input p-2">
      <p className="text-xs font-medium text-muted-foreground">
        Profile{activeProfile ? `: ${activeProfile.name}` : " (none selected)"}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {savedProfiles.map((profile) => (
          <Button
            key={profile.id}
            variant={profile.id === activeProfile?.id ? "default" : "outline"}
            size="sm"
            onClick={() => applyProfile(profile)}
          >
            {profile.name}
          </Button>
        ))}
        <Button size="sm" onClick={() => setWizardTarget("new")}>
          New profile…
        </Button>
        {activeProfile && (
          <Button variant="outline" size="sm" onClick={() => setWizardTarget(activeProfile)}>
            Edit parsing…
          </Button>
        )}
        {activeProfile && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              saveCurrentView();
              setJustSaved(true);
              setTimeout(() => setJustSaved(false), 1500);
            }}
          >
            {justSaved ? "Saved" : "Save view"}
          </Button>
        )}
      </div>

      <ProfileWizard
        open={wizardTarget !== null}
        onOpenChange={(open) => !open && setWizardTarget(null)}
        datasetRawText={dataset.rawText}
        initialProfile={wizardTarget === "new" || wizardTarget === null ? undefined : wizardTarget}
        onSave={saveAndApplyProfile}
      />
    </div>
  );
}

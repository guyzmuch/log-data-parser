"use client";

import { useState } from "react";
import { ManageProfilesDialog } from "@/components/profile-wizard/ManageProfilesDialog";
import { Button } from "@/components/ui/button";
import { BUILT_IN_PROFILES, isBuiltInProfile } from "@/core/profile/builtInProfiles";
import { useAppStore } from "@/state/useAppStore";

/** Shown once a Dataset is loaded and before a profile is picked: pick how to split it, or make a new profile. */
export function ProfileChooser() {
  const [manageOpen, setManageOpen] = useState(false);
  const savedProfiles = useAppStore((s) => s.savedProfiles);
  const hiddenProfileIds = useAppStore((s) => s.hiddenProfileIds);
  const applyProfile = useAppStore((s) => s.applyProfile);
  const openWizard = useAppStore((s) => s.openWizard);

  const profiles = [...savedProfiles, ...BUILT_IN_PROFILES].filter((profile) => !hiddenProfileIds.has(profile.id));
  const hiddenCount = savedProfiles.length + BUILT_IN_PROFILES.length - profiles.length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 pt-14 pb-10">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Choose how to split this data</h1>
        <p className="max-w-prose text-muted-foreground">
          Pick a saved or built-in profile, or make a new one and check the preview before saving it.
        </p>
      </div>

      <div>
        <Button size="lg" onClick={() => openWizard("new")}>
          New profile…
        </Button>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {profiles.map((profile) => (
          <li key={profile.id}>
            <button
              type="button"
              aria-label={profile.name}
              onClick={() => applyProfile(profile)}
              className="flex h-full w-full flex-col items-start gap-0.5 border border-border bg-background px-3 py-2.5 text-left outline-none hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring"
            >
              <span className="font-medium">{profile.name}</span>
              <span className="text-xs text-muted-foreground">{isBuiltInProfile(profile) ? "Built-in" : "Yours"}</span>
            </button>
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <div>
          <Button variant="ghost" onClick={() => setManageOpen(true)}>
            Show hidden profiles ({hiddenCount})
          </Button>
        </div>
      )}
      <ManageProfilesDialog open={manageOpen} onOpenChange={setManageOpen} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ProfileWizard } from "@/components/profile-wizard/ProfileWizard";
import { BUILT_IN_PROFILES } from "@/core/profile/builtInProfiles";
import type { Profile } from "@/core/profile/types";
import { useAppStore } from "@/state/useAppStore";

/** "new" opens the wizard in create mode; a Profile opens it in edit mode; null keeps it closed. */
type WizardTarget = Profile | "new" | null;

interface ProfileEntryProps {
  profile: Profile;
  isActive: boolean;
  isHidden: boolean;
  onApply: () => void;
  onToggleHidden: () => void;
}

function ProfileEntry({ profile, isActive, isHidden, onApply, onToggleHidden }: ProfileEntryProps) {
  return (
    <div className="flex items-center gap-1">
      <Button variant={isActive ? "default" : "outline"} size="sm" onClick={onApply}>
        {profile.name}
      </Button>
      <Button
        variant="ghost"
        size="xs"
        onClick={onToggleHidden}
        aria-label={isHidden ? `Unhide ${profile.name}` : `Hide ${profile.name}`}
      >
        {isHidden ? "Unhide" : "Hide"}
      </Button>
    </div>
  );
}

export function ProfilePicker() {
  const [wizardTarget, setWizardTarget] = useState<WizardTarget>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const dataset = useAppStore((s) => s.dataset);
  const savedProfiles = useAppStore((s) => s.savedProfiles);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const hiddenProfileIds = useAppStore((s) => s.hiddenProfileIds);
  const applyProfile = useAppStore((s) => s.applyProfile);
  const saveAndApplyProfile = useAppStore((s) => s.saveAndApplyProfile);
  const saveCurrentView = useAppStore((s) => s.saveCurrentView);
  const hideProfile = useAppStore((s) => s.hideProfile);
  const unhideProfile = useAppStore((s) => s.unhideProfile);

  if (!dataset) return null;

  // Built-in Profiles are always offered alongside the user's own, additively — see Built-in Profile in CONTEXT.md.
  const allProfiles = [...BUILT_IN_PROFILES, ...savedProfiles];
  const visibleProfiles = allProfiles.filter((profile) => !hiddenProfileIds.has(profile.id));
  const hiddenProfiles = allProfiles.filter((profile) => hiddenProfileIds.has(profile.id));

  function handleToggleHidden(id: string) {
    if (hiddenProfileIds.has(id)) unhideProfile(id);
    else hideProfile(id);
  }

  return (
    <div className="flex flex-col gap-2 border border-input p-2">
      <p className="text-xs font-medium text-muted-foreground">
        Profile{activeProfile ? `: ${activeProfile.name}` : " (none selected)"}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {visibleProfiles.map((profile) => (
          <ProfileEntry
            key={profile.id}
            profile={profile}
            isActive={profile.id === activeProfile?.id}
            isHidden={false}
            onApply={() => applyProfile(profile)}
            onToggleHidden={() => handleToggleHidden(profile.id)}
          />
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
        {hiddenProfiles.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowHidden((prev) => !prev)}>
            {showHidden ? "Hide hidden profiles" : `Show hidden (${hiddenProfiles.length})`}
          </Button>
        )}
      </div>

      {showHidden && hiddenProfiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-input pt-2">
          <p className="w-full text-xs text-muted-foreground">Hidden:</p>
          {hiddenProfiles.map((profile) => (
            <ProfileEntry
              key={profile.id}
              profile={profile}
              isActive={profile.id === activeProfile?.id}
              isHidden
              onApply={() => applyProfile(profile)}
              onToggleHidden={() => handleToggleHidden(profile.id)}
            />
          ))}
        </div>
      )}

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

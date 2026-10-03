"use client";

import { useState } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";
import { ManageProfilesDialog } from "@/components/profile-wizard/ManageProfilesDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BUILT_IN_PROFILES } from "@/core/profile/builtInProfiles";
import { useAppStore } from "@/state/useAppStore";

/** Switch profile, create one, or manage which ones show up. */
export function ProfileMenu() {
  const [manageOpen, setManageOpen] = useState(false);
  const activeProfile = useAppStore((s) => s.activeProfile);
  const savedProfiles = useAppStore((s) => s.savedProfiles);
  const hiddenProfileIds = useAppStore((s) => s.hiddenProfileIds);
  const applyProfile = useAppStore((s) => s.applyProfile);
  const openWizard = useAppStore((s) => s.openWizard);

  const allProfiles = [...BUILT_IN_PROFILES, ...savedProfiles];
  const builtIns = BUILT_IN_PROFILES.filter((profile) => !hiddenProfileIds.has(profile.id));
  const yours = savedProfiles.filter((profile) => !hiddenProfileIds.has(profile.id));
  const hiddenCount = allProfiles.filter((profile) => hiddenProfileIds.has(profile.id)).length;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <span className="text-muted-foreground">Profile</span>
            <span className="max-w-48 truncate">{activeProfile ? activeProfile.name : "none selected"}</span>
            <CaretDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuRadioGroup
            value={activeProfile?.id ?? ""}
            onValueChange={(id) => {
              const profile = allProfiles.find((candidate) => candidate.id === id);
              if (profile) applyProfile(profile);
            }}
          >
            {yours.length > 0 && (
              <>
                <DropdownMenuLabel>Your profiles</DropdownMenuLabel>
                {yours.map((profile) => (
                  <DropdownMenuRadioItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </DropdownMenuRadioItem>
                ))}
              </>
            )}
            {builtIns.length > 0 && (
              <>
                <DropdownMenuLabel>Built-in</DropdownMenuLabel>
                {builtIns.map((profile) => (
                  <DropdownMenuRadioItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </DropdownMenuRadioItem>
                ))}
              </>
            )}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => openWizard("new")}>New profile…</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setManageOpen(true)}>
            Manage profiles…
            {hiddenCount > 0 && <span className="ml-auto text-xs text-muted-foreground">{hiddenCount} hidden</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ManageProfilesDialog open={manageOpen} onOpenChange={setManageOpen} />
    </>
  );
}

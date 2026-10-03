"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BUILT_IN_PROFILES, isBuiltInProfile } from "@/core/profile/builtInProfiles";
import { useAppStore } from "@/state/useAppStore";

interface ManageProfilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Every profile, built-in and your own, with a switch to hide the ones you don't want in the profile menu. */
export function ManageProfilesDialog({ open, onOpenChange }: ManageProfilesDialogProps) {
  const savedProfiles = useAppStore((s) => s.savedProfiles);
  const hiddenProfileIds = useAppStore((s) => s.hiddenProfileIds);
  const hideProfile = useAppStore((s) => s.hideProfile);
  const unhideProfile = useAppStore((s) => s.unhideProfile);

  const allProfiles = [...BUILT_IN_PROFILES, ...savedProfiles];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage profiles</DialogTitle>
          <DialogDescription>Hidden profiles stay saved; they just don&apos;t appear in the profile menu.</DialogDescription>
        </DialogHeader>
        <ul className="grid max-h-96 gap-1 overflow-y-auto">
          {allProfiles.map((profile) => {
            const hidden = hiddenProfileIds.has(profile.id);
            return (
              <li key={profile.id} className="flex items-center gap-3 border border-border px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className={hidden ? "truncate text-muted-foreground" : "truncate font-medium"}>{profile.name}</p>
                  <p className="text-xs text-muted-foreground">{isBuiltInProfile(profile) ? "Built-in" : "Yours"}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`${hidden ? "Unhide" : "Hide"} ${profile.name}`}
                  onClick={() => (hidden ? unhideProfile(profile.id) : hideProfile(profile.id))}
                >
                  {hidden ? "Unhide" : "Hide"}
                </Button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

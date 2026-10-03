import { currentFieldOrder } from "@/core/profile/fieldOrder";
import { reconcileDisplay } from "@/core/profile/reconcileDisplay";
import type { Profile, ProfileView, ViewColumns } from "@/core/profile/types";

export const DEFAULT_VIEW_ID = "default";
export const DEFAULT_VIEW_NAME = "Default";

/** The columns of a Profile's live display, as a view stores them. */
function liveColumns(profile: Profile): ViewColumns {
  const { visibleFieldKeys, fieldOrder, columnOptions } = profile.display;
  // columnOptions is always present (possibly undefined) so that spreading this over a view or a display clears an old value.
  return {
    visibleFieldKeys: [...visibleFieldKeys],
    ...(fieldOrder ? { fieldOrder: [...fieldOrder] } : {}),
    columnOptions: columnOptions ? structuredClone(columnOptions) : undefined,
  };
}

/** A Profile's views, with the active one picked. A Profile without views gets a "Default" one made from its display. */
export function ensureViews(profile: Profile): { views: ProfileView[]; activeViewId: string } {
  const views = profile.views?.length
    ? profile.views
    : [{ id: DEFAULT_VIEW_ID, name: DEFAULT_VIEW_NAME, ...liveColumns(profile) }];
  const activeViewId = views.some((view) => view.id === profile.activeViewId) ? profile.activeViewId! : views[0].id;
  return { views, activeViewId };
}

/** Copies the live display's columns into the active view, so the views list never lags behind edits. */
export function syncActiveView(profile: Profile): Profile {
  if (!profile.views || !profile.activeViewId) return profile;
  return {
    ...profile,
    views: profile.views.map((view) => (view.id === profile.activeViewId ? { ...view, ...liveColumns(profile) } : view)),
  };
}

/** `view`'s columns made consistent with the Fields the Profile's display actually has. */
function reconcileColumns(profile: Profile, view: ViewColumns, baseFieldNames: string[]): ViewColumns {
  const { visibleFieldKeys, fieldOrder, columnOptions } = reconcileDisplay(
    {
      ...profile.display,
      visibleFieldKeys: view.visibleFieldKeys,
      fieldOrder: view.fieldOrder,
      columnOptions: view.columnOptions,
    },
    baseFieldNames,
  );
  return { visibleFieldKeys, fieldOrder, columnOptions };
}

/**
 * Prepares a Profile (whose display is already reconciled) for use: it has views, every view fits the
 * Dataset's Fields, and the display shows the active view's columns.
 */
export function reconcileViews(profile: Profile, baseFieldNames: string[]): Profile {
  const { views, activeViewId } = ensureViews(profile);
  const reconciled = views.map((view) => ({ ...view, ...reconcileColumns(profile, view, baseFieldNames) }));
  const active = reconciled.find((view) => view.id === activeViewId)!;
  return {
    ...profile,
    views: reconciled,
    activeViewId,
    display: {
      ...profile.display,
      visibleFieldKeys: active.visibleFieldKeys,
      fieldOrder: active.fieldOrder,
      columnOptions: active.columnOptions,
    },
  };
}

/** Shows another view's columns. Unknown ids leave the Profile as it is. */
export function switchView(current: Profile, viewId: string, baseFieldNames: string[]): Profile {
  const profile = syncActiveView(current);
  const target = profile.views?.find((view) => view.id === viewId);
  if (!target || viewId === profile.activeViewId) return profile;
  const columns = reconcileColumns(profile, target, baseFieldNames);
  return {
    ...profile,
    activeViewId: viewId,
    views: profile.views!.map((view) => (view.id === viewId ? { ...view, ...columns } : view)),
    display: { ...profile.display, ...columns },
  };
}

/** Adds a view that starts as a copy of the columns on screen, and makes it the active one. */
export function addView(profile: Profile, id: string, name: string, baseFieldNames: string[]): Profile {
  const synced = syncActiveView(profile);
  const columns: ViewColumns = {
    ...liveColumns(profile),
    fieldOrder: currentFieldOrder(profile.display, baseFieldNames),
  };
  return {
    ...synced,
    activeViewId: id,
    views: [...(synced.views ?? []), { id, name, ...columns }],
  };
}

export function renameView(profile: Profile, viewId: string, name: string): Profile {
  return { ...profile, views: profile.views?.map((view) => (view.id === viewId ? { ...view, name } : view)) };
}

/** Removes a view (never the last one). Deleting the active view switches to the first remaining. */
export function deleteView(profile: Profile, viewId: string, baseFieldNames: string[]): Profile {
  if (!profile.views || profile.views.length <= 1 || !profile.views.some((view) => view.id === viewId)) return profile;
  const views = profile.views.filter((view) => view.id !== viewId);
  const remaining = { ...profile, views };
  return viewId === profile.activeViewId
    ? switchView({ ...remaining, activeViewId: undefined }, views[0].id, baseFieldNames)
    : remaining;
}

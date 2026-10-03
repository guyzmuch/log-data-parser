import type { DerivedFieldSpec } from "@/core/derived-fields/types";
import type { ParsingConfig } from "@/core/parsing/types";

export type SearchMode = "highlight" | "filter";

export interface SearchState {
  term: string;
  mode: SearchMode;
}

export interface DisplayConfig {
  /**
   * Ordered list of visible Field keys — order IS display order. Show/hide
   * and reorder are both just edits to this array; it never touches parsed
   * Fields (see Field vs. Visible Field in CONTEXT.md).
   */
  visibleFieldKeys: string[];
  /**
   * Every Field key in the user's chosen order, hidden ones included, so a hidden column keeps its
   * place and comes back where it was. `visibleFieldKeys` is the shown subset, in this same order.
   * Optional only for Profiles saved before this existed; reconcileDisplay fills it in on apply.
   */
  fieldOrder?: string[];
  /**
   * Shown Field keys displayed on their own line under the row (full width) instead of as a column,
   * in column order. Part of a view: the active view's list is mirrored here.
   */
  secondLineKeys?: string[];
  fieldLabels: Record<string, string>;
  /** Column widths in px the user dragged to, by Field key. A column without an entry gets an automatic width. Shared by all views. */
  columnWidths?: Record<string, number>;
  derivedFieldSelections: DerivedFieldSpec[];
  searchState?: SearchState;
}

/** The part of a display config a view owns: which columns are shown, and in what order (hidden ones included). */
export interface ViewColumns {
  visibleFieldKeys: string[];
  fieldOrder?: string[];
  secondLineKeys?: string[];
}

/**
 * A named column layout of a Profile. Labels, Derived Fields and search are shared by all of a
 * Profile's views; only the columns differ. The active view's columns are mirrored in `Profile.display`.
 */
export interface ProfileView extends ViewColumns {
  id: string;
  name: string;
}

/** The single saved, reusable unit combining parsing config + display config (see Profile in CONTEXT.md). */
export interface Profile {
  id: string;
  name: string;
  parsing: ParsingConfig;
  display: DisplayConfig;
  /** Saved column layouts. Absent on Profiles saved before views existed; applying one creates a "Default" view from `display`. */
  views?: ProfileView[];
  /** The view `display` currently mirrors; the one shown when the Profile is applied. */
  activeViewId?: string;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
}

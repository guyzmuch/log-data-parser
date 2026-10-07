import type { DerivedFieldSpec } from "@/core/derived-fields/types";
import type { ArrayMode } from "@/core/json/types";
import type { ParsingConfig } from "@/core/parsing/types";

export type SearchMode = "highlight" | "filter";

export interface SearchState {
  term: string;
  mode: SearchMode;
}

/** How one column is displayed beyond being shown or hidden. Every option is off when missing. */
export interface ColumnOptions {
  /** Shown on its own full-width line under the row instead of as a column. */
  secondLine?: boolean;
  /** Each distinct value gets its own (deterministic) color, as a badge. */
  colorCode?: boolean;
  /**
   * Only on the entry of a root-level JSON array's key (e.g. "info.trace[]"), not on a column: how the array's
   * items are shown. Missing means "table", the default.
   */
  arrayMode?: Exclude<ArrayMode, "table">;
}

/** The on/off options of a column. */
export type ColumnOption = "secondLine" | "colorCode";

/** Options by Field key (and by array key for `arrayMode`). A column with no option on has no entry. */
export type ColumnOptionsMap = Record<string, ColumnOptions>;

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
   * Per-column display options, by Field key (see ColumnOptions). Part of a view: the active view's
   * options are mirrored here. Absent when no column has any option on.
   */
  columnOptions?: ColumnOptionsMap;
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
  columnOptions?: ColumnOptionsMap;
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

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
  fieldLabels: Record<string, string>;
  derivedFieldSelections: DerivedFieldSpec[];
  searchState?: SearchState;
}

/** The single saved, reusable unit combining parsing config + display config (see Profile in CONTEXT.md). */
export interface Profile {
  id: string;
  name: string;
  parsing: ParsingConfig;
  display: DisplayConfig;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
}

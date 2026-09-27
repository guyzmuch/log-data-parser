export interface SelectionModifiers {
  ctrlOrMeta: boolean;
  shift: boolean;
}

export interface SelectionResult {
  selection: Set<number>;
  anchorIndex: number;
}

/**
 * Computes the next row-selection state for a click, given modifier keys and
 * the ordered list of Record indexes currently visible (i.e. after hidden
 * Records and any active search filter are applied):
 * - plain click: selects only the clicked row; anchor moves to it.
 * - ctrl/cmd-click: toggles the clicked row in/out of the existing selection; anchor moves to it.
 * - shift-click: selects the contiguous range from the anchor to the clicked row, counted by
 *   POSITION in visibleIndexesInOrder rather than by raw index — so a row hidden or filtered out
 *   of view never gets silently swept into the range just because its index falls between the two.
 *
 * Shift-click falls back to a plain click when there's no prior anchor, or when the anchor/clicked
 * row isn't currently in visibleIndexesInOrder (e.g. the anchor row got filtered out since).
 */
export function computeRangeSelection(
  previousSelection: ReadonlySet<number>,
  anchorIndex: number | null,
  clickedIndex: number,
  modifiers: SelectionModifiers,
  visibleIndexesInOrder: readonly number[],
): SelectionResult {
  if (modifiers.shift && anchorIndex !== null) {
    const anchorPos = visibleIndexesInOrder.indexOf(anchorIndex);
    const clickedPos = visibleIndexesInOrder.indexOf(clickedIndex);

    if (anchorPos !== -1 && clickedPos !== -1) {
      const start = Math.min(anchorPos, clickedPos);
      const end = Math.max(anchorPos, clickedPos);
      const selection = new Set(visibleIndexesInOrder.slice(start, end + 1));
      return { selection, anchorIndex };
    }
    // Fall through to a plain click below.
  }

  if (modifiers.ctrlOrMeta) {
    const selection = new Set(previousSelection);
    if (selection.has(clickedIndex)) {
      selection.delete(clickedIndex);
    } else {
      selection.add(clickedIndex);
    }
    return { selection, anchorIndex: clickedIndex };
  }

  return { selection: new Set([clickedIndex]), anchorIndex: clickedIndex };
}

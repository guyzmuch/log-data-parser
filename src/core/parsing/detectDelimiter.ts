import { DELIMITER_CANDIDATES } from "@/core/parsing/delimiter";
import type { Delimiter } from "@/core/parsing/types";

/**
 * Picks the delimiter that splits every sample line into the same
 * (non-trivial) number of fields. Falls back to comma if nothing matches
 * consistently.
 */
export function detectDelimiter(sampleLines: string[]): Delimiter {
  const nonEmpty = sampleLines.filter((line) => line.length > 0);
  if (nonEmpty.length === 0) return ",";

  let best: Delimiter = ",";
  let bestScore = -1;

  for (const delimiter of DELIMITER_CANDIDATES) {
    const counts = nonEmpty.map((line) => line.split(delimiter).length - 1);
    if (!counts.every((count) => count > 0)) continue;

    const consistent = counts.every((count) => count === counts[0]);
    const score = (consistent ? 1000 : 0) + counts[0];

    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }

  return best;
}

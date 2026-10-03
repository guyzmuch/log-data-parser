/**
 * Samples items (lines, rows) from the middle, not the head or tail — a copy-paste often
 * clips the very first/last line, and building a Profile's parsing config off
 * a clipped boundary line would poison the config.
 */
export function sampleMiddleLines<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;

  const start = Math.floor((items.length - count) / 2);
  return items.slice(start, start + count);
}

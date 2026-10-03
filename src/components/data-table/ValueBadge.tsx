import type { CSSProperties, ReactNode } from "react";
import { valueColor } from "@/core/display/valueColor";

/** A value shown as a pill whose color comes from its text: the same text always gets the same color. */
export function ValueBadge({ value, children }: { value: string; children: ReactNode }) {
  if (value.trim() === "") return <>{children}</>;
  const { id, hue, neutral, strong } = valueColor(value);
  const chroma = neutral ? 0 : 1; // grey: same lightness, no color
  // Normal: a pale tint with dark text (in the dark theme: a deep tint with light text). Strong: a solid badge with white text.
  const style: CSSProperties = strong
    ? { backgroundColor: `oklch(0.52 0.19 ${hue})`, color: "white", fontWeight: 600 }
    : {
        backgroundColor: `oklch(var(--tag-bg-l) calc(var(--tag-bg-c) * ${chroma}) ${hue})`,
        color: `oklch(var(--tag-fg-l) calc(var(--tag-fg-c) * ${chroma}) ${hue})`,
      };
  return (
    <span data-color-badge={id} className="inline-block max-w-full truncate rounded-sm px-1.5 align-middle leading-5" style={style}>
      {children}
    </span>
  );
}

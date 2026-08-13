import React from "react";
import { cn } from "../../lib/cn";

interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  active?: boolean;
  tone?: "amber" | "neutral";
}

/** Compact pill for sources / topics / filters. Sharp, brand-consistent. */
export function Chip({ active, tone = "neutral", className, children, ...rest }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-black uppercase tracking-widest rounded-none border-2",
        tone === "amber" || active
          ? "bg-amber text-ink border-ink"
          : "bg-paper/70 dark:bg-white/5 text-ink-soft dark:text-neutral-300 border-ink/15 dark:border-white/20",
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

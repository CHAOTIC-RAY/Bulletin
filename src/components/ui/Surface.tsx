import React from "react";
import { cn } from "../../lib/cn";

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: "paper" | "card" | "ink";
  interactive?: boolean;
}

/**
 * The standard card/surface. tone picks the palette; in dark mode paper→card.
 * Sharp corners + hard offset shadow (brand). Interactive adds hover lift.
 */
export function Surface({ tone = "paper", interactive, className, children, ...rest }: SurfaceProps) {
  return (
    <div
      className={cn(
        "border-2 rounded-none",
        tone === "paper" &&
          "bg-paper dark:bg-surface-card border-ink/15 dark:border-white/15 shadow-[var(--shadow-hard-light)] dark:shadow-[var(--shadow-hard-dark)]",
        tone === "card" &&
          "bg-surface-card border-white/15 shadow-[var(--shadow-hard-dark)]",
        tone === "ink" &&
          "bg-ink text-paper border-ink shadow-[var(--shadow-hard)]",
        interactive && "transition-transform duration-[var(--dur-fast)] hover:-translate-y-0.5",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

import React from "react";
import { cn } from "../../lib/cn";

type Variant = "ghost" | "solid" | "outline";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  label?: string; // accessible name (aria-label)
}

/**
 * Square icon button — the atomic action control across the app.
 * Sharp corners (brand), hard offset shadow on solid, focus-visible ring,
 * disabled dimming. Spinner support via `data-loading`.
 */
export function IconButton({
  variant = "ghost",
  size = "md",
  label,
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center border-2 rounded-none select-none",
        "transition-all duration-[var(--dur-fast)] ease-[var(--ease-snap)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-1",
        "disabled:opacity-40 disabled:pointer-events-none active:translate-x-[1px] active:translate-y-[1px]",
        size === "md" ? "w-10 h-10" : "w-9 h-9",
        variant === "solid" &&
          "bg-amber text-ink border-ink shadow-[var(--shadow-hard)] hover:bg-amber-deep",
        variant === "outline" &&
          "bg-transparent text-ink dark:text-white border-ink/30 dark:border-white/30 hover:bg-amber/15",
        variant === "ghost" &&
          "bg-paper/80 dark:bg-black/40 border-ink/15 dark:border-white/20 text-ink dark:text-white hover:bg-amber/20 dark:hover:bg-white/10",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

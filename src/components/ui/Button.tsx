import React from "react";
import { cn } from "../../lib/cn";

type Variant = "solid" | "ghost" | "outline";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
}

/** Primary/secondary text button — sharp, hard-shadowed, consistent focus ring. */
export function Button({
  variant = "solid",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 border-2 rounded-none font-extrabold uppercase tracking-wide",
        "transition-all duration-[var(--dur-fast)] ease-[var(--ease-snap)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-1",
        "disabled:opacity-40 disabled:pointer-events-none active:translate-x-[1px] active:translate-y-[1px]",
        size === "sm" ? "px-3 py-1.5 text-xs" : size === "lg" ? "px-6 py-3 text-base" : "px-4 py-2 text-sm",
        variant === "solid" &&
          "bg-amber text-ink border-ink shadow-[var(--shadow-hard)] hover:bg-amber-deep",
        variant === "outline" &&
          "bg-transparent text-ink dark:text-white border-ink/40 dark:border-white/40 hover:bg-amber/15",
        variant === "ghost" &&
          "bg-paper/70 dark:bg-white/5 text-ink dark:text-white border-transparent hover:bg-amber/15",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

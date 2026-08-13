import React from "react";
import { cn } from "../../lib/cn";

export interface SegOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
  className?: string;
  "aria-label"?: string;
}

/**
 * Two-or-more option toggle with a hard-shadowed active pill.
 * Used for Immersive/Magazine switch and other binary choices.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  ...rest
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={rest["aria-label"]}
      className={cn(
        "inline-flex items-center p-1 gap-1 border-2 rounded-none bg-paper/80 dark:bg-black/40 border-ink/15 dark:border-white/20 backdrop-blur-md",
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-none border-2 transition-all duration-[var(--dur-fast)]",
              active
                ? "bg-amber text-ink border-ink shadow-[var(--shadow-hard)]"
                : "text-ink-soft dark:text-neutral-400 border-transparent hover:text-ink dark:hover:text-white"
            )}
          >
            {o.icon}
            <span className="hidden sm:inline">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

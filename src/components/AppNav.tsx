import React from "react";
import { Newspaper, BookOpen, Bookmark, Settings } from "lucide-react";
import { cn } from "../lib/cn";

export type NavTab = "feed" | "brief" | "saved" | "settings";

interface TabDef {
  id: NavTab;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  { id: "feed", label: "Feed", icon: <Newspaper className="w-[22px] h-[22px]" /> },
  { id: "brief", label: "Daily Paper", icon: <BookOpen className="w-[22px] h-[22px]" /> },
  { id: "saved", label: "Saved", icon: <Bookmark className="w-[22px] h-[22px]" /> },
  { id: "settings", label: "Settings", icon: <Settings className="w-[22px] h-[22px]" /> },
];

/** Mobile bottom tab bar + desktop left sidebar. Sharp, token-styled, active=amber. */
export function AppNav({
  active,
  onChange,
  savedCount = 0,
}: {
  active: NavTab;
  onChange: (t: NavTab) => void;
  savedCount?: number;
}) {
  return (
    <>
      {/* Mobile: bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed bottom-0 inset-x-0 z-[60] md:hidden flex border-t-2 border-ink/15 dark:border-white/20 bg-paper/95 dark:bg-surface-dark/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        {TABS.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-bold uppercase tracking-wide transition-colors duration-150",
                on ? "text-amber" : "text-ink-soft dark:text-neutral-400"
              )}
            >
              <span className={cn("relative", on && "drop-shadow-[2px_2px_0_rgba(0,0,0,0.85)]")}>{t.icon}</span>
              {t.label}
              {t.id === "saved" && savedCount > 0 && (
                <span className="absolute top-1 right-1/2 translate-x-3 min-w-[16px] h-4 px-1 rounded-none bg-amber text-ink text-[9px] font-black flex items-center justify-center border border-ink">
                  {savedCount > 99 ? "99+" : savedCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Desktop: left sidebar */}
      <nav
        aria-label="Primary"
        className="hidden md:flex fixed left-0 top-0 bottom-0 z-[60] w-24 flex-col items-center gap-2 border-r-2 border-ink/15 dark:border-white/20 bg-paper/95 dark:bg-surface-dark/95 backdrop-blur-md py-6"
      >
        <div className="mb-4 text-amber font-extrabold text-2xl tracking-tighter" aria-hidden>
          B
        </div>
        {TABS.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              aria-current={on ? "page" : undefined}
              title={t.label}
              className={cn(
                "relative w-16 h-16 flex flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide border-2 rounded-none transition-all duration-150",
                on
                  ? "bg-amber text-ink border-ink shadow-[var(--shadow-hard)]"
                  : "text-ink-soft dark:text-neutral-400 border-transparent hover:bg-amber/15"
              )}
            >
              {t.icon}
              {t.label}
              {t.id === "saved" && savedCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-ink text-paper dark:bg-white dark:text-ink text-[9px] font-black flex items-center justify-center border border-amber">
                  {savedCount > 99 ? "99+" : savedCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}

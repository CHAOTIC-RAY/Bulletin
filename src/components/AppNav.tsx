import React from "react";
import { cn } from "../lib/cn";

export type NavTab = "feed" | "brief" | "saved" | "settings";

interface TabDef {
  id: NavTab;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  { id: "feed", label: "Feed", icon: <NewspaperIcon /> },
  { id: "brief", label: "Brief", icon: <BriefIcon /> },
  { id: "saved", label: "Saved", icon: <BookmarkIcon /> },
  { id: "settings", label: "Settings", icon: <GearIcon /> },
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

/* --- inline icons (no extra dep; lucide already a dep but keep local for control) --- */
function NewspaperIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
      <path d="M4 5h13a2 2 0 0 1 2 2v11a2 2 0 0 0 2-2V7" />
      <path d="M4 5v12a2 2 0 0 0 2 2h13" />
      <path d="M7 9h7M7 13h7" />
    </svg>
  );
}
function BriefIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
      <path d="M5 4h14v16H5z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}
function BookmarkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
      <path d="M7 4h10v16l-5-4-5 4z" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </svg>
  );
}

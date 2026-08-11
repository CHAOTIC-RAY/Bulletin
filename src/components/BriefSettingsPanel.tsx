import React, { useMemo, useState } from "react";
import {
  BRIEF_TOPICS,
  DEFAULT_BRIEF_SETTINGS,
  getBriefSettings,
  getAvailableSourceTitles,
  saveBriefSettings,
  type BriefSettings,
} from "../lib/feedStorage";
import type { FeedItem } from "../lib/feedStorage";
import { Sparkles, Newspaper, Check, CornerDownLeft, Filter } from "lucide-react";

interface Props {
  items: FeedItem[];
  onChanged?: () => void;
}

export default function BriefSettingsPanel({ items, onChanged }: Props) {
  const [settings, setSettings] = useState<BriefSettings>(() => getBriefSettings());
  const [showSources, setShowSources] = useState(false);

  const sourceTitles = useMemo(() => getAvailableSourceTitles(items), [items]);

  const persist = (next: BriefSettings) => {
    setSettings(next);
    saveBriefSettings(next);
    onChanged?.();
  };

  const toggleTopic = (id: string) => {
    const has = settings.topics.includes(id);
    persist({ ...settings, topics: has ? settings.topics.filter((t) => t !== id) : [...settings.topics, id] });
  };

  const toggleSource = (title: string) => {
    const has = settings.sources.includes(title);
    persist({ ...settings, sources: has ? settings.sources.filter((s) => s !== title) : [...settings.sources, title] });
  };

  const reset = () => persist({ ...DEFAULT_BRIEF_SETTINGS });

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
          <Newspaper className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-white">Daily Brief</h3>
          <p className="text-xs text-neutral-400">Scope the AI summary to the topics &amp; sources you care about</p>
        </div>
      </div>

      {/* AI toggle */}
      <div className="p-4 rounded-none bg-neutral-900/80 border-2 border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-white">AI-polished brief</span>
          </div>
          <button
            onClick={() => persist({ ...settings, useAi: !settings.useAi })}
            className={`relative w-12 h-7 rounded-full border-2 transition-colors ${
              settings.useAi ? "bg-amber-500 border-amber-600" : "bg-neutral-800 border-white/15"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-black transition-all ${
                settings.useAi ? "left-6" : "left-0.5"
              }`}
            />
          </button>
        </div>
        <p className="text-[11px] text-neutral-500 leading-relaxed">
          When a Groq API key is set in Cloudflare, the brief is rewritten by AI. If the key is missing or fails, it automatically falls back to the on-device generator.
        </p>
      </div>

      {/* Topics */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Topics
          </h4>
          {settings.topics.length > 0 && (
            <button onClick={() => persist({ ...settings, topics: [] })} className="text-[10px] font-mono text-amber-400 hover:underline">
              Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {BRIEF_TOPICS.map((t) => {
            const on = settings.topics.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggleTopic(t.id)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-none border-2 text-xs font-bold transition-all ${
                  on ? "bg-amber-500/10 border-amber-500/40 text-white" : "bg-black/30 border-white/5 text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <span className="truncate">{t.label}</span>
                {on && <Check className="w-4 h-4 text-amber-400 shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-neutral-500 px-1">
          {settings.topics.length === 0 ? "All topics included." : `${settings.topics.length} topic${settings.topics.length > 1 ? "s" : ""} selected.`}
        </p>
      </div>

      {/* Sources */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <CornerDownLeft className="w-3.5 h-3.5" /> Sources
          </h4>
          <button
            onClick={() => setShowSources((v) => !v)}
            className="text-[10px] font-mono text-amber-400 hover:underline"
          >
            {showSources ? "Hide" : `Choose (${settings.sources.length})`}
          </button>
        </div>
        <p className="text-[10px] text-neutral-500 px-1">
          {settings.sources.length === 0 ? "All enabled sources feed the brief." : `${settings.sources.length} source(s) selected.`}
        </p>

        {showSources && (
          <div className="rounded-none bg-neutral-900/80 border-2 border-white/10 p-3 space-y-1.5 max-h-56 overflow-y-auto scrollbar-none">
            <button
              onClick={() => persist({ ...settings, sources: [] })}
              className="w-full text-left px-3 py-2 rounded-none border-2 text-xs font-bold transition-all bg-black/30 border-white/5 text-neutral-300 hover:text-white"
            >
              All sources
            </button>
            {sourceTitles.map((title) => {
              const on = settings.sources.includes(title);
              return (
                <button
                  key={title}
                  onClick={() => toggleSource(title)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-none border-2 text-xs font-bold transition-all ${
                    on ? "bg-amber-500/10 border-amber-500/40 text-white" : "bg-black/30 border-white/5 text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <span className="truncate">{title}</span>
                  {on && <Check className="w-4 h-4 text-amber-400 shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Size */}
      <div className="space-y-3 p-4 rounded-none bg-neutral-900/80 border-2 border-white/10">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Stories per source</h4>
            <span className="text-xs font-mono text-amber-400">{settings.maxPerSource}</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={settings.maxPerSource}
            onChange={(e) => persist({ ...settings, maxPerSource: Number(e.target.value) })}
            className="w-full accent-amber-500"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Max sources</h4>
            <span className="text-xs font-mono text-amber-400">{settings.maxSources}</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            value={settings.maxSources}
            onChange={(e) => persist({ ...settings, maxSources: Number(e.target.value) })}
            className="w-full accent-amber-500"
          />
        </div>
      </div>

      <button
        onClick={reset}
        className="w-full py-2.5 rounded-none border-2 border-white/10 text-xs font-bold text-neutral-400 hover:text-white hover:border-white/20 transition-colors"
      >
        Reset to defaults
      </button>
    </div>
  );
}

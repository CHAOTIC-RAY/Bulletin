import React, { useMemo, useState } from "react";
import {
  FeedSubscription,
  getAllCuratedSources,
  getFeedSubscriptions,
  isFeedSubscriptionEnabled,
  setFeedSubscriptionEnabled,
  addFeedSubscription,
  removeFeedSubscription,
  makeFeedSubscriptionId,
} from "../lib/feedStorage";
import { Newspaper, Plus, Trash2 } from "lucide-react";

interface Props {
  onChanged: () => void;
}

/**
 * Manage news sources: enable/disable curated sources, add custom RSS / site URLs,
 * and remove custom sources. Changes persist to localStorage immediately.
 */
export default function SourcesPanel({ onChanged }: Props) {
  const [subs, setSubs] = useState<FeedSubscription[]>(() => getFeedSubscriptions());
  const [addUrl, setAddUrl] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const curated = useMemo(() => getAllCuratedSources(), []);
  // Map of feedUrl -> enabled for quick lookup of curated sources.
  const subState = useMemo(() => {
    const m = new Map<string, { id: string; enabled: boolean }>();
    for (const s of subs) m.set(s.feedUrl, { id: s.id, enabled: isFeedSubscriptionEnabled(s) });
    return m;
  }, [subs]);

  const toggle = (feedUrl: string) => {
    const cur = subState.get(feedUrl);
    if (!cur) {
      // Not yet subscribed → add it enabled.
      const found = curated.flatMap((g) => g.sources).find((s) => s.feedUrl === feedUrl);
      if (found) {
        const next = addFeedSubscription(found);
        setSubs(next);
        onChanged();
      }
      return;
    }
    const next = setFeedSubscriptionEnabled(cur.id, !cur.enabled);
    setSubs(next);
    onChanged();
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = addUrl.trim();
    if (!raw) return;
    const url = raw.startsWith("http") ? raw : `https://${raw}`;
    try {
      new URL(url);
    } catch {
      setAddError("Enter a valid URL or RSS link.");
      return;
    }
    const title = url
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .replace(/^www\./, "");
    const next = addFeedSubscription({
      title,
      siteUrl: url,
      feedUrl: url,
    });
    setSubs(next);
    setAddUrl("");
    setAddError(null);
    onChanged();
  };

  const handleRemove = (id: string) => {
    const next = removeFeedSubscription(id);
    setSubs(next);
    onChanged();
  };

  // Custom (non-curated) subscriptions.
  const curatedUrls = new Set(curated.flatMap((g) => g.sources.map((s) => s.feedUrl)));
  const customSubs = subs.filter((s) => !curatedUrls.has(s.feedUrl));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Newspaper className="w-6 h-6 text-amber-400" />
        <div>
          <div className="text-base font-bold text-white">News Sources</div>
          <div className="text-xs text-neutral-400">Enable or disable feeds. Your picks are saved automatically.</div>
        </div>
      </div>

      {curated.map((group) => (
        <div key={group.group} className="space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">{group.group}</h4>
          {group.sources.map((s) => {
            const st = subState.get(s.feedUrl);
            const on = st ? st.enabled : false;
            return (
              <button
                key={s.feedUrl}
                onClick={() => toggle(s.feedUrl)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                  on ? "bg-white/10 border-white/20" : "bg-white/5 border-white/10 opacity-70"
                }`}
              >
                <div className="min-w-0 text-left">
                  <p className="text-xs font-bold text-white truncate">{s.title}</p>
                  <p className="text-[10px] text-neutral-400 truncate">{s.siteUrl}</p>
                </div>
                <span
                  className={`w-10 h-6 rounded-full flex items-center px-0.5 shrink-0 transition-colors ${
                    on ? "bg-amber-500 justify-end" : "bg-neutral-600 justify-start"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white" />
                </span>
              </button>
            );
          })}
        </div>
      ))}

      {customSubs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Custom</h4>
          {customSubs.map((s) => {
            const on = isFeedSubscriptionEnabled(s);
            return (
              <div
                key={s.id}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border ${
                  on ? "bg-white/10 border-white/20" : "bg-white/5 border-white/10 opacity-70"
                }`}
              >
                <button onClick={() => toggle(s.feedUrl)} className="min-w-0 text-left flex-1">
                  <p className="text-xs font-bold text-white truncate">{s.title}</p>
                  <p className="text-[10px] text-neutral-400 truncate">{s.feedUrl}</p>
                </button>
                <button
                  onClick={() => handleRemove(s.id)}
                  className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handleAdd} className="space-y-2 pt-2 border-t border-white/10">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Add Custom Source</h4>
        <input
          type="text"
          value={addUrl}
          onChange={(e) => setAddUrl(e.target.value)}
          placeholder="https://example.com/feed.xml or example.com"
          className="w-full bg-neutral-900 border border-white/20 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-400"
        />
        {addError && <p className="text-[10px] text-red-500">{addError}</p>}
        <button
          type="submit"
          className="w-full py-2.5 rounded-xl bg-white text-neutral-950 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-neutral-200"
        >
          <Plus className="w-4 h-4" /> Add Source
        </button>
      </form>
    </div>
  );
}

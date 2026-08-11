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
import { Newspaper, Plus, Trash2, Search, CheckCircle2, Circle, Globe2, ChevronDown, ChevronRight, ChevronsUpDown } from "lucide-react";

interface Props {
  onChanged: () => void;
}

/**
  Manage news sources packed under country/regional groups with quick toggles,
  collapsible accordion collections (collapsed by default), search filtering,
  and custom RSS / Telegram URL adding.
 */
export default function SourcesPanel({ onChanged }: Props) {
  const [subs, setSubs] = useState<FeedSubscription[]>(() => getFeedSubscriptions());
  const [search, setSearch] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  // Expanded group IDs (default empty = ALL COLLAPSED)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const curated = useMemo(() => getAllCuratedSources(), []);

  const toggleExpand = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedGroups(new Set(curated.map((g) => g.group)));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

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

  const toggleGroup = (groupSources: Omit<FeedSubscription, "id" | "addedAt">[], enable: boolean) => {
    let currentSubs = [...getFeedSubscriptions()];
    for (const src of groupSources) {
      const existing = currentSubs.find((s) => s.feedUrl === src.feedUrl);
      if (existing) {
        currentSubs = currentSubs.map((s) => (s.id === existing.id ? { ...s, enabled: enable } : s));
      } else if (enable) {
        const id = makeFeedSubscriptionId(src.feedUrl);
        currentSubs.push({ ...src, id, addedAt: Date.now(), enabled: true });
      }
    }
    setSubs(currentSubs);
    // Save updated subs
    localStorage.setItem("raadhavalhi_feed_subscriptions", JSON.stringify(currentSubs));
    onChanged();
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    let raw = addUrl.trim();
    if (!raw) return;

    if (raw.startsWith("@")) {
      raw = `https://t.me/${raw.slice(1)}`;
    } else if (/^[a-zA-Z0-9_]{4,32}$/.test(raw) && !raw.includes(".")) {
      raw = `https://t.me/${raw}`;
    }

    const url = raw.startsWith("http") ? raw : `https://${raw}`;
    try {
      new URL(url);
    } catch {
      setAddError("Enter a valid URL, Telegram link (@channel), or RSS feed.");
      return;
    }

    let title = url
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .replace(/^www\./, "");

    if (url.includes("t.me/")) {
      const channel = url.split("t.me/")[1].replace(/^s\//, "").split("/")[0];
      title = `${channel} (Telegram)`;
    }

    const siteUrl = url.includes("t.me/")
      ? `https://t.me/s/${url.split("t.me/")[1].replace(/^s\//, "").split("/")[0]}`
      : url;

    const next = addFeedSubscription({
      title,
      siteUrl,
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

  // Filter curated groups based on search query
  const filteredCurated = useMemo(() => {
    if (!search.trim()) return curated;
    const q = search.toLowerCase();
    return curated
      .map((g) => {
        const matchesGroup = g.group.toLowerCase().includes(q);
        const matchingSources = g.sources.filter(
          (s) => s.title.toLowerCase().includes(q) || s.siteUrl.toLowerCase().includes(q)
        );
        if (matchesGroup) return g;
        return { ...g, sources: matchingSources };
      })
      .filter((g) => g.sources.length > 0);
  }, [curated, search]);

  return (
    <div className="space-y-6">
      {/* Title & Description */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Globe2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">Country & Regional Sources</h3>
            <p className="text-xs text-neutral-400">News feeds packed under their respective countries</p>
          </div>
        </div>
      </div>

      {/* Search Input & Expand/Collapse Controls */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search country or publication..."
            className="w-full bg-neutral-900 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 outline-none focus:border-amber-400"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs font-bold"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto text-xs font-mono">
          <button
            onClick={expandAll}
            className="px-2.5 py-2 rounded-lg bg-neutral-900 border border-white/10 text-neutral-300 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-2.5 py-2 rounded-lg bg-neutral-900 border border-white/10 text-neutral-300 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Country & Regional Groups (Collapsed by default) */}
      <div className="space-y-3">
        {filteredCurated.map((group) => {
          const enabledCount = group.sources.filter((s) => subState.get(s.feedUrl)?.enabled).length;
          const allEnabled = enabledCount === group.sources.length;

          // Auto-expand if searching, otherwise check expandedGroups state
          const isExpanded = Boolean(search.trim()) || expandedGroups.has(group.group);

          return (
            <div
              key={group.group}
              className="rounded-2xl bg-neutral-900/80 border border-white/10 overflow-hidden transition-all"
            >
              {/* Group Header (Clickable Accordion) */}
              <div className="flex items-center justify-between p-3.5 bg-neutral-900/90 hover:bg-neutral-800/80 transition-colors">
                <button
                  onClick={() => toggleExpand(group.group)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                >
                  <span className="text-neutral-400">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-amber-400" /> : <ChevronRight className="w-4 h-4 text-neutral-500" />}
                  </span>
                  <h4 className="text-sm font-extrabold text-white truncate">{group.group}</h4>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                    {enabledCount}/{group.sources.length} Active
                  </span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroup(group.sources, !allEnabled);
                  }}
                  className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 hover:underline shrink-0 ml-3"
                >
                  {allEnabled ? "Deselect All" : "Select All"}
                </button>
              </div>

              {/* Group Sources Grid (Visible only if expanded or searching) */}
              {isExpanded && (
                <div className="p-3.5 pt-1 border-t border-white/5 bg-black/20 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.sources.map((s) => {
                    const st = subState.get(s.feedUrl);
                    const on = st ? st.enabled : false;

                    return (
                      <button
                        key={s.feedUrl}
                        onClick={() => toggle(s.feedUrl)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs text-left transition-all ${
                          on
                            ? "bg-amber-500/10 border-amber-500/30 text-white"
                            : "bg-black/30 border-white/5 text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold truncate text-xs">{s.title}</p>
                          <p className="text-[10px] font-mono text-neutral-500 truncate">{s.siteUrl}</p>
                        </div>

                        <div className="shrink-0">
                          {on ? (
                            <CheckCircle2 className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                          ) : (
                            <Circle className="w-4 h-4 text-neutral-600" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom Subscriptions Section */}
      {customSubs.length > 0 && (
        <div className="p-4 rounded-2xl bg-neutral-900/80 border border-white/10 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <h4 className="text-sm font-extrabold text-white">Custom Subscriptions</h4>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">
              {customSubs.length} Added
            </span>
          </div>

          <div className="space-y-2">
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
                    <p className="text-[10px] font-mono text-neutral-400 truncate">{s.feedUrl}</p>
                  </button>
                  <button
                    onClick={() => handleRemove(s.id)}
                    className="p-1.5 text-neutral-400 hover:text-red-400 transition-colors"
                    title="Remove custom source"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Custom Source Form */}
      <form onSubmit={handleAdd} className="space-y-3 pt-3 border-t border-white/10">
        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Add Custom RSS or Telegram Source</h4>
        <div className="flex gap-2">
          <input
            type="text"
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            placeholder="e.g. https://example.com/feed.xml or @MvCrisis"
            className="flex-1 bg-neutral-900 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        {addError && <p className="text-[10px] text-red-400 font-semibold">{addError}</p>}
      </form>
    </div>
  );
}


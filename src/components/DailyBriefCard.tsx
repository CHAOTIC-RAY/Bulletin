import React, { useMemo, useRef, useState } from "react";
import type { FeedItem } from "../lib/feedStorage";
import { buildDailyBrief, BriefArticleInput } from "../lib/generateNewsBrief";
import { HavaaTts } from "../lib/ttsPlayer";
import { t, getLocale } from "../lib/i18n";
import { createPortal } from "react-dom";

interface Props {
  items: FeedItem[];
  narrateLang: string; // e.g. "en-US" or "dv-MV"
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DailyBriefCard({ items, narrateLang }: Props) {
  const locale = getLocale();
  const brief = useMemo(() => {
    const today = Date.now();
    const articles: BriefArticleInput[] = items
      .filter((i) => dayKey(i.publishedAt) === dayKey(today))
      .slice(0, 24)
      .map((i) => ({ id: i.id, source: i.subscriptionTitle, title: i.title, summary: i.summary, link: i.link }));
    if (articles.length < 2) return null;
    return buildDailyBrief(articles, dayKey(today));
  }, [items]);

  const ttsRef = useRef<HavaaTts | null>(null);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);
  const [subtitle, setSubtitle] = useState("");

  if (!brief) return null;
  const storyCount = brief.sections.reduce((a, s) => a + s.items.length, 0);

  const ensureTts = () => {
    if (!ttsRef.current) {
      ttsRef.current = new HavaaTts({
        onSubtitle: setSubtitle,
        onEnded: () => setPlaying(false),
        onError: () => setPlaying(false),
      });
    }
    return ttsRef.current;
  };

  const buildSpokenText = () => {
    const parts = [brief!.lead];
    for (const s of brief!.sections) {
      parts.push(`${s.source}. ${s.intro}`);
      for (const it of s.items) parts.push(`${it.headline}. ${it.detail}`);
    }
    return parts.join(". ");
  };

  const toggleListen = () => {
    const tts = ensureTts();
    if (playing) {
      tts.stop();
      setPlaying(false);
      return;
    }
    tts.setVoice(narrateLang, "", 1, 1);
    tts.play(buildSpokenText());
    setPlaying(true);
  };

  const overlay = open
    ? createPortal(
        <div className="fixed inset-0 z-[9999] bg-neutral-950 text-white flex flex-col" style={{ height: "100dvh" }}>
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <button onClick={() => setOpen(false)} className="p-2 rounded-full bg-white/10">←</button>
            <span className="text-[10px] font-bold uppercase tracking-widest">{t("brief.title")}</span>
            <button onClick={toggleListen} className="px-3 py-1.5 rounded-full bg-amber-500 text-black text-xs font-bold">
              {playing ? t("brief.stop") : t("brief.listen")}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <p className="text-lg font-bold leading-relaxed">{brief.lead}</p>
            {brief.sections.map((s) => (
              <section key={s.source} className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-400">{s.source}</h3>
                <p className="text-xs text-neutral-400">{s.intro}</p>
                <ul className="space-y-2">
                  {s.items.map((it) => (
                    <li key={it.id} className="border border-white/10 rounded-xl p-3">
                      <p className="font-bold leading-snug">{it.headline}</p>
                      <p className="text-sm text-neutral-300 mt-1 leading-relaxed">{it.detail}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {playing && (
            <div className="p-4 border-t border-white/10 text-center text-sm text-amber-300 italic">{subtitle}</div>
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left bg-neutral-900 border border-white/10 rounded-2xl p-4 hover:border-amber-400/40 transition"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">⚡ {t("brief.title")}</span>
          </div>
          <span className="text-[10px] font-mono text-neutral-500">
            {storyCount} stories · {brief.sections.length} sources
          </span>
        </div>
        <h3 className="text-base font-bold text-white mb-1">{brief.lead.slice(0, 90)}…</h3>
        <p className="text-[11px] text-neutral-500">Tap for full brief · {t("brief.listen")} available</p>
      </button>
      {overlay}
    </>
  );
}

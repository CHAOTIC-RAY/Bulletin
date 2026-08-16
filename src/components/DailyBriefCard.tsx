import React, { useEffect, useMemo, useRef, useState } from "react";
import type { FeedItem } from "../lib/feedStorage";
import { getBriefSettings, filterItemsForBrief, getAvailableSourceTitles } from "../lib/feedStorage";
import { buildDailyBrief, type BriefArticleInput, type GeneratedDailyBrief } from "../lib/generateNewsBrief";
import { BulletinTts } from "../lib/ttsPlayer";
import { t, getLocale, getContentLocale } from "../lib/i18n";
import { getDisplayHeadline, getDisplayDetail } from "../lib/feedSanitize";
import { createPortal } from "react-dom";
import { ArrowLeft, Volume2, VolumeX, Sparkles, ArrowUpRight } from "lucide-react";
import { textDirection } from "../lib/textDirection";

interface Props {
  items: FeedItem[];
  narrateLang: string; // e.g. "en-US" or "dv-MV"
  isOpen?: boolean;
  onClose?: () => void;
  showBanner?: boolean;
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function fetchGroqBrief(articles: BriefArticleInput[], useAi: boolean): Promise<{ brief: GeneratedDailyBrief; source: string }> {
  try {
    const res = await fetch("/api/brief/groq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articles, useAi }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as any;
    if (data?.brief?.sections?.length) return { brief: data.brief as GeneratedDailyBrief, source: (data.source as string) || "groq" };
    throw new Error("empty");
  } catch {
    // Always fall back to the on-device generator — never break the brief.
    const today = Date.now();
    return { brief: buildDailyBrief(articles, dayKey(today)), source: "fallback" };
  }
}

export default function DailyBriefCard({ items, narrateLang, isOpen, onClose, showBanner = true }: Props) {
  const locale = getLocale();
  const [brief, setBrief] = useState<GeneratedDailyBrief | null>(null);
  const [briefSource, setBriefSource] = useState<string>("fallback");

  const articles = useMemo<BriefArticleInput[]>(() => {
    const today = Date.now();
    const settings = getBriefSettings();
    const scoped = filterItemsForBrief(
      items.filter((i) => dayKey(i.publishedAt) === dayKey(today)),
      settings
    );
    // Group by source, cap per-source, cap number of sources.
    const bySource = new Map<string, FeedItem[]>();
    for (const it of scoped) {
      const title = it.subscriptionTitle || "General News";
      const list = bySource.get(title) || [];
      list.push(it);
      bySource.set(title, list);
    }
    const out: BriefArticleInput[] = [];
    let sources = 0;
    for (const [, list] of bySource) {
      if (sources >= settings.maxSources) break;
      for (const it of list.slice(0, settings.maxPerSource)) {
        out.push({ id: it.id, source: it.subscriptionTitle, title: it.title, summary: it.summary, link: it.link });
      }
      sources++;
    }
    return out.slice(0, 240);
  }, [items]);

  useEffect(() => {
    let alive = true;
    if (articles.length < 2) {
      setBrief(null);
      return;
    }
    const useAi = getBriefSettings().useAi;
    fetchGroqBrief(articles, useAi).then(({ brief, source }) => {
      if (alive) {
        setBrief(brief);
        setBriefSource(source);
      }
    });
    return () => {
      alive = false;
    };
  }, [articles]);

  const ttsRef = useRef<BulletinTts | null>(null);
  const [playing, setPlaying] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const [subtitle, setSubtitle] = useState("");

  const isModalOpen = Boolean(isOpen ?? internalOpen);

  const handleClose = () => {
    setInternalOpen(false);
    onClose?.();
  };

  // Flatten all articles from generated brief sections for the bento layout
  const flatBriefItems = useMemo(() => {
    if (!brief) return [];
    const dv = getContentLocale() === "dv";
    return brief.sections.flatMap((s) =>
      s.items.map((it) => {
        // Find matching original feed item to recover image URLs + Thaana body
        const matchedOrig = items.find((orig) => orig.id === it.id || orig.title === it.headline);
        let headline = it.headline;
        let detail = it.detail;
        if (dv && matchedOrig) {
          const body = matchedOrig.content || matchedOrig.summary || "";
          headline = getDisplayHeadline(it.headline, body) || it.headline;
          const thaanaDetail = getDisplayDetail(body);
          if (thaanaDetail) detail = thaanaDetail;
        }
        return {
          ...it,
          headline,
          detail,
          source: s.source,
          intro: s.intro,
          originalItem: matchedOrig,
        };
      })
    );
  }, [brief, items]);

  const bentoSlots = useMemo(() => [
    { style: "hero", colSpan: "md:col-span-8", rowSpan: "md:row-span-2" },
    { style: "visual", colSpan: "md:col-span-4", rowSpan: "md:row-span-2" },
    { style: "double-column", colSpan: "md:col-span-6", rowSpan: "md:row-span-1" },
    { style: "standard", colSpan: "md:col-span-3", rowSpan: "md:row-span-1" },
    { style: "quote", colSpan: "md:col-span-3", rowSpan: "md:row-span-1" },
    { style: "visual", colSpan: "md:col-span-4", rowSpan: "md:row-span-2" },
    { style: "hero", colSpan: "md:col-span-8", rowSpan: "md:row-span-2" },
    { style: "intel", colSpan: "md:col-span-4", rowSpan: "md:row-span-1" },
    { style: "double-column", colSpan: "md:col-span-4", rowSpan: "md:row-span-1" },
    { style: "standard", colSpan: "md:col-span-4", rowSpan: "md:row-span-1" },
    { style: "quote", colSpan: "md:col-span-3", rowSpan: "md:row-span-1" },
    { style: "intel", colSpan: "md:col-span-3", rowSpan: "md:row-span-1" },
    { style: "double-column", colSpan: "md:col-span-6", rowSpan: "md:row-span-1" },
  ], []);

  const assignedSlots = useMemo(() => {
    const count = flatBriefItems.length;
    if (count === 0) return [];

    const slots = [];
    for (let i = 0; i < count; i++) {
      const defaultSlot = bentoSlots[i % bentoSlots.length];
      slots.push({
        style: defaultSlot.style,
        colSpan: defaultSlot.colSpan,
        rowSpan: defaultSlot.rowSpan,
      });
    }

    // Dynamic row packing correction to eliminate grid gaps at the bottom row
    const lastIdx = count - 1;
    if (lastIdx === 0) {
      slots[0].colSpan = "md:col-span-12";
    } else {
      const rem = count % 13;
      if (rem === 1) {
        slots[lastIdx].colSpan = "md:col-span-12";
      } else if (rem === 3) {
        slots[lastIdx].colSpan = "md:col-span-12";
      } else if (rem === 4) {
        slots[lastIdx].colSpan = "md:col-span-6";
      } else if (rem === 6) {
        slots[lastIdx].colSpan = "md:col-span-12";
      } else if (rem === 8) {
        slots[lastIdx].colSpan = "md:col-span-8";
      } else if (rem === 11) {
        slots[lastIdx].colSpan = "md:col-span-9";
      }
    }

    return slots;
  }, [flatBriefItems, bentoSlots]);

  if (!brief) return null;
  const storyCount = brief.sections.reduce((a, s) => a + s.items.length, 0);

  const ensureTts = () => {
    if (!ttsRef.current) {
      ttsRef.current = new BulletinTts({
        onSubtitle: setSubtitle,
        onEnded: () => setPlaying(false),
        onError: () => setPlaying(false),
      });
    }
    return ttsRef.current;
  };

  const buildSpokenText = () => {
    if (!brief) return "";
    const parts = [brief.lead];
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

  const renderFallbackGraphic = (style: string, index: number, headline: string) => {
    const hash = Array.from(headline).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const typeIdx = (hash + index) % 4;

    if (typeIdx === 0) {
      return (
        <div className="w-full h-full min-h-[150px] bg-neutral-950/5 dark:bg-white/5 border border-dashed border-neutral-950/20 dark:border-white/15 flex flex-col items-center justify-center p-4 text-center select-none overflow-hidden relative">
          <svg viewBox="0 0 100 100" className="w-12 h-12 opacity-25 dark:opacity-15 text-neutral-950 dark:text-white absolute">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3,3" />
            <circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M 18,50 A 32,32 0 0,1 82,50" fill="none" id="curve" />
            <text className="text-[5px] font-mono tracking-[0.2em]" fill="currentColor">
              <textPath href="#curve" startOffset="50%" textAnchor="middle">
                BULLETIN PRESS
              </textPath>
            </text>
            <text x="50" y="58" textAnchor="middle" className="text-[12px] font-serif font-black" fill="currentColor">B</text>
          </svg>
          <span className="text-[8px] font-mono tracking-wider font-extrabold uppercase text-amber-950/40 dark:text-amber-400/30 relative z-10">
            OFFICIAL TELEGRAPH
          </span>
        </div>
      );
    } else if (typeIdx === 1) {
      return (
        <div className="w-full h-full min-h-[150px] bg-neutral-950/5 dark:bg-white/5 border-2 border-double border-neutral-950/40 dark:border-white/20 flex flex-col items-center justify-center p-4 text-center select-none overflow-hidden relative">
          <div className="border border-neutral-950/25 dark:border-white/10 p-2 w-full h-full flex flex-col items-center justify-center">
            <span className="text-[9px] font-serif font-black tracking-widest uppercase text-neutral-950 dark:text-white block">
              BULLETIN CO.
            </span>
            <div className="w-4 h-[1px] bg-neutral-950/30 dark:bg-white/30 my-0.5" />
            <span className="text-[7px] font-serif italic text-amber-800 dark:text-amber-400 mt-0.5">
              "Veritas"
            </span>
          </div>
        </div>
      );
    } else if (typeIdx === 2) {
      return (
        <div className="w-full h-full min-h-[150px] bg-neutral-950/5 dark:bg-white/5 border border-neutral-950/10 dark:border-white/10 flex items-center justify-center p-4 overflow-hidden relative select-none">
          <svg viewBox="0 0 120 80" className="w-full h-full opacity-15 dark:text-white text-neutral-950 absolute">
            <line x1="10" y1="40" x2="110" y2="40" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="20" cy="40" r="1.5" fill="currentColor" />
            <circle cx="45" cy="40" r="2.5" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="100" cy="40" r="1.5" fill="currentColor" />
            <path d="M 20,40 Q 32.5,25 45,40 T 70,40 T 100,40" fill="none" stroke="currentColor" strokeWidth="0.75" />
          </svg>
          <span className="text-[8px] font-mono uppercase tracking-[0.2em] font-extrabold text-neutral-500/60 select-none">
            TELE WIRE
          </span>
        </div>
      );
    } else {
      return (
        <div className="w-full h-full min-h-[150px] bg-amber-500/5 dark:bg-amber-500/5 border border-dashed border-amber-600/30 flex flex-col items-center justify-center p-4 text-center select-none relative">
          <span className="text-xs text-amber-600/50 dark:text-amber-400/40 mb-1">★★★</span>
          <span className="text-[8px] font-mono tracking-[0.1em] font-black uppercase text-amber-800 dark:text-amber-400">
            BRIEF SPECIAL
          </span>
        </div>
      );
    }
  };

  const renderHeroCard = (art: any, index: number, colSpan: string, rowSpan: string) => {
    const dir = getContentLocale() === "dv" ? "rtl" : textDirection(art.headline);
    const cover = art.originalItem?.imageUrl;

    return (
      <article
        key={art.id + index}
        className={`bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 rounded-none ${colSpan} ${rowSpan}`}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b-2 border-neutral-950 dark:border-neutral-200 pb-2">
            <span className="text-[9px] font-mono font-black uppercase tracking-widest text-amber-800 dark:text-amber-400">
              ★ {art.source} • BRIEF LEAD
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 space-y-3">
              <h2
                dir={dir}
                className={`font-serif font-black leading-tight text-neutral-950 dark:text-white text-lg sm:text-xl md:text-2xl ${
                  dir === "rtl" ? "font-thaana-title text-right" : ""
                }`}
              >
                {art.headline}
              </h2>

              <div
                dir={dir}
                className={`text-neutral-800 dark:text-neutral-300 leading-relaxed text-xs sm:text-sm font-serif ${
                  dir === "rtl" ? "font-thaana text-right" : ""
                }`}
              >
                {dir !== "rtl" ? (
                  <>
                    <span className="float-left text-4xl font-serif font-black mr-2 mt-0.5 line-height-none text-neutral-950 dark:text-white">
                      {art.detail.charAt(0)}
                    </span>
                    {art.detail.slice(1)}
                  </>
                ) : (
                  art.detail
                )}
              </div>
            </div>

            <div className="lg:col-span-5 w-full">
              {cover ? (
                <div className="relative group overflow-hidden border-2 border-neutral-950 dark:border-neutral-700">
                  <img
                    src={cover}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-full h-36 object-cover grayscale contrast-125 hover:grayscale-0 transition-all duration-700 scale-100"
                  />
                </div>
              ) : (
                renderFallbackGraphic("hero", index, art.headline)
              )}
            </div>
          </div>
        </div>

        {art.originalItem?.link && (
          <div className="border-t border-dashed border-neutral-950/20 dark:border-white/10 pt-3 mt-4">
            <a
              href={art.originalItem.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 hover:underline"
            >
              Read Original <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        )}
      </article>
    );
  };

  const renderVisualCard = (art: any, index: number, colSpan: string, rowSpan: string) => {
    const dir = getContentLocale() === "dv" ? "rtl" : textDirection(art.headline);
    const cover = art.originalItem?.imageUrl;

    return (
      <article
        key={art.id + index}
        className={`relative bg-neutral-900 border-2 border-neutral-950 dark:border-neutral-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] flex flex-col justify-end overflow-hidden group min-h-[260px] md:min-h-[300px] transition-all duration-300 hover:-translate-y-0.5 rounded-none ${colSpan} ${rowSpan}`}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover grayscale contrast-110 brightness-75 group-hover:grayscale-0 transition-all duration-700"
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-neutral-950/95 flex items-center justify-center">
            {renderFallbackGraphic("visual", index, art.headline)}
          </div>
        )}

        <div className="absolute top-3 left-3 z-20">
          <span className="text-[8px] font-mono font-black uppercase bg-amber-500 text-black border border-neutral-950 px-1.5 py-0.5">
            ★ {art.source}
          </span>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-transparent z-10" />

        <div className="relative z-20 p-4 space-y-2">
          <h2
            dir={dir}
            className={`font-serif font-black text-white text-sm sm:text-base leading-tight ${
              dir === "rtl" ? "font-thaana text-right" : ""
            }`}
          >
            {art.headline}
          </h2>

          <p
            dir={dir}
            className={`text-neutral-300 text-[11px] line-clamp-2 leading-relaxed ${
              dir === "rtl" ? "font-thaana text-right" : ""
            }`}
          >
            {art.detail}
          </p>

          {art.originalItem?.link && (
            <div className="border-t border-white/20 pt-2 mt-2">
              <a
                href={art.originalItem.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-amber-400 hover:underline"
              >
                Full Link <ArrowUpRight className="w-2.5 h-2.5" />
              </a>
            </div>
          )}
        </div>
      </article>
    );
  };

  const renderDoubleColumnCard = (art: any, index: number, colSpan: string, rowSpan: string) => {
    const dir = getContentLocale() === "dv" ? "rtl" : textDirection(art.headline);

    return (
      <article
        key={art.id + index}
        className={`bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 rounded-none ${colSpan} ${rowSpan}`}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b-2 border-neutral-950 dark:border-neutral-200 pb-2">
            <span className="text-[9px] font-mono font-black uppercase tracking-widest text-amber-800 dark:text-amber-400">
              ✦ {art.source} • SUMMARY
            </span>
          </div>

          <h2
            dir={dir}
            className={`font-serif font-black leading-snug text-neutral-950 dark:text-white text-base ${
              dir === "rtl" ? "font-thaana-title text-right" : ""
            }`}
          >
            {art.headline}
          </h2>

          <div
            dir={dir}
            className={`text-neutral-800 dark:text-neutral-300 leading-relaxed text-[11px] sm:text-xs font-serif ${
              dir === "rtl"
                ? "font-thaana text-right"
                : "md:columns-2 gap-4 border-t border-neutral-950/10 dark:border-white/10 pt-2"
            }`}
          >
            {dir !== "rtl" ? (
              <>
                <span className="font-serif font-black text-xs text-neutral-950 dark:text-white mr-0.5">
                  {art.detail.split(" ").slice(0, 2).join(" ").toUpperCase()}
                </span>{" "}
                {art.detail.split(" ").slice(2).join(" ")}
              </>
            ) : (
              art.detail
            )}
          </div>
        </div>

        {art.originalItem?.link && (
          <div className="border-t border-dashed border-neutral-950/20 dark:border-white/10 pt-3 mt-3">
            <a
              href={art.originalItem.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 hover:underline"
            >
              Read Article <ArrowUpRight className="w-2.5 h-2.5" />
            </a>
          </div>
        )}
      </article>
    );
  };

  const renderQuoteCard = (art: any, index: number, colSpan: string, rowSpan: string) => {
    const dir = getContentLocale() === "dv" ? "rtl" : textDirection(art.headline);

    return (
      <article
        key={art.id + index}
        className={`bg-[#fdfaf2] dark:bg-[#1f1d19] border-2 border-neutral-950 dark:border-neutral-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 rounded-none ${colSpan} ${rowSpan}`}
      >
        <div className="space-y-3">
          <div className="flex justify-center">
            <span className="text-3xl font-serif text-amber-600 dark:text-amber-400 leading-none select-none">
              “
            </span>
          </div>

          <h2
            dir={dir}
            className={`font-serif italic text-xs sm:text-sm font-bold text-center leading-relaxed text-neutral-950 dark:text-neutral-100 ${
              dir === "rtl" ? "font-thaana" : ""
            }`}
          >
            {art.headline}
          </h2>

          <div className="w-8 h-[1px] bg-neutral-950/10 dark:bg-white/10 mx-auto" />

          <p
            dir={dir}
            className={`text-center font-serif text-[10px] italic text-neutral-500 ${
              dir === "rtl" ? "font-thaana" : ""
            }`}
          >
            — {art.source} Dispatch
          </p>
        </div>
      </article>
    );
  };

  const renderIntelCard = (art: any, index: number, colSpan: string, rowSpan: string) => {
    const dir = getContentLocale() === "dv" ? "rtl" : textDirection(art.headline);

    return (
      <article
        key={art.id + index}
        className={`bg-neutral-950 dark:bg-[#1a150c] text-white border-2 border-neutral-950 dark:border-amber-500/20 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(245,158,11,0.15)] p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 rounded-none ${colSpan} ${rowSpan}`}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-white/20 pb-1.5">
            <span className="text-[8px] font-mono font-black uppercase tracking-widest text-amber-400">
              ⚡ BRIEFING INTEL
            </span>
          </div>

          <h2
            dir={dir}
            className={`font-sans font-extrabold tracking-tight leading-snug text-white text-xs sm:text-sm ${
              dir === "rtl" ? "font-thaana text-right" : ""
            }`}
          >
            {art.headline}
          </h2>

          <p
            dir={dir}
            className={`text-neutral-300 font-mono text-[10px] leading-relaxed line-clamp-4 ${
              dir === "rtl" ? "font-thaana text-right" : ""
            }`}
          >
            {art.detail}
          </p>
        </div>

        <div className="border-t border-white/10 pt-2.5 mt-3">
          <span className="text-[8px] font-mono text-amber-400/70 font-semibold uppercase">
            Source: {art.source}
          </span>
        </div>
      </article>
    );
  };

  const renderStandardCard = (art: any, index: number, colSpan: string, rowSpan: string) => {
    const dir = getContentLocale() === "dv" ? "rtl" : textDirection(art.headline);
    const cover = art.originalItem?.imageUrl;

    return (
      <article
        key={art.id + index}
        className={`bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] p-4 flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 rounded-none ${colSpan} ${rowSpan}`}
      >
        <div className="space-y-2">
          {cover ? (
            <div className="relative overflow-hidden border-2 border-neutral-950 dark:border-neutral-700 mb-2">
              <img
                src={cover}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-24 object-cover grayscale contrast-115 hover:grayscale-0 transition-all duration-500"
              />
            </div>
          ) : (
            <div className="mb-1">
              {renderFallbackGraphic("standard", index, art.headline)}
            </div>
          )}

          <div className="flex items-center justify-between border-b border-neutral-950/10 dark:border-white/10 pb-0.5">
            <span className="text-[9px] font-mono font-black uppercase text-amber-800 dark:text-amber-400">
              {art.source}
            </span>
          </div>

          <h2
            dir={dir}
            className={`font-serif font-bold leading-snug text-neutral-950 dark:text-white text-xs sm:text-sm ${
              dir === "rtl" ? "font-thaana text-right" : ""
            }`}
          >
            {art.headline}
          </h2>

          <p
            dir={dir}
            className={`text-neutral-700 dark:text-neutral-300 text-[11px] line-clamp-3 leading-relaxed ${
              dir === "rtl" ? "font-thaana text-right" : ""
            }`}
          >
            {art.detail}
          </p>
        </div>

        {art.originalItem?.link && (
          <div className="border-t border-dashed border-neutral-950/20 dark:border-white/10 pt-2 mt-2">
            <a
              href={art.originalItem.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 hover:underline"
            >
              Read Article <ArrowUpRight className="w-2.5 h-2.5" />
            </a>
          </div>
        )}
      </article>
    );
  };

  const isRtl = getContentLocale() === "dv";

  const overlay = isModalOpen
    ? createPortal(
        <div dir={isRtl ? "rtl" : "ltr"} className={`fixed inset-0 z-[9999] bg-[#f2eee3] dark:bg-[#131210] text-neutral-900 dark:text-neutral-100 flex flex-col ${isRtl ? "font-thaana text-right" : ""}`} style={{ height: "100dvh" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b-2 border-neutral-950 dark:border-neutral-700 bg-[#f2eee3] dark:bg-[#131210]">
            <button
              onClick={handleClose}
              className="p-2 rounded-none border-2 border-neutral-950 dark:border-neutral-700 bg-white dark:bg-[#1a1815] text-neutral-950 dark:text-white hover:bg-neutral-100 transition-colors flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_rgba(255,255,255,0.15)]"
              title="Close Brief"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-serif font-black uppercase tracking-widest text-neutral-950 dark:text-white flex items-center gap-1">
              ⚡ {t("brief.title")}
              {briefSource === "groq" && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-mono text-amber-800 dark:text-amber-400 border-2 border-amber-800 dark:border-amber-500/40 px-1 font-black">
                  <Sparkles className="w-2.5 h-2.5" /> AI
                </span>
              )}
            </span>
            <button
              onClick={toggleListen}
              className={`px-4 py-2 rounded-none border-2 border-neutral-950 text-xs font-serif font-black flex items-center gap-1.5 transition-colors shadow-[2px_2px_0px_rgba(0,0,0,1)] ${
                playing ? "bg-red-600 text-white" : "bg-amber-500 hover:bg-amber-400 text-black"
              }`}
            >
              {playing ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{playing ? t("brief.stop") : t("brief.listen")}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 md:p-8 max-w-7xl mx-auto w-full space-y-8 scrollbar-none relative">
            {/* Paper texture overlay */}
            <div className="absolute inset-0 bg-noise pointer-events-none opacity-[0.02] dark:opacity-[0.015] z-40" />

            {/* Daily Brief Lead Box */}
            <div className="p-5 rounded-none bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] text-neutral-900 dark:text-neutral-100">
              <span className="text-[9px] font-mono font-black uppercase text-amber-800 dark:text-amber-400 block mb-1">★★★ LEAD EXTRA EDITORIAL ★★★</span>
              <p className="text-base sm:text-lg font-serif font-bold italic leading-relaxed">{brief.lead}</p>
            </div>

            {/* Irregular Bento Grid of Brief Articles */}
            <div className="grid grid-cols-1 md:grid-cols-12 grid-flow-row-dense gap-6 auto-rows-min pb-12">
              {flatBriefItems.map((art, index) => {
                const slot = assignedSlots[index];
                if (!slot) return null;

                const colSpan = slot.colSpan;
                const rowSpan = slot.rowSpan;
                const style = slot.style;

                switch (style) {
                  case "hero":
                    return renderHeroCard(art, index, colSpan, rowSpan);
                  case "visual":
                    return renderVisualCard(art, index, colSpan, rowSpan);
                  case "double-column":
                    return renderDoubleColumnCard(art, index, colSpan, rowSpan);
                  case "quote":
                    return renderQuoteCard(art, index, colSpan, rowSpan);
                  case "intel":
                    return renderIntelCard(art, index, colSpan, rowSpan);
                  case "standard":
                  default:
                    return renderStandardCard(art, index, colSpan, rowSpan);
                }
              })}
            </div>
          </div>

          {playing && (
            <div className="p-4 border-t-2 border-neutral-950 dark:border-neutral-700 bg-[#f2eee3] dark:bg-[#131210] text-center text-xs font-mono text-neutral-950 dark:text-amber-300 italic">
              {subtitle || "Listening to News Brief..."}
            </div>
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {showBanner && (
        <button
          onClick={() => setInternalOpen(true)}
          dir={isRtl ? "rtl" : "ltr"}
          className={`w-full text-left bg-neutral-900 border-2 border-white/15 rounded-none p-4 hover:border-amber-400/50 transition ${isRtl ? "font-thaana text-right" : ""}`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">⚡ {t("brief.title")}</span>
              {briefSource === "groq" && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-400 border border-amber-500/40 px-1 rounded-none">
                  <Sparkles className="w-2.5 h-2.5" /> AI
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono text-neutral-500">
              {storyCount} stories · {brief.sections.length} sources
            </span>
          </div>
          <h3 className="text-base font-bold text-white mb-1">{brief.lead.slice(0, 90)}…</h3>
          <p className="text-[11px] text-neutral-500">Tap for full brief · {t("brief.listen")} available</p>
        </button>
      )}
      {overlay}
    </>
  );
}

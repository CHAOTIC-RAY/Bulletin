import React, { useEffect, useMemo, useRef, useState } from "react";
import type { FeedItem } from "../lib/feedStorage";
import { buildPersonalizedBrief, type PersonalizedBrief } from "../lib/briefService";
import { getBriefSettings } from "../lib/feedStorage";
import { BulletinTts } from "../lib/ttsPlayer";
import { textDirection } from "../lib/textDirection";
import { getContentLocale } from "../lib/i18n";
import { getDisplayHeadline, getDisplayDetail } from "../lib/feedSanitize";
import WeatherOverview from "./WeatherOverview";
import { Bookmark, BookmarkCheck, BookOpen, Newspaper, Globe, Sparkles, Volume2, VolumeX } from "lucide-react";

interface Props {
  items: FeedItem[];
  onOpen: (item: FeedItem) => void;
  onSave: (item: FeedItem) => void;
  narrateLang: string; // e.g. "en-US" or "dv-MV"
}

export default function MagazineFeedScroll({ items, onOpen, onSave, narrateLang }: Props) {
  const [pb, setPb] = useState<PersonalizedBrief | null>(null);
  const [playing, setPlaying] = useState(false);
  const ttsRef = useRef<BulletinTts | null>(null);
  const [scopedCount, setScopedCount] = useState(0);

  const todayStr = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).toUpperCase(),
    []
  );

  // SVG Noise Paper Texture Data URI
  const noisePaperTexture = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E`;

  useEffect(() => {
    let alive = true;
    buildPersonalizedBrief(items).then((result) => {
      if (alive) {
        setPb(result);
        setScopedCount(result.articleCount);
      }
    });
    return () => {
      alive = false;
    };
  }, [items]);

  const ensureTts = () => {
    if (!ttsRef.current) {
      ttsRef.current = new BulletinTts({
        onSubtitle: () => {},
        onEnded: () => setPlaying(false),
        onError: () => setPlaying(false),
      });
    }
    return ttsRef.current;
  };

  const buildSpokenText = (brief: PersonalizedBrief["brief"]) => {
    const parts = [brief.lead];
    for (const s of brief.sections) {
      parts.push(`${s.source}. ${s.intro}`);
      for (const it of s.items) parts.push(`${it.headline}. ${it.detail}`);
    }
    return parts.join(". ");
  };

  const toggleListen = () => {
    if (!pb) return;
    const tts = ensureTts();
    if (playing) {
      tts.stop();
      setPlaying(false);
      return;
    }
    tts.setVoice(narrateLang, "", 1, 1);
    tts.play(buildSpokenText(pb.brief));
    setPlaying(true);
  };

  const settings = getBriefSettings();
  const filterSummary = [
    settings.topics.length ? `${settings.topics.length} topics` : "all topics",
    settings.sources.length ? `${settings.sources.length} sources` : "all sources",
  ].join(" · ");

  const storyCount = pb ? pb.brief.sections.reduce((a, s) => a + s.items.length, 0) : 0;

  // Flatten all articles from the sections to treat them as individual bento bricks
  const allArticles = useMemo(() => {
    if (!pb) return [];
    const dv = getContentLocale() === "dv";
    return pb.brief.sections.flatMap((section) =>
      section.items.map((it) => {
        const item = items.find((i) => i.id === it.id);
        let headline = it.headline;
        let detail = it.detail;
        if (dv && item) {
          const body = item.content || item.summary || "";
          headline = getDisplayHeadline(it.headline, body) || it.headline;
          const thaanaDetail = getDisplayDetail(body);
          if (thaanaDetail) detail = thaanaDetail;
        }
        return {
          ...it,
          headline,
          detail,
          source: section.source,
          intro: section.intro,
          item,
        };
      })
    );
  }, [pb, items]);

  // Bento Slots Definition for perfect 12-column masonry rows
  const bentoSlots = useMemo(() => [
    // Row 1 & 2 (Span 12)
    { style: "hero", colSpan: "md:col-span-8", rowSpan: "md:row-span-2" },
    { style: "visual", colSpan: "md:col-span-4", rowSpan: "md:row-span-2" },
    // Row 3 (Span 12)
    { style: "double-column", colSpan: "md:col-span-6", rowSpan: "md:row-span-1" },
    { style: "standard", colSpan: "md:col-span-3", rowSpan: "md:row-span-1" },
    { style: "quote", colSpan: "md:col-span-3", rowSpan: "md:row-span-1" },
    // Row 4 & 5 (Span 12)
    { style: "visual", colSpan: "md:col-span-4", rowSpan: "md:row-span-2" },
    { style: "hero", colSpan: "md:col-span-8", rowSpan: "md:row-span-2" },
    // Row 6 (Span 12)
    { style: "intel", colSpan: "md:col-span-4", rowSpan: "md:row-span-1" },
    { style: "double-column", colSpan: "md:col-span-4", rowSpan: "md:row-span-1" },
    { style: "standard", colSpan: "md:col-span-4", rowSpan: "md:row-span-1" },
    // Row 7 (Span 12)
    { style: "quote", colSpan: "md:col-span-3", rowSpan: "md:row-span-1" },
    { style: "intel", colSpan: "md:col-span-3", rowSpan: "md:row-span-1" },
    { style: "double-column", colSpan: "md:col-span-6", rowSpan: "md:row-span-1" },
  ], []);

  // Compute column and row span details with automatic correction to eliminate gaps
  const assignedSlots = useMemo(() => {
    const count = allArticles.length;
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

    // Mathematical correction layer:
    // When the article count doesn't finish a perfect 12-column multiple at the bottom,
    // we expand the final card's width to occupy the entire remaining row width perfectly.
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
  }, [allArticles, bentoSlots]);

  // Renders a stylized vector-like ink illustration or woodblock imprint when an article lacks an image
  const renderFallbackGraphic = (style: string, index: number, headline: string) => {
    const hash = Array.from(headline).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const typeIdx = (hash + index) % 4;

    if (typeIdx === 0) {
      return (
        <div className="w-full h-full min-h-[150px] bg-neutral-950/5 dark:bg-white/5 border border-dashed border-neutral-950/20 dark:border-white/15 flex flex-col items-center justify-center p-4 text-center select-none overflow-hidden relative">
          <svg viewBox="0 0 100 100" className="w-16 h-16 opacity-25 dark:opacity-15 text-neutral-950 dark:text-white absolute">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3,3" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M 18,50 A 32,32 0 0,1 82,50" fill="none" id="curve" />
            <text className="text-[5px] font-mono tracking-[0.2em]" fill="currentColor">
              <textPath href="#curve" startOffset="50%" textAnchor="middle">
                BULLETIN PRESS
              </textPath>
            </text>
            <text x="50" y="58" textAnchor="middle" className="text-[14px] font-serif font-black" fill="currentColor">B</text>
          </svg>
          <span className="text-[9px] font-mono tracking-wider font-extrabold uppercase text-amber-950/50 dark:text-amber-400/40 relative z-10">
            OFFICIAL TELEGRAPH
          </span>
          <span className="text-[8px] font-serif italic text-neutral-500 mt-1 relative z-10">
            Certified Newsprint
          </span>
        </div>
      );
    } else if (typeIdx === 1) {
      return (
        <div className="w-full h-full min-h-[150px] bg-neutral-950/5 dark:bg-white/5 border-2 border-double border-neutral-950/40 dark:border-white/20 flex flex-col items-center justify-center p-4 text-center select-none overflow-hidden relative">
          <div className="border border-neutral-950/25 dark:border-white/10 p-3 w-full h-full flex flex-col items-center justify-center">
            <span className="text-[10px] font-serif font-black tracking-widest uppercase text-neutral-950 dark:text-white block">
              BULLETIN CO.
            </span>
            <div className="w-6 h-[1px] bg-neutral-950/30 dark:bg-white/30 my-1" />
            <span className="text-[7px] font-mono uppercase tracking-[0.2em] text-neutral-500">
              ESTABLISHED 2026
            </span>
            <span className="text-[8px] font-serif italic text-amber-800 dark:text-amber-400 mt-1">
              "Veritas et Lux"
            </span>
          </div>
        </div>
      );
    } else if (typeIdx === 2) {
      return (
        <div className="w-full h-full min-h-[150px] bg-neutral-950/5 dark:bg-white/5 border border-neutral-950/10 dark:border-white/10 flex items-center justify-center p-4 overflow-hidden relative select-none">
          <svg viewBox="0 0 120 80" className="w-full h-full opacity-15 dark:text-white text-neutral-950 absolute">
            <line x1="10" y1="40" x2="110" y2="40" stroke="currentColor" strokeWidth="0.5" />
            <line x1="10" y1="20" x2="110" y2="20" stroke="currentColor" strokeWidth="0.25" strokeDasharray="1,1" />
            <line x1="10" y1="60" x2="110" y2="60" stroke="currentColor" strokeWidth="0.25" strokeDasharray="1,1" />
            <circle cx="20" cy="40" r="1.5" fill="currentColor" />
            <circle cx="45" cy="40" r="2.5" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="75" cy="40" r="1" fill="currentColor" />
            <circle cx="100" cy="40" r="1.5" fill="currentColor" />
            <path d="M 20,40 Q 32.5,25 45,40 T 70,40 T 100,40" fill="none" stroke="currentColor" strokeWidth="0.75" />
          </svg>
          <span className="text-[9px] font-mono uppercase tracking-[0.25em] font-extrabold text-neutral-500/70 select-none">
            WIRE WIRE WIRE
          </span>
        </div>
      );
    } else {
      return (
        <div className="w-full h-full min-h-[150px] bg-amber-500/5 dark:bg-amber-500/5 border border-dashed border-amber-600/30 flex flex-col items-center justify-center p-4 text-center select-none relative">
          <span className="text-sm text-amber-600/50 dark:text-amber-400/40 mb-1">★★★</span>
          <span className="text-[9px] font-mono tracking-[0.15em] font-black uppercase text-amber-800 dark:text-amber-400">
            FRONT PAGE CHOICE
          </span>
          <span className="text-[8px] font-serif italic text-neutral-500">
            Selected for global circulation
          </span>
        </div>
      );
    }
  };

  const renderHeroCard = (art: any, index: number, colSpan: string, rowSpan: string) => {
    const dir = textDirection(art.headline);
    const cover = art.item?.imageUrl;

    return (
      <article
        key={art.id + index}
        className={`bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 rounded-none ${colSpan} ${rowSpan}`}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b-2 border-neutral-950 dark:border-neutral-200 pb-2">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-800 dark:text-amber-400">
              ★ {art.source} • LEAD SPECIAL
            </span>
            <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider">
              {art.item?.publishedAt
                ? new Date(art.item.publishedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                : "DISPATCH"}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 space-y-3">
              <button onClick={() => art.item && onOpen(art.item)} className="text-left w-full group">
                <h2
                  dir={dir}
                  className={`font-serif font-black leading-tight text-neutral-950 dark:text-white group-hover:text-amber-800 dark:group-hover:text-amber-400 transition-colors text-xl sm:text-2xl md:text-3xl ${
                    dir === "rtl" ? "font-thaana-title text-right" : ""
                  }`}
                >
                  {art.headline}
                </h2>
              </button>

              <div
                dir={dir}
                className={`text-neutral-800 dark:text-neutral-300 leading-relaxed text-sm sm:text-base font-serif ${
                  dir === "rtl" ? "font-thaana text-right" : ""
                }`}
              >
                {dir !== "rtl" ? (
                  <>
                    <span className="float-left text-5xl font-serif font-black mr-2 mt-1 line-height-none text-neutral-950 dark:text-white">
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
                    className="w-full h-48 lg:h-56 object-cover grayscale contrast-125 hover:grayscale-0 transition-all duration-700 ease-in-out scale-100 hover:scale-105"
                  />
                  <span className="absolute bottom-0 left-0 right-0 bg-neutral-950/80 text-[9px] text-neutral-300 font-serif italic py-1 px-2 text-center border-t border-neutral-950">
                    Press Photo • {art.source}
                  </span>
                </div>
              ) : (
                renderFallbackGraphic("hero", index, art.headline)
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-dashed border-neutral-950/20 dark:border-white/10 pt-4 mt-6">
          {art.item && (
            <button
              onClick={() => onOpen(art.item)}
              className="inline-flex items-center gap-1 text-[11px] font-mono font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 hover:underline"
            >
              Read full article <BookOpen className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            {art.item && (
              <button
                onClick={() => onSave(art.item)}
                className="text-neutral-500 hover:text-amber-800 dark:hover:text-amber-400 transition-colors p-1.5 border border-neutral-950/10 dark:border-white/10 hover:border-neutral-950 shrink-0"
                title="Bookmark"
              >
                {art.item.saved ? (
                  <BookmarkCheck className="w-4 h-4 text-amber-800 dark:text-amber-400 fill-amber-500/20" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  const renderVisualCard = (art: any, index: number, colSpan: string, rowSpan: string) => {
    const dir = textDirection(art.headline);
    const cover = art.item?.imageUrl;

    return (
      <article
        key={art.id + index}
        className={`relative bg-neutral-900 border-2 border-neutral-950 dark:border-neutral-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] flex flex-col justify-end overflow-hidden group min-h-[300px] sm:min-h-[340px] md:min-h-[380px] transition-all duration-300 hover:-translate-y-0.5 rounded-none ${colSpan} ${rowSpan}`}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover grayscale contrast-110 brightness-75 group-hover:grayscale-0 group-hover:scale-105 group-hover:brightness-90 transition-all duration-700 ease-in-out"
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-neutral-950/95 flex items-center justify-center">
            {renderFallbackGraphic("visual", index, art.headline)}
          </div>
        )}

        <div className="absolute top-4 left-4 z-20">
          <span className="text-[9px] font-mono font-black uppercase bg-amber-500 text-black border border-neutral-950 px-2 py-0.5">
            ★ {art.source}
          </span>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10" />

        <div className="relative z-20 p-5 space-y-3">
          <button onClick={() => art.item && onOpen(art.item)} className="text-left w-full group">
            <h2
              dir={dir}
              className={`font-serif font-black text-white group-hover:text-amber-400 transition-colors text-lg sm:text-xl md:text-2xl leading-tight ${
                dir === "rtl" ? "font-thaana-title text-right" : ""
              }`}
            >
              {art.headline}
            </h2>
          </button>

          <p
            dir={dir}
            className={`text-neutral-300 text-xs sm:text-sm line-clamp-2 leading-relaxed ${
              dir === "rtl" ? "font-thaana text-right" : ""
            }`}
          >
            {art.detail}
          </p>

          <div className="flex items-center justify-between border-t border-white/20 pt-3 mt-4">
            {art.item && (
              <button
                onClick={() => onOpen(art.item)}
                className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 hover:underline"
              >
                Read full article <BookOpen className="w-3 h-3" />
              </button>
            )}
            <div className="flex items-center gap-2">
              {art.item && (
                <button
                  onClick={() => onSave(art.item)}
                  className="text-neutral-400 hover:text-amber-400 transition-colors p-1 bg-black/40 border border-white/10 shrink-0"
                  title="Bookmark"
                >
                  {art.item.saved ? (
                    <BookmarkCheck className="w-4 h-4 text-amber-400 fill-amber-400/10" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  };

  const renderDoubleColumnCard = (art: any, index: number, colSpan: string, rowSpan: string) => {
    const dir = textDirection(art.headline);

    return (
      <article
        key={art.id + index}
        className={`bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 rounded-none ${colSpan} ${rowSpan}`}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b-2 border-neutral-950 dark:border-neutral-200 pb-2">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-800 dark:text-amber-400">
              ✦ {art.source} • DISPATCH
            </span>
            <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider">
              ANALYSIS
            </span>
          </div>

          <button onClick={() => art.item && onOpen(art.item)} className="text-left w-full group">
            <h2
              dir={dir}
              className={`font-serif font-black leading-snug text-neutral-950 dark:text-white group-hover:text-amber-800 dark:group-hover:text-amber-400 transition-colors text-lg sm:text-xl ${
                dir === "rtl" ? "font-thaana-title text-right" : ""
              }`}
            >
              {art.headline}
            </h2>
          </button>

          <div
            dir={dir}
            className={`text-neutral-800 dark:text-neutral-300 leading-relaxed text-xs sm:text-sm font-serif ${
              dir === "rtl"
                ? "font-thaana text-right"
                : "md:columns-2 gap-4 border-t border-neutral-950/10 dark:border-white/10 pt-3"
            }`}
          >
            {dir !== "rtl" ? (
              <>
                <span className="font-serif font-black text-xl text-neutral-950 dark:text-white mr-0.5">
                  {art.detail.split(" ").slice(0, 2).join(" ").toUpperCase()}
                </span>{" "}
                {art.detail.split(" ").slice(2).join(" ")}
              </>
            ) : (
              art.detail
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-dashed border-neutral-950/20 dark:border-white/10 pt-4 mt-4">
          {art.item && (
            <button
              onClick={() => onOpen(art.item)}
              className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 hover:underline"
            >
              Read full article <BookOpen className="w-3 h-3" />
            </button>
          )}
          <div className="flex items-center gap-2">
            {art.item && (
              <button
                onClick={() => onSave(art.item)}
                className="text-neutral-500 hover:text-amber-800 dark:hover:text-amber-400 transition-colors p-1.5 border border-neutral-950/10 dark:border-white/10 hover:border-neutral-950 shrink-0"
                title="Bookmark"
              >
                {art.item.saved ? (
                  <BookmarkCheck className="w-4 h-4 text-amber-800 dark:text-amber-400 fill-amber-500/20" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  const renderQuoteCard = (art: any, index: number, colSpan: string, rowSpan: string) => {
    const dir = textDirection(art.headline);

    return (
      <article
        key={art.id + index}
        className={`bg-[#fdfaf2] dark:bg-[#1f1d19] border-2 border-neutral-950 dark:border-neutral-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 rounded-none ${colSpan} ${rowSpan}`}
      >
        <div className="space-y-4">
          <div className="flex justify-center">
            <span className="text-4xl font-serif text-amber-600 dark:text-amber-400 leading-none select-none">
              “
            </span>
          </div>

          <button onClick={() => art.item && onOpen(art.item)} className="text-center w-full group block">
            <h2
              dir={dir}
              className={`font-serif italic text-base sm:text-lg md:text-xl font-bold leading-relaxed text-neutral-950 dark:text-neutral-100 group-hover:text-amber-800 dark:group-hover:text-amber-400 transition-colors ${
                dir === "rtl" ? "font-thaana" : ""
              }`}
            >
              {art.headline}
            </h2>
          </button>

          <div className="w-12 h-[1px] bg-neutral-950/10 dark:bg-white/10 mx-auto" />

          <p
            dir={dir}
            className={`text-center font-serif text-xs italic text-neutral-600 dark:text-neutral-400 ${
              dir === "rtl" ? "font-thaana" : ""
            }`}
          >
            — {art.source} Correspondent
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-dashed border-neutral-950/20 dark:border-white/10 pt-4 mt-4">
          <span className="text-[9px] font-mono tracking-wider font-extrabold uppercase text-neutral-400">
            EDITORIAL COLUMN
          </span>
          <div className="flex items-center gap-2">
            {art.item && (
              <button
                onClick={() => onSave(art.item)}
                className="text-neutral-500 hover:text-amber-800 dark:hover:text-amber-400 transition-colors p-1.5 border border-neutral-950/10 dark:border-white/10 hover:border-neutral-950 shrink-0"
                title="Bookmark"
              >
                {art.item.saved ? (
                  <BookmarkCheck className="w-4 h-4 text-amber-800 dark:text-amber-400 fill-amber-500/20" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  const renderIntelCard = (art: any, index: number, colSpan: string, rowSpan: string) => {
    const dir = textDirection(art.headline);

    return (
      <article
        key={art.id + index}
        className={`bg-neutral-950 dark:bg-[#1a150c] text-white border-2 border-neutral-950 dark:border-amber-500/20 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(245,158,11,0.15)] p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 rounded-none ${colSpan} ${rowSpan}`}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-white/20 pb-2">
            <span className="text-[9px] font-mono font-black uppercase tracking-widest text-amber-400">
              ⚡ BULLETIN INTEL
            </span>
            <span className="text-[8px] font-mono bg-amber-500 text-black px-1.5 py-0.5 uppercase tracking-wide font-bold">
              TOP CONFIDENTIAL
            </span>
          </div>

          <button onClick={() => art.item && onOpen(art.item)} className="text-left w-full group block">
            <h2
              dir={dir}
              className={`font-sans font-extrabold tracking-tight leading-snug text-white group-hover:text-amber-400 transition-colors text-sm sm:text-base ${
                dir === "rtl" ? "font-thaana text-right" : ""
              }`}
            >
              {art.headline}
            </h2>
          </button>

          <p
            dir={dir}
            className={`text-neutral-300 font-mono text-[11px] leading-relaxed line-clamp-4 ${
              dir === "rtl" ? "font-thaana text-right" : ""
            }`}
          >
            {art.detail}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-4">
          <span className="text-[9px] font-mono text-amber-400/70 font-semibold uppercase">
            Source: {art.source}
          </span>
          <div className="flex items-center gap-2">
            {art.item && (
              <button
                onClick={() => onSave(art.item)}
                className="text-neutral-400 hover:text-amber-400 transition-colors p-1 bg-white/5 border border-white/10 shrink-0"
                title="Bookmark"
              >
                {art.item.saved ? (
                  <BookmarkCheck className="w-4 h-4 text-amber-400 fill-amber-400/10" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  const renderStandardCard = (art: any, index: number, colSpan: string, rowSpan: string) => {
    const dir = textDirection(art.headline);
    const cover = art.item?.imageUrl;

    return (
      <article
        key={art.id + index}
        className={`bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 rounded-none ${colSpan} ${rowSpan}`}
      >
        <div className="space-y-3">
          {cover ? (
            <div className="relative overflow-hidden border-2 border-neutral-950 dark:border-neutral-700 mb-2">
              <img
                src={cover}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-32 sm:h-36 object-cover grayscale contrast-115 hover:grayscale-0 transition-all duration-500"
              />
            </div>
          ) : (
            <div className="mb-2">
              {renderFallbackGraphic("standard", index, art.headline)}
            </div>
          )}

          <div className="flex items-center justify-between border-b border-neutral-950/10 dark:border-white/10 pb-1">
            <span className="text-[10px] font-mono font-black uppercase text-amber-800 dark:text-amber-400">
              {art.source}
            </span>
            <span className="text-[9px] font-mono text-neutral-400">
              {art.item?.publishedAt
                ? new Date(art.item.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "NEWS"}
            </span>
          </div>

          <button onClick={() => art.item && onOpen(art.item)} className="text-left w-full group block">
            <h2
              dir={dir}
              className={`font-serif font-bold leading-snug text-neutral-950 dark:text-white group-hover:text-amber-800 dark:group-hover:text-amber-400 transition-colors text-base ${
                dir === "rtl" ? "font-thaana text-right" : ""
              }`}
            >
              {art.headline}
            </h2>
          </button>

          <p
            dir={dir}
            className={`text-neutral-700 dark:text-neutral-300 text-xs sm:text-sm line-clamp-3 leading-relaxed ${
              dir === "rtl" ? "font-thaana text-right" : ""
            }`}
          >
            {art.detail}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-dashed border-neutral-950/20 dark:border-white/10 pt-3 mt-3">
          {art.item && (
            <button
              onClick={() => onOpen(art.item)}
              className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 hover:underline"
            >
              Read full article <BookOpen className="w-3 h-3" />
            </button>
          )}
          <div className="flex items-center gap-2">
            {art.item && (
              <button
                onClick={() => onSave(art.item)}
                className="text-neutral-500 hover:text-amber-800 dark:hover:text-amber-400 transition-colors p-1.5 border border-neutral-950/10 dark:border-white/10 hover:border-neutral-950 shrink-0"
                title="Bookmark"
              >
                {art.item.saved ? (
                  <BookmarkCheck className="w-4 h-4 text-amber-800 dark:text-amber-400 fill-amber-500/20" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="relative min-h-[100dvh] h-[100dvh] w-full overflow-y-auto pt-20 pb-16 bg-[#f2eee3] dark:bg-[#131210] text-neutral-900 dark:text-neutral-100 font-sans selection:bg-amber-500 selection:text-black">
      {/* Paper texture grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-10 opacity-70 dark:opacity-30 mix-blend-multiply dark:mix-blend-overlay"
        style={{ backgroundImage: `url("${noisePaperTexture}")` }}
      />

      <div className="relative z-20 w-full px-3 sm:px-6 md:px-8 lg:px-12">
        {!pb ? (
          <div className="text-center py-24 font-serif italic text-neutral-500 dark:text-neutral-400">
            Composing your Daily Paper…
          </div>
        ) : (
          <>
            {/* --- DAILY PAPER MASTHEAD --- */}
            <header className="text-center pt-2 pb-6 mb-8 border-b-4 border-double border-neutral-950 dark:border-neutral-200">
              <div className="flex items-center justify-between border-b-2 border-t-2 border-neutral-950 dark:border-neutral-200 py-1.5 px-3 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest text-neutral-800 dark:text-neutral-200 mb-4 bg-black/5 dark:bg-white/5">
                <span>{todayStr}</span>
                <span className="hidden sm:inline font-serif italic text-amber-900 dark:text-amber-400 font-extrabold">
                  "YOUR CURATED EDITION"
                </span>
                <span>BULLETIN • DAILY PAPER</span>
              </div>

              <div className="py-2 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="hidden md:block md:col-span-3 text-left border-r border-neutral-900/30 dark:border-neutral-100/30 pr-3 font-serif">
                  <span className="text-[10px] font-mono uppercase font-black tracking-wider text-amber-800 dark:text-amber-400 block mb-0.5">
                    EDITION
                  </span>
                  <p className="text-xs text-neutral-700 dark:text-neutral-300 font-bold">
                    {pb.source === "groq" ? "AI-polished" : "Standard"} brief
                  </p>
                  <p className="text-[10px] italic text-neutral-500 dark:text-neutral-400">{filterSummary}</p>
                </div>

                <div className="md:col-span-6 text-center">
                  <h1 className="font-serif font-black tracking-tight text-4xl sm:text-6xl md:text-6xl lg:text-7xl uppercase text-neutral-950 dark:text-white drop-shadow-sm border-b-2 border-neutral-900/20 dark:border-neutral-100/20 pb-2">
                    The Daily Paper
                  </h1>
                  <p className="text-xs sm:text-sm font-serif italic text-neutral-700 dark:text-neutral-300 font-medium mt-1.5">
                    Bulletin • Personalized News Brief & Global Intel
                  </p>
                </div>

                <div className="hidden md:block md:col-span-3 text-right border-l border-neutral-900/30 dark:border-neutral-100/30 pl-3 font-serif">
                  <span className="text-[10px] font-mono uppercase font-black tracking-wider text-amber-800 dark:text-amber-400 block mb-0.5">
                    IN THIS EDITION
                  </span>
                  <p className="text-xs text-neutral-700 dark:text-neutral-300 font-bold">
                    {storyCount} stories • {pb.brief.sections.length} sources
                  </p>
                  <p className="text-[10px] italic text-neutral-500 dark:text-neutral-400">
                    Updated live from your feeds
                  </p>
                </div>
              </div>

              {/* Listen control bar */}
              <div className="border-t-2 border-b-2 border-neutral-950 dark:border-neutral-200 py-2 mt-4 bg-amber-950/5 dark:bg-amber-100/5 flex items-center justify-center gap-3">
                <button
                  onClick={toggleListen}
                  className={`px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-wider border-2 transition-colors flex items-center gap-1.5 ${
                    playing
                      ? "bg-red-500 text-white border-black"
                      : "bg-amber-500 text-black border-neutral-950 hover:bg-amber-400"
                  }`}
                >
                  {playing ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  {playing ? "Stop" : "Listen to Brief"}
                </button>
                {pb.source === "groq" && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 border border-amber-500/40 px-1.5 py-0.5">
                    <Sparkles className="w-3 h-3" /> AI
                  </span>
                )}
              </div>
            </header>

            {/* --- WEATHER OVERVIEW --- */}
            <section className="mb-8">
              <WeatherOverview />
            </section>

            {/* --- LEAD STORY --- */}
            <section className="mb-8">
              <div className="p-4 sm:p-6 bg-amber-500/10 dark:bg-amber-500/5 border-2 border-amber-600/40 dark:border-amber-400/30">
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-800 dark:text-amber-400">
                  ★ TODAY'S LEAD
                </span>
                <p className="mt-2 font-serif font-bold text-lg sm:text-2xl leading-snug text-neutral-950 dark:text-white">
                  {pb.brief.lead}
                </p>
              </div>
            </section>

            {/* --- IRREGULAR BENTO GRID (The News Mosaic) --- */}
            <div className="grid grid-cols-1 md:grid-cols-12 grid-flow-row-dense gap-6 auto-rows-min">
              {allArticles.map((art, index) => {
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

            {/* Footer */}
            <footer className="mt-16 pt-8 border-t-4 border-double border-b-2 border-neutral-950 dark:border-neutral-200 text-center text-xs font-mono text-neutral-700 dark:text-neutral-400 space-y-2 pb-6">
              <p className="font-serif font-black uppercase tracking-widest text-neutral-950 dark:text-white text-sm">
                End of Your Daily Edition • Bulletin
              </p>
              <p>© 2026 Bulletin. Personalized news brief composed from your selected sources & topics.</p>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

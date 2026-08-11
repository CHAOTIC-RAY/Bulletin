import React, { useEffect, useMemo, useRef, useState } from "react";
import type { FeedItem } from "../lib/feedStorage";
import { buildPersonalizedBrief, type PersonalizedBrief } from "../lib/briefService";
import { getBriefSettings } from "../lib/feedStorage";
import { BulletinTts } from "../lib/ttsPlayer";
import { textDirection } from "../lib/textDirection";
import { Bookmark, BookmarkCheck, ArrowUpRight, Newspaper, Globe, Sparkles, Volume2, VolumeX } from "lucide-react";

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

            {/* --- BRIEF SECTIONS (the whole paper) --- */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
              {pb.brief.sections.map((section, idx) => {
                const isFeature = idx === 0;
                return (
                  <article
                    key={section.source}
                    className={`bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-900 dark:border-neutral-700 shadow-[3px_3px_0px_rgba(0,0,0,0.15)] dark:shadow-[3px_3px_0px_rgba(255,255,255,0.08)] p-4 sm:p-5 flex flex-col ${
                      isFeature ? "md:col-span-12" : "md:col-span-6"
                    }`}
                  >
                    <div className="flex items-center justify-between border-b-2 border-neutral-900 dark:border-neutral-200 pb-2 mb-3">
                      <h2 className="font-serif font-black uppercase tracking-wide text-lg sm:text-xl text-neutral-950 dark:text-white">
                        {section.source}
                      </h2>
                      <span className="text-[10px] font-mono text-neutral-500">
                        {section.items.length} stories
                      </span>
                    </div>

                    <p className="text-[11px] sm:text-xs font-serif italic text-neutral-600 dark:text-neutral-400 mb-3 border-l-2 border-amber-500/50 pl-2">
                      {section.intro}
                    </p>

                    <ul className="space-y-3 flex-1">
                      {section.items.map((it) => {
                        const item = items.find((i) => i.id === it.id);
                        const dir = textDirection(it.headline);
                        return (
                          <li
                            key={it.id}
                            className="group border-b border-dashed border-neutral-900/20 dark:border-neutral-700 last:border-0 pb-3 last:pb-0"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <button
                                onClick={() => item && onOpen(item)}
                                className="text-left flex-1"
                              >
                                <h3
                                  dir={dir}
                                  className={`font-serif font-bold leading-snug text-neutral-950 dark:text-neutral-50 group-hover:text-amber-800 dark:group-hover:text-amber-400 transition-colors ${
                                    isFeature ? "text-base sm:text-lg" : "text-sm sm:text-base"
                                  } ${dir === "rtl" ? "font-thaana" : ""}`}
                                >
                                  {it.headline}
                                </h3>
                                <p
                                  dir={dir}
                                  className={`mt-1 text-neutral-700 dark:text-neutral-300 leading-relaxed ${
                                    isFeature ? "text-sm sm:text-base line-clamp-4" : "text-xs sm:text-sm line-clamp-3"
                                  } ${dir === "rtl" ? "font-thaana text-right" : ""}`}
                                >
                                  {it.detail}
                                </p>
                              </button>
                              {item && (
                                <button
                                  onClick={() => onSave(item)}
                                  className="text-neutral-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors p-1 shrink-0"
                                  title="Bookmark"
                                >
                                  {item.saved ? (
                                    <BookmarkCheck className="w-4 h-4 text-amber-700 dark:text-amber-400 fill-amber-500/20" />
                                  ) : (
                                    <Bookmark className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                            </div>
                            {item && item.link && (
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-amber-800 dark:text-amber-400 hover:underline mt-1"
                              >
                                Read full <ArrowUpRight className="w-3 h-3" />
                              </a>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                );
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

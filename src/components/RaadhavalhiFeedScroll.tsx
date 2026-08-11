import React, { useEffect, useRef, useState, useMemo } from "react";
import type { FeedItem } from "../lib/feedStorage";
import { textDirection } from "../lib/textDirection";
import { t, getLocale } from "../lib/i18n";
import AutoImageReel from "./AutoImageReel";
import { RaadhavalhiTts } from "../lib/ttsPlayer";
import { Volume2, VolumeX, SlidersHorizontal } from "lucide-react";
import { cleanArticleHtml as sanitize, cleanTtsText, extractImagesFromHtml } from "../lib/feedSanitize";

interface Props {
  items: FeedItem[];
  narrateLang: string;
  onOpen: (item: FeedItem) => void;
  onSave: (item: FeedItem) => void;
  onOpenBrief: () => void;
  onOpenFilter?: () => void;
  hasActiveFilters?: boolean;
}

/**
 * Raadhavalhi home — TikTok/Reels-style vertical news scroll.
 * One story per screen, snap scrolling, multi-image AutoImageReel hero.
 */
export default function RaadhavalhiFeedScroll({
  items,
  narrateLang,
  onOpen,
  onSave,
  onOpenBrief,
  onOpenFilter,
  hasActiveFilters,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loadedDims, setLoadedDims] = useState<Record<string, { w: number; h: number }>>({});
  
  const [isReading, setIsReading] = useState(false);
  const [userMuted, setUserMuted] = useState(true);

  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentStepRef = useRef<"idle" | "title" | "pausing" | "summary">("idle");
  const activeIndexRef = useRef<number>(active);
  activeIndexRef.current = active;

  // Maintain a TTS instance
  const tts = useMemo(() => new RaadhavalhiTts(), []);

  useEffect(() => {
    tts.setVoice(narrateLang);
  }, [narrateLang, tts]);

  const startReadingSequence = (index: number) => {
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    tts.stop();

    if (userMuted || !items[index]) {
      currentStepRef.current = "idle";
      setIsReading(false);
      return;
    }

    const item = items[index];
    currentStepRef.current = "title";

    // Step 1: Read topic headline first
    tts.setCallbacks({
      onPlay: () => setIsReading(true),
      onPause: () => setIsReading(false),
      onError: () => setIsReading(false),
      onEnded: () => {
        if (currentStepRef.current === "title" && activeIndexRef.current === index) {
          currentStepRef.current = "pausing";
          setIsReading(true);

          // Pause for a short while (~2 seconds) before reading detailed summary
          pauseTimeoutRef.current = setTimeout(() => {
            if (activeIndexRef.current !== index) return;

            currentStepRef.current = "summary";
            const detailedText = item.summary && item.summary.trim()
              ? cleanTtsText(item.summary).replace(/\s+/g, " ").trim()
              : item.content
              ? cleanTtsText(item.content).replace(/\s+/g, " ").trim()
              : "";

            if (detailedText.trim()) {
              tts.setCallbacks({
                onPlay: () => setIsReading(true),
                onPause: () => setIsReading(false),
                onError: () => setIsReading(false),
                onEnded: () => {
                  if (currentStepRef.current === "summary" && activeIndexRef.current === index) {
                    currentStepRef.current = "idle";
                    setIsReading(false);

                    // Check if Auto-Scroll is enabled in settings
                    const isAutoScroll = localStorage.getItem("raadhavalhi_auto_scroll") === "true";
                    if (isAutoScroll) {
                      go(1);
                    }
                    // Else: pause and wait for user scroll
                  }
                },
              });
              tts.play(detailedText);
            } else {
              currentStepRef.current = "idle";
              setIsReading(false);
              const isAutoScroll = localStorage.getItem("raadhavalhi_auto_scroll") === "true";
              if (isAutoScroll) go(1);
            }
          }, 2000);
        }
      },
    });

    tts.play(item.title);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          const indexAttr = e.target.getAttribute("data-index");
          if (indexAttr !== null) {
            const idx = parseInt(indexAttr, 10);
            setActive(idx);
          }
        }
      }),
      { root: el, threshold: 0.6 }
    );
    Array.from(el.children).forEach((c) => {
      if (c.tagName === 'SECTION') io.observe(c);
    });
    return () => io.disconnect();
  }, [items.length]);

  const go = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const next = Math.min(items.length - 1, Math.max(0, active + dir));
    const targetSection = el.querySelector(`section[data-index="${next}"]`);
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === " ") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [active, items.length]);

  useEffect(() => {
    // When active index or mute state changes, trigger reading sequence
    startReadingSequence(active);

    return () => {
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
      tts.stop();
    };
  }, [active, userMuted, items, tts]);

  useEffect(() => {
    // Prefetch upcoming items in the background
    tts.prefetchItems(items, active);
  }, [active, items, tts]);

  const toggleMute = () => {
    const nextMute = !userMuted;
    setUserMuted(nextMute);
    if (nextMute) {
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
      tts.stop();
      setIsReading(false);
    } else {
      startReadingSequence(active);
    }
  };

  if (!items.length) return null;

  // Ken Burns-like class choice for single images (dimension aware).
  const kbClass = (item: FeedItem, i: number) => {
    const cover = item.imageUrl;
    if (!cover) return "";
    const d = loadedDims[cover];
    if (!d) return i % 2 === 0 ? "kb-zi" : "kb-zo";
    const r = d.w / d.h;
    if (r > 1.35) return "kb-px";
    if (r < 0.8) return "kb-py";
    return i % 2 === 0 ? "kb-zi" : "kb-zo";
  };

  return (
    <div
      ref={ref}
      className="h-[100dvh] w-full overflow-y-auto snap-y snap-mandatory scrollbar-none touch-pan-y bg-neutral-950 relative"
    >
      {items.map((item, index) => {
        const dir = textDirection(item.title);
        const isExpanded = expanded === index;
        const inlineImgs = extractImagesFromHtml(item.content || item.summary || "");
        const allImgsSet = new Set<string>();
        if (item.imageUrl) allImgsSet.add(item.imageUrl);
        if (item.images) item.images.forEach((img) => img && allImgsSet.add(img));
        inlineImgs.forEach((img) => img && allImgsSet.add(img));
        const reelImages = Array.from(allImgsSet);

        const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
          const el = e.currentTarget;
          if (el.naturalWidth && el.naturalHeight && item.imageUrl) {
            setLoadedDims((p) => ({ ...p, [item.imageUrl!]: { w: el.naturalWidth, h: el.naturalHeight } }));
          }
        };
        return (
          <section
            key={item.id}
            data-index={index}
            className="relative snap-start snap-always h-[100dvh] w-full shrink-0 flex flex-col justify-end p-4 sm:p-6 md:p-8 pb-6 md:pb-8 overflow-hidden"
          >
            {/* HERO: multi-image reel if >1 image, else single Ken Burns */}
            {reelImages.length > 1 ? (
              <AutoImageReel images={reelImages} className="z-0" />
            ) : item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt=""
                referrerPolicy="no-referrer"
                loading="lazy"
                onLoad={onImgLoad}
                className={`absolute inset-0 w-full h-full object-cover z-0 kb ${kbClass(item, index)}`}
              />
            ) : (
              <div className="absolute inset-0 z-0 bg-gradient-to-br from-amber-600/30 to-neutral-950" />
            )}

            <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/95 via-black/65 to-black/15" />

            {/* Action rail (Hidden when details are expanded) */}
            {!isExpanded && (
              <div className="absolute right-4 bottom-6 sm:bottom-8 z-30 flex flex-col gap-3">
                {/* Listen / TTS Button (icon only, directly above filter button) */}
                <button
                  onClick={toggleMute}
                  className={`w-11 h-11 rounded-none border-2 backdrop-blur flex items-center justify-center transition-all active:scale-95 ${
                    userMuted 
                      ? "bg-black/50 text-white/70 hover:bg-black/80 hover:text-white border-white/20" 
                      : "bg-amber-500 text-black border-amber-400 shadow-none"
                  }`}
                  title={userMuted ? "Listen to News" : "Mute Speech"}
                >
                  {userMuted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <div className="relative">
                      <Volume2 className="w-5 h-5 text-black" />
                      {isReading && (
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-none bg-black opacity-75"></span>
                          <span className="relative inline-flex rounded-none h-2.5 w-2.5 bg-black"></span>
                        </span>
                      )}
                    </div>
                  )}
                </button>

                {onOpenFilter && (
                  <button
                    onClick={onOpenFilter}
                    className={`w-11 h-11 rounded-none border-2 bg-black/50 backdrop-blur flex items-center justify-center transition-all active:scale-95 ${
                      hasActiveFilters
                        ? "bg-amber-500 text-black border-amber-400 font-bold shadow-none"
                        : "border-white/20 text-white hover:bg-black/70"
                    }`}
                    title="Filter & Sort News"
                  >
                    <SlidersHorizontal className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => onSave(item)}
                  className={`w-11 h-11 rounded-none border-2 border-white/20 bg-black/50 backdrop-blur flex items-center justify-center text-white active:scale-95 ${
                    item.saved ? "bg-amber-500 text-black border-amber-500" : ""
                  }`}
                  title="Save"
                >
                  {item.saved ? "★" : "☆"}
                </button>
                <button
                  onClick={onOpenBrief}
                  className="w-11 h-11 rounded-none border-2 border-amber-400 bg-amber-500 text-black flex items-center justify-center active:scale-95 shadow-none"
                  title="Daily Brief"
                >
                  ⚡
                </button>
              </div>
            )}

            <div
              className={`relative z-20 cursor-pointer text-white pb-2 sm:pb-4 transition-all duration-300 ${
                isExpanded ? "pr-0" : "pr-16"
              }`}
              onClick={() => setExpanded(isExpanded ? null : index)}
            >
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 text-white/80">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-extrabold">{item.subscriptionTitle}</span>
                  {item.saved && <span className="rounded-none border border-black/30 bg-amber-500 text-black px-1.5 py-0.5 text-[9px]">Saved</span>}
                </div>
                {isExpanded && (
                  <span className="text-amber-400 bg-black/60 border-2 border-amber-500/30 px-2 py-0.5 rounded-none text-[10px] font-mono">
                    ▲ Tap to collapse
                  </span>
                )}
              </div>
              <h2
                dir={dir}
                className={`text-xl md:text-3xl font-bold leading-tight mb-3 ${
                  isExpanded ? "" : "line-clamp-4"
                } ${dir === "rtl" ? "font-thaana" : ""}`}
              >
                {item.title}
              </h2>

              {isExpanded && (
                <div className="mt-3 border-t border-white/10 pt-3 max-h-[55vh] overflow-y-auto pr-1" onClick={(e) => e.stopPropagation()}>
                  {item.content ? (
                    <div
                      dir={dir}
                      className={`prose-reader text-base sm:text-lg md:text-xl leading-relaxed text-neutral-200 ${dir === "rtl" ? "font-thaana text-right" : ""}`}
                      dangerouslySetInnerHTML={{ __html: sanitize(item.content) }}
                    />
                  ) : (
                    <div dir={dir} className={`prose-reader text-base sm:text-lg md:text-xl leading-relaxed text-neutral-200 ${dir === "rtl" ? "font-thaana text-right" : ""}`} dangerouslySetInnerHTML={{ __html: sanitize(item.summary || "") }} />
                  )}
                </div>
              )}

              <div className="flex items-center gap-2.5 mt-3 text-[11px] font-mono text-white/80">
                <span className="font-bold bg-black/50 px-2 py-0.5 rounded-none border-2 border-white/15 shrink-0">{index + 1}/{items.length}</span>
                <span className="text-amber-300 font-medium truncate">
                  {new Date(item.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} • {new Date(item.publishedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
                <span className={`ml-auto ${isExpanded ? "rotate-180" : "animate-bounce"} shrink-0`}>▼</span>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

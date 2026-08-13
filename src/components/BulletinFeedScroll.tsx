import React, { useEffect, useRef, useState, useMemo } from "react";
import type { FeedItem } from "../lib/feedStorage";
import { textDirection } from "../lib/textDirection";
import { t, getLocale } from "../lib/i18n";
import AutoImageReel from "./AutoImageReel";
import NoImageArt from "./NoImageArt";
import { IconButton } from "./ui/IconButton";
import { BulletinTts } from "../lib/ttsPlayer";
import { Volume2, VolumeX, SlidersHorizontal } from "lucide-react";
import { cleanArticleHtml as sanitize, cleanTtsText, getDisplayHeadline, extractImagesFromHtml } from "../lib/feedSanitize";
import { getContentLocale } from "../lib/i18n";

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
 * Bulletin home — TikTok/Reels-style vertical news scroll.
 * One story per screen, snap scrolling, multi-image AutoImageReel hero.
 */
export default function BulletinFeedScroll({
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
  const [loadedImgs, setLoadedImgs] = useState<Set<string>>(new Set());
  
  const [isReading, setIsReading] = useState(false);
  const [userMuted, setUserMuted] = useState(true);

  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentStepRef = useRef<"idle" | "title" | "pausing" | "summary">("idle");
  const activeIndexRef = useRef<number>(active);
  activeIndexRef.current = active;

  // Maintain a TTS instance
  const tts = useMemo(() => new BulletinTts(), []);

  useEffect(() => {
    tts.setVoice(narrateLang);
  }, [narrateLang, tts]);

  const startReadingSequence = (index: number) => {
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    // Instantly kill any in-flight speech so scrolling switches articles with no overlap.
    try { window.speechSynthesis?.cancel(); } catch {}
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

          // Brief pause (~0.8s) before reading the full article body
          pauseTimeoutRef.current = setTimeout(() => {
            if (activeIndexRef.current !== index) return;

            currentStepRef.current = "summary";
            // Read the COMPLETE article (content) so the full news is narrated,
            // not just the truncated summary. Fall back to summary only if no content.
            const detailedText = item.content && item.content.trim()
              ? cleanTtsText(item.content).replace(/\s+/g, " ").trim()
              : item.summary && item.summary.trim()
              ? cleanTtsText(item.summary).replace(/\s+/g, " ").trim()
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
                    const isAutoScroll = localStorage.getItem("bulletin_auto_scroll") === "true";
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
              const isAutoScroll = localStorage.getItem("bulletin_auto_scroll") === "true";
              if (isAutoScroll) go(1);
            }
          }, 2000);
        }
      },
    });

    const headline =
      getContentLocale() === "dv"
        ? getDisplayHeadline(item.title, item.content || item.summary || "")
        : item.title;
    tts.play(headline);
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
        const displayHeadline =
          getContentLocale() === "dv"
            ? getDisplayHeadline(item.title, item.content || item.summary || "")
            : item.title;
        const dir = textDirection(displayHeadline);
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
          if (item.imageUrl) {
            setLoadedImgs((prev) => {
              if (prev.has(item.imageUrl!)) return prev;
              const n = new Set(prev);
              n.add(item.imageUrl!);
              return n;
            });
          }
        };
        const imgLoaded = item.imageUrl ? loadedImgs.has(item.imageUrl) : true;
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
              <>
                <img
                  src={item.imageUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  onLoad={onImgLoad}
                  className={`absolute inset-0 w-full h-full object-cover z-0 kb ${kbClass(item, index)} transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                />
                {!imgLoaded && (
                  <div className="absolute inset-0 z-0 bg-neutral-800 animate-pulse" aria-hidden>
                    <div className="absolute inset-0 bg-gradient-to-tr from-neutral-900/60 via-neutral-800/30 to-neutral-700/40" />
                  </div>
                )}
              </>
            ) : (
              <NoImageArt seed={item.id} />
            )}

            <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/95 via-black/65 to-black/15" />

            {/* Action rail (Hidden when details are expanded) */}
            {!isExpanded && (
              <div className="absolute right-4 bottom-24 md:bottom-8 z-30 flex flex-col gap-3">
                {/* Listen / TTS */}
                <IconButton
                  label={userMuted ? "Listen to News" : "Mute Speech"}
                  onClick={toggleMute}
                  className={`w-11 h-11 ${userMuted ? "bg-black/50 text-white/80 hover:bg-black/80" : "bg-amber-500 text-black border-amber-400"}`}
                >
                  {userMuted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <div className="relative">
                      <Volume2 className="w-5 h-5 text-black" />
                      {isReading && (
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full bg-black opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 bg-black" />
                        </span>
                      )}
                    </div>
                  )}
                </IconButton>

                {onOpenFilter && (
                  <IconButton
                    label="Filter & Sort News"
                    onClick={onOpenFilter}
                    className={`w-11 h-11 ${hasActiveFilters ? "bg-amber-500 text-black border-amber-400" : "bg-black/50 text-white hover:bg-black/70"}`}
                  >
                    <SlidersHorizontal className="w-5 h-5" />
                  </IconButton>
                )}
                <IconButton
                  label="Save"
                  onClick={() => onSave(item)}
                  className={`w-11 h-11 ${item.saved ? "bg-amber-500 text-black border-amber-500" : "bg-black/50 text-white hover:bg-black/70"}`}
                >
                  {item.saved ? "★" : "☆"}
                </IconButton>
                <IconButton
                  label="Daily Brief"
                  onClick={onOpenBrief}
                  className="w-11 h-11 bg-amber-500 text-black border-amber-400"
                >
                  ⚡
                </IconButton>
              </div>
            )}

            <div
              className={`relative z-20 cursor-pointer text-white pb-2 sm:pb-4 transition-all duration-300 ${
                isExpanded ? "pr-0" : "pr-16"
              }`}
              onClick={() => setExpanded(isExpanded ? null : index)}
            >
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2 text-white/80">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-none border-2 border-amber-400 bg-amber-500 text-black px-2 py-0.5 font-extrabold tracking-wider">{item.subscriptionTitle}</span>
                  {item.saved && <span className="rounded-none border border-black/30 bg-white/90 text-black px-1.5 py-0.5 text-[9px]">Saved</span>}
                </div>
                {isExpanded && (
                  <span className="text-amber-400 bg-black/60 border-2 border-amber-500/30 px-2 py-0.5 rounded-none text-[10px] font-mono">
                    ▲ Tap to collapse
                  </span>
                )}
              </div>
              <h2
                dir={dir}
                className={`text-2xl sm:text-4xl md:text-5xl font-extrabold leading-[1.05] tracking-tight mb-3 font-display ${dir === "rtl" ? "font-thaana-title" : ""} ${isExpanded ? "" : "line-clamp-4"}`}
              >
                {displayHeadline}
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

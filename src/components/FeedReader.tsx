import React, { useEffect, useRef, useState } from "react";
import type { FeedItem } from "../lib/feedStorage";
import { textDirection } from "../lib/textDirection";
import { BulletinTts } from "../lib/ttsPlayer";
import { t, getContentLocale } from "../lib/i18n";
import { createPortal } from "react-dom";
import { cleanArticleHtml, cleanTtsText, getDisplayHeadline } from "../lib/feedSanitize";

interface Props {
  item: FeedItem | null;
  narrateLang: string;
  onClose: () => void;
}

export default function FeedReader({ item, narrateLang, onClose }: Props) {
  const ttsRef = useRef<BulletinTts | null>(null);
  const [playing, setPlaying] = useState(false);
  const [subtitle, setSubtitle] = useState("");

  useEffect(() => {
    // Close on Escape for desktop popup ergonomics.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      ttsRef.current?.stop();
    };
  }, [onClose]);

  if (!item) return null;
  const contentLocale = getContentLocale();
  // When reading Dhivehi news, derive the headline + direction from the Thaana
  // article body (the real headline) instead of the Latin `<title>` that RSS
  // feeds store for SEO. This is what was leaving the headline in English.
  const displayHeadline =
    contentLocale === "dv" ? getDisplayHeadline(item.title, item.content || item.summary || "") : item.title;
  const dir = textDirection(displayHeadline);

  // The reader container goes RTL + Thaana font ONLY for Dhivehi articles,
  // never for the English UI shell.
  const isRtl = contentLocale === "dv";

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

  const sanitizeAndCleanHtml = (html: string): string => {
    return cleanArticleHtml(html);
  };

  const toggleListen = () => {
    const tts = ensureTts();
    if (playing) {
      tts.stop();
      setPlaying(false);
      return;
    }
    const fullText = item!.content ? cleanTtsText(item!.content) : item!.summary ? cleanTtsText(item!.summary) : "";
    // Use the Thaana headline (not the Latin RSS title) as the intro for TTS.
    const headlineText = contentLocale === "dv" ? displayHeadline : item!.title;
    const text = `${headlineText}. ${fullText}`;
    tts.setVoice(narrateLang, "", 1, 1);
    tts.play(text);
    setPlaying(true);
  };

  const publishedLabel = item.publishedAt
    ? new Date(item.publishedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return createPortal(
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={`fixed inset-0 z-[9999] flex md:items-center md:justify-center ${isRtl ? "font-thaana" : ""}`}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop — dims the app behind the popup (desktop). On mobile the sheet
          is full-bleed so the backdrop just reads as a solid scrim. */}
      <div
        className="absolute inset-0 bg-black/70 md:bg-black/60 animate-fade-in"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet: fullscreen on mobile, centered popup on desktop. */}
      <div
        className="relative w-full h-full md:h-auto md:max-h-[92vh] md:max-w-3xl md:my-auto bg-paper dark:bg-surface-card md:border-2 md:border-ink md:shadow-[var(--shadow-hard)] flex flex-col overflow-hidden"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 p-3 sm:p-4 border-b-2 border-ink/15 dark:border-white/20 bg-paper dark:bg-surface-card shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-none border-2 border-ink/30 dark:border-white/30 bg-paper dark:bg-black/20 text-xs font-bold text-ink dark:text-white hover:bg-amber/15 dark:hover:bg-white/10"
          >
            {t("reader.back")}
          </button>
          <span className="text-[10px] font-bold uppercase tracking-widest truncate max-w-[50%] text-ink-soft dark:text-neutral-400">
            {item.subscriptionTitle}
          </span>
          <button
            onClick={toggleListen}
            className="px-3 py-1.5 rounded-none border-2 border-ink dark:border-neutral-200 bg-amber text-ink text-xs font-bold hover:bg-amber-deep shrink-0"
          >
            {playing ? `⏸ ${t("reader.stop")}` : `▶ ${t("reader.listen")}`}
          </button>
        </div>

        {/* Scroll body */}
        <div className="flex-1 overflow-y-auto">
          <article className="max-w-2xl mx-auto px-5 py-6 sm:py-8">
            {/* Byline */}
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-amber-800 dark:text-amber-400 mb-3">
              <span>{item.subscriptionTitle}</span>
              {publishedLabel && <span className="text-ink-soft dark:text-neutral-500">· {publishedLabel}</span>}
            </div>

            <h1
              dir={dir}
              className={`font-serif font-black text-3xl sm:text-4xl leading-tight mb-5 text-ink dark:text-white ${dir === "rtl" ? "font-thaana-title text-right" : ""}`}
            >
              {displayHeadline}
            </h1>

            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-56 sm:h-72 object-cover border-2 border-ink dark:border-white/20 mb-6 grayscale contrast-110"
              />
            )}

            {item.content ? (
              <div
                dir={dir}
                className={`prose-reader magazine-body ${dir === "rtl" ? "font-thaana text-right" : ""}`}
                dangerouslySetInnerHTML={{ __html: sanitizeAndCleanHtml(item.content) }}
              />
            ) : (
              <div
                dir={textDirection(item.summary || "")}
                className={`prose-reader magazine-body ${textDirection(item.summary || "") === "rtl" ? "font-thaana text-right" : ""}`}
                dangerouslySetInnerHTML={{ __html: sanitizeAndCleanHtml(item.summary || "") }}
              />
            )}
          </article>
        </div>

        {playing && (
          <div className="p-4 border-t-2 border-ink/15 dark:border-white/20 text-center text-sm italic bg-amber/10 dark:bg-amber-950/30 text-ink dark:text-white shrink-0">
            {subtitle || "…"}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

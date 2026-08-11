import React, { useEffect, useRef, useState } from "react";
import type { FeedItem } from "../lib/feedStorage";
import { textDirection } from "../lib/textDirection";
import { RaadhavalhiTts } from "../lib/ttsPlayer";
import { t, getLocale } from "../lib/i18n";
import { createPortal } from "react-dom";
import { cleanArticleHtml, cleanTtsText } from "../lib/feedSanitize";

interface Props {
  item: FeedItem | null;
  narrateLang: string;
  onClose: () => void;
}

export default function FeedReader({ item, narrateLang, onClose }: Props) {
  const ttsRef = useRef<RaadhavalhiTts | null>(null);
  const [playing, setPlaying] = useState(false);
  const [subtitle, setSubtitle] = useState("");

  useEffect(() => {
    return () => {
      ttsRef.current?.stop();
    };
  }, []);

  if (!item) return null;
  const dir = textDirection(item.title);
  const locale = getLocale();

  const ensureTts = () => {
    if (!ttsRef.current) {
      ttsRef.current = new RaadhavalhiTts({
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
    const text = `${item!.title}. ${fullText}`;
    tts.setVoice(narrateLang, "", 1, 1);
    tts.play(text);
    setPlaying(true);
  };

  const isRtl = locale === "dv";

  return createPortal(
    <div dir={isRtl ? "rtl" : "ltr"} className={`fixed inset-0 z-[9999] bg-neutral-50 text-neutral-900 flex flex-col dark:bg-neutral-950 dark:text-white ${isRtl ? "font-thaana" : ""}`} style={{ height: "100dvh" }}>
      <div className="flex items-center justify-between p-4 border-b border-black/10 dark:border-white/10">
        <button onClick={onClose} className="px-3 py-1.5 rounded-none border-2 border-neutral-950 dark:border-neutral-200 bg-black/5 dark:bg-white/10 text-xs font-bold">{t("reader.back")}</button>
        <span className="text-[10px] font-bold uppercase tracking-widest truncate max-w-[50%]">{item.subscriptionTitle}</span>
        <div className="flex gap-2">
          <button onClick={toggleListen} className="px-3 py-1.5 rounded-none border-2 border-neutral-950 dark:border-neutral-200 bg-amber-500 text-black text-xs font-bold">
            {playing ? `⏸ ${t("reader.stop")}` : `▶ ${t("reader.listen")}`}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 max-w-2xl mx-auto w-full">
        <h1 dir={dir} className={`text-2xl font-bold leading-tight mb-4 ${dir === "rtl" ? "font-thaana" : ""}`}>{item.title}</h1>

        {item.imageUrl && (
          <img src={item.imageUrl} alt="" referrerPolicy="no-referrer" className="w-full rounded-none border-2 border-neutral-950 dark:border-neutral-700 mb-4 object-cover" />
        )}

        {item.content ? (
          <div
            dir={dir}
            className={`prose-reader text-lg sm:text-xl md:text-2xl leading-relaxed ${dir === "rtl" ? "font-thaana text-right" : ""}`}
            dangerouslySetInnerHTML={{ __html: sanitizeAndCleanHtml(item.content) }}
          />
        ) : (
          <div
            dir={textDirection(item.summary || "")}
            className={`prose-reader text-lg sm:text-xl md:text-2xl leading-relaxed ${textDirection(item.summary || "") === "rtl" ? "font-thaana text-right" : ""}`}
            dangerouslySetInnerHTML={{ __html: sanitizeAndCleanHtml(item.summary || "") }}
          />
        )}

        <a href={item.link} target="_blank" rel="noopener noreferrer" className="mt-6 inline-block text-amber-600 dark:text-amber-400 underline font-bold">
          {t("reader.open")} →
        </a>
      </div>

      {playing && (
        <div className="p-4 border-t border-black/10 dark:border-white/10 text-center text-sm italic bg-amber-50 dark:bg-amber-950/30">
          {subtitle || "…"}
        </div>
      )}
    </div>,
    document.body
  );
}

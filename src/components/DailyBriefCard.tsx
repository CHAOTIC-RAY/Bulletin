import React, { useEffect, useMemo, useRef, useState } from "react";
import type { FeedItem } from "../lib/feedStorage";
import { buildDailyBrief, type BriefArticleInput, type GeneratedDailyBrief } from "../lib/generateNewsBrief";
import { RaadhavalhiTts } from "../lib/ttsPlayer";
import { t, getLocale } from "../lib/i18n";
import { createPortal } from "react-dom";
import { ArrowLeft, Volume2, VolumeX, Sparkles } from "lucide-react";

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

async function fetchGroqBrief(articles: BriefArticleInput[]): Promise<{ brief: GeneratedDailyBrief; source: string }> {
  try {
    const res = await fetch("/api/brief/groq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articles }),
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
    return items
      .filter((i) => dayKey(i.publishedAt) === dayKey(today))
      .slice(0, 24)
      .map((i) => ({ id: i.id, source: i.subscriptionTitle, title: i.title, summary: i.summary, link: i.link }));
  }, [items]);

  useEffect(() => {
    let alive = true;
    if (articles.length < 2) {
      setBrief(null);
      return;
    }
    fetchGroqBrief(articles).then(({ brief, source }) => {
      if (alive) {
        setBrief(brief);
        setBriefSource(source);
      }
    });
    return () => {
      alive = false;
    };
  }, [articles]);

  const ttsRef = useRef<RaadhavalhiTts | null>(null);
  const [playing, setPlaying] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const [subtitle, setSubtitle] = useState("");

  const isModalOpen = Boolean(isOpen ?? internalOpen);

  const handleClose = () => {
    setInternalOpen(false);
    onClose?.();
  };

  if (!brief) return null;
  const storyCount = brief.sections.reduce((a, s) => a + s.items.length, 0);

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

  const isRtl = locale === "dv";

  const overlay = isModalOpen
    ? createPortal(
        <div dir={isRtl ? "rtl" : "ltr"} className={`fixed inset-0 z-[9999] bg-neutral-950 text-white flex flex-col ${isRtl ? "font-thaana text-right" : ""}`} style={{ height: "100dvh" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-neutral-900/80 backdrop-blur-md">
            <button
              onClick={handleClose}
              className="p-2 rounded-none border-2 border-white/20 bg-white/10 text-white transition-colors flex items-center justify-center"
              title="Close Brief"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">⚡ {t("brief.title")}{briefSource === "groq" && <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-amber-300 border border-amber-500/40 px-1 align-middle"><Sparkles className="w-3 h-3" />AI</span>}</span>
            <button
              onClick={toggleListen}
              className={`px-4 py-2 rounded-none border-2 border-neutral-950 dark:border-neutral-200 text-xs font-extrabold flex items-center gap-1.5 transition-colors ${
                playing ? "bg-red-500 text-white" : "bg-amber-500 hover:bg-amber-400 text-black"
              }`}
            >
              {playing ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{playing ? t("brief.stop") : t("brief.listen")}</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 md:p-8 max-w-3xl mx-auto w-full space-y-6 scrollbar-none">
            <div className="p-4 rounded-none bg-amber-500/10 border-2 border-amber-500/30 text-amber-200">
              <p className="text-sm font-semibold leading-relaxed">{brief.lead}</p>
            </div>
            {brief.sections.map((s) => (
              <section key={s.source} className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-amber-400">{s.source}</h3>
                  <span className="text-[10px] font-mono text-neutral-400">{s.items.length} stories</span>
                </div>
                <p className="text-xs text-neutral-400 italic">{s.intro}</p>
                <ul className="space-y-3">
                  {s.items.map((it) => (
                    <li key={it.id} className="border-2 border-white/15 bg-neutral-900/60 rounded-none p-4 space-y-1 hover:border-amber-500/40 transition-colors">
                      <p className="font-bold text-sm text-white leading-snug">{it.headline}</p>
                      <p className="text-xs text-neutral-300 leading-relaxed">{it.detail}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {playing && (
            <div className="p-4 border-t border-white/10 bg-neutral-900/90 text-center text-xs font-mono text-amber-300 italic">
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

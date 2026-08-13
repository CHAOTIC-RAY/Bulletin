import React, { useState, useMemo, useRef, useEffect } from "react";
import { LocaleCode, getLocale, t } from "../lib/i18n";
import TtsSettings from "./TtsSettings";
import SourcesPanel from "./SourcesPanel";
import BriefSettingsPanel from "./BriefSettingsPanel";
import WeatherSettingsPanel from "./WeatherSettingsPanel";
import { BulletinTts } from "../lib/ttsPlayer";
import LoadingPile from "./LoadingPile";
import {
  Mic,
  Globe,
  Sliders,
  ArrowLeft,
  Newspaper,
  BookOpen,
  Check,
  ChevronRight,
  Sparkles,
  CloudSun,
  ChevronDown,
  Info,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Palette,
  Volume2,
  VolumeX
} from "lucide-react";
import type { FeedItem } from "../lib/feedStorage";
import { getBriefSettings, getFeedSubscriptions } from "../lib/feedStorage";
import { getWeatherCountryInfo, getWeatherCountry } from "../lib/weatherCountries";

interface Props {
  onDone: (uiLocale: LocaleCode, narrateLang: string) => void;
  items?: FeedItem[];
}

export default function LanguageSetup({ onDone, items = [] }: Props) {
  const [uiLocale, setUiLocale] = useState<LocaleCode>(getLocale());
  const [narrateLang, setNarrateLang] = useState("en-US");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("bulletin_theme") as "light" | "dark") || "dark";
  });

  // First-run welcome: chosen default reading mode (persisted so the app opens there).
  const [defaultView, setDefaultView] = useState<"immersive" | "magazine">(
    () => (localStorage.getItem("bulletin_default_view") as "immersive" | "magazine") || "immersive"
  );

  // Live TTS sample using the real BulletinTts engine.
  const sampleRef = useRef<BulletinTts | null>(null);
  const [samplePlaying, setSamplePlaying] = useState(false);
  const playSample = () => {
    if (!sampleRef.current) {
      sampleRef.current = new BulletinTts({
        onEnded: () => setSamplePlaying(false),
        onError: () => setSamplePlaying(false),
      });
    }
    const tts = sampleRef.current;
    if (samplePlaying) {
      tts.stop();
      setSamplePlaying(false);
      return;
    }
    setSamplePlaying(true);
    void tts.play(
      "Bulletin brings you the day's stories, read aloud the moment you open them."
    );
  };
  useEffect(() => () => sampleRef.current?.stop(), []);

  // Keep track of which accordion categories are expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    tts: true,
    language: false,
    appearance: false,
    sources: false,
    brief: false,
    weather: false,
  });

  const toggleSection = (key: string) => {
    setExpanded((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const expandAll = () => {
    setExpanded({
      tts: true,
      language: true,
      appearance: true,
      sources: true,
      brief: true,
      weather: true,
    });
  };

  const collapseAll = () => {
    setExpanded({
      tts: false,
      language: false,
      appearance: false,
      sources: false,
      brief: false,
      weather: false,
    });
  };

  const handleSelectTheme = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    localStorage.setItem("bulletin_theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleComplete = () => {
    localStorage.setItem("bulletin_default_view", defaultView);
    onDone(uiLocale, narrateLang);
  };

  // Dynamically calculate brief selections & active configurations for the summary board
  const activeSubsCount = useMemo(() => {
    const subs = getFeedSubscriptions();
    return subs.filter((s) => s.enabled).length;
  }, []);

  const weatherInfo = useMemo(() => {
    const currentCode = getWeatherCountry();
    return getWeatherCountryInfo(currentCode);
  }, []);

  const briefSettings = useMemo(() => {
    return getBriefSettings();
  }, []);

  const activeTtsEngine = useMemo(() => {
    return localStorage.getItem("bulletin_tts_engine") || "webspeech";
  }, []);

  const isRtl = false; // UI is always English/LTR — Dhivehi is content-only

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-[100dvh] bg-[#f5f1e6] dark:bg-[#12110e] text-neutral-900 dark:text-neutral-100 flex flex-col font-sans relative"
    >
      {/* Newspaper Grain Texture */}
      <div className="absolute inset-0 bg-noise pointer-events-none opacity-[0.03] dark:opacity-[0.02] z-40" />

      {/* ── Welcome hero (first-run) ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 pt-10 pb-6 text-center">
        <div className="mx-auto mb-4 w-20 h-24 flex items-center justify-center">
          <svg viewBox="0 0 194.16 232.77" className="w-14 h-16 text-amber drop-shadow-[3px_3px_0_rgba(0,0,0,0.85)] dark:drop-shadow-[3px_3px_0_rgba(255,255,255,0.2)]">
            <path fill="currentColor" d="M194.16,54.97l-6.1,32.94-27.9,24.53,33.82,28.24.03,61.02-33.94,31-141.93.06,36.14-31.52-54.28-.27V.32s130.88-.14,130.88-.14l-.02,31.91-96.06.02.13,141.1L173.69,55.24l-33.37-.25.34-54.99,53.5,54.97ZM159.38,200.81l-.08-87.68-103.43,87.66,103.51.03Z" />
          </svg>
        </div>
        <h1 className="font-serif font-black text-4xl sm:text-5xl tracking-tight text-neutral-950 dark:text-white">Bulletin</h1>
        <p className="mt-2 text-sm sm:text-base text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
          Your day, bound like a newspaper. Pick how you'd like to read, then fine-tune your paper below.
        </p>

        {/* Reading-mode chooser */}
        <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
          <button
            onClick={() => setDefaultView("immersive")}
            aria-pressed={defaultView === "immersive"}
            className={`group relative border-2 rounded-none p-5 transition-all duration-150 ${
              defaultView === "immersive"
                ? "bg-amber-500 text-black border-neutral-950 shadow-[4px_4px_0px_rgba(0,0,0,0.9)]"
                : "bg-[#faf6ec] dark:bg-[#1a1815] border-neutral-950/20 dark:border-white/15 hover:border-amber-500"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Newspaper className="w-5 h-5" />
              <span className="font-serif font-black text-lg">Immersive</span>
            </div>
            <p className={`text-xs ${defaultView === "immersive" ? "text-black/80" : "text-neutral-500 dark:text-neutral-400"}`}>
              One full-screen story at a time with cinematic imagery. Swipe to read.
            </p>
            {defaultView === "immersive" && (
              <span className="absolute top-3 right-3 text-xs font-black">✓</span>
            )}
          </button>

          <button
            onClick={() => setDefaultView("magazine")}
            aria-pressed={defaultView === "magazine"}
            className={`group relative border-2 rounded-none p-5 transition-all duration-150 ${
              defaultView === "magazine"
                ? "bg-amber-500 text-black border-neutral-950 shadow-[4px_4px_0px_rgba(0,0,0,0.9)]"
                : "bg-[#faf6ec] dark:bg-[#1a1815] border-neutral-950/20 dark:border-white/15 hover:border-amber-500"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-5 h-5" />
              <span className="font-serif font-black text-lg">Magazine</span>
            </div>
            <p className={`text-xs ${defaultView === "magazine" ? "text-black/80" : "text-neutral-500 dark:text-neutral-400"}`}>
              A sectioned front page — headlines, grids and the Daily Paper at a glance.
            </p>
            {defaultView === "magazine" && (
              <span className="absolute top-3 right-3 text-xs font-black">✓</span>
            )}
          </button>
        </div>

        {/* Live TTS sample */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={playSample}
            className="inline-flex items-center gap-2 px-4 py-2 border-2 border-neutral-950 dark:border-white/30 rounded-none bg-white dark:bg-[#1a1815] text-neutral-950 dark:text-white font-bold text-sm hover:bg-amber-500 hover:text-black transition-colors"
          >
            {samplePlaying ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            {samplePlaying ? "Stop sample" : "Hear a sample"}
          </button>
          <span className="text-xs text-neutral-400">Listen in your voice of choice</span>
        </div>
      </section>

      {/* Top Sticky Header */}
      <div className="sticky top-0 z-50 bg-[#f5f1e6]/95 dark:bg-[#12110e]/95 backdrop-blur-md border-b-2 border-neutral-950 dark:border-neutral-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleComplete}
            className="p-2 rounded-none border-2 border-neutral-950 dark:border-neutral-700 bg-white dark:bg-[#1a1815] text-neutral-950 dark:text-white hover:bg-neutral-100 active:scale-95 transition-all flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_rgba(255,255,255,0.15)]"
            title="Back to news"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-serif font-black tracking-tight text-neutral-950 dark:text-white leading-none">
              Daily Paper Configuration
            </h1>
            <p className="text-[10px] font-mono uppercase tracking-wider text-amber-800 dark:text-amber-400 mt-1">
              Editorial Register & Custom Settings
            </p>
          </div>
        </div>

        <button
          onClick={handleComplete}
          className="px-5 py-2 rounded-none border-2 border-neutral-950 bg-amber-500 hover:bg-amber-400 text-black font-serif font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
        >
          Publish & Apply
        </button>
      </div>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Desktop Ledger Info Board / Sidebar (Hidden on mobile, beautiful on desktop) */}
        <div className="lg:col-span-4 hidden lg:block sticky top-20 space-y-6">
          <div className="bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] space-y-6">
            {/* Retro woodblock seal */}
            <div className="border border-dashed border-neutral-950/20 dark:border-white/10 p-4 text-center relative overflow-hidden">
              <span className="text-[9px] font-mono tracking-widest text-amber-800 dark:text-amber-400 block mb-1">
                ★★★ OFFICIAL REGISTRAR ★★★
              </span>
              <h2 className="font-serif font-black text-xl text-neutral-950 dark:text-white leading-tight">
                THE LEDGER
              </h2>
              <div className="w-12 h-[1px] bg-neutral-950/20 dark:bg-white/10 mx-auto my-2" />
              <p className="text-xs text-neutral-600 dark:text-neutral-400 italic">
                “Veritas et Claritas”
              </p>
            </div>

            {/* Quick Status Stats */}
            <div className="space-y-3.5 pt-2">
              <h3 className="text-xs font-mono uppercase tracking-widest font-black text-neutral-400 pb-1 border-b border-neutral-950/10 dark:border-white/10">
                ACTIVE PROFILE
              </h3>

              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500 font-medium">App Language</span>
                <span className="font-serif font-black bg-neutral-950/5 dark:bg-white/5 border border-neutral-950/10 dark:border-white/10 px-2 py-0.5 text-neutral-950 dark:text-white">
                  {uiLocale === "dv" ? "ދިވެހި" : "English (LTR)"}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500 font-medium">TTS Voice Engine</span>
                <span className="font-mono uppercase text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-400 px-2 py-0.5 font-bold">
                  {activeTtsEngine}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500 font-medium">Subscribed Feeds</span>
                <span className="font-mono text-[10px] bg-neutral-950/5 dark:bg-white/5 border border-neutral-950/10 dark:border-white/10 px-2 py-0.5 font-black">
                  {activeSubsCount} sources
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500 font-medium">Weather Target</span>
                <span className="font-serif font-black text-amber-800 dark:text-amber-400">
                  {weatherInfo.flag} {weatherInfo.name}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500 font-medium">AI Brief Polishing</span>
                <span className="font-mono text-[10px] font-bold">
                  {briefSettings.useAi ? (
                    <span className="text-green-600 dark:text-green-400">ON</span>
                  ) : (
                    <span className="text-neutral-400">OFF (FALLBACK)</span>
                  )}
                </span>
              </div>
            </div>

            <div className="border-t border-dashed border-neutral-950/20 dark:border-white/10 pt-4 space-y-2">
              <span className="text-[10px] font-mono text-neutral-500 block">
                Quick commands:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={expandAll}
                  className="w-full text-center py-1.5 border-2 border-neutral-950 text-[10px] font-mono font-bold bg-white text-black hover:bg-neutral-50 active:translate-y-0.5 active:shadow-none shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                >
                  EXPAND ALL
                </button>
                <button
                  onClick={collapseAll}
                  className="w-full text-center py-1.5 border-2 border-neutral-950 text-[10px] font-mono font-bold bg-white text-black hover:bg-neutral-50 active:translate-y-0.5 active:shadow-none shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                >
                  COLLAPSE ALL
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Collapsible categories (Full width on mobile, 8-cols on desktop) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Mobile quick controls */}
          <div className="lg:hidden flex items-center justify-between px-1 text-xs">
            <span className="text-neutral-500 font-mono font-bold uppercase">
              Configure Settings
            </span>
            <div className="flex items-center gap-2 font-mono">
              <button
                onClick={expandAll}
                className="text-amber-800 dark:text-amber-400 font-bold hover:underline"
              >
                Expand All
              </button>
              <span className="text-neutral-300">•</span>
              <button
                onClick={collapseAll}
                className="text-amber-800 dark:text-amber-400 font-bold hover:underline"
              >
                Collapse All
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* 1. Voice & TTS */}
            <div className="bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] rounded-none overflow-hidden">
              <button
                onClick={() => toggleSection("tts")}
                className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-neutral-950/5 dark:hover:bg-white/5 transition-all border-b-2 border-neutral-950 dark:border-neutral-700"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-none border-2 border-neutral-950 dark:border-neutral-700 bg-[#f5f1e6] dark:bg-[#201e1a] text-neutral-950 dark:text-white flex items-center justify-center shrink-0 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm md:text-base font-serif font-black text-neutral-950 dark:text-white flex items-center gap-2">
                      Voice & Narration Speed
                    </h3>
                    <p className="text-[11px] text-neutral-500 truncate">
                      Select speech engine, voice genders, rate & pitch
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden sm:inline-block text-[10px] font-mono bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-400 px-2 py-0.5 font-bold">
                    {activeTtsEngine.toUpperCase()}
                  </span>
                  {expanded.tts ? (
                    <ChevronDown className="w-5 h-5 text-neutral-950 dark:text-white rotate-180 transition-transform duration-300" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-neutral-500 transition-transform duration-300" />
                  )}
                </div>
              </button>

              {expanded.tts && (
                <div className="p-4 md:p-6 bg-[#faf6ec] dark:bg-[#1a1815]">
                  <TtsSettings />
                </div>
              )}
            </div>

            {/* 2. App Language */}
            <div className="bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] rounded-none overflow-hidden">
              <button
                onClick={() => toggleSection("language")}
                className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-neutral-950/5 dark:hover:bg-white/5 transition-all border-b-2 border-neutral-950 dark:border-neutral-700"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-none border-2 border-neutral-950 dark:border-neutral-700 bg-[#f5f1e6] dark:bg-[#201e1a] text-neutral-950 dark:text-white flex items-center justify-center shrink-0 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm md:text-base font-serif font-black text-neutral-950 dark:text-white">
                      App Interface Language
                    </h3>
                    <p className="text-[11px] text-neutral-500 truncate">
                      Select your preferred language for labels and menu settings
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden sm:inline-block text-[10px] font-mono bg-neutral-950/5 dark:bg-white/5 border border-neutral-950/10 dark:border-white/10 px-2 py-0.5 font-black">
                    {uiLocale === "dv" ? "ދިވެހި" : "ENGLISH"}
                  </span>
                  {expanded.language ? (
                    <ChevronDown className="w-5 h-5 text-neutral-950 dark:text-white rotate-180 transition-transform duration-300" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-neutral-500 transition-transform duration-300" />
                  )}
                </div>
              </button>

              {expanded.language && (
                <div className="p-4 md:p-6 space-y-4 bg-[#faf6ec] dark:bg-[#1a1815]">
                  <div className="space-y-1">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">
                      App Interface Language
                    </h2>
                    <p className="text-xs text-neutral-500 px-1">
                      Select your preferred language for buttons, titles, and system labels.
                    </p>
                  </div>

                  <div className="rounded-none bg-[#f2eee3] dark:bg-[#131210] border-2 border-neutral-950 dark:border-neutral-700 overflow-hidden divide-y divide-neutral-950/10 dark:divide-white/10">
                    <button
                      onClick={() => setUiLocale("en")}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-950/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🇬🇧</span>
                        <div>
                          <div className="text-sm font-bold text-neutral-950 dark:text-white">English</div>
                          <div className="text-xs text-neutral-500">Left-to-Right (LTR) Layout</div>
                        </div>
                      </div>
                      {uiLocale === "en" ? (
                        <div className="w-6 h-6 rounded-none border border-black/30 bg-amber-500 text-black flex items-center justify-center font-bold">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-none border-2 border-neutral-950/20 dark:border-white/20" />
                      )}
                    </button>

                    <button
                      onClick={() => setUiLocale("dv")}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-950/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🇲🇻</span>
                        <div>
                          <div className="text-sm font-bold text-neutral-950 dark:text-white font-thaana">ދިވެހި (Dhivehi)</div>
                          <div className="text-xs text-neutral-500">Right-to-Left (RTL / Dhivehi Content Layout)</div>
                        </div>
                      </div>
                      {uiLocale === "dv" ? (
                        <div className="w-6 h-6 rounded-none border border-black/30 bg-amber-500 text-black flex items-center justify-center font-bold">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-none border-2 border-neutral-950/20 dark:border-white/20" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. App Appearance */}
            <div className="bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] rounded-none overflow-hidden">
              <button
                onClick={() => toggleSection("appearance")}
                className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-neutral-950/5 dark:hover:bg-white/5 transition-all border-b-2 border-neutral-950 dark:border-neutral-700"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-none border-2 border-neutral-950 dark:border-neutral-700 bg-[#f5f1e6] dark:bg-[#201e1a] text-neutral-950 dark:text-white flex items-center justify-center shrink-0 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                    <Palette className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm md:text-base font-serif font-black text-neutral-950 dark:text-white">
                      App Appearance
                    </h3>
                    <p className="text-[11px] text-neutral-500 truncate">
                      Switch between Light Mode and Dark Mode styling
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden sm:inline-block text-[10px] font-mono bg-neutral-950/5 dark:bg-white/5 border border-neutral-950/10 dark:border-white/10 px-2 py-0.5 font-black uppercase">
                    {theme === "dark" ? "DARK MODE" : "LIGHT MODE"}
                  </span>
                  {expanded.appearance ? (
                    <ChevronDown className="w-5 h-5 text-neutral-950 dark:text-white rotate-180 transition-transform duration-300" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-neutral-500 transition-transform duration-300" />
                  )}
                </div>
              </button>

              {expanded.appearance && (
                <div className="p-4 md:p-6 space-y-4 bg-[#faf6ec] dark:bg-[#1a1815]">
                  <div className="space-y-1">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">
                      Select Theme
                    </h2>
                    <p className="text-xs text-neutral-500 px-1">
                      Choose between a high-contrast dark aesthetic or a clean light paper layout.
                    </p>
                  </div>

                  <div className="rounded-none bg-[#f2eee3] dark:bg-[#131210] border-2 border-neutral-950 dark:border-neutral-700 overflow-hidden divide-y divide-neutral-950/10 dark:divide-white/10">
                    {/* Light Mode Button */}
                    <button
                      onClick={() => handleSelectTheme("light")}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-950/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">☀️</span>
                        <div>
                          <div className="text-sm font-bold text-neutral-950 dark:text-white">Light Mode</div>
                          <div className="text-xs text-neutral-500">Elegant, clean newspaper style layout</div>
                        </div>
                      </div>
                      {theme === "light" ? (
                        <div className="w-6 h-6 rounded-none border border-black/30 bg-amber-500 text-black flex items-center justify-center font-bold">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-none border-2 border-neutral-950/20 dark:border-white/20" />
                      )}
                    </button>

                    {/* Dark Mode Button */}
                    <button
                      onClick={() => handleSelectTheme("dark")}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-950/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🌙</span>
                        <div>
                          <div className="text-sm font-bold text-neutral-950 dark:text-white">Dark Mode</div>
                          <div className="text-xs text-neutral-500">High-contrast, eye-friendly ambient layout</div>
                        </div>
                      </div>
                      {theme === "dark" ? (
                        <div className="w-6 h-6 rounded-none border border-black/30 bg-amber-500 text-black flex items-center justify-center font-bold">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-none border-2 border-neutral-950/20 dark:border-white/20" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 4. News Sources */}
            <div className="bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] rounded-none overflow-hidden">
              <button
                onClick={() => toggleSection("sources")}
                className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-neutral-950/5 dark:hover:bg-white/5 transition-all border-b-2 border-neutral-950 dark:border-neutral-700"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-none border-2 border-neutral-950 dark:border-neutral-700 bg-[#f5f1e6] dark:bg-[#201e1a] text-neutral-950 dark:text-white flex items-center justify-center shrink-0 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                    <Newspaper className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm md:text-base font-serif font-black text-neutral-950 dark:text-white">
                      Country & Regional Sources
                    </h3>
                    <p className="text-[11px] text-neutral-500 truncate">
                      Subscribe to official newspapers, custom RSS or Telegram channels
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden sm:inline-block text-[10px] font-mono bg-neutral-950/5 dark:bg-white/5 border border-neutral-950/10 dark:border-white/10 px-2 py-0.5 font-black">
                    {activeSubsCount} SOURCES
                  </span>
                  {expanded.sources ? (
                    <ChevronDown className="w-5 h-5 text-neutral-950 dark:text-white rotate-180 transition-transform duration-300" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-neutral-500 transition-transform duration-300" />
                  )}
                </div>
              </button>

              {expanded.sources && (
                <div className="p-4 md:p-6 bg-[#faf6ec] dark:bg-[#1a1815]">
                  <SourcesPanel onChanged={() => {}} />
                </div>
              )}
            </div>

            {/* 5. Daily Brief */}
            <div className="bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] rounded-none overflow-hidden">
              <button
                onClick={() => toggleSection("brief")}
                className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-neutral-950/5 dark:hover:bg-white/5 transition-all border-b-2 border-neutral-950 dark:border-neutral-700"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-none border-2 border-neutral-950 dark:border-neutral-700 bg-[#f5f1e6] dark:bg-[#201e1a] text-neutral-950 dark:text-white flex items-center justify-center shrink-0 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm md:text-base font-serif font-black text-neutral-950 dark:text-white">
                      Daily Brief AI Engine
                    </h3>
                    <p className="text-[11px] text-neutral-500 truncate">
                      Customize sources scope, AI polish filters and topics
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden sm:inline-block text-[10px] font-mono bg-neutral-950/5 dark:bg-white/5 border border-neutral-950/10 dark:border-white/10 px-2 py-0.5 font-black">
                    {briefSettings.topics.length === 0 ? "ALL TOPICS" : `${briefSettings.topics.length} TOPICS`}
                  </span>
                  {expanded.brief ? (
                    <ChevronDown className="w-5 h-5 text-neutral-950 dark:text-white rotate-180 transition-transform duration-300" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-neutral-500 transition-transform duration-300" />
                  )}
                </div>
              </button>

              {expanded.brief && (
                <div className="p-4 md:p-6 bg-[#faf6ec] dark:bg-[#1a1815]">
                  <BriefSettingsPanel items={items} onChanged={() => {}} />
                </div>
              )}
            </div>

            {/* 6. Weather */}
            <div className="bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.15)] rounded-none overflow-hidden">
              <button
                onClick={() => toggleSection("weather")}
                className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-neutral-950/5 dark:hover:bg-white/5 transition-all border-b-2 border-neutral-950 dark:border-neutral-700"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-none border-2 border-neutral-950 dark:border-neutral-700 bg-[#f5f1e6] dark:bg-[#201e1a] text-neutral-950 dark:text-white flex items-center justify-center shrink-0 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                    <CloudSun className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm md:text-base font-serif font-black text-neutral-950 dark:text-white">
                      Weather Station Forecast
                    </h3>
                    <p className="text-[11px] text-neutral-500 truncate">
                      Select national forecast location target for local paper
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden sm:inline-block text-[10px] font-mono bg-neutral-950/5 dark:bg-white/5 border border-neutral-950/10 dark:border-white/10 px-2 py-0.5 font-black">
                    {weatherInfo.flag} {weatherInfo.code}
                  </span>
                  {expanded.weather ? (
                    <ChevronDown className="w-5 h-5 text-neutral-950 dark:text-white rotate-180 transition-transform duration-300" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-neutral-500 transition-transform duration-300" />
                  )}
                </div>
              </button>

              {expanded.weather && (
                <div className="p-4 md:p-6 bg-[#faf6ec] dark:bg-[#1a1815]">
                  <WeatherSettingsPanel />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Panel */}
      <div className="sticky bottom-0 bg-[#f5f1e6]/95 dark:bg-[#12110e]/95 backdrop-blur-md p-4 border-t-2 border-neutral-950 dark:border-neutral-700 mt-auto z-50">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleComplete}
            className="w-full py-4 rounded-none border-2 border-neutral-950 bg-amber-500 hover:bg-amber-400 text-black font-serif font-black text-sm uppercase tracking-widest shadow-[4px_4px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2"
          >
            <span>Apply Changes & Go to Newspaper</span>
            <ChevronRight className="w-5 h-5 stroke-[3]" />
          </button>
        </div>
      </div>
    </div>
  );
}


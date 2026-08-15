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
  VolumeX,
  Radio,
} from "lucide-react";
import type { FeedItem } from "../lib/feedStorage";
import { getBriefSettings, getFeedSubscriptions } from "../lib/feedStorage";
import { getWeatherCountryInfo, getWeatherCountry } from "../lib/weatherCountries";
import {
  checkForApkUpdate,
  downloadAndInstallApk,
  fetchLatestApkDownloadUrl,
  isApkAutoUpdateEnabled,
  setApkAutoUpdateEnabled,
  type ApkReleaseInfo,
  type DownloadProgress,
} from "../lib/apkUpdater";
import { isNativeAndroid } from "../lib/capacitorNative";
import { APP_VERSION } from "../lib/appVersion";

interface Props {
  onDone: (uiLocale: LocaleCode, narrateLang: string) => void;
  items?: FeedItem[];
}

type SectionKey = "tts" | "language" | "appearance" | "sources" | "brief" | "weather" | "updates";

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "tts", label: "Voice & Narration" },
  { key: "language", label: "App Interface Language" },
  { key: "appearance", label: "App Appearance" },
  { key: "sources", label: "Country & Regional Sources" },
  { key: "brief", label: "Daily Brief AI Engine" },
  { key: "weather", label: "Weather Station Forecast" },
  { key: "updates", label: "App Updates" },
];

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
    updates: false,
  });

  const toggleSection = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    setExpanded({
      tts: true,
      language: true,
      appearance: true,
      sources: true,
      brief: true,
      weather: true,
      updates: true,
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
      updates: false,
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

  const [updateInfo, setUpdateInfo] = useState<ApkReleaseInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<DownloadProgress | null>(null);
  const [autoUpdate, setAutoUpdate] = useState<boolean>(() => isApkAutoUpdateEnabled());
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const runUpdateCheck = async () => {
    setChecking(true);
    try {
      const res = await checkForApkUpdate();
      setUpdateInfo(res.update);
      if (res.update) {
        window.dispatchEvent(
          new CustomEvent("bulletin-apk-update", { detail: res.update })
        );
      }
      if (!res.update && isNativeAndroid()) {
        const web = await fetchLatestApkDownloadUrl();
        setDownloadUrl(web?.url || null);
      }
    } catch {
      setUpdateInfo(null);
    } finally {
      setChecking(false);
    }
  };

  const runInstall = async () => {
    if (!updateInfo) return;
    setInstalling(true);
    setInstallProgress({ percent: 0 });
    try {
      await downloadAndInstallApk(updateInfo, (p) => setInstallProgress(p));
    } catch (err) {
      console.warn("[Settings] install failed", err);
      // Fallback: open the APK download in the browser.
      const a = document.createElement("a");
      a.href = updateInfo.apkUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
    } finally {
      setInstalling(false);
    }
  };

  const activeTtsEngine = useMemo(() => {
    return localStorage.getItem("bulletin_tts_engine") || "webspeech";
  }, []);

  const isRtl = false; // UI is always English/LTR — Dhivehi is content-only

  const chevron = (open: boolean) =>
    open ? (
      <ChevronDown className="w-5 h-5 text-neutral-950 dark:text-white rotate-180 transition-transform duration-300" />
    ) : (
      <ChevronDown className="w-5 h-5 text-neutral-500 transition-transform duration-300" />
    );

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="h-[100dvh] w-full overflow-y-auto bg-[#f5f1e6] dark:bg-[#12110e] text-neutral-900 dark:text-neutral-100 flex flex-col font-sans relative scrollbar-none"
    >
      {/* Newspaper Grain Texture */}
      <div className="fixed inset-0 bg-noise pointer-events-none opacity-[0.03] dark:opacity-[0.02] z-0" />

      {/* ── Masthead (sticky top bar) ── */}
      <header className="sticky top-0 z-50 bg-[#f5f1e6]/95 dark:bg-[#12110e]/95 backdrop-blur-md border-b-2 border-neutral-950 dark:border-neutral-700">
        <div className="max-w-6xl mx-auto w-full px-4 md:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleComplete}
              className="shrink-0 p-2 rounded-none border-2 border-neutral-950 dark:border-neutral-700 bg-white dark:bg-[#1a1815] text-neutral-950 dark:text-white hover:bg-neutral-100 active:scale-95 transition-all flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_rgba(255,255,255,0.15)]"
              title="Back to news"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-serif font-black text-lg tracking-tight text-neutral-950 dark:text-white leading-none">
                  THE LEDGER
                </h1>
                <span className="hidden sm:inline-block text-[9px] font-mono uppercase tracking-widest text-amber-800 dark:text-amber-400 border border-amber-800/40 dark:border-amber-400/40 px-1.5 py-0.5">
                  Settings
                </span>
              </div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mt-0.5">
                Editorial Register &amp; Custom Settings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={expandAll}
              className="hidden sm:inline-flex px-3 py-1.5 border-2 border-neutral-950 dark:border-neutral-700 text-[10px] font-mono font-bold uppercase tracking-wider bg-white dark:bg-[#1a1815] text-neutral-950 dark:text-white hover:bg-amber-500 hover:text-black transition-colors"
            >
              Expand all
            </button>
            <button
              onClick={collapseAll}
              className="hidden sm:inline-flex px-3 py-1.5 border-2 border-neutral-950 dark:border-neutral-700 text-[10px] font-mono font-bold uppercase tracking-wider bg-white dark:bg-[#1a1815] text-neutral-950 dark:text-white hover:bg-amber-500 hover:text-black transition-colors"
            >
              Collapse all
            </button>
            <button
              onClick={handleComplete}
              className="px-4 py-2 border-2 border-neutral-950 dark:border-neutral-700 bg-amber-500 text-black font-black text-sm uppercase tracking-wide shadow-[3px_3px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_rgba(255,255,255,0.2)] hover:bg-amber-400 active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </header>

      {/* ── Body: LEDGER rail + settings column ── */}
      <div className="relative z-10 max-w-6xl mx-auto w-full px-4 md:px-6 py-6 md:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* LEFT — The Ledger profile masthead (sticky on desktop) */}
        <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-5">
          <div className="bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 p-5 sm:p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[5px_5px_0px_0px_rgba(255,255,255,0.15)]">
            <div className="border border-dashed border-neutral-950/20 dark:border-white/10 p-4 text-center relative overflow-hidden">
              <span className="text-[9px] font-mono tracking-widest text-amber-800 dark:text-amber-400 block mb-1">
                ★★★ OFFICIAL REGISTRAR ★★★
              </span>
              <h2 className="font-serif font-black text-2xl text-neutral-950 dark:text-white leading-tight">
                THE LEDGER
              </h2>
              <div className="w-12 h-[1px] bg-neutral-950/20 dark:bg-white/10 mx-auto my-2" />
              <p className="text-xs text-neutral-600 dark:text-neutral-400 italic">
                “Veritas et Claritas”
              </p>
            </div>

            <div className="space-y-3 pt-4">
              <h3 className="text-xs font-mono uppercase tracking-widest font-black text-neutral-400 pb-1 border-b border-neutral-950/10 dark:border-white/10">
                Active Profile
              </h3>

              <div className="flex justify-between items-center text-xs gap-2">
                <span className="text-neutral-500 font-medium">App Language</span>
                <span className="font-serif font-black bg-neutral-950/5 dark:bg-white/5 border border-neutral-950/10 dark:border-white/10 px-2 py-0.5 text-neutral-950 dark:text-white truncate max-w-[55%]">
                  {uiLocale === "dv" ? "ދިވެހި" : "English (LTR)"}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs gap-2">
                <span className="text-neutral-500 font-medium">TTS Engine</span>
                <span className="font-mono uppercase text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-400 px-2 py-0.5 font-bold truncate max-w-[55%]">
                  {activeTtsEngine}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs gap-2">
                <span className="text-neutral-500 font-medium">Subscribed</span>
                <span className="font-mono text-[10px] bg-neutral-950/5 dark:bg-white/5 border border-neutral-950/10 dark:border-white/10 px-2 py-0.5 font-black truncate max-w-[55%]">
                  {activeSubsCount} sources
                </span>
              </div>

              <div className="flex justify-between items-center text-xs gap-2">
                <span className="text-neutral-500 font-medium">Weather</span>
                <span className="font-serif font-black text-amber-800 dark:text-amber-400 truncate max-w-[55%]">
                  {weatherInfo.flag} {weatherInfo.name}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs gap-2">
                <span className="text-neutral-500 font-medium">AI Brief</span>
                <span className="font-mono text-[10px] font-bold truncate max-w-[55%]">
                  {briefSettings.useAi ? (
                    <span className="text-green-600 dark:text-green-400">ON</span>
                  ) : (
                    <span className="text-neutral-400">OFF (FALLBACK)</span>
                  )}
                </span>
              </div>
            </div>

            {/* Reading mode preview */}
            <div className="border-t border-dashed border-neutral-950/20 dark:border-white/10 pt-4">
              <span className="text-[10px] font-mono text-neutral-500 block mb-2">
                Default reading view
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDefaultView("immersive")}
                  aria-pressed={defaultView === "immersive"}
                  className={`border-2 rounded-none p-2.5 text-left transition-all ${
                    defaultView === "immersive"
                      ? "bg-amber-500 text-black border-neutral-950"
                      : "bg-white dark:bg-[#201e1a] text-neutral-950 dark:text-white border-neutral-950/20 dark:border-white/15 hover:border-amber-500"
                  }`}
                >
                  <Maximize2 className="w-4 h-4 mb-1" />
                  <div className="text-[11px] font-black font-serif">Immersive</div>
                </button>
                <button
                  onClick={() => setDefaultView("magazine")}
                  aria-pressed={defaultView === "magazine"}
                  className={`border-2 rounded-none p-2.5 text-left transition-all ${
                    defaultView === "magazine"
                      ? "bg-amber-500 text-black border-neutral-950"
                      : "bg-white dark:bg-[#201e1a] text-neutral-950 dark:text-white border-neutral-950/20 dark:border-white/15 hover:border-amber-500"
                  }`}
                >
                  <Minimize2 className="w-4 h-4 mb-1" />
                  <div className="text-[11px] font-black font-serif">Magazine</div>
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT — settings column (full width of its track) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Section index / jump bar */}
          <div className="hidden md:flex flex-wrap items-center gap-2 bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 px-3 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.15)]">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mr-1">
              Sections
            </span>
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => toggleSection(s.key)}
                className={`px-2.5 py-1 text-[11px] font-bold border-2 transition-colors ${
                  expanded[s.key]
                    ? "bg-amber-500 text-black border-neutral-950"
                    : "bg-white dark:bg-[#201e1a] text-neutral-950 dark:text-white border-neutral-950/20 dark:border-white/15 hover:border-amber-500"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* 1. Voice & TTS */}
          <section className="bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[5px_5px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[5px_5px_0px_0px_rgba(255,255,255,0.15)] rounded-none overflow-hidden">
            <button
              onClick={() => toggleSection("tts")}
              className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-neutral-950/5 dark:hover:bg-white/5 transition-all border-b-2 border-neutral-950 dark:border-neutral-700"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-none border-2 border-neutral-950 dark:border-neutral-700 bg-[#f5f1e6] dark:bg-[#201e1a] text-neutral-950 dark:text-white flex items-center justify-center shrink-0 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                  <Mic className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm md:text-base font-serif font-black text-neutral-950 dark:text-white">
                    Voice &amp; Narration Speed
                  </h3>
                  <p className="text-[11px] text-neutral-500 truncate">
                    Select speech engine, voice genders, rate &amp; pitch
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:inline-block text-[10px] font-mono bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-400 px-2 py-0.5 font-bold">
                  {activeTtsEngine.toUpperCase()}
                </span>
                {chevron(expanded.tts)}
              </div>
            </button>
            {expanded.tts && (
              <div className="p-4 md:p-6 bg-[#faf6ec] dark:bg-[#1a1815]">
                <TtsSettings />
              </div>
            )}
          </section>

          {/* 2. App Language */}
          <section className="bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[5px_5px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[5px_5px_0px_0px_rgba(255,255,255,0.15)] rounded-none overflow-hidden">
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
                {chevron(expanded.language)}
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
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-950/5 dark:hover:bg-white/5"
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
          </section>

          {/* 3. App Appearance */}
          <section className="bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[5px_5px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[5px_5px_0px_0px_rgba(255,255,255,0.15)] rounded-none overflow-hidden">
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
                {chevron(expanded.appearance)}
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
          </section>

          {/* 4. News Sources */}
          <section className="bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[5px_5px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[5px_5px_0px_0px_rgba(255,255,255,0.15)] rounded-none overflow-hidden">
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
                    Country &amp; Regional Sources
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
                {chevron(expanded.sources)}
              </div>
            </button>
            {expanded.sources && (
              <div className="p-4 md:p-6 bg-[#faf6ec] dark:bg-[#1a1815]">
                <SourcesPanel onChanged={() => {}} />
              </div>
            )}
          </section>

          {/* 5. Daily Brief */}
          <section className="bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[5px_5px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[5px_5px_0px_0px_rgba(255,255,255,0.15)] rounded-none overflow-hidden">
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
                {chevron(expanded.brief)}
              </div>
            </button>
            {expanded.brief && (
              <div className="p-4 md:p-6 bg-[#faf6ec] dark:bg-[#1a1815]">
                <BriefSettingsPanel items={items} onChanged={() => {}} />
              </div>
            )}
          </section>

          {/* 6. Weather */}
          <section className="bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[5px_5px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[5px_5px_0px_0px_rgba(255,255,255,0.15)] rounded-none overflow-hidden">
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
                {chevron(expanded.weather)}
              </div>
            </button>
            {expanded.weather && (
              <div className="p-4 md:p-6 bg-[#faf6ec] dark:bg-[#1a1815]">
                <WeatherSettingsPanel />
              </div>
            )}
          </section>

          {/* 7. App Updates */}
          <section className="bg-[#faf6ec] dark:bg-[#1a1815] border-2 border-neutral-950 dark:border-neutral-700 shadow-[5px_5px_0px_0px_rgba(0,0,0,0.95)] dark:shadow-[5px_5px_0px_0px_rgba(255,255,255,0.15)] rounded-none overflow-hidden">
            <button
              onClick={() => toggleSection("updates")}
              className="w-full p-4 md:p-5 flex items-center justify-between text-left hover:bg-neutral-950/5 dark:hover:bg-white/5 transition-all border-b-2 border-neutral-950 dark:border-neutral-700"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-none border-2 border-neutral-950 dark:border-neutral-700 bg-[#f5f1e6] dark:bg-[#201e1a] text-neutral-950 dark:text-white flex items-center justify-center shrink-0 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm md:text-base font-serif font-black text-neutral-950 dark:text-white">
                    App Updates
                  </h3>
                  <p className="text-[11px] text-neutral-500 truncate">
                    Current v{APP_VERSION} · auto-check for new APK releases
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:inline-block text-[10px] font-mono bg-neutral-950/5 dark:bg-white/5 border border-neutral-950/10 dark:border-white/10 px-2 py-0.5 font-black uppercase">
                  {updateInfo ? "UPDATE" : "UP TO DATE"}
                </span>
                {chevron(expanded.updates)}
              </div>
            </button>
            {expanded.updates && (
              <div className="p-4 md:p-6 bg-[#faf6ec] dark:bg-[#1a1815] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Automatic updates</p>
                    <p className="text-xs text-neutral-500">Check on launch and notify when a new APK is available.</p>
                  </div>
                  <button
                    onClick={() => {
                      const next = !autoUpdate;
                      setAutoUpdate(next);
                      setApkAutoUpdateEnabled(next);
                    }}
                    className={`relative w-12 h-7 rounded-none border-2 border-neutral-950 dark:border-white/30 transition-colors ${autoUpdate ? "bg-amber-500" : "bg-neutral-300 dark:bg-neutral-700"}`}
                    aria-pressed={autoUpdate}
                  >
                    <span className={`absolute top-0.5 ${autoUpdate ? "left-6" : "left-0.5"} w-5 h-5 bg-white border-2 border-neutral-950 transition-all`} />
                  </button>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => void runUpdateCheck()}
                    disabled={checking}
                    className="px-4 py-2 border-2 border-neutral-950 dark:border-white/30 bg-white dark:bg-[#1a1815] text-neutral-950 dark:text-white font-bold text-sm hover:bg-amber-500 hover:text-black transition-colors disabled:opacity-50"
                  >
                    {checking ? "Checking…" : "Check for updates"}
                  </button>
                  {updateInfo && (
                    <button
                      onClick={() => void runInstall()}
                      disabled={installing}
                      className="px-4 py-2 bg-amber-500 text-black font-black text-sm border-2 border-black shadow-[2px_2px_0_rgba(0,0,0,1)] hover:bg-amber-400 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50"
                    >
                      {installing ? `Installing… ${installProgress?.percent ?? 0}%` : `Install v${updateInfo.versionName}`}
                    </button>
                  )}
                  {!updateInfo && downloadUrl && (
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-amber-500 text-black font-black text-sm border-2 border-black shadow-[2px_2px_0_rgba(0,0,0,1)] hover:bg-amber-400 transition-colors"
                    >
                      Download APK
                    </a>
                  )}
                </div>
                {!updateInfo && !checking && (
                  <p className="text-xs text-neutral-500">You're on the latest version (v{APP_VERSION}).</p>
                )}
              </div>
            )}
          </section>

          <p className="text-center text-[10px] font-mono text-neutral-400 dark:text-neutral-600 pt-2 pb-4">
            BULLETIN · EDITION {new Date().getFullYear()} · ALL SECTIONS SET
          </p>
        </div>
      </div>
    </div>
  );
}

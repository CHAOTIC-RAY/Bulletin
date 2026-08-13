import React, { useState } from "react";
import { LocaleCode, getLocale } from "../lib/i18n";
import TtsSettings from "./TtsSettings";
import SourcesPanel from "./SourcesPanel";
import BriefSettingsPanel from "./BriefSettingsPanel";
import WeatherSettingsPanel from "./WeatherSettingsPanel";
import { Mic, Globe, Sliders, ArrowLeft, Newspaper, Check, ChevronRight, Sparkles, CloudSun } from "lucide-react";
import type { FeedItem } from "../lib/feedStorage";

interface Props {
  onDone: (uiLocale: LocaleCode, narrateLang: string) => void;
  items?: FeedItem[];
}

export default function LanguageSetup({ onDone, items = [] }: Props) {
  const [uiLocale, setUiLocale] = useState<LocaleCode>(getLocale());
  const [narrateLang, setNarrateLang] = useState("en-US");
  const [tab, setTab] = useState<"tts" | "language" | "sources" | "brief" | "weather">("tts");

  const handleComplete = () => {
    onDone(uiLocale, narrateLang);
  };

  const isRtl = false; // UI is always English/LTR — Dhivehi is content-only

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={`min-h-[100dvh] bg-neutral-950 text-white flex flex-col font-sans ${
        isRtl ? "font-thaana text-right" : ""
      }`}
    >
      {/* Mobile App Header Bar */}
      <div className="sticky top-0 z-50 bg-neutral-900/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleComplete}
            className="p-2 -ml-2 rounded-none border border-white/20 hover:bg-white/10 active:scale-95 text-neutral-300 transition-all flex items-center justify-center"
            title="Back to news"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white leading-none">Settings</h1>
            <p className="text-[11px] text-neutral-400 mt-0.5">Voice, Language & Sources</p>
          </div>
        </div>

        <button
          onClick={handleComplete}
          className="px-4 py-1.5 rounded-none border-2 border-black bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs tracking-wide shadow-none active:scale-95 transition-all"
        >
          Done
        </button>
      </div>

      <div className="flex-1 max-w-lg w-full mx-auto p-4 sm:p-6 flex flex-col space-y-5">
        {/* Mobile Segmented Control */}
        <div className="p-1 bg-neutral-900 border-2 border-white/15 rounded-none flex items-center shadow-none">
          <button
            onClick={() => setTab("tts")}
            className={`flex-1 py-2 px-2 rounded-none text-xs font-bold flex items-center justify-center gap-1.5 transition-all border-2 ${
              tab === "tts"
                ? "bg-amber-500 text-black border-amber-600 font-extrabold"
                : "text-neutral-400 hover:text-white border-transparent"
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span className="truncate">Voice & TTS</span>
          </button>

          <button
            onClick={() => setTab("language")}
            className={`flex-1 py-2 px-2 rounded-none text-xs font-bold flex items-center justify-center gap-1.5 transition-all border-2 ${
              tab === "language"
                ? "bg-amber-500 text-black border-amber-600 font-extrabold"
                : "text-neutral-400 hover:text-white border-transparent"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="truncate">Language</span>
          </button>

          <button
            onClick={() => setTab("sources")}
            className={`flex-1 py-2 px-2 rounded-none text-xs font-bold flex items-center justify-center gap-1.5 transition-all border-2 ${
              tab === "sources"
                ? "bg-amber-500 text-black border-amber-600 font-extrabold"
                : "text-neutral-400 hover:text-white border-transparent"
            }`}
          >
            <Newspaper className="w-3.5 h-3.5" />
            <span className="truncate">Sources</span>
          </button>

          <button
            onClick={() => setTab("brief")}
            className={`flex-1 py-2 px-2 rounded-none text-xs font-bold flex items-center justify-center gap-1.5 transition-all border-2 ${
              tab === "brief"
                ? "bg-amber-500 text-black border-amber-600 font-extrabold"
                : "text-neutral-400 hover:text-white border-transparent"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="truncate">Daily Brief</span>
          </button>

          <button
            onClick={() => setTab("weather")}
            className={`flex-1 py-2 px-2 rounded-none text-xs font-bold flex items-center justify-center gap-1.5 transition-all border-2 ${
              tab === "weather"
                ? "bg-amber-500 text-black border-amber-600 font-extrabold"
                : "text-neutral-400 hover:text-white border-transparent"
            }`}
          >
            <CloudSun className="w-3.5 h-3.5" />
            <span className="truncate">Weather</span>
          </button>
        </div>

        {/* Tab Contents */}
        {tab === "tts" && (
          <div className="flex-1">
            <TtsSettings />
          </div>
        )}

        {tab === "language" && (
          <div className="flex-1 space-y-4">
            <div className="space-y-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">
                App Interface Language
              </h2>
              <p className="text-xs text-neutral-500 px-1">
                Select your preferred language for buttons, titles, and system labels.
              </p>
            </div>

            {/* iOS style grouped list */}
            <div className="rounded-none bg-neutral-900 border-2 border-white/10 overflow-hidden divide-y divide-white/10">
              <button
                onClick={() => setUiLocale("en")}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🇬🇧</span>
                  <div>
                    <div className="text-sm font-bold text-white">English</div>
                    <div className="text-xs text-neutral-400">Left-to-Right (LTR) Layout</div>
                  </div>
                </div>
                {uiLocale === "en" ? (
                  <div className="w-6 h-6 rounded-none border border-black/30 bg-amber-500 text-black flex items-center justify-center font-bold">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-none border-2 border-white/20" />
                )}
              </button>

              <button
                onClick={() => setUiLocale("dv")}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🇲🇻</span>
                  <div>
                    <div className="text-sm font-bold text-white font-thaana">ދިވެހި (Dhivehi)</div>
                    <div className="text-xs text-neutral-400">Right-to-Left (RTL / Thaana Script)</div>
                  </div>
                </div>
                {uiLocale === "dv" ? (
                  <div className="w-6 h-6 rounded-none border border-black/30 bg-amber-500 text-black flex items-center justify-center font-bold">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-none border-2 border-white/20" />
                )}
              </button>
            </div>
          </div>
        )}

        {tab === "sources" && (
          <div className="flex-1">
            <SourcesPanel onChanged={() => {}} />
          </div>
        )}

        {tab === "brief" && (
          <div className="flex-1">
            <BriefSettingsPanel items={items} onChanged={() => {}} />
          </div>
        )}

        {tab === "weather" && (
          <div className="flex-1">
            <WeatherSettingsPanel />
          </div>
        )}
      </div>

      {/* Bottom Floating Save Button */}
      <div className="sticky bottom-0 bg-neutral-950/90 backdrop-blur-md p-4 border-t border-white/10 mt-auto">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleComplete}
            className="w-full py-3.5 rounded-none bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-black font-extrabold text-sm tracking-wide shadow-none transition-all flex items-center justify-center gap-2"
          >
            <span>Save & Continue to News</span>
            <ChevronRight className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      </div>
    </div>
  );
}


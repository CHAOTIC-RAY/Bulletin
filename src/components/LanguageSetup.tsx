import React, { useState } from "react";
import { LocaleCode, getLocale } from "../lib/i18n";
import TtsSettings from "./TtsSettings";
import { Mic, Globe, Sliders, ArrowLeft } from "lucide-react";

interface Props {
  onDone: (uiLocale: LocaleCode, narrateLang: string) => void;
}

export default function LanguageSetup({ onDone }: Props) {
  const [uiLocale, setUiLocale] = useState<LocaleCode>(getLocale());
  const [narrateLang, setNarrateLang] = useState("en-US");
  const [tab, setTab] = useState<"tts" | "language">("tts");

  const handleComplete = () => {
    onDone(uiLocale, narrateLang);
  };

  return (
    <div className="min-h-[100dvh] bg-neutral-950 text-white flex flex-col pt-6 pb-8 px-4 sm:px-6 overflow-y-auto">
      <div className="max-w-2xl w-full mx-auto flex-1 flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center font-black text-xl text-neutral-950 shadow-lg shadow-amber-500/20">
              H
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Audio & Speech Settings</h1>
              <p className="text-xs text-neutral-400">Configure TTS engines, Piper voice packs, and languages.</p>
            </div>
          </div>

          <button
            onClick={handleComplete}
            className="px-5 py-2.5 rounded-full bg-white text-neutral-950 font-bold text-sm hover:bg-neutral-200 transition-colors shadow-lg"
          >
            Done
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl mb-6">
          <button
            onClick={() => setTab("tts")}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
              tab === "tts"
                ? "bg-amber-500 text-black shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>TTS Engine & Voice Packs</span>
          </button>
          <button
            onClick={() => setTab("language")}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
              tab === "language"
                ? "bg-amber-500 text-black shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>App Language</span>
          </button>
        </div>

        {/* Main Tab Content */}
        {tab === "tts" ? (
          <div className="flex-1">
            <TtsSettings />
          </div>
        ) : (
          <div className="flex-1 space-y-6 pt-2">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <Globe className="w-6 h-6 text-amber-400" />
                <div>
                  <div className="text-base font-bold text-white">Interface Locale</div>
                  <div className="text-xs text-neutral-400">Choose the language for application UI labels.</div>
                </div>
              </div>

              <select
                value={uiLocale}
                onChange={(e) => setUiLocale(e.target.value as LocaleCode)}
                className="w-full p-3 rounded-xl bg-neutral-900 border border-white/20 text-sm font-bold text-amber-400 outline-none"
              >
                <option value="en">English (LTR)</option>
                <option value="dv">Dhivehi (RTL / Thaana)</option>
              </select>
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-8 pt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={handleComplete}
            className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-amber-500 text-neutral-950 font-extrabold text-base hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
          >
            Save & Continue to News
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import {
  PIPER_VOICE_PACKS,
  PiperVoicePack,
  isVoiceDownloaded,
  downloadVoicePack,
  deleteVoicePack,
} from "../lib/piperVoiceManager";
import { getWebSpeechVoices } from "../lib/webSpeechEngine";
import { POLLY_VOICES } from "../lib/pollyEngine";
import { RaadhavalhiTts, TtsEngineType } from "../lib/ttsPlayer";
import {
  Mic,
  Download,
  Trash2,
  Play,
  Square,
  Check,
  Cpu,
  Globe,
  Cloud,
  Sparkles,
  Volume2,
  HardDrive,
  RefreshCw,
  Sliders,
} from "lucide-react";

export default function TtsSettings() {
  const [engine, setEngine] = useState<TtsEngineType>(() => {
    return (localStorage.getItem("raadhavalhi_tts_engine") as TtsEngineType) || "webspeech";
  });

  const [piperVoice, setPiperVoice] = useState<string>(() => {
    return localStorage.getItem("raadhavalhi_piper_voice") || "ryan-high";
  });

  const [pollyVoiceId, setPollyVoiceId] = useState<string>(() => {
    return localStorage.getItem("raadhavalhi_polly_voice") || "Matthew";
  });

  const [autoScroll, setAutoScroll] = useState<boolean>(() => {
    return localStorage.getItem("raadhavalhi_auto_scroll") === "true";
  });

  const [rate, setRate] = useState<number>(() => {
    const r = localStorage.getItem("raadhavalhi_tts_rate");
    return r ? parseFloat(r) : 1.0;
  });

  const [pitch, setPitch] = useState<number>(() => {
    const p = localStorage.getItem("raadhavalhi_tts_pitch");
    return p ? parseFloat(p) : 1.0;
  });

  const [volume, setVolume] = useState<number>(() => {
    const v = localStorage.getItem("raadhavalhi_tts_volume");
    return v ? Math.min(1, Math.max(0, parseFloat(v))) : 1.0;
  });

  const [downloadedMap, setDownloadedMap] = useState<Record<string, boolean>>({});
  const [downloadProgressMap, setDownloadProgressMap] = useState<Record<string, number>>({});
  const [isDownloadingMap, setIsDownloadingMap] = useState<Record<string, boolean>>({});

  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [activeTestPack, setActiveTestPack] = useState<string | null>(null);
  const [ttsPlayer] = useState(() => new RaadhavalhiTts());

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    checkDownloadedStatus();
  }, []);

  const checkDownloadedStatus = async () => {
    const map: Record<string, boolean> = {};
    for (const pack of PIPER_VOICE_PACKS) {
      map[pack.id] = await isVoiceDownloaded(pack.id);
    }
    setDownloadedMap(map);
  };

  const handleSelectEngine = (eType: TtsEngineType) => {
    setEngine(eType);
    localStorage.setItem("raadhavalhi_tts_engine", eType);
    ttsPlayer.setEngine(eType, piperVoice, localStorage.getItem("raadhavalhi_narrate_lang") || "en-US");
  };

  const handleSelectPiper = (packId: string) => {
    setPiperVoice(packId);
    localStorage.setItem("raadhavalhi_piper_voice", packId);
    ttsPlayer.setEngine("piper", packId, localStorage.getItem("raadhavalhi_narrate_lang") || "en-US");
  };

  const handleSelectPolly = (vId: string) => {
    setPollyVoiceId(vId);
    localStorage.setItem("raadhavalhi_polly_voice", vId);
    ttsPlayer.setPolly(vId, "neural");
    ttsPlayer.setEngine("polly", piperVoice, localStorage.getItem("raadhavalhi_narrate_lang") || "en-US");
  };

  const handleRateChange = (newRate: number) => {
    setRate(newRate);
    localStorage.setItem("raadhavalhi_tts_rate", String(newRate));
    // Trigger setVoice so it updates live
    ttsPlayer.setVoice(localStorage.getItem("raadhavalhi_narrate_lang") || "en-US", "", newRate, pitch, volume);
  };

  const handlePitchChange = (newPitch: number) => {
    setPitch(newPitch);
    localStorage.setItem("raadhavalhi_tts_pitch", String(newPitch));
    // Trigger setVoice so it updates live
    ttsPlayer.setVoice(localStorage.getItem("raadhavalhi_narrate_lang") || "en-US", "", rate, newPitch, volume);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    localStorage.setItem("raadhavalhi_tts_volume", String(newVol));
    ttsPlayer.setGain(newVol);
  };

  const handleDownloadPack = async (pack: PiperVoicePack) => {
    setIsDownloadingMap((prev) => ({ ...prev, [pack.id]: true }));
    setDownloadProgressMap((prev) => ({ ...prev, [pack.id]: 0 }));
    setErrorMsg(null);

    try {
      await downloadVoicePack(pack, (pct) => {
        setDownloadProgressMap((prev) => ({ ...prev, [pack.id]: pct }));
      });
      await checkDownloadedStatus();
    } catch (err: any) {
      setErrorMsg(`Failed to download voice pack ${pack.name}: ${err?.message || "Error"}`);
    } finally {
      setIsDownloadingMap((prev) => ({ ...prev, [pack.id]: false }));
    }
  };

  const handleDeletePack = (packId: string) => {
    setConfirmDeleteId(packId);
  };

  const executeDeletePack = async (packId: string) => {
    try {
      await deleteVoicePack(packId);
      await checkDownloadedStatus();
    } catch (err: any) {
      setErrorMsg(`Failed to delete voice pack: ${err?.message || "Error"}`);
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleTestVoice = async (packId?: string, _edgeId?: string, pollyId?: string) => {
    if (isPlayingTest) {
      ttsPlayer.stop();
      setIsPlayingTest(false);
      setActiveTestPack(null);
      return;
    }

    const testText =
      "Hello! Welcome to Raadhavalhi News. This is a live preview of your chosen neural speech voice.";

    const testEngine = packId ? "piper" : pollyId ? "polly" : engine;
    const testPiper = packId || piperVoice;
    if (pollyId) ttsPlayer.setPolly(pollyId, "neural");

    ttsPlayer.setCallbacks({
      onPlay: () => {
        setIsPlayingTest(true);
        setActiveTestPack(packId || pollyId || "current");
      },
      onEnded: () => {
        setIsPlayingTest(false);
        setActiveTestPack(null);
      },
      onError: (msg) => {
        setIsPlayingTest(false);
        setActiveTestPack(null);
        setErrorMsg(`Speech playback failed: ${msg}`);
      },
    });

    // Make sure rate and pitch are applied before test
    ttsPlayer.setEngine(testEngine, testPiper, localStorage.getItem("raadhavalhi_narrate_lang") || "en-US");
    ttsPlayer.setVoice(localStorage.getItem("raadhavalhi_narrate_lang") || "en-US", "", rate, pitch, volume);
    await ttsPlayer.play(testText);
  };

  return (
    <div className="space-y-8 py-2">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-white/10">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
          <Mic className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-white">TTS Engine & Voice Packs</h2>
          <p className="text-xs text-neutral-400">
            Browser WebSpeech (free, no download) or optional Piper local models.
          </p>
        </div>
      </div>

      {/* Engine Selection */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
          Select Active TTS Engine
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* WebSpeech Engine (default, free) */}
          <div
            onClick={() => handleSelectEngine("webspeech")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
              engine === "webspeech"
                ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Globe className={`w-5 h-5 ${engine === "webspeech" ? "text-amber-400" : "text-neutral-400"}`} />
              {engine === "webspeech" && (
                <span className="text-[10px] bg-amber-500 text-black px-2 py-0.5 rounded-full font-extrabold">
                  ACTIVE
                </span>
              )}
            </div>
            <div className="font-bold text-white text-sm">Browser WebSpeech</div>
            <div className="text-xs text-neutral-400 mt-1">
              Free built-in system voices. Zero download, zero API key — works on every device.
            </div>
          </div>

          {/* Polly Engine */}
          <div
            onClick={() => handleSelectEngine("polly")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
              engine === "polly"
                ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Cloud className="w-5 h-5 text-amber-400" />
              {engine === "polly" && (
                <span className="text-[10px] bg-amber-500 text-black px-2 py-0.5 rounded-full font-extrabold">
                  ACTIVE
                </span>
              )}
            </div>
            <div className="font-bold text-white text-sm">AWS Polly (Cloud)</div>
            <div className="text-xs text-neutral-400 mt-1">
              Studio-quality neural voices. Needs AWS keys (free tier). Best quality.
            </div>
          </div>

          {/* Piper Engine */}
          <div
            onClick={() => handleSelectEngine("piper")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
              engine === "piper"
                ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Cpu className="w-5 h-5 text-amber-400" />
              {engine === "piper" && (
                <span className="text-[10px] bg-amber-500 text-black px-2 py-0.5 rounded-full font-extrabold">
                  ACTIVE
                </span>
              )}
            </div>
            <div className="font-bold text-white text-sm">Piper TTS (WASM)</div>
            <div className="text-xs text-neutral-400 mt-1">
              Local neural models (Ryan High, LJSpeech High). Offline ready — ~114 MB download.
            </div>
          </div>
        </div>
      </div>

      {/* PIPER VOICE PACKS SECTION */}
      {engine === "piper" && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">
                Piper High Voice Packs
              </h3>
            </div>
            <span className="text-xs text-neutral-400 flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5" /> Saved in IndexedDB
            </span>
          </div>

          <div className="space-y-3">
            {PIPER_VOICE_PACKS.map((pack) => {
              const isDownloaded = downloadedMap[pack.id];
              const isDownloading = isDownloadingMap[pack.id];
              const progress = downloadProgressMap[pack.id] || 0;
              const isSelected = piperVoice === pack.id;
              const isTestingThis = isPlayingTest && activeTestPack === pack.id;

              return (
                <div
                  key={pack.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? "border-amber-500/70 bg-amber-500/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-base">{pack.name}</span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">
                          {pack.quality} · ~{pack.sizeMB} MB
                        </span>
                        {(pack.id === "ryan-high" || pack.id === "ljspeech-high") && (
                          <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-black">
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-300">{pack.description}</p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      {/* Select Pack button */}
                      <button
                        onClick={() => handleSelectPiper(pack.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                          isSelected
                            ? "bg-amber-500 text-black"
                            : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                      >
                        {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : null}
                        {isSelected ? "Selected" : "Select"}
                      </button>

                      {/* Download / Delete button */}
                      {isDownloaded ? (
                        confirmDeleteId === pack.id ? (
                          <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 p-1 rounded-xl">
                            <span className="text-[10px] text-red-400 font-bold px-1">Delete?</span>
                            <button
                              onClick={() => executeDeletePack(pack.id)}
                              className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-bold"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 bg-white/10 hover:bg-white/20 text-neutral-300 rounded-lg text-[10px] font-bold"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleDeletePack(pack.id)}
                            className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/20"
                            title="Delete downloaded voice pack"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => handleDownloadPack(pack)}
                          disabled={isDownloading}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          {isDownloading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          {isDownloading ? `${progress}%` : "Download"}
                        </button>
                      )}

                      {/* Preview audio button */}
                      <button
                        onClick={() => handleTestVoice(pack.id)}
                        className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                        title="Preview voice audio"
                      >
                        {isTestingThis ? (
                          <Square className="w-4 h-4 fill-amber-400 text-amber-400" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Progress bar if downloading */}
                  {isDownloading && (
                    <div className="mt-3 w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full transition-all duration-200"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* POLLY TTS VOICES SECTION */}
      {engine === "polly" && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">
              AWS Polly Neural Voices
            </h3>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-200/90">
            Needs AWS credentials. Set <code className="font-mono">AWS_ACCESS_KEY_ID</code>,{" "}
            <code className="font-mono">AWS_SECRET_ACCESS_KEY</code>, and{" "}
            <code className="font-mono">AWS_REGION</code> in your <code className="font-mono">.env</code>{" "}
            (dev) or wrangler vars (prod). Free tier: 1M neural chars/month. See README → "AWS Polly setup".
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {POLLY_VOICES.map((voice) => {
              const isSelected = pollyVoiceId === voice.id;
              const isTestingThis = isPlayingTest && activeTestPack === voice.id;

              return (
                <div
                  key={voice.id}
                  onClick={() => handleSelectPolly(voice.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? "border-amber-500 bg-amber-500/10 shadow-md"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{voice.name}</span>
                      <span className="text-[10px] bg-white/10 text-neutral-300 px-2 py-0.5 rounded-full font-mono">
                        {voice.gender}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400">{voice.description}</p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTestVoice(undefined, undefined, voice.id);
                    }}
                    className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors shrink-0"
                    title="Preview voice"
                  >
                    {isTestingThis ? (
                      <Square className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Speech Controls */}
      <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-5">
        <div className="flex items-center gap-2 pb-2 border-b border-white/5">
          <Sliders className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">
            Voice Pitch & Speed
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Speed (Rate) Control */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-neutral-300">Speech Rate (Speed)</span>
              <span className="font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-bold">
                {rate.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={rate}
              onChange={(e) => handleRateChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 font-bold">
              <span>0.5x (Slower)</span>
              <span>1.0x (Normal)</span>
              <span>2.0x (Faster)</span>
            </div>
          </div>

          {/* Pitch Control */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-neutral-300">Pitch (Tone)</span>
              <span className="font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-bold">
                {pitch.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={pitch}
              onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 font-bold">
              <span>0.5x (Deeper)</span>
              <span>1.0x (Normal)</span>
              <span>1.5x (Higher)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Voice Preview Controller */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Volume2 className="w-5 h-5 text-amber-400" />
          <div>
            <div className="text-sm font-bold text-white">Voice Output Test</div>
            <div className="text-xs text-neutral-400">
              Active engine: <span className="text-amber-400 font-bold uppercase">{engine}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => handleTestVoice()}
          className="px-4 py-2 rounded-full bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-colors flex items-center gap-2"
        >
          {isPlayingTest ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          {isPlayingTest ? "Stop Test" : "Test Active Voice"}
        </button>
      </div>

      {/* Auto-Scroll Toggle */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
        <div className="space-y-1 pr-4">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <span>Auto-Scroll On Finish</span>
            {autoScroll && (
              <span className="text-[10px] bg-amber-500 text-black font-extrabold px-2 py-0.5 rounded-full">
                ENABLED
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400">
            Automatically scroll to the next news story when TTS finishes reading the complete news article.
          </p>
        </div>

        <button
          onClick={() => {
            const next = !autoScroll;
            setAutoScroll(next);
            localStorage.setItem("raadhavalhi_auto_scroll", next ? "true" : "false");
          }}
          className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 relative shrink-0 ${
            autoScroll ? "bg-amber-500" : "bg-white/20"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-full bg-neutral-950 shadow-md transition-transform duration-300 ${
              autoScroll ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

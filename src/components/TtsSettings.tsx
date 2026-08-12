import React, { useState, useEffect } from "react";
import { getWebSpeechVoices, getSortedWebSpeechVoices, ScoredVoice, onVoicesReady } from "../lib/webSpeechEngine";
import { POLLY_VOICES } from "../lib/pollyEngine";
import { BulletinTts, TtsEngineType } from "../lib/ttsPlayer";
import {
  Play,
  Square,
  Check,
  Globe,
  Cloud,
  Sparkles,
  Volume2,
  Sliders,
} from "lucide-react";

export default function TtsSettings() {
  const [engine, setEngine] = useState<TtsEngineType>(() => {
    return (localStorage.getItem("bulletin_tts_engine") as TtsEngineType) || "webspeech";
  });

  const [pollyVoiceId, setPollyVoiceId] = useState<string>(() => {
    return localStorage.getItem("bulletin_polly_voice") || "Matthew";
  });

  const [webSpeechVoiceName, setWebSpeechVoiceName] = useState<string>(() => {
    return localStorage.getItem("bulletin_webspeech_voice") || "";
  });

  const [webSpeechVoicesList, setWebSpeechVoicesList] = useState<ScoredVoice[]>([]);

  const [autoScroll, setAutoScroll] = useState<boolean>(() => {
    return localStorage.getItem("bulletin_auto_scroll") === "true";
  });

  const [rate, setRate] = useState<number>(() => {
    const r = localStorage.getItem("bulletin_tts_rate");
    return r ? parseFloat(r) : 1.0;
  });

  const [pitch, setPitch] = useState<number>(() => {
    const p = localStorage.getItem("bulletin_tts_pitch");
    return p ? parseFloat(p) : 1.0;
  });

  const [volume, setVolume] = useState<number>(() => {
    const v = localStorage.getItem("bulletin_tts_volume");
    return v ? Math.min(1, Math.max(0, parseFloat(v))) : 1.0;
  });

  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [activeTestPack, setActiveTestPack] = useState<string | null>(null);
  const [ttsPlayer] = useState(() => new BulletinTts());

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadWebSpeechVoices();
    const unsub = onVoicesReady(() => {
      loadWebSpeechVoices();
    });
    return unsub;
  }, []);

  const loadWebSpeechVoices = () => {
    const lang = localStorage.getItem("bulletin_narrate_lang") || "en-US";
    const sorted = getSortedWebSpeechVoices(lang);
    setWebSpeechVoicesList(sorted);
    if (!webSpeechVoiceName && sorted.length > 0) {
      setWebSpeechVoiceName(sorted[0].voice.name);
    }
  };

  const handleSelectEngine = (eType: TtsEngineType) => {
    setEngine(eType);
    localStorage.setItem("bulletin_tts_engine", eType);
    ttsPlayer.setEngine(eType, undefined, localStorage.getItem("bulletin_narrate_lang") || "en-US");
  };

  const handleSelectWebSpeechVoice = (voiceName: string) => {
    setWebSpeechVoiceName(voiceName);
    localStorage.setItem("bulletin_webspeech_voice", voiceName);
    ttsPlayer.setVoice(
      localStorage.getItem("bulletin_narrate_lang") || "en-US",
      voiceName,
      rate,
      pitch,
      volume
    );
  };

  const handleSelectPolly = (vId: string) => {
    setPollyVoiceId(vId);
    localStorage.setItem("bulletin_polly_voice", vId);
    ttsPlayer.setPolly(vId, "neural");
    ttsPlayer.setEngine("polly", undefined, localStorage.getItem("bulletin_narrate_lang") || "en-US");
  };

  const handleRateChange = (newRate: number) => {
    setRate(newRate);
    localStorage.setItem("bulletin_tts_rate", String(newRate));
    ttsPlayer.setVoice(
      localStorage.getItem("bulletin_narrate_lang") || "en-US",
      webSpeechVoiceName,
      newRate,
      pitch,
      volume
    );
  };

  const handlePitchChange = (newPitch: number) => {
    setPitch(newPitch);
    localStorage.setItem("bulletin_tts_pitch", String(newPitch));
    ttsPlayer.setVoice(
      localStorage.getItem("bulletin_narrate_lang") || "en-US",
      webSpeechVoiceName,
      rate,
      newPitch,
      volume
    );
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    localStorage.setItem("bulletin_tts_volume", String(newVol));
    ttsPlayer.setGain(newVol);
  };

  const handleTestVoice = async (
    _voiceId?: string,
    _edgeId?: string,
    pollyId?: string,
    customWebSpeechVoice?: string,
    engineOverride?: TtsEngineType
  ) => {
    if (isPlayingTest) {
      ttsPlayer.stop();
      setIsPlayingTest(false);
      setActiveTestPack(null);
      return;
    }

    const testEngine = engineOverride || (pollyId ? "polly" : engine);
    if (pollyId) ttsPlayer.setPolly(pollyId, "neural");

    const targetVoice = customWebSpeechVoice || webSpeechVoiceName;
    const testText =
      testEngine === "dhivehi"
        ? "ޙީ ދީ ބުގުން ގޮތްގައް ނޑިކުމާއޭކެވާ އުފެދިޏޯ. މޙައްގތުނާ ކުށހެ، މުޅޔޔޔަ޻ާ އެޅޔމަ ކުހެ." :
        "Hello! Welcome to Bulletin News. This is a live preview of your chosen speech voice.";

    ttsPlayer.setCallbacks({
      onPlay: () => {
        setIsPlayingTest(true);
        setActiveTestPack(pollyId || customWebSpeechVoice || "current");
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

    ttsPlayer.setEngine(testEngine, undefined, localStorage.getItem("bulletin_narrate_lang") || "en-US");
    ttsPlayer.setVoice(
      localStorage.getItem("bulletin_narrate_lang") || "en-US",
      targetVoice,
      rate,
      pitch,
      volume
    );
    await ttsPlayer.play(testText);
  };

  return (
    <div className="space-y-6 py-1">
      {/* Engine Selection Group */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">
          Active Text-To-Speech Engine
        </h2>
        <div className="rounded-none bg-neutral-900 border-2 border-white/10 overflow-hidden divide-y divide-white/10">
          {/* WebSpeech Engine */}
          <button
            type="button"
            onClick={() => handleSelectEngine("webspeech")}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">Browser System WebSpeech</span>
                  {engine === "webspeech" && (
                    <span className="text-[9px] bg-amber-500 text-black px-2 py-0.5 rounded-full font-extrabold">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-400 truncate mt-0.5">
                  Free built-in voices. Zero download required.
                </p>
              </div>
            </div>
            {engine === "webspeech" ? (
              <div className="w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full border border-white/20 shrink-0" />
            )}
          </button>

          {/* AWS Polly */}
          <button
            type="button"
            onClick={() => handleSelectEngine("polly")}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">AWS Polly (Cloud Neural)</span>
                  {engine === "polly" && (
                    <span className="text-[9px] bg-amber-500 text-black px-2 py-0.5 rounded-full font-extrabold">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-400 truncate mt-0.5">
                  Studio-quality neural voices (needs AWS keys).
                </p>
              </div>
            </div>
            {engine === "polly" ? (
              <div className="w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full border border-white/20 shrink-0" />
            )}
          </button>

          {/* Dhivehi (Keyless dhivehi.mv proxy) Engine */}
          <button
            type="button"
            onClick={() => handleSelectEngine("dhivehi")}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                {" "}
                <Globe className="w-5 h-5" />{" "}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    Keyless Dhivehi (dhivehi.mv)
                  </span>
                  {engine === "dhivehi" && (
                    <span className="text-[9px] bg-amber-500 text-black px-2 py-0.5 rounded-full font-extrabold">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-400 truncate mt-0.5">
                  Common Voice-based Dhivehi TTS. No API key, no download.
                </p>
              </div>
            </div>
            {engine === "dhivehi" ? (
              <div className="w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full border border-white/20 shrink-0" />
            )}
          </button>
        </div>
      </div>

      {/* Dhivehi Engine Section */}
      {engine === "dhivehi" && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">
                Dhivehi Voice (Keyless)
              </h3>
            </div>
            <span className="text-xs text-neutral-400">
              Powered by dhivehi.mv · Malé, MV
            </span>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-200/90 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              This uses the{" "}
              <a
                href="https://dhivehi.mv/tools/tts/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-amber-400"
              >
                dhivehi.mv Common Voice TTS
              </a>{" "}
              service via a keyless Worker proxy. No login or API key required.
              Audio is streamed as MP3 and played through your device speakers.
            </span>
          </div>

          {/* Gender selector */}\{" "}
          <div className="space-y-2">
            {" "}
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Voice Gender
            </label>
            <select
              value={localStorage.getItem("bulletin_dhivehi_gender") || "f"}
              onChange={(e) => {
                const g = e.target.value as "m" | "f";
                ttsPlayer.setDhivehiGender(g);
              }}
              className="w-full bg-neutral-900 text-white text-sm rounded-xl px-4 py-3 border border-white/10 focus:border-amber-500 focus:outline-none"
            >
              {" "}
              <option value="f">Female (Default)</option>
              <option value="m">Male</option>
            </select>
          </div>

          {/* Test button */}\{" "}
          <button
            onClick={() =>
              handleTestVoice(undefined, undefined, undefined, undefined, "dhivehi")
            }
            className="w-full p-3 rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-[0.98] text-xs font-bold flex items-center justify-center gap-2 transition-all"
          >
            {" "}
            {isPlayingTest ? (
              <Square className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}{" "}
            {isPlayingTest ? "Stop Preview" : "Test Dhivehi Voice"}
          </button>
        </div>
      )}{" "}

      {engine === "webspeech" && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">
                Browser System Voices
              </h3>
            </div>
            <span className="text-xs text-neutral-400">
              {webSpeechVoicesList.length} voices detected on your device
            </span>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-200/90 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Pro Tip:</strong> Voices labeled <span className="text-amber-400 font-bold">✨ NEURAL / NATURAL</span> (like Microsoft Edge Online Natural, Google Wavenet, or Apple Enhanced Siri) sound substantially more human and less robotic.
            </span>
          </div>

          {/* Quick Voice Dropdown Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Quick Voice Select
            </label>
            <select
              value={webSpeechVoiceName}
              onChange={(e) => handleSelectWebSpeechVoice(e.target.value)}
              className="w-full bg-neutral-900 text-white text-sm rounded-xl px-4 py-3 border border-white/10 focus:border-amber-500 focus:outline-none"
            >
              <option value="">-- Default Best Voice --</option>
              {webSpeechVoicesList.map((sv) => (
                <option key={sv.voice.name} value={sv.voice.name}>
                  {sv.isNatural ? "✨ " : ""}{sv.voice.name} ({sv.voice.lang || "en"})
                </option>
              ))}
            </select>
          </div>

          {/* Top Voices Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
            {webSpeechVoicesList.slice(0, 16).map((sv) => {
              const isSelected = webSpeechVoiceName === sv.voice.name;
              const isTestingThis = isPlayingTest && activeTestPack === sv.voice.name;

              return (
                <div
                  key={sv.voice.name}
                  onClick={() => handleSelectWebSpeechVoice(sv.voice.name)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? "border-amber-500 bg-amber-500/10 shadow-md"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="space-y-1 min-w-0 pr-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm truncate">{sv.voice.name}</span>
                      {sv.isNatural && (
                        <span className="text-[9px] uppercase font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full shrink-0">
                          ✨ Natural
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-400 flex items-center gap-2">
                      <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-[10px]">
                        {sv.voice.lang || "en-US"}
                      </span>
                      {sv.voice.localService ? <span>Local Engine</span> : <span>Network Neural</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectWebSpeechVoice(sv.voice.name);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors ${
                        isSelected
                          ? "bg-amber-500 text-black"
                          : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTestVoice(undefined, undefined, undefined, sv.voice.name);
                      }}
                      className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                      title="Preview this voice"
                    >
                      {isTestingThis ? (
                        <Square className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>
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
      <div className="p-4 rounded-none bg-white/5 border-2 border-white/15 flex items-center justify-between">
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
          className="px-4 py-2 rounded-none border-2 border-neutral-950 bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-colors flex items-center gap-2"
        >
          {isPlayingTest ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          {isPlayingTest ? "Stop Test" : "Test Active Voice"}
        </button>
      </div>

      {/* Auto-Scroll Toggle */}
      <div className="p-4 rounded-none bg-white/5 border-2 border-white/15 flex items-center justify-between">
        <div className="space-y-1 pr-4">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <span>Auto-Scroll On Finish</span>
            {autoScroll && (
              <span className="text-[10px] bg-amber-500 text-black font-extrabold px-2 py-0.5 rounded-none border border-black/30">
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
            localStorage.setItem("bulletin_auto_scroll", next ? "true" : "false");
          }}
          className={`w-14 h-8 rounded-none p-1 border-2 transition-colors duration-300 relative shrink-0 ${
            autoScroll ? "bg-amber-500 border-amber-600" : "bg-white/20 border-white/10"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-none bg-neutral-950 shadow-md transition-transform duration-300 ${
              autoScroll ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

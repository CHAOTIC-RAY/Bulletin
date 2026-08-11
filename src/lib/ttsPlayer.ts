// Unified Raadhavalhi TTS Engine
// Free, keyless browser WebSpeech (SpeechSynthesis) is the default — zero
// download, zero API key, no 114 MB WASM model to crash low-end pages.
// Piper TTS (in-browser WASM neural voices) remains available as an optional
// local engine for users who want a different voice and have the bandwidth to
// download a ~114 MB model. The reverse-engineered Edge TTS WebSocket was
// removed: Microsoft killed that endpoint (401/403), so it only ever 502'd.

import { synthesizePiperAudio, PIPER_VOICE_PACKS } from "./piperVoiceManager";
import { getWebSpeechVoices, pickVoice } from "./webSpeechEngine";
import { synthesizePolly } from "./pollyEngine";

export type TtsEngineType = "webspeech" | "piper" | "polly";

export interface TtsCallbacks {
  onSubtitle?: (text: string) => void;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onError?: (msg: string) => void;
}

function splitSentences(text: string): string[] {
  return (text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [text]).map((s) => s.trim()).filter(Boolean);
}

export class RaadhavalhiTts {
  private cb: TtsCallbacks = {};
  private engine: TtsEngineType = "webspeech";
  private piperPackId = "ryan-high";
  private pollyVoiceId = "Matthew";
  private pollyEngine: "standard" | "neural" = "neural";
  private webSpeechLang = "en-US";
  private webSpeechVoice = "";
  private rate = 1;
  private pitch = 1;
  private volume = 1;

  private playing = false;
  private currentPlayId = 0;
  private currentAudio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private utter: SpeechSynthesisUtterance | null = null;

  constructor(cb?: TtsCallbacks) {
    if (cb) this.cb = cb;
    this.loadSettings();
  }

  public loadSettings() {
    if (typeof localStorage !== "undefined") {
      const savedEngine = localStorage.getItem("raadhavalhi_tts_engine") as TtsEngineType;
      if (savedEngine === "webspeech" || savedEngine === "piper" || savedEngine === "polly") this.engine = savedEngine;

      const savedPiper = localStorage.getItem("raadhavalhi_piper_voice");
      if (savedPiper) this.piperPackId = savedPiper;

      const savedPolly = localStorage.getItem("raadhavalhi_polly_voice");
      if (savedPolly) this.pollyVoiceId = savedPolly;

      const savedPollyEngine = localStorage.getItem("raadhavalhi_polly_engine");
      if (savedPollyEngine === "standard" || savedPollyEngine === "neural") this.pollyEngine = savedPollyEngine;

      const savedVoice = localStorage.getItem("raadhavalhi_webspeech_voice");
      if (savedVoice) this.webSpeechVoice = savedVoice;

      const savedRate = localStorage.getItem("raadhavalhi_tts_rate");
      if (savedRate) this.rate = parseFloat(savedRate);

      const savedPitch = localStorage.getItem("raadhavalhi_tts_pitch");
      if (savedPitch) this.pitch = parseFloat(savedPitch);

      const savedVol = localStorage.getItem("raadhavalhi_tts_volume");
      if (savedVol) this.volume = Math.min(1, Math.max(0, parseFloat(savedVol)));
    }
  }

  public setCallbacks(cb: TtsCallbacks) {
    this.cb = cb;
  }

  public setEngine(
    engine: TtsEngineType,
    piperPackId?: string,
    webSpeechLang?: string
  ) {
    this.engine = engine;
    if (piperPackId) this.piperPackId = piperPackId;
    if (webSpeechLang) this.webSpeechLang = webSpeechLang;

    if (typeof localStorage !== "undefined") {
      localStorage.setItem("raadhavalhi_tts_engine", engine);
      if (piperPackId) localStorage.setItem("raadhavalhi_piper_voice", piperPackId);
    }
  }

  public setPolly(voiceId: string, engine: "standard" | "neural" = "neural") {
    this.pollyVoiceId = voiceId;
    this.pollyEngine = engine;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("raadhavalhi_polly_voice", voiceId);
      localStorage.setItem("raadhavalhi_polly_engine", engine);
    }
  }

  public setVoice(lang: string, voiceName = "", rate = 1, pitch = 1, volume = 1) {
    this.webSpeechLang = lang || "en-US";
    this.webSpeechVoice = voiceName;
    this.rate = rate;
    this.pitch = pitch;
    this.volume = Math.min(1, Math.max(0, volume));
  }

  public setGain(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
  }

  public async play(text: string) {
    this.stop();
    this.loadSettings();
    this.playing = true;
    const playId = ++this.currentPlayId;
    this.cb.onPlay?.();

    const sentences = splitSentences(text);
    if (!sentences.length) {
      if (playId === this.currentPlayId) {
        this.playing = false;
        this.cb.onEnded?.();
      }
      return;
    }

    if (this.engine === "piper") {
      await this.playPiper(sentences, playId);
    } else if (this.engine === "polly") {
      await this.playPolly(sentences, playId);
    } else {
      this.playWebSpeech(sentences, playId);
    }
  }

  // --- 1.5 Polly TTS Playback (AWS cloud, MP3 via backend proxy) ---
  private async playPolly(sentences: string[], playId: number) {
    try {
      let idx = 0;
      const playNextSentence = async () => {
        if (!this.playing || playId !== this.currentPlayId || idx >= sentences.length) {
          if (playId === this.currentPlayId) {
            this.playing = false;
            this.cb.onEnded?.();
          }
          return;
        }

        const sentence = sentences[idx];
        this.cb.onSubtitle?.(sentence);

        try {
          const blob = await synthesizePolly(
            sentence,
            this.pollyVoiceId,
            this.pollyEngine,
            this.rate
          );

          if (!this.playing || playId !== this.currentPlayId) return;

          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.volume = Math.min(1, Math.max(0, this.volume));
          this.currentAudio = audio;

          audio.onended = () => {
            URL.revokeObjectURL(url);
            if (!this.playing || playId !== this.currentPlayId) return;
            idx++;
            playNextSentence();
          };

          audio.onerror = () => {
            URL.revokeObjectURL(url);
            if (!this.playing || playId !== this.currentPlayId) return;
            this.cb.onError?.("Polly audio playback failed");
          };

          await audio.play();
        } catch (e: any) {
          console.warn("Polly TTS synthesis failed:", e);
          if (!this.playing || playId !== this.currentPlayId) return;
          this.cb.onError?.(e?.message || "Polly TTS failed");
        }
      };

      await playNextSentence();
    } catch (err: any) {
      console.warn("Polly TTS failed:", err);
      this.cb.onError?.(err?.message || "Polly TTS failed");
    }
  }

  // --- 1. Piper TTS Playback (optional local WASM engine) ---
  private async playPiper(sentences: string[], playId: number) {
    try {
      const bufferPromiseCache = new Map<number, Promise<AudioBuffer>>();

      const getAudioBuffer = (index: number): Promise<AudioBuffer> => {
        if (!bufferPromiseCache.has(index)) {
          const promise = synthesizePiperAudio(sentences[index], this.piperPackId);
          bufferPromiseCache.set(index, promise);
        }
        return bufferPromiseCache.get(index)!;
      };

      const prefetch = (currentIndex: number) => {
        for (let i = 1; i <= 2; i++) {
          const nextIndex = currentIndex + i;
          if (nextIndex < sentences.length) {
            getAudioBuffer(nextIndex).catch((err) => {
              console.warn(`Piper pre-synthesis failed for index ${nextIndex}`, err);
            });
          }
        }
      };

      let idx = 0;
      const playNextSentence = async () => {
        if (!this.playing || playId !== this.currentPlayId || idx >= sentences.length) {
          if (playId === this.currentPlayId) {
            this.playing = false;
            this.cb.onEnded?.();
          }
          return;
        }

        const sentence = sentences[idx];
        this.cb.onSubtitle?.(sentence);

        try {
          // Trigger prefetch for the next sentences immediately
          prefetch(idx);

          const audioBuffer = await getAudioBuffer(idx);
          if (!this.playing || playId !== this.currentPlayId) return;

          if (!this.audioCtx || this.audioCtx.state === "closed") {
            this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          if (this.audioCtx.state === "suspended") {
            await this.audioCtx.resume();
          }

          const source = this.audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.playbackRate.value = this.rate;
          source.connect(this.audioCtx.destination);
          this.activeSource = source;

          source.onended = () => {
            if (!this.playing || playId !== this.currentPlayId) return;
            idx++;
            playNextSentence();
          };

          source.start();
        } catch (e: any) {
          console.warn("Piper TTS error, using browser speech fallback:", e);
          this.playWebSpeech(sentences.slice(idx), playId);
        }
      };

      await playNextSentence();
    } catch (err: any) {
      console.warn("Piper TTS failed, using browser speech fallback:", err);
      this.playWebSpeech(sentences, playId);
    }
  }

  // --- 2. Browser WebSpeech (default, free, keyless) ---
  private playWebSpeech(sentences: string[], playId: number) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      this.cb.onError?.("Web Speech API not supported.");
      return;
    }

    const voices = getWebSpeechVoices();
    const chosen = this.webSpeechVoice
      ? voices.find((v) => v.name === this.webSpeechVoice || v.voiceURI === this.webSpeechVoice)
      : pickVoice(this.webSpeechLang);

    let idx = 0;
    const speakNext = () => {
      if (!this.playing || playId !== this.currentPlayId || idx >= sentences.length) {
        if (playId === this.currentPlayId) {
          this.playing = false;
          this.cb.onEnded?.();
        }
        return;
      }
      const sentence = sentences[idx];
      const u = new SpeechSynthesisUtterance(sentence);
      u.lang = this.webSpeechLang || "en-US";
      u.rate = this.rate;
      u.pitch = this.pitch;
      u.volume = Math.min(1, Math.max(0, this.volume));

      if (chosen) u.voice = chosen;

      u.onboundary = () => {
        if (playId === this.currentPlayId) {
          this.cb.onSubtitle?.(sentence);
        }
      };
      u.onend = () => {
        if (!this.playing || playId !== this.currentPlayId) return;
        idx++;
        speakNext();
      };
      u.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") return;
        if (playId === this.currentPlayId) {
          this.cb.onError?.(e.error || "Speech failed");
        }
      };

      this.utter = u;
      if (playId === this.currentPlayId) {
        this.cb.onSubtitle?.(sentence);
      }
      window.speechSynthesis.speak(u);
    };

    speakNext();
  }

  public pause() {
    this.playing = false;
    if (this.audioCtx && this.audioCtx.state === "running") this.audioCtx.suspend();
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.pause();
    this.cb.onPause?.();
  }

  public resume() {
    this.playing = true;
    if (this.audioCtx && this.audioCtx.state === "suspended") this.audioCtx.resume();
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.resume();
    this.cb.onPlay?.();
  }

  public stop() {
    this.playing = false;
    this.currentPlayId++;

    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch {}
      this.activeSource = null;
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    this.utter = null;
  }

  public get isPlaying(): boolean {
    return this.playing;
  }
}

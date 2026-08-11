// Unified Raadhavalhi TTS Engine
// Supports WebSpeech, Piper TTS (High Voice Packs), and Edge TTS (openai-edge-tts style)

import { synthesizePiperAudio, PIPER_VOICE_PACKS } from "./piperVoiceManager";
import { synthesizeEdgeTts, EDGE_VOICES } from "./edgeTtsEngine";

export type TtsEngineType = "webspeech" | "piper" | "edgetts";

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
  private engine: TtsEngineType = "piper";
  private piperPackId = "ryan-high";
  private edgeVoiceId = "en-US-AvaMultilingualNeural";
  private webSpeechLang = "en-US";
  private webSpeechVoice = "";
  private rate = 1;
  private pitch = 1;

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
      if (savedEngine) this.engine = savedEngine;

      const savedPiper = localStorage.getItem("raadhavalhi_piper_voice");
      if (savedPiper) this.piperPackId = savedPiper;

      const savedEdge = localStorage.getItem("raadhavalhi_edge_voice");
      if (savedEdge) this.edgeVoiceId = savedEdge;

      const savedRate = localStorage.getItem("raadhavalhi_tts_rate");
      if (savedRate) this.rate = parseFloat(savedRate);

      const savedPitch = localStorage.getItem("raadhavalhi_tts_pitch");
      if (savedPitch) this.pitch = parseFloat(savedPitch);
    }
  }

  public setCallbacks(cb: TtsCallbacks) {
    this.cb = cb;
  }

  public setEngine(
    engine: TtsEngineType,
    piperPackId?: string,
    edgeVoiceId?: string,
    webSpeechLang = "en-US"
  ) {
    this.engine = engine;
    if (piperPackId) this.piperPackId = piperPackId;
    if (edgeVoiceId) this.edgeVoiceId = edgeVoiceId;
    this.webSpeechLang = webSpeechLang;

    if (typeof localStorage !== "undefined") {
      localStorage.setItem("raadhavalhi_tts_engine", engine);
      if (piperPackId) localStorage.setItem("raadhavalhi_piper_voice", piperPackId);
      if (edgeVoiceId) localStorage.setItem("raadhavalhi_edge_voice", edgeVoiceId);
    }
  }

  public setVoice(lang: string, voiceName = "", rate = 1, pitch = 1) {
    this.webSpeechLang = lang || "en-US";
    this.webSpeechVoice = voiceName;
    this.rate = rate;
    this.pitch = pitch;
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
    } else if (this.engine === "edgetts") {
      await this.playEdgeTts(sentences, playId);
    } else {
      this.playWebSpeech(sentences, playId);
    }
  }

  // --- 1. Piper TTS Playback ---
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

  // --- 2. Edge TTS Playback ---
  private async playEdgeTts(sentences: string[], playId: number) {
    try {
      const blobPromiseCache = new Map<number, Promise<Blob>>();

      const getBlob = (index: number): Promise<Blob> => {
        if (!blobPromiseCache.has(index)) {
          const promise = synthesizeEdgeTts(
            sentences[index],
            this.edgeVoiceId,
            this.rate,
            this.pitch
          );
          blobPromiseCache.set(index, promise);
        }
        return blobPromiseCache.get(index)!;
      };

      const prefetch = (currentIndex: number) => {
        for (let i = 1; i <= 2; i++) {
          const nextIndex = currentIndex + i;
          if (nextIndex < sentences.length) {
            getBlob(nextIndex).catch((err) => {
              console.warn(`Edge pre-synthesis failed for index ${nextIndex}`, err);
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

          const blob = await getBlob(idx);

          if (!this.playing || playId !== this.currentPlayId) return;

          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          this.currentAudio = audio;

          audio.onended = () => {
            URL.revokeObjectURL(url);
            if (!this.playing || playId !== this.currentPlayId) return;
            idx++;
            playNextSentence();
          };

          audio.onerror = () => {
            URL.revokeObjectURL(url);
            console.warn("Edge TTS audio element error, using browser speech fallback");
            this.playWebSpeech(sentences.slice(idx), playId);
          };

          await audio.play();
        } catch (e) {
          console.warn("Edge TTS synthesis failed, using browser speech fallback:", e);
          this.playWebSpeech(sentences.slice(idx), playId);
        }
      };

      await playNextSentence();
    } catch (err: any) {
      console.warn("Edge TTS failed, using browser speech fallback:", err);
      this.playWebSpeech(sentences, playId);
    }
  }

  // --- 3. Web Speech API Fallback ---
  private playWebSpeech(sentences: string[], playId: number) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      this.cb.onError?.("Web Speech API not supported.");
      return;
    }
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
      u.lang = this.webSpeechLang;
      u.rate = this.rate;
      u.pitch = this.pitch;

      if (this.webSpeechVoice) {
        const match = window.speechSynthesis.getVoices().find((v) => v.name === this.webSpeechVoice);
        if (match) u.voice = match;
      } else if (window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        const isMale =
          this.edgeVoiceId.includes("Andrew") ||
          this.edgeVoiceId.includes("Guy") ||
          this.edgeVoiceId.includes("Brian") ||
          this.piperPackId.includes("ryan") ||
          this.piperPackId.includes("alan");

        let voiceMatch = voices.find((v) => {
          const vName = v.name.toLowerCase();
          return (
            v.lang.startsWith("en") &&
            (isMale
              ? vName.includes("male") || vName.includes("david") || vName.includes("mark") || vName.includes("george") || vName.includes("guy")
              : vName.includes("female") || vName.includes("zira") || vName.includes("samantha") || vName.includes("ava") || vName.includes("aria"))
          );
        });

        if (!voiceMatch) {
          voiceMatch = voices.find((v) => v.lang.startsWith("en"));
        }
        if (voiceMatch) u.voice = voiceMatch;
        if (isMale) u.pitch = Math.max(0.7, u.pitch * 0.85);
      }

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
    if (this.currentAudio) this.currentAudio.pause();
    if (this.audioCtx && this.audioCtx.state === "running") this.audioCtx.suspend();
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.pause();
    this.cb.onPause?.();
  }

  public resume() {
    this.playing = true;
    if (this.currentAudio) this.currentAudio.play();
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

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
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

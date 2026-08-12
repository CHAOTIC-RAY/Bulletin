// Unified Bulletin TTS Engine
// Free, keyless browser WebSpeech (SpeechSynthesis) is the default — zero
// download, zero API key. The reverse-engineered Edge TTS WebSocket was
// removed: Microsoft killed that endpoint (401/403), so it only ever 502'd.
// Piper WAS a local WASM option but was removed: the 114 MB ONNX model
// crashed low-end pages and added ~450 KB of vendored deps. WebSpeech (free)
// and the keyless Dhivehi proxy (dhivehi.mv) cover all locales now.

import { getWebSpeechVoices, pickVoice, prepareTextForNaturalSpeech } from "./webSpeechEngine";
import { synthesizePolly } from "./pollyEngine";
import { cleanTtsText } from "./feedSanitize";

export type TtsEngineType = "webspeech" | "polly" | "dhivehi";

export interface TtsCallbacks {
  onSubtitle?: (text: string) => void;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onError?: (msg: string) => void;
}

function splitSentences(text: string): string[] {
  return prepareTextForNaturalSpeech(text);
}

export class BulletinTts {
  private cb: TtsCallbacks = {};
  private engine: TtsEngineType = "webspeech";
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
  private utter: SpeechSynthesisUtterance | null = null;

  constructor(cb?: TtsCallbacks) {
    if (cb) this.cb = cb;
    this.loadSettings();
  }

  public loadSettings() {
    if (typeof localStorage !== "undefined") {
      const savedEngine = localStorage.getItem("bulletin_tts_engine") as TtsEngineType;
      if (savedEngine === "webspeech" || savedEngine === "polly" || savedEngine === "dhivehi") this.engine = savedEngine;

      const savedPolly = localStorage.getItem("bulletin_polly_voice");
      if (savedPolly) this.pollyVoiceId = savedPolly;

      const savedPollyEngine = localStorage.getItem("bulletin_polly_engine");
      if (savedPollyEngine === "standard" || savedPollyEngine === "neural") this.pollyEngine = savedPollyEngine;

      const savedVoice = localStorage.getItem("bulletin_webspeech_voice");
      if (savedVoice) this.webSpeechVoice = savedVoice;

      const savedRate = localStorage.getItem("bulletin_tts_rate");
      if (savedRate) this.rate = parseFloat(savedRate);

      const savedPitch = localStorage.getItem("bulletin_tts_pitch");
      if (savedPitch) this.pitch = parseFloat(savedPitch);

      const savedVol = localStorage.getItem("bulletin_tts_volume");
      if (savedVol) this.volume = Math.min(1, Math.max(0, parseFloat(savedVol)));
    }
  }

  public setCallbacks(cb: TtsCallbacks) {
    this.cb = cb;
  }

  public setEngine(
    engine: TtsEngineType,
    _voiceId?: string,
    webSpeechLang?: string
  ) {
    this.engine = engine;
    if (webSpeechLang) this.webSpeechLang = webSpeechLang;

    if (typeof localStorage !== "undefined") {
      localStorage.setItem("bulletin_tts_engine", engine);
    }
  }

  public setPolly(voiceId: string, engine: "standard" | "neural" = "neural") {
    this.pollyVoiceId = voiceId;
    this.pollyEngine = engine;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("bulletin_polly_voice", voiceId);
      localStorage.setItem("bulletin_polly_engine", engine);
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

    if (this.engine === "polly") {
      await this.playPolly(sentences, playId);
    } else if (this.engine === "dhivehi") {
      await this.playDhivehi(sentences, playId);
    } else {
      this.playWebSpeech(sentences, playId);
    }
  }

  // --- 1.5 Polly TTS Playback (AWS cloud, MP3 via backend proxy) ---
  // Sentences are grouped into chunks and synthesized as ONE MP3 per chunk
  // (continuous audio, no per-sentence gap). The next chunk is synthesized in
  // parallel while the current one plays, so playback is gap-free.
  private async playPolly(sentences: string[], playId: number) {
    try {
      // Group sentences into chunks (~4 sentences / <2800 chars) to cut the
      // number of network round-trips and keep audio continuous within a chunk.
      const CHUNK_SENTENCES = 4;
      const MAX_CHARS = 2800;
      const chunks: string[] = [];
      let buf: string[] = [];
      let bufLen = 0;
      for (const s of sentences) {
        if (buf.length && (buf.length >= CHUNK_SENTENCES || bufLen + s.length > MAX_CHARS)) {
          chunks.push(buf.join(" "));
          buf = [];
          bufLen = 0;
        }
        buf.push(s);
        bufLen += s.length;
      }
      if (buf.length) chunks.push(buf.join(" "));

      let ci = 0;
      const playNextChunk = async () => {
        if (!this.playing || playId !== this.currentPlayId || ci >= chunks.length) {
          if (playId === this.currentPlayId) {
            this.playing = false;
            this.cb.onEnded?.();
          }
          return;
        }

        const text = chunks[ci];
        this.cb.onSubtitle?.(text);

        // Warm the cache for upcoming chunks so they're ready the instant the
        // current one ends (overlap synthesis with playback → no gap).
        for (let k = ci + 1; k < Math.min(ci + 3, chunks.length); k++) {
          synthesizePolly(chunks[k], this.pollyVoiceId, this.pollyEngine, this.rate).catch(() => {});
        }

        try {
          const blob = await synthesizePolly(text, this.pollyVoiceId, this.pollyEngine, this.rate);
          if (!this.playing || playId !== this.currentPlayId) return;

          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.volume = Math.min(1, Math.max(0, this.volume));
          this.currentAudio = audio;

          audio.onended = () => {
            URL.revokeObjectURL(url);
            if (!this.playing || playId !== this.currentPlayId) return;
            ci++;
            playNextChunk();
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

      await playNextChunk();
    } catch (err: any) {
      console.warn("Polly TTS failed:", err);
      this.cb.onError?.(err?.message || "Polly TTS failed");
    }
  }

  // --- Dhivehi TTS Playback (keyless proxy of dhivehi.mv /tools/tts) ---
  // Streams MP3 audio from the Worker's /api/tts/dv endpoint (which itself
  // proxies dhivehi.mv, avoiding CORS). No API keys / logins required.
  private dhivehiGender: "m" | "f" = "f";
  public setDhivehiGender(g: "m" | "f") {
    this.dhivehiGender = g;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("bulletin_dhivehi_gender", g);
    }
  }

  private async fetchDhivehiAudio(text: string): Promise<Blob> {
    const params = new URLSearchParams({ q: text, g: this.dhivehiGender });
    const res = await fetch(`/api/tts/dv?${params.toString()}`, {
      headers: { Accept: "audio/mpeg" },
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: "" }))) as { error?: string };
      throw new Error(err?.error || `Dhivehi TTS error ${res.status}`);
    }
    return res.blob();
  }

  private async playDhivehi(sentences: string[], playId: number) {
    // dhivehi.mv has a practical per-request length limit, so chunk the text.
    const MAX_CHARS = 500;
    const chunks: string[] = [];
    let buf = "";
    for (const s of sentences) {
      if (buf && buf.length + s.length > MAX_CHARS) {
        chunks.push(buf);
        buf = "";
      }
      buf += (buf ? " " : "") + s;
    }
    if (buf) chunks.push(buf);

    try {
      let ci = 0;
      const playNextChunk = async () => {
        if (!this.playing || playId !== this.currentPlayId || ci >= chunks.length) {
          if (playId === this.currentPlayId) {
            this.playing = false;
            this.cb.onEnded?.();
          }
          return;
        }
        const text = chunks[ci];
        this.cb.onSubtitle?.(text);
        try {
          const blob = await this.fetchDhivehiAudio(text);
          if (!this.playing || playId !== this.currentPlayId) return;
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.volume = Math.min(1, Math.max(0, this.volume));
          this.currentAudio = audio;
          audio.onended = () => {
            URL.revokeObjectURL(url);
            if (!this.playing || playId !== this.currentPlayId) return;
            ci++;
            playNextChunk();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            if (!this.playing || playId !== this.currentPlayId) return;
            this.cb.onError?.("Dhivehi audio playback failed");
          };
          await audio.play();
        } catch (e: any) {
          console.warn("Dhivehi TTS synthesis failed:", e);
          if (!this.playing || playId !== this.currentPlayId) return;
          this.cb.onError?.(e?.message || "Dhivehi TTS failed");
        }
      };
      await playNextChunk();
    } catch (err: any) {
      console.warn("Dhivehi TTS failed:", err);
      this.cb.onError?.(err?.message || "Dhivehi TTS failed");
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

    const QUEUE_AHEAD = 3; // keep this many utterances queued so they play back-to-back
    let idx = 0;

    // Chrome/Edge cut SpeechSynthesis off after ~15s of continuous playback
    // because the queue drains silently. A periodic pause/resume keeps the
    // engine alive so long articles read to the end.
    this.clearWebSpeechKeepAlive();
    this.webSpeechKeepAlive = setInterval(() => {
      if (playId !== this.currentPlayId || !this.playing) return;
      try {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } catch {}
    }, 9000);

    const buildUtterance = (sentence: string, i: number): SpeechSynthesisUtterance => {
      const u = new SpeechSynthesisUtterance(sentence);
      u.lang = this.webSpeechLang || "en-US";

      // Expressive newsreader cadence: vary pitch/rate slightly per sentence so
      // the voice doesn't sound robotic, and add emphasis on emotional cues.
      const isExcited = /[!？]|wow|breaking|shock|surge|win|victory|celebrat/i.test(sentence);
      const isQuestion = /\?$/.test(sentence.trim());
      const basePitch = this.pitch;
      const baseRate = this.rate || 1;
      const wobble = (i % 2 === 0 ? 1 : -1) * 0.06;
      let pitch = Math.max(0, Math.min(2, basePitch + wobble));
      let rate = baseRate;
      if (isExcited) {
        pitch = Math.min(2, basePitch + 0.18);
        rate = Math.min(2, baseRate + 0.08);
      } else if (isQuestion) {
        pitch = Math.min(2, basePitch + 0.1);
      } else if (sentence.length > 160) {
        rate = Math.max(0.6, baseRate - 0.06); // slow down for long reads
      }
      u.rate = rate;
      u.pitch = pitch;
      u.volume = Math.min(1, Math.max(0, this.volume));

      if (chosen) u.voice = chosen;

      u.onboundary = () => {
        if (playId === this.currentPlayId) {
          this.cb.onSubtitle?.(sentence);
        }
      };
      u.onend = () => {
        if (!this.playing || playId !== this.currentPlayId) return;
        this.queuedCount = Math.max(0, this.queuedCount - 1);
        idx++;
        // Queue the next utterances immediately so playback is gap-free.
        queueAhead();
      };
      u.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") return;
        if (playId === this.currentPlayId) {
          this.queuedCount = Math.max(0, this.queuedCount - 1);
          this.clearWebSpeechKeepAlive();
          this.cb.onError?.(e.error || "Speech failed");
        }
      };
      return u;
    };

    const queueAhead = () => {
      if (!this.playing || playId !== this.currentPlayId) return;
      // Keep up to QUEUE_AHEAD utterances buffered so they play back-to-back
      // with no gap between sentences.
      while (this.queuedCount < QUEUE_AHEAD && idx < sentences.length) {
        const sentence = sentences[idx];
        this.utter = buildUtterance(sentence, idx);
        this.queuedCount++;
        if (playId === this.currentPlayId) {
          this.cb.onSubtitle?.(sentence);
        }
        window.speechSynthesis.speak(this.utter);
        idx++;
      }
      // When the queue is drained and nothing is left, we're done.
      if (this.queuedCount === 0 && idx >= sentences.length) {
        this.clearWebSpeechKeepAlive();
        if (playId === this.currentPlayId) {
          this.playing = false;
          this.cb.onEnded?.();
        }
      }
    };

    // Kick off the first utterances.
    queueAhead();
  }

  public pause() {
    this.playing = false;
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.pause();
    this.cb.onPause?.();
  }

  public resume() {
    this.playing = true;
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.resume();
    this.cb.onPlay?.();
  }

  public stop() {
    this.playing = false;
    this.currentPlayId++;
    this.queuedCount = 0;

    this.clearWebSpeechKeepAlive();

    if (this.currentAudio) {
      this.currentAudio.pause();
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

  private prefetchQueue: string[] = [];
  private isPrefetching = false;
  private currentPrefetchId = 0;
  private webSpeechKeepAlive: ReturnType<typeof setInterval> | null = null;
  private queuedCount = 0;

  private clearWebSpeechKeepAlive() {
    if (this.webSpeechKeepAlive !== null) {
      clearInterval(this.webSpeechKeepAlive);
      this.webSpeechKeepAlive = null;
    }
  }

  public async prefetchItems(items: any[], startIndex: number) {
    if (this.engine !== "polly") {
      return;
    }

    const prefetchId = ++this.currentPrefetchId;
    this.prefetchQueue = [];
    
    const numItemsToPrefetch = 5;
    const itemsToPrefetch = items.slice(startIndex, startIndex + numItemsToPrefetch);

    const sentencesToPrefetch: string[] = [];

    for (const item of itemsToPrefetch) {
      if (!item) continue;
      if (prefetchId !== this.currentPrefetchId) return;

      // Add title sentences
      const titleSentences = splitSentences(item.title);
      for (const s of titleSentences) {
        if (s.trim()) {
          sentencesToPrefetch.push(s);
        }
      }

      // Add summary/content sentences
      const detailedText = item.summary && item.summary.trim()
        ? cleanTtsText(item.summary).replace(/\s+/g, " ").trim()
        : item.content
        ? cleanTtsText(item.content).replace(/\s+/g, " ").trim()
        : "";

      if (detailedText.trim()) {
        const summarySentences = splitSentences(detailedText);
        for (const s of summarySentences) {
          if (s.trim()) {
            sentencesToPrefetch.push(s);
          }
        }
      }
    }

    this.prefetchQueue = sentencesToPrefetch;
    if (this.isPrefetching) return;

    this.isPrefetching = true;
    while (this.prefetchQueue.length > 0) {
      if (prefetchId !== this.currentPrefetchId) {
        this.isPrefetching = false;
        return;
      }
      const sentence = this.prefetchQueue.shift();
      if (!sentence) continue;

      try {
        if (this.engine === "polly") {
          await synthesizePolly(sentence, this.pollyVoiceId, this.pollyEngine, this.rate);
        }
      } catch (err) {
        console.warn("Background prefetch failed for sentence:", sentence, err);
      }

      // Yield 100ms
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.isPrefetching = false;
  }
}

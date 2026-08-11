// Browser WebSpeech (SpeechSynthesis) engine — the only free, keyless TTS path.
//
// TTSReader's "free" voices ARE the browser's built-in SpeechSynthesis voices
// (it ships WebSpeech for free, and charges only for the premium cloud voices).
// So wiring the app to use SpeechSynthesis directly gives the same free result
// with zero download, zero API key, and zero 114 MB WASM model to crash low-end
// pages. This replaces the dead reverse-engineered Edge TTS WebSocket.

let cachedVoices: SpeechSynthesisVoice[] = [];

/** Return the list of voices the browser currently exposes. */
export function getWebSpeechVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return cachedVoices;
  const v = window.speechSynthesis.getVoices();
  if (v && v.length) cachedVoices = v;
  return cachedVoices;
}

/**
 * Some browsers (notably Safari/iOS) populate voices asynchronously. Call this
 * once at startup; `cb` fires when voices become available. Returns an
 * unsubscribe function. No-op if SpeechSynthesis is unavailable.
 */
export function onVoicesReady(cb: () => void): () => void {
  if (typeof window === "undefined" || !window.speechSynthesis) return () => {};
  if (getWebSpeechVoices().length) {
    cb();
    return () => {};
  }
  const handler = () => cb();
  window.speechSynthesis.onvoiceschanged = handler;
  return () => {
    window.speechSynthesis.onvoiceschanged = null;
  };
}

/**
 * Pick the best available voice for a language, optionally honouring a saved
 * voice name. Prefers a "neural"/"natural"/"premium"-labelled voice when one
 * exists (these read much more naturally on Chrome/Edge), then falls back to
 * the first matching-language voice, then any voice.
 */
export function pickVoice(lang: string, preferredName = ""): SpeechSynthesisVoice | null {
  const voices = getWebSpeechVoices();
  if (!voices.length) return null;

  if (preferredName) {
    const exact = voices.find(
      (v) => v.name === preferredName || v.voiceURI === preferredName
    );
    if (exact) return exact;
  }

  const langKey = (lang || "en-US").split("-")[0].toLowerCase();
  const sameLang = voices.filter(
    (v) => v.lang && v.lang.toLowerCase().startsWith(langKey)
  );
  const pool = sameLang.length ? sameLang : voices;

  const premium = pool.find((v) => /neural|natural|premium|enhanced/i.test(v.name));
  return premium || pool[0] || null;
}

// Browser WebSpeech (SpeechSynthesis) engine — free, zero-download, keyless TTS.
//
// Provides intelligent voice scoring (Edge Natural, Chrome Wavenet/Google,
// Safari Enhanced/Premium/Siri), voice ranking, and prosody/text-sanitization
// utilities to make WebSpeech sound as human and non-robotic as possible.

let cachedVoices: SpeechSynthesisVoice[] = [];

/** Return the list of voices the browser currently exposes. */
export function getWebSpeechVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return cachedVoices;
  const v = window.speechSynthesis.getVoices();
  if (v && v.length) cachedVoices = v;
  return cachedVoices;
}

/**
 * Score a WebSpeech voice based on acoustic naturalness and quality.
 * High scores indicate neural, natural, enhanced, or studio-grade voices.
 */
export function scoreVoiceQuality(voice: SpeechSynthesisVoice): number {
  const name = voice.name || "";
  let score = 0;

  // Microsoft Edge Online Natural voices (extremely high quality, human-like)
  if (/Online \(Natural\)|Natural/i.test(name) && /Microsoft/i.test(name)) {
    score += 100;
  }
  // Google Wavenet / Natural / Neural voices
  else if (/Google/i.test(name) && /Natural|Neural|Wavenet|Premium|Enhanced/i.test(name)) {
    score += 95;
  }
  // Apple macOS / iOS Siri, Enhanced, Premium voices
  else if (/Enhanced|Premium|Siri/i.test(name)) {
    score += 90;
  }
  // General Neural / Natural / Premium / Studio keywords
  else if (/Neural|Natural|Premium|Enhanced|Studio|Wavenet/i.test(name)) {
    score += 85;
  }
  // Standard Google high quality voices
  else if (/Google/i.test(name)) {
    score += 65;
  }
  // Standard Microsoft voices
  else if (/Microsoft/i.test(name)) {
    score += 50;
  }
  // Local system voices
  else if (voice.localService) {
    score += 30;
  } else {
    score += 10;
  }

  // Bonus for US/UK/AU English or explicit natural locale matches
  if (/en-US|en-GB|en-AU|en-CA|en-IN/i.test(voice.lang)) {
    score += 5;
  }

  return score;
}

export interface ScoredVoice {
  voice: SpeechSynthesisVoice;
  score: number;
  isNatural: boolean;
  label: string;
}

/**
 * Return sorted WebSpeech voices, optionally filtered by language,
 * with natural/neural voices placed at the top.
 */
export function getSortedWebSpeechVoices(lang = "en"): ScoredVoice[] {
  const voices = getWebSpeechVoices();
  if (!voices.length) return [];

  const langKey = (lang || "en").split("-")[0].toLowerCase();
  
  // Filter for matching language first, but keep all voices if no exact match
  const matching = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith(langKey));
  const pool = matching.length > 0 ? matching : voices;

  const scored: ScoredVoice[] = pool.map((voice) => {
    const score = scoreVoiceQuality(voice);
    const isNatural = score >= 75 || /natural|neural|enhanced|premium|wavenet|siri/i.test(voice.name);
    
    let label = voice.name;
    if (isNatural) label = `✨ ${voice.name}`;
    if (voice.lang) label += ` (${voice.lang})`;

    return { voice, score, isNatural, label };
  });

  // Sort descending by score, then alphabetically
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.voice.name.localeCompare(b.voice.name);
  });

  return scored;
}

/**
 * Some browsers (notably Safari/iOS) populate voices asynchronously.
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
 * Pick the best available voice for a language, honoring a saved voice name
 * or falling back to the highest scored natural voice.
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

  const sorted = getSortedWebSpeechVoices(lang);
  return sorted.length ? sorted[0].voice : voices[0];
}

/**
 * Prepares raw text for natural speech synthesis by stripping noise, expanding
 * financial/tech abbreviations, adding natural prosody punctuation, and chunking
 * long sentences into human breath-phrases.
 */
export function prepareTextForNaturalSpeech(rawText: string): string[] {
  if (!rawText) return [];

  let text = rawText;

  // 1. Strip HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // 2. Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, " and ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  // 3. Remove URLs, citations like [1], hashtags, and noise
  text = text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\[\d+\]/g, "")
    .replace(/#\w+/g, "")
    .replace(/[•\t\r]/g, " ");

  // 4. Normalize quotes and dashes for speech pauses
  text = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[—–]/g, ", ")
    .replace(/\.{2,}/g, ".");

  // 5. Expand abbreviations for smooth cadence
  text = text
    .replace(/\bUSD\b/g, " U S dollars ")
    .replace(/\bEUR\b/g, " Euros ")
    .replace(/\bGBP\b/g, " British Pounds ")
    .replace(/\bAUD\b/g, " Australian dollars ")
    .replace(/\bRBA\b/g, " Reserve Bank of Australia ")
    .replace(/\bFed\b/g, " Federal Reserve ")
    .replace(/\bUS\b/g, " U.S. ")
    .replace(/\bUK\b/g, " U.K. ")
    .replace(/\bEU\b/g, " E.U. ")
    .replace(/\bAI\b/g, " A.I. ")
    .replace(/\bCEO\b/g, " C.E.O. ")
    .replace(/\bCFO\b/g, " C.F.O. ")
    .replace(/\bGDP\b/g, " G.D.P. ")
    .replace(/\bIT\b/g, " I.T. ")
    .replace(/%/g, " percent ")
    .replace(/\$([0-9,]+(?:\.[0-9]+)?)/g, "$1 dollars")
    .replace(/&/g, " and ");

  // 6. Split into primary sentence blocks
  const sentences = (text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [text])
    .map((s) => s.trim())
    .filter(Boolean);

  const finalChunks: string[] = [];

  for (const sentence of sentences) {
    // If a sentence is under 120 chars, keep intact
    if (sentence.length <= 120) {
      finalChunks.push(sentence);
      continue;
    }

    // Split long sentences at clause boundaries (, ; :) to create natural breath pauses
    const subClauses = sentence
      .split(/(?<=[,;:])/g)
      .map((c) => c.trim())
      .filter(Boolean);

    let currentChunk = "";
    for (const clause of subClauses) {
      if ((currentChunk + " " + clause).length > 120 && currentChunk) {
        finalChunks.push(currentChunk.trim());
        currentChunk = clause;
      } else {
        currentChunk = currentChunk ? `${currentChunk} ${clause}` : clause;
      }
    }
    if (currentChunk.trim()) {
      finalChunks.push(currentChunk.trim());
    }
  }

  return finalChunks.filter((c) => c.length > 1);
}


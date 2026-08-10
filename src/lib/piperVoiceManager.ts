// Piper TTS Voice Pack Manager & ONNX Neural Synthesizer
// Uses @diffusionstudio/vits-web under the hood for highly optimized in-browser speech synthesis.

import { predict, stored, remove, download } from "@diffusionstudio/vits-web";

export interface PiperVoicePack {
  id: string; // e.g. "ryan-high"
  name: string; // e.g. "Ryan (High)"
  key: string; // e.g. "en_US-ryan-high"
  lang: string; // e.g. "en-US"
  quality: "high" | "medium" | "low";
  sizeMB: number;
  description: string;
}

export const PIPER_VOICE_PACKS: PiperVoicePack[] = [
  {
    id: "ryan-high",
    name: "Ryan (High)",
    key: "en_US-ryan-high",
    lang: "en-US",
    quality: "high",
    sizeMB: 62,
    description: "Deep, crisp male American voice with rich natural cadence.",
  },
  {
    id: "ljspeech-high",
    name: "LJSpeech (High)",
    key: "en_US-ljspeech-high",
    lang: "en-US",
    quality: "high",
    sizeMB: 63,
    description: "Classic high quality female narrator, clear & expressive.",
  },
  {
    id: "lessac-high",
    name: "Lessac (High)",
    key: "en_US-lessac-high",
    lang: "en-US",
    quality: "high",
    sizeMB: 61,
    description: "Neutral, authoritative American news presenter voice.",
  },
  {
    id: "alan-medium",
    name: "Alan (UK Medium)",
    key: "en_GB-alan-medium",
    lang: "en-GB",
    quality: "medium",
    sizeMB: 28,
    description: "Refined British English narrator voice.",
  },
];

export async function isVoiceDownloaded(packId: string): Promise<boolean> {
  try {
    const pack = PIPER_VOICE_PACKS.find((p) => p.id === packId) || PIPER_VOICE_PACKS[0];
    const storedVoices = await stored();
    return storedVoices.includes(pack.key);
  } catch (err) {
    console.error("Error checking stored voices:", err);
    return false;
  }
}

export async function deleteVoicePack(packId: string): Promise<void> {
  const pack = PIPER_VOICE_PACKS.find((p) => p.id === packId) || PIPER_VOICE_PACKS[0];
  try {
    await remove(pack.key);
  } catch (err) {
    console.error("Error removing voice pack:", err);
    throw err;
  }
}

export async function downloadVoicePack(
  pack: PiperVoicePack,
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    await download(pack.key, (progress: any) => {
      if (onProgress && progress && typeof progress === "object" && "loaded" in progress && "total" in progress) {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        onProgress(pct);
      } else if (onProgress && typeof progress === "number") {
        onProgress(Math.round(progress * 100));
      }
    });
  } catch (err) {
    console.error("Error downloading voice pack:", err);
    throw err;
  }
}

export async function synthesizePiperAudio(
  text: string,
  packId: string,
  onProgress?: (pct: number) => void
): Promise<AudioBuffer> {
  const pack = PIPER_VOICE_PACKS.find((p) => p.id === packId) || PIPER_VOICE_PACKS[0];
  try {
    // Predict returns the standard AudioBuffer directly!
    const audioBuffer = await predict({
      text,
      voiceId: pack.key,
    }, (progress: any) => {
      if (onProgress && typeof progress === "number") {
        onProgress(Math.round(progress * 100));
      }
    });
    return audioBuffer;
  } catch (err) {
    console.error("Error synthesizing audio with vits-web:", err);
    throw err;
  }
}

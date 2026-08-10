// Edge TTS Engine (openai-edge-tts style)
// Uses high-quality Microsoft Edge Neural TTS voices via Express backend proxy (/api/tts/edge)

export interface EdgeVoice {
  id: string; // e.g. "en-US-AvaMultilingualNeural"
  name: string; // e.g. "Ava (Multilingual Neural)"
  lang: string; // e.g. "en-US"
  gender: "Female" | "Male";
  description: string;
}

export const EDGE_VOICES: EdgeVoice[] = [
  {
    id: "en-US-AvaMultilingualNeural",
    name: "Ava (Multilingual)",
    lang: "en-US",
    gender: "Female",
    description: "Versatile, expressive modern American female voice.",
  },
  {
    id: "en-US-AndrewMultilingualNeural",
    name: "Andrew (Multilingual)",
    lang: "en-US",
    gender: "Male",
    description: "Warm, engaging modern American male narrator.",
  },
  {
    id: "en-US-AriaNeural",
    name: "Aria",
    lang: "en-US",
    gender: "Female",
    description: "Clear, natural American news host voice.",
  },
  {
    id: "en-US-GuyNeural",
    name: "Guy",
    lang: "en-US",
    gender: "Male",
    description: "Professional, steady American broadcast tone.",
  },
  {
    id: "en-US-EmmaNeural",
    name: "Emma",
    lang: "en-US",
    gender: "Female",
    description: "Friendly, upbeat American conversational voice.",
  },
  {
    id: "en-US-BrianNeural",
    name: "Brian",
    lang: "en-US",
    gender: "Male",
    description: "Deep, resonant American male narrator.",
  },
  {
    id: "en-GB-SoniaNeural",
    name: "Sonia (UK)",
    lang: "en-GB",
    gender: "Female",
    description: "Polished British English presenter voice.",
  },
  {
    id: "zh-CN-XiaoxiaoNeural",
    name: "Xiaoxiao (Chinese)",
    lang: "zh-CN",
    gender: "Female",
    description: "Smooth, warm Mandarin Chinese voice.",
  },
  {
    id: "es-ES-ElviraNeural",
    name: "Elvira (Spanish)",
    lang: "es-ES",
    gender: "Female",
    description: "Natural, articulated Spanish voice.",
  },
];

export async function synthesizeEdgeTts(
  text: string,
  voiceId: string = "en-US-AvaMultilingualNeural",
  rate = 0,
  pitch = 0
): Promise<Blob> {
  const response = await fetch("/api/tts/edge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voiceId,
      rate,
      pitch,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Edge TTS backend error (${response.status})`);
  }

  return await response.blob();
}

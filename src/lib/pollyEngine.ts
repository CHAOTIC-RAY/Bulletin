// AWS Polly TTS client — calls the app's backend proxy (/api/tts/polly).
//
// Polly requires AWS credentials, which must stay server-side (never shipped
// to the browser). The backend signs the request with the Polly API and
// returns MP3 audio; this client just fetches + returns the Blob. The same
// route runs in the dev Express server (server.ts) and the Cloudflare Worker
// (src/worker.ts), both using the AWS SDK v3 Polly client.

export interface PollyVoice {
  id: string; // e.g. "Matthew"
  name: string; // display name
  lang: string; // e.g. "en-US"
  gender: "Female" | "Male";
  engine: "standard" | "neural";
  description: string;
}

// A curated subset of the most useful Polly voices. The backend can synthesize
// ANY Polly voice id at runtime; this list is just the picker's defaults.
export const POLLY_VOICES: PollyVoice[] = [
  {
    id: "Matthew",
    name: "Matthew (US, Neural)",
    lang: "en-US",
    gender: "Male",
    engine: "neural",
    description: "Warm, conversational American male narrator — great for news.",
  },
  {
    id: "Joanna",
    name: "Joanna (US, Neural)",
    lang: "en-US",
    gender: "Female",
    engine: "neural",
    description: "Clear, professional American female news voice.",
  },
  {
    id: "Danielle",
    name: "Danielle (US, Neural)",
    lang: "en-US",
    gender: "Female",
    engine: "neural",
    description: "Bright, friendly American female voice.",
  },
  {
    id: "Stephen",
    name: "Stephen (GB, Neural)",
    lang: "en-GB",
    gender: "Male",
    engine: "neural",
    description: "Refined British male narrator.",
  },
  {
    id: "Amy",
    name: "Amy (GB, Neural)",
    lang: "en-GB",
    gender: "Female",
    engine: "neural",
    description: "Polished British female presenter voice.",
  },
  {
    id: "Kajal",
    name: "Kajal (Indian, Neural)",
    lang: "en-IN",
    gender: "Female",
    engine: "neural",
    description: "Smooth English (India) female voice.",
  },
];

const pollyBlobCache = new Map<string, Promise<Blob>>();

export function clearPollyBlobCache() {
  pollyBlobCache.clear();
}

export async function synthesizePolly(
  text: string,
  voiceId: string = "Matthew",
  engine: "standard" | "neural" = "neural",
  rate = 1
): Promise<Blob> {
  const cacheKey = `${text}|${voiceId}|${engine}|${rate}`;
  let promise = pollyBlobCache.get(cacheKey);
  if (!promise) {
    promise = (async () => {
      const response = await fetch("/api/tts/polly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId, engine, rate }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { error?: string };
        // Surface the real backend error (e.g. missing AWS credentials) instead of
        // silently degrading. The caller's TTS engine shows it to the user.
        throw new Error(errorData?.error || `Polly backend error (${response.status})`);
      }

      return await response.blob();
    })();
    pollyBlobCache.set(cacheKey, promise);
  }
  return promise;
}

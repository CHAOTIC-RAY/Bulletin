// Shared AWS Polly synthesis — runs in the dev Express server AND the
// Cloudflare Worker. Uses the Workers-safe SigV4 REST client (Web Crypto +
// fetch, NO Node-only AWS SDK) so it works identically on both runtimes.
//
// Credentials are read from the environment (NEVER from the client):
//   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
// In dev, load them from a `.env` file (see README). In the Worker, set them
// as wrangler secrets (see README).
//
// Free tier: 5M characters/month of standard voices, 1M of neural voices.

import { synthesizePollyRest } from "./pollyRest";
import { pollyCacheKey, getCachedPolly, putCachedPolly } from "./pollyCache";

export interface PollyResult {
  audio: Uint8Array;
  contentType: string;
  cached?: boolean;
}

export async function synthesizePolly(
  text: string,
  voiceId: string = "Matthew",
  engine: "standard" | "neural" = "neural",
  rate = 1
): Promise<PollyResult> {
  const normEngine = engine === "standard" ? "standard" : "neural";

  // 1) Shared cache check (Firebase). On a hit, return the cached MP3 — no AWS
  //    token spent, instant for every other device/user.
  try {
    const key = await pollyCacheKey(text, voiceId, normEngine, rate);
    const cached = await getCachedPolly(key);
    if (cached) {
      return { audio: cached.audio, contentType: cached.contentType, cached: true };
    }
  } catch {
    // cache is best-effort; fall through to live synthesis on any error
  }

  // 2) Live synthesis (only on a cache miss).
  const result = await synthesizePollyRest({
    text,
    voiceId,
    engine: normEngine,
    rate,
  });

  // 3) Persist to the shared cache so the next device reuses it.
  try {
    const key = await pollyCacheKey(text, voiceId, normEngine, rate);
    await putCachedPolly(key, result.audio, { text, voiceId, engine: normEngine, rate });
  } catch {
    // caching failure must never break playback
  }

  return { audio: result.audio, contentType: result.contentType };
}

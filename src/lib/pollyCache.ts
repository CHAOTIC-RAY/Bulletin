// Shared, cross-user / cross-device TTS cache backed by Firebase Firestore.
//
// GOAL: once any user generates a news sentence's Polly audio, it's stored in
// Firestore keyed by a hash of (text + voice + engine + rate). The next user —
// on any device — fetches the cached MP3 instead of re-synthesizing. This makes
// repeat playback instant and cuts AWS Polly token cost to (essentially) one
// synthesis per unique sentence.
//
// WHY FIRESTORE-ONLY (no Storage bucket, no Admin SDK):
//  - A sentence MP3 is ~5–15 KB. Firestore documents hold up to 1 MB, so the
//    base64 audio fits comfortably inside the doc. One collection = one data
//    model, no second service, no OAuth token plumbing.
//  - The Firestore REST v1 API authenticates with the standard web API key
//    (`?key=...`) when Security Rules permit it, so the SAME code runs in the
//    Node dev server and the Cloudflare Worker (both have fetch + crypto.subtle).
//    No `firebase-admin` / `firebase` npm deps, nothing Node-only.
//
// WEEKLY SELF-RESET (free-tier guard):
//  - A meta doc `pollyCacheMeta/sweep` tracks `{ totalDocs, lastSweep }`.
//  - Each cache write increments `totalDocs`. Once 7 days pass since `lastSweep`
//    AND `totalDocs > MAX_DOCS`, a sweep deletes the OLDEST `DELETE_BATCH` docs
//    (Firestore list ordered by createdAt ascending) — i.e. it resets from the
//    oldest news first. The sweep is lazy (runs inside /api/tts/polly) so there
//    is NO separate Cloud Function / scheduler to configure.
//  - The sweep only ever reads + deletes `DELETE_BATCH` (2000) docs per week —
//    cheap and safely inside the 50k reads/day free allowance. Any backlog
//    converges over subsequent weeks. MAX_DOCS (50000) ≈ 500 MB < the 1 GB
//    free storage limit, with headroom.
//  - OPTIONAL native safety net: also set a 7-day Firestore TTL on `createdAt`
//    in the console (TTL deletes are FREE and don't count against write quota).
//
// SECURITY MODEL: the cache holds only PUBLIC news audio keyed by content hash
// (no user data). Lock Security Rules to the `pollyCache` collection + the meta
// doc only:
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{db}/documents {
//       match /pollyCache/{hash} { allow read, write: if true; }
//       match /pollyCacheMeta/{any} { allow read, write: if true; }
//     }
//   }
//
// DISABLED BY DEFAULT: if FIREBASE_PROJECT_ID / FIREBASE_API_KEY are unset, every
// function is a no-op and the app falls straight through to live Polly — no
// breakage, no crash. See README "Firebase TTS cache setup".

const COLLECTION = "pollyCache";
const META_DOC = "pollyCacheMeta/sweep";

const MAX_DOCS = Number(process.env.POLLY_CACHE_MAX_DOCS || "50000");
const SWEEP_INTERVAL_MS = 7 * 24 * 3600 * 1000; // weekly
const DELETE_BATCH = 2000; // oldest docs removed per sweep

function projectId(): string | undefined {
  return process.env.FIREBASE_PROJECT_ID;
}
function apiKey(): string | undefined {
  return process.env.FIREBASE_API_KEY;
}

export function pollyCacheEnabled(): boolean {
  return Boolean(projectId() && apiKey());
}

/** Stable cache key from the exact synthesis inputs. */
export async function pollyCacheKey(
  text: string,
  voiceId: string,
  engine: string,
  rate: number
): Promise<string> {
  const raw = `${text}|${voiceId}|${engine}|${rate}`;
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(raw));
  return bufToHex(digest);
}

export interface CachedPolly {
  audio: Uint8Array;
  contentType: string;
}

/** Fetch a cached MP3. Returns null on miss / error / disabled. */
export async function getCachedPolly(key: string): Promise<CachedPolly | null> {
  const project = projectId();
  const key_ = apiKey();
  if (!project || !key_) return null;

  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${COLLECTION}/${key}?key=${key_}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const fields = data.fields;
    const b64 = fields?.audioB64?.stringValue;
    if (!b64) return null;

    // Best-effort hit counter (free; extra reads/writes, pruned by TTL/sweep).
    const hits = Number(fields?.hits?.integerValue || "0");
    bumpHits(project, key_, hits + 1).catch(() => {});

    return { audio: base64ToBytes(b64), contentType: "audio/mpeg" };
  } catch {
    return null;
  }
}

/** Store a freshly synthesized MP3 so the next device reuses it. */
export async function putCachedPolly(
  key: string,
  audio: Uint8Array,
  meta: { text: string; voiceId: string; engine: string; rate: number }
): Promise<void> {
  const project = projectId();
  const key_ = apiKey();
  if (!project || !key_) return;

  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${COLLECTION}/${key}?key=${key_}`;
  const body = {
    fields: {
      text: { stringValue: meta.text },
      voiceId: { stringValue: meta.voiceId },
      engine: { stringValue: meta.engine },
      rate: { doubleValue: meta.rate },
      size: { integerValue: String(audio.length) },
      hits: { integerValue: "0" },
      createdAt: { timestampValue: new Date().toISOString() },
      audioB64: { stringValue: bytesToBase64(audio) },
    },
  };

  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn("[pollyCache] put failed:", res.status, await res.text().catch(() => ""));
      return;
    }
    // Track count + lazily trigger the weekly oldest-first sweep.
    await incrementTotalDocs(project);
    maybeSweep(project).catch((e) => console.warn("[pollyCache] sweep error:", e));
  } catch (e) {
    console.warn("[pollyCache] put error:", e);
  }
}

// --- Weekly self-reset (oldest-first, free-tier cap) ---

async function incrementTotalDocs(project: string): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${META_DOC}?key=${apiKey()}`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as any;
      const current = Number(data.fields?.totalDocs?.integerValue || "0");
      await patchMeta(project, { totalDocs: { integerValue: String(current + 1) } });
    } else {
      // First write: create the meta doc.
      await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            totalDocs: { integerValue: "1" },
            lastSweep: { timestampValue: new Date().toISOString() },
          },
        }),
      });
    }
  } catch {
    // meta tracking is best-effort
  }
}

async function patchMeta(project: string, fields: Record<string, any>): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${META_DOC}?key=${apiKey()}&updateMask.fieldPaths=${Object.keys(
    fields
  ).join("&updateMask.fieldPaths=")}`;
  await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
}

async function maybeSweep(project: string): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${META_DOC}?key=${apiKey()}`;
  let res = await fetch(url);
  if (!res.ok) return;
  const data = (await res.json()) as any;
  const totalDocs = Number(data.fields?.totalDocs?.integerValue || "0");
  const lastSweep = data.fields?.lastSweep?.timestampValue
    ? new Date(data.fields.lastSweep.timestampValue).getTime()
    : 0;

  // Only sweep weekly AND when over the free-tier cap.
  if (Date.now() - lastSweep < SWEEP_INTERVAL_MS) return;
  if (totalDocs <= MAX_DOCS) {
    // Under cap, just refresh the sweep clock.
    await patchMeta(project, { lastSweep: { timestampValue: new Date().toISOString() } });
    return;
  }

  // Delete the OLDEST DELETE_BATCH docs (createdAt ascending = oldest first).
  const listUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${COLLECTION}?pageSize=${DELETE_BATCH}&orderBy=createdAt&key=${apiKey()}`;
  const listRes = await fetch(listUrl);
  if (!listRes.ok) return;
  const list = (await listRes.json()) as any;
  const docs = list.documents || [];

  let deleted = 0;
  for (const doc of docs) {
    const name: string = doc.name; // e.g. .../documents/pollyCache/{hash}
    const delRes = await fetch(
      `https://firestore.googleapis.com/v1/${name}?key=${apiKey()}`,
      { method: "DELETE" }
    );
    if (delRes.ok) deleted++;
  }

  const remaining = Math.max(0, totalDocs - deleted);
  await patchMeta(project, {
    totalDocs: { integerValue: String(remaining) },
    lastSweep: { timestampValue: new Date().toISOString() },
  });
  console.log(`[pollyCache] weekly sweep removed ${deleted} oldest docs (${remaining} remain)`);
}

// --- helpers ---

async function bumpHits(project: string, key: string, hits: number): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${COLLECTION}/${key}?key=${apiKey()}&updateMask.fieldPaths=hits`;
  await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { hits: { integerValue: String(hits) } } }),
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

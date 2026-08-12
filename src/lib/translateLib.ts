// Keyless machine translation via Google's public "gtx" endpoint (the one the
// Google Translate web UI uses). No API key required, supports Dhivehi (dv).
// We route it through the Worker / dev server purely to dodge browser CORS —
// the browser must never call this endpoint directly.
//
// Tradeoff vs an LLM: this gives functional, fluent-enough Dhivehi for news
// headlines/details. It is an unofficial endpoint (ToS gray area) and
// per-IP rate limited, so callers must degrade gracefully to the source text
// when it fails. We translate one string per request (the repeated-?q= batch
// form only returns the first item), which is fine for the small N we send.

const GTX = "https://translate.googleapis.com/translate_a/single";

export type TranslateTarget = "dv" | "en";

function isDhivehi(text: string): boolean {
  return /[ހ-޿]/.test(text);
}

/**
 * Translate a batch of strings to `target`. Returns an array the same length
 * as `texts`; any entry that fails (or is already in the target script) is
 * echoed back unchanged so the UI never blanks out.
 */
export async function translateBatch(
  texts: string[],
  target: TranslateTarget
): Promise<string[]> {
  const out: string[] = new Array(texts.length);
  // Translate in parallel but cap concurrency to avoid hammering the endpoint.
  const limit = 6;
  let i = 0;
  const worker = async () => {
    while (i < texts.length) {
      const idx = i++;
      const src = (texts[idx] || "").trim();
      if (!src) {
        out[idx] = texts[idx];
        continue;
      }
      // Already in the target script — skip the round trip.
      if (target === "dv" && isDhivehi(src)) {
        out[idx] = src;
        continue;
      }
      try {
        const url = `${GTX}?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(src)}`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
          out[idx] = src;
          continue;
        }
        const json = (await res.json()) as any;
        // Response shape: [[["translated", "orig", ...], ...], ...]
        const sentences: any[] = json?.[0] || [];
        const translated = sentences
          .map((s) => (Array.isArray(s) ? s[0] : ""))
          .join("")
          .trim();
        // Retry once if a non-Dhivehi source came back unchanged (gtx rate
        // limit / transient echo). Skip the retry when the text was already
        // in the target script (nothing to translate).
        if (!translated || (translated === src && !isDhivehi(src))) {
          const retry = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(8000),
          });
          if (retry.ok) {
            const rj = (await retry.json()) as any;
            const rs: any[] = rj?.[0] || [];
            const rt = rs.map((s) => (Array.isArray(s) ? s[0] : "")).join("").trim();
            out[idx] = rt || src;
          } else {
            out[idx] = src;
          }
        } else {
          out[idx] = translated;
        }
      } catch {
        out[idx] = src;
      }
    }
  };
  const pool = Array.from({ length: Math.min(limit, texts.length) }, worker);
  await Promise.all(pool);
  return out;
}

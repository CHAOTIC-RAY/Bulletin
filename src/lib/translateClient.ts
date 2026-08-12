// Client-side helper for the keyless /api/translate endpoint. Translates a set
// of strings to Dhivehi (or back to English) and memoizes by content so we
// don't refetch the same text. Degrades to the source text on any failure.

import { getLocale } from "./i18n";

const cache = new Map<string, string>();

export async function translateToLocale(texts: string[]): Promise<string[]> {
  const locale = getLocale();
  if (locale !== "dv") return texts; // English: nothing to translate
  const clean = texts.filter((t) => typeof t === "string" && t.trim());
  if (!clean.length) return texts;

  // Serve cached entries immediately; only fetch the misses.
  const misses: string[] = [];
  const indexOf: number[] = [];
  for (const t of clean) {
    if (cache.has(t)) {
      indexOf.push(-1); // sentinel: use cache
    } else {
      indexOf.push(misses.length);
      misses.push(t);
    }
  }

  let results = clean;
  if (misses.length) {
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: misses, target: "dv" }),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        const got: string[] = Array.isArray(data?.translated) ? data.translated : misses;
        got.forEach((g, i) => cache.set(misses[i], g || misses[i]));
        results = clean.map((t, i) => (cache.get(t) ?? t));
      }
    } catch {
      /* keep source text */
    }
  } else {
    results = clean.map((t) => cache.get(t) ?? t);
  }
  return results;
}

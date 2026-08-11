// Builds the personalized Daily Paper brief from the current feed, honoring the
// user's BriefSettings (topics / sources / size / AI toggle). Shared by the
// Daily Paper tab and the standalone brief card. Always returns a usable brief.

import type { FeedItem } from "./feedStorage";
import {
  getBriefSettings,
  filterItemsForBrief,
} from "./feedStorage";
import { buildDailyBrief, type BriefArticleInput, type GeneratedDailyBrief } from "./generateNewsBrief";

function dayKeyOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Filter today's items by brief settings and cap per-source / per-number-of-sources. */
export function buildBriefArticles(items: FeedItem[]): BriefArticleInput[] {
  const today = Date.now();
  const settings = getBriefSettings();
  const scoped = filterItemsForBrief(
    items.filter((i) => dayKeyOf(i.publishedAt) === dayKeyOf(today)),
    settings
  );
  const bySource = new Map<string, FeedItem[]>();
  for (const it of scoped) {
    const title = it.subscriptionTitle || "General News";
    const list = bySource.get(title) || [];
    list.push(it);
    bySource.set(title, list);
  }
  const out: BriefArticleInput[] = [];
  let sources = 0;
  for (const [, list] of bySource) {
    if (sources >= settings.maxSources) break;
    for (const it of list.slice(0, settings.maxPerSource)) {
      out.push({ id: it.id, source: it.subscriptionTitle, title: it.title, summary: it.summary, link: it.link });
    }
    sources++;
  }
  return out.slice(0, 240);
}

export interface PersonalizedBrief {
  brief: GeneratedDailyBrief;
  source: string; // "groq" | "fallback"
  articleCount: number;
}

export async function buildPersonalizedBrief(items: FeedItem[]): Promise<PersonalizedBrief> {
  const articles = buildBriefArticles(items);
  if (articles.length === 0) {
    // Nothing matched the user's scope today — fall back to the full feed so the
    // paper is never blank. (If >=1 matched, we honor the scope even if small.)
    const all = items
      .filter((i) => dayKeyOf(i.publishedAt) === dayKeyOf(Date.now()))
      .slice(0, 24)
      .map((i) => ({ id: i.id, source: i.subscriptionTitle, title: i.title, summary: i.summary, link: i.link }));
    const brief = buildDailyBrief(all, dayKeyOf(Date.now()));
    return { brief, source: "fallback", articleCount: all.length };
  }
  const useAi = getBriefSettings().useAi;
  try {
    if (!useAi) throw new Error("ai_disabled");
    const res = await fetch("/api/brief/groq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articles, useAi }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as any;
    if (data?.brief?.sections?.length) {
      return { brief: data.brief as GeneratedDailyBrief, source: (data.source as string) || "groq", articleCount: articles.length };
    }
    throw new Error("empty");
  } catch {
    return { brief: buildDailyBrief(articles, dayKeyOf(Date.now())), source: "fallback", articleCount: articles.length };
  }
}

// Havaa feed client — fetches RSS without a backend by routing through a public
// RSS-to-JSON proxy. (Kora uses its own Worker; Havaa reuses that when deployed,
// but this keeps the app runnable standalone for AI Studio / local dev.)
import { FeedItem, FeedSubscription, parseFeedJson } from "./feedStorage";

// Public CORS-friendly RSS→JSON proxy. Swap for Kora's /api/feed proxy in prod.
const RSS_PROXY = "https://api.rss2json.com/v1/api.json?rss_url=";

/** Parse an XML string into FeedItems using browser's native DOMParser. */
function parseXmlToItems(xmlStr: string, sub: FeedSubscription): FeedItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, "application/xml");
  
  let items = Array.from(doc.querySelectorAll("item"));
  const isAtom = items.length === 0;
  if (isAtom) {
    items = Array.from(doc.querySelectorAll("entry"));
  }
  
  return items.map((el, i) => {
    const title = el.querySelector("title")?.textContent || "Untitled";
    
    let link = "";
    if (isAtom) {
      const linkEl = el.querySelector("link");
      link = linkEl?.getAttribute("href") || linkEl?.textContent || "";
    } else {
      link = el.querySelector("link")?.textContent || "";
    }
    
    const summary = el.querySelector("description")?.textContent || 
                    el.querySelector("summary")?.textContent || 
                    el.querySelector("content")?.textContent || "";
                    
    const content = el.querySelector("encoded")?.textContent || 
                    el.querySelector("content")?.textContent || 
                    summary;
                    
    let imageUrl: string | undefined = undefined;
    
    const enclosure = el.querySelector("enclosure");
    if (enclosure) {
      imageUrl = enclosure.getAttribute("url") || undefined;
    }
    
    if (!imageUrl) {
      const mediaContent = el.getElementsByTagName("media:content")[0] || el.querySelector("content");
      if (mediaContent && mediaContent.getAttribute("url")) {
        imageUrl = mediaContent.getAttribute("url") || undefined;
      }
    }
    
    if (!imageUrl) {
      const mediaThumb = el.getElementsByTagName("media:thumbnail")[0] || el.querySelector("thumbnail");
      if (mediaThumb && mediaThumb.getAttribute("url")) {
        imageUrl = mediaThumb.getAttribute("url") || undefined;
      }
    }
    
    if (!imageUrl && (content || summary)) {
      const m = (content || summary).match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m) imageUrl = m[1];
    }
    
    const pubDateStr = el.querySelector("pubDate")?.textContent || 
                       el.querySelector("published")?.textContent || 
                       el.querySelector("updated")?.textContent || "";
    let publishedAt = Date.now() - i * 60000;
    if (pubDateStr) {
      const d = Date.parse(pubDateStr);
      if (!isNaN(d)) publishedAt = d;
    }
    
    const guid = el.querySelector("guid")?.textContent || el.querySelector("id")?.textContent || link || String(i);
    
    return {
      id: `${sub.id}-${guid}`,
      subscriptionId: sub.id,
      subscriptionTitle: sub.title,
      title: title.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      link,
      summary: summary.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      content: content,
      publishedAt,
      imageUrl,
      read: false,
    } as FeedItem;
  });
}

export async function fetchFeed(sub: FeedSubscription): Promise<FeedItem[]> {
  // 1. Try our highly reliable server-side feed proxy first (bypasses CORS & Cloudflare)
  try {
    const response = await fetch(`/api/feed-proxy?url=${encodeURIComponent(sub.feedUrl)}`);
    if (response.ok) {
      const xmlText = await response.text();
      const parsed = parseXmlToItems(xmlText, sub);
      if (parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn(`Backend feed proxy failed for ${sub.title}, trying rss2json...`, err);
  }

  // 2. Fallback to rss2json proxy if server proxy fails or is not found
  try {
    const res = await fetch(RSS_PROXY + encodeURIComponent(sub.feedUrl));
    if (!res.ok) return [];
    const json = await res.json();
    if (json.status !== "ok") return [];
    return parseFeedJson(json, sub);
  } catch {
    return [];
  }
}

export async function refreshAllSubscriptions(subs: FeedSubscription[]): Promise<FeedItem[]> {
  const results = await Promise.all(subs.map((s) => fetchFeed(s)));
  return results.flat().sort((a, b) => b.publishedAt - a.publishedAt);
}

/** Collect gallery images for the AutoImageReel from an article page. */
export async function collectArticleImages(link: string, summaryImages: string[] = []): Promise<string[]> {
  // Best-effort: use any images already known (feed/summary) so we don't block on a fetch.
  const out = [...summaryImages];
  try {
    const res = await fetch(RSS_PROXY + encodeURIComponent(link));
    if (!res.ok) return out.slice(0, 6);
    const json = await res.json();
    const html: string = json?.items?.[0]?.content || json?.feed?.description || "";
    const imgs = (html.match(/<img[^>]+src=["']([^"']+)["']/gi) || [])
      .map((m: string) => (m.match(/src=["']([^"']+)["']/i) || [])[1])
      .filter(Boolean)
      .filter((u: string) => !u.startsWith("data:"));
    for (const u of imgs) if (!out.includes(u)) out.push(u);
  } catch {
    /* ignore */
  }
  return out.slice(0, 6);
}

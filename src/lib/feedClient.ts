// Raadhavalhi feed client — fetches RSS via the app's own /api/feed/fetch
// enrichment endpoint; falls back to a public RSS->JSON proxy when offline.
import { FeedItem, FeedSubscription, parseFeedJson } from "./feedStorage";

// Public CORS-friendly RSS→JSON proxy (fallback if the enrichment endpoint is down).
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
  // 1. Primary: our server-side enrichment endpoint (best-method-per-source image
  //    + full-content extraction, bypasses CORS & Cloudflare).
  try {
    const response = await fetch(`/api/feed/fetch?url=${encodeURIComponent(sub.feedUrl)}`);
    if (response.ok) {
      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("application/json")) {
        const json: any = await response.json();
        const items: any[] = json?.items || [];
        if (items.length) {
          return items.map((e, i) => ({
            id: `${sub.id}-${e.id || e.link || i}`,
            subscriptionId: sub.id,
            subscriptionTitle: sub.title,
            title: String(e.title || "Untitled").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
            link: String(e.link || ""),
            author: e.author || undefined,
            summary: e.summary ? String(e.summary).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : undefined,
            content: e.content || e.summary || undefined,
            publishedAt: e.publishedAt || Date.now() - i * 60000,
            imageUrl: e.imageUrl || (e.images && e.images[0]) || undefined,
            images: e.images && e.images.length ? e.images : e.imageUrl ? [e.imageUrl] : undefined,
            read: false,
          }));
        }
      } else {
        console.warn(`Enriched feed fetch for ${sub.title} returned non-JSON content: ${contentType}`);
      }
    }
  } catch (err) {
    console.warn(`Enriched feed fetch failed for ${sub.title}, trying rss2json...`, err);
  }

  // 2. Fallback to the raw XML proxy + browser parse.
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

  // 3. Last resort: rss2json proxy if server proxy fails or is not found
  try {
    const res = await fetch(RSS_PROXY + encodeURIComponent(sub.feedUrl));
    if (!res.ok) return [];
    const contentType = res.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) {
      const json: any = await res.json();
      if (json.status !== "ok") return [];
      return parseFeedJson(json, sub);
    } else {
      console.warn(`rss2json proxy for ${sub.title} returned non-JSON content: ${contentType}`);
      return [];
    }
  } catch (err) {
    console.warn(`rss2json fallback failed for ${sub.title}`, err);
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
    const json: any = await res.json();
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

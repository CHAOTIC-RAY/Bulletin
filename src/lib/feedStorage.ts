// Forked + slimmed from Kora src/lib/feedStorage.ts.
// Keeps the FeedItem model, curated Maldives + international catalogs, and
// localStorage-backed subscriptions/items so the app runs with no backend.

export interface FeedSubscription {
  id: string;
  title: string;
  siteUrl: string;
  feedUrl: string;
  favicon?: string;
  folder?: string;
  addedAt: number;
  lastFetchedAt?: number;
  enabled?: boolean;
}

export interface FeedItem {
  id: string;
  subscriptionId: string;
  subscriptionTitle: string;
  title: string;
  author?: string;
  link: string;
  summary?: string;
  content?: string;
  publishedAt: number;
  imageUrl?: string;
  images?: string[]; // <-- Havaa: collected gallery images for AutoImageReel
  category?: string;
  read: boolean;
  saved?: boolean;
  savedAt?: number;
}

const SUBSCRIPTIONS_KEY = "havaa_feed_subscriptions";
const ITEMS_KEY = "havaa_feed_items";

export const DEFAULT_FEED_SUBSCRIPTIONS: Omit<FeedSubscription, "id" | "addedAt">[] = [
  { title: "Maldives Independent", siteUrl: "https://maldivesindependent.com", feedUrl: "https://maldivesindependent.com/api/rss" },
  { title: "PSM News", siteUrl: "https://psmnews.mv/en/", feedUrl: "https://psmnews.mv/en/feed/" },
  { title: "Edition", siteUrl: "https://edition.mv/", feedUrl: "https://edition.mv/feed/" },
  { title: "Mihaaru", siteUrl: "https://mihaaru.com/", feedUrl: "https://mihaaru.com/feed/" },
];

export const INTERNATIONAL_FEED_OPTIONS: Omit<FeedSubscription, "id" | "addedAt">[] = [
  { title: "BBC World", siteUrl: "https://www.bbc.com/news/world", feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { title: "The Guardian World", siteUrl: "https://www.theguardian.com/world", feedUrl: "https://www.theguardian.com/world/rss" },
  { title: "Al Jazeera", siteUrl: "https://www.aljazeera.com/", feedUrl: "https://www.aljazeera.com/xml/rss/all.xml" },
  { title: "NPR News", siteUrl: "https://www.npr.org/", feedUrl: "https://feeds.npr.org/1001/rss.xml" },
  { title: "The Verge", siteUrl: "https://www.theverge.com/", feedUrl: "https://www.theverge.com/rss/index.xml" },
];

export const TOPIC_FEED_GROUPS: { id: string; label: string; feeds: Omit<FeedSubscription, "id" | "addedAt">[] }[] = [
  { id: "local", label: "Local & Maldives", feeds: DEFAULT_FEED_SUBSCRIPTIONS },
  {
    id: "world",
    label: "World News",
    feeds: [
      { title: "BBC World", siteUrl: "https://www.bbc.com/news/world", feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml" },
      { title: "The Guardian World", siteUrl: "https://www.theguardian.com/world", feedUrl: "https://www.theguardian.com/world/rss" },
      { title: "Al Jazeera", siteUrl: "https://www.aljazeera.com/", feedUrl: "https://www.aljazeera.com/xml/rss/all.xml" },
      { title: "NPR News", siteUrl: "https://www.npr.org/", feedUrl: "https://feeds.npr.org/1001/rss.xml" },
    ],
  },
  {
    id: "technology",
    label: "Technology",
    feeds: [
      { title: "The Verge", siteUrl: "https://www.theverge.com/", feedUrl: "https://www.theverge.com/rss/index.xml" },
      { title: "Ars Technica", siteUrl: "https://arstechnica.com/", feedUrl: "http://feeds.arstechnica.com/arstechnica/index" },
      { title: "TechCrunch", siteUrl: "https://techcrunch.com/", feedUrl: "https://techcrunch.com/feed/" },
    ],
  },
  {
    id: "science",
    label: "Science",
    feeds: [
      { title: "NASA", siteUrl: "https://www.nasa.gov/", feedUrl: "https://www.nasa.gov/feed/" },
      { title: "Science Daily", siteUrl: "https://www.sciencedaily.com/", feedUrl: "https://www.sciencedaily.com/rss/all.xml" },
    ],
  },
  {
    id: "business",
    label: "Business",
    feeds: [
      { title: "Bloomberg", siteUrl: "https://www.bloomberg.com/", feedUrl: "https://feeds.bloomberg.com/markets/news.rss" },
      { title: "CNBC", siteUrl: "https://www.cnbc.com/", feedUrl: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partner=rss&id=10000664" },
    ],
  },
  {
    id: "sports",
    label: "Sports",
    feeds: [
      { title: "ESPN", siteUrl: "https://www.espn.com/", feedUrl: "https://www.espn.com/espn/rss/news" },
      { title: "BBC Sport", siteUrl: "https://www.bbc.com/sport", feedUrl: "https://feeds.bbci.co.uk/sport/rss.xml" },
    ],
  },
];

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getFeedSubscriptions(): FeedSubscription[] {
  return readJson<FeedSubscription[]>(SUBSCRIPTIONS_KEY, []);
}
export function saveFeedSubscriptions(subs: FeedSubscription[]): void {
  writeJson(SUBSCRIPTIONS_KEY, subs);
}
export function getFeedItems(): FeedItem[] {
  return readJson<FeedItem[]>(ITEMS_KEY, []);
}
export function saveFeedItems(items: FeedItem[]): void {
  writeJson(ITEMS_KEY, items.slice(0, 500));
}
export function isFeedSubscriptionEnabled(sub: Pick<FeedSubscription, "enabled">): boolean {
  return sub.enabled !== false;
}

export function makeFeedSubscriptionId(feedUrl: string): string {
  return `feed-${feedUrl.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}`;
}

/** Onboarding: pick interest topics → enable matching curated feeds (no RSS pasting). */
export function applySelectedFeedSources(topicIds: string[]): FeedSubscription[] {
  const chosen = new Set(topicIds.length ? topicIds : TOPIC_FEED_GROUPS.map((g) => g.id));
  const feeds = TOPIC_FEED_GROUPS.filter((g) => chosen.has(g.id)).flatMap((g) => g.feeds);
  const seen = new Set<string>();
  const subs: FeedSubscription[] = [];
  for (const f of feeds) {
    if (seen.has(f.feedUrl)) continue;
    seen.add(f.feedUrl);
    subs.push({ ...f, id: makeFeedSubscriptionId(f.feedUrl), addedAt: Date.now(), enabled: true });
  }
  saveFeedSubscriptions(subs);
  return subs;
}

export function ensureDefaultSubscriptions(): FeedSubscription[] {
  const existing = getFeedSubscriptions();
  if (existing.length) return existing;
  return applySelectedFeedSources([]);
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function tagText(item: any, tag: string): string {
  return stripHtml(item[tag]?._ ?? item[tag]?.["#"] ?? item[tag] ?? "");
}

/** Parse an RSS/Atom JSON feed (from rss2json-style or raw) into FeedItems. */
export function parseFeedJson(json: any, sub: FeedSubscription): FeedItem[] {
  const entries = json?.items || json?.feed?.entries || json?.entries || [];
  if (!Array.isArray(entries)) return [];
  return entries.map((e: any, i: number) => {
    const title = stripHtml(e.title || e.headline || "Untitled");
    const summary = stripHtml(e.description || e.summary || e.contentSnippet || e.content || "");
    const content = e['content:encoded'] || e.content || e.description || summary;
    const link = e.link || e.url || "";
    let imageUrl: string | undefined = e.thumbnail || e.enclosure?.link || e.enclosure?.url || e.image || undefined;
    if (!imageUrl && (e.content || e.description || e.summary)) {
      const html = String(e.content || e.description || e.summary);
      const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m) imageUrl = m[1];
    }
    
    // Attempt media:content or media:thumbnail if nested
    if (!imageUrl && e['media:content'] && e['media:content'].$) {
      imageUrl = e['media:content'].$.url;
    }
    if (!imageUrl && e.thumbnail) {
      if (typeof e.thumbnail === 'string') imageUrl = e.thumbnail;
      else if (e.thumbnail.url) imageUrl = e.thumbnail.url;
    }
    return {
      id: `${sub.id}-${e.guid || e.id || link || i}`,
      subscriptionId: sub.id,
      subscriptionTitle: sub.title,
      title,
      link,
      summary: summary,
      content: content,
      publishedAt: e.isoDate ? new Date(e.isoDate).getTime() : e.pubDate ? new Date(e.pubDate).getTime() : Date.now() - i * 60000,
      imageUrl,
      read: false,
    } as FeedItem;
  });
}

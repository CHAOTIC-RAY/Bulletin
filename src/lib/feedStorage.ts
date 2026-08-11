// Feed storage for Raadhavalhi — localStorage-backed subscriptions/items.
// Keeps the FeedItem model, curated Maldives + international catalogs, and
// localStorage-backed subscriptions/items so the app runs with no backend.

import { getLocale } from "./i18n";

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
  images?: string[]; // <-- Raadhavalhi: collected gallery images for AutoImageReel
  category?: string;
  read: boolean;
  saved?: boolean;
  savedAt?: number;
}

const SUBSCRIPTIONS_KEY = "raadhavalhi_feed_subscriptions";
const ITEMS_KEY = "raadhavalhi_feed_items";

// Sun.mv is the Dhivehi edition; see.mv is its English edition. Pick per locale.
const SUN_MV_DV: Omit<FeedSubscription, "id" | "addedAt"> = {
  title: "Sun.mv",
  siteUrl: "https://sun.mv/",
  feedUrl: "https://sun.mv/feed/",
};
const SEE_MV_EN: Omit<FeedSubscription, "id" | "addedAt"> = {
  title: "See.mv",
  siteUrl: "https://see.mv/",
  feedUrl: "https://see.mv/feed/",
};

// Maldives local sources. Sun.mv (Dhivehi) is swapped for see.mv (English) when
// the UI language is English, so English readers never get the Dhivehi edition.
export function getMaldivesDefaults(locale: "en" | "dv" = "dv"): Omit<FeedSubscription, "id" | "addedAt">[] {
  const base: Omit<FeedSubscription, "id" | "addedAt">[] = [
    { title: "Maldives Independent", siteUrl: "https://maldivesindependent.com", feedUrl: "https://maldivesindependent.com/api/rss" },
    { title: "PSM News", siteUrl: "https://psmnews.mv/en/", feedUrl: "https://psmnews.mv/en/feed/" },
    { title: "Edition", siteUrl: "https://edition.mv/", feedUrl: "https://edition.mv/feed/" },
    { title: "Mihaaru", siteUrl: "https://mihaaru.com/", feedUrl: "https://mihaaru.com/feed/" },
    { title: "Vaguthu", siteUrl: "https://vaguthu.mv/", feedUrl: "https://vaguthu.mv/feed/" },
  ];
  return [...base, locale === "en" ? SEE_MV_EN : SUN_MV_DV];
}

export const INTERNATIONAL_FEED_OPTIONS: Omit<FeedSubscription, "id" | "addedAt">[] = [
  { title: "BBC World", siteUrl: "https://www.bbc.com/news/world", feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { title: "The Guardian World", siteUrl: "https://www.theguardian.com/world", feedUrl: "https://www.theguardian.com/world/rss" },
  { title: "Al Jazeera", siteUrl: "https://www.aljazeera.com/", feedUrl: "https://www.aljazeera.com/xml/rss/all.xml" },
  { title: "NPR News", siteUrl: "https://www.npr.org/", feedUrl: "https://feeds.npr.org/1001/rss.xml" },
  { title: "The Verge", siteUrl: "https://www.theverge.com/", feedUrl: "https://www.theverge.com/rss/index.xml" },
];

export const TOPIC_FEED_GROUPS: { id: string; label: string; feeds: Omit<FeedSubscription, "id" | "addedAt">[] }[] = [
  { id: "local", label: "Local & Maldives", feeds: getMaldivesDefaults(getLocale()) },
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
export const INITIAL_DEFAULT_FEED_ITEMS: FeedItem[] = [
  {
    id: "init-edition-tourism",
    subscriptionId: "feed-https-edition-mv-feed-",
    subscriptionTitle: "Edition",
    title: "Maldives Commits to Sustainable Eco-Tourism and Coral Conservation",
    link: "https://edition.mv/",
    summary: "The Ministry of Tourism has announced a landmark initiative focusing on sustainable local eco-tourism and active coral reef restoration across several key atolls in the Maldives, aiming to balance growing traveler numbers with sensitive marine biology.",
    content: "<p>The Ministry of Tourism, in collaboration with leading marine biologists and local council authorities, has announced a landmark initiative focusing on sustainable local eco-tourism and active coral reef restoration across several key atolls in the Maldives.</p><p>This initiative aims to balance growing traveler numbers with sensitive marine ecosystems, ensuring the Maldives remains a pristine, bio-diverse destination for generations to come. Community-led coral nurseries and strict eco-resort guidelines will be established.</p>",
    publishedAt: Date.now() - 3600000,
    imageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
    images: ["https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80", "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80"],
    read: false
  },
  {
    id: "init-bbc-climate",
    subscriptionId: "feed-https-feeds-bbci-co-uk-news-world-rss-xml",
    subscriptionTitle: "BBC World",
    title: "Global Ocean Treaty Sets Ambitious Targets for Deep-Sea Protection",
    link: "https://www.bbc.com/news/world",
    summary: "A newly ratified international ocean conservation treaty sets binding targets to protect at least 30% of the world's open oceans by 2030, offering a major boost for migratory marine species and sensitive reef habitats.",
    content: "<p>A newly ratified international ocean conservation treaty sets binding targets to protect at least 30% of the world's open oceans by 2030, offering a major boost for migratory marine species and sensitive reef habitats.</p><p>The agreement introduces strict regulations on high-seas fishing and deep-sea mining, establishing vast marine sanctuaries across international waters where commercial exploitation will be prohibited.</p>",
    publishedAt: Date.now() - 7200000,
    imageUrl: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=1200&q=80",
    images: ["https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=1200&q=80", "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?auto=format&fit=crop&w=1200&q=80"],
    read: false
  },
  {
    id: "init-mihaaru-local",
    subscriptionId: "feed-https-mihaaru-com-feed-",
    subscriptionTitle: "Mihaaru",
    title: "ލޯކަލް ޓޫރިޒަމް ފުޅާކުރުމަށް ރާއްޖޭގެ ރަށްތަކުގައި އާ މަޝްރޫއުތަކެއް ފަށައިފި",
    link: "https://mihaaru.com/",
    summary: "ރާއްޖޭގެ އެކި އަތޮޅުތަކުގެ ރަށްތަކުގައި ތިމާވެއްޓާ ރައްޓެހި ގޮތަކަށް ލޯކަލް ޓޫރިޒަމް ކުރިއެރުވުމަށްޓަކައި ހާއްސަ މަޝްރޫއުތަކެއް ފަށައިފިއެވެ. މީގެ ބޭނުމަކީ ރަށްރަށުގެ އިގްތިސާދު ވަރުގަދަކޮށް ވަޒީފާގެ ފުރުސަތުތައް އިތުރުކުރުމެވެ.",
    content: "<p>ރާއްޖޭގެ އެކި އަތޮޅުތަކުގެ ރަށްތަކުގައި ތިމާވެއްޓާ ރައްޓެހި ގޮތަކަށް ލޯކަލް ޓޫރިޒަމް ކުރިއެރުވުމަށްޓަކައި ހާއްސަ މަޝްރޫއުތަކެއް ފަށައިފިއެވެ.</p><p>މީގެ ބޭނުމަކީ ރަށްރަށުގެ އިގްތިސާދު ވަރުގަދަކޮށް ވަޒީފާގެ ފުރުސަތުތައް އިތުރުކުރުމެވެ. މި މަޝްރޫއުގެ ދަށުން ރަށްރަށުގެ ގުދުރަތީ ރީތިކަން ހިމާޔަތްކުރުމާ އެކު، ފަތުރުވެރިންނަށް ތަފާތު ތަޖުރިބާތަކެއް ލިބިގެންދާނެއެވެ.</p>",
    publishedAt: Date.now() - 10800000,
    imageUrl: "https://images.unsplash.com/photo-1533753659765-98bd000fc7bc?auto=format&fit=crop&w=1200&q=80",
    images: ["https://images.unsplash.com/photo-1533753659765-98bd000fc7bc?auto=format&fit=crop&w=1200&q=80", "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1200&q=80"],
    read: false
  },
  {
    id: "init-psm-ferry",
    subscriptionId: "feed-https-psmnews-mv-en-feed-",
    subscriptionTitle: "PSM News",
    title: "New High-Speed Ferry Network Seamlessly Connects Central Atolls",
    link: "https://psmnews.mv/en/",
    summary: "The newly expanded integrated high-speed ferry network has commenced operations in the central atolls, providing affordable, regular, and convenient public transportation between neighboring islands.",
    content: "<p>The newly expanded integrated high-speed ferry network has commenced operations in the central atolls, providing affordable, regular, and convenient public transportation between neighboring islands.</p><p>This initiative, funded by the national development bank, aims to foster greater economic integration, enhance education/healthcare access, and support local business travel across the archipelago.</p>",
    publishedAt: Date.now() - 14400000,
    imageUrl: "https://images.unsplash.com/photo-1516690561799-46d8f74f9abf?auto=format&fit=crop&w=1200&q=80",
    images: ["https://images.unsplash.com/photo-1516690561799-46d8f74f9abf?auto=format&fit=crop&w=1200&q=80", "https://images.unsplash.com/photo-1439066615861-d1af74d74000?auto=format&fit=crop&w=1200&q=80"],
    read: false
  }
];

export function getFeedItems(): FeedItem[] {
  const items = readJson<FeedItem[]>(ITEMS_KEY, []);
  if (items.length === 0) {
    return INITIAL_DEFAULT_FEED_ITEMS;
  }
  return items;
}
export function saveFeedItems(items: FeedItem[]): void {
  writeJson(ITEMS_KEY, items.slice(0, 500));
}
export function isFeedSubscriptionEnabled(sub: Pick<FeedSubscription, "enabled">): boolean {
  return sub.enabled !== false;
}

export function setFeedSubscriptionEnabled(id: string, enabled: boolean): FeedSubscription[] {
  const subs = getFeedSubscriptions().map((s) => (s.id === id ? { ...s, enabled } : s));
  saveFeedSubscriptions(subs);
  return subs;
}

export function addFeedSubscription(sub: Omit<FeedSubscription, "id" | "addedAt">): FeedSubscription[] {
  const existing = getFeedSubscriptions();
  const id = makeFeedSubscriptionId(sub.feedUrl);
  if (existing.some((s) => s.id === id)) return existing;
  const next = [...existing, { ...sub, id, addedAt: Date.now(), enabled: true }];
  saveFeedSubscriptions(next);
  return next;
}

export function removeFeedSubscription(id: string): FeedSubscription[] {
  const next = getFeedSubscriptions().filter((s) => s.id !== id);
  saveFeedSubscriptions(next);
  return next;
}

/** All curated sources (Maldives defaults + international options + topics), for the management UI. */
export function getAllCuratedSources(): { group: string; sources: Omit<FeedSubscription, "id" | "addedAt">[] }[] {
  return [
    { group: "Maldives", sources: getMaldivesDefaults(getLocale()) },
    { group: "International", sources: INTERNATIONAL_FEED_OPTIONS },
    ...TOPIC_FEED_GROUPS.map((g) => ({ group: g.label, sources: g.feeds })),
  ];
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

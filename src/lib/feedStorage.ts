// Feed storage for Raadhavalhi — localStorage-backed subscriptions/items.
// Keeps the FeedItem model, curated Maldives + international catalogs, and
// localStorage-backed subscriptions/items so the app runs with no backend.

import { getLocale } from "./i18n";

// Drop non-article "noise" items (interactive quizzes, guess-the-player games,
// polls, etc.) so the feed shows real news. e.g. BBC Sport's recurring
// "Who am I? Guess Premier League star No 22" quiz.
export function isJunkFeedItem(title: string, link = "", summary = ""): boolean {
  const hay = `${title} ${summary}`.toLowerCase();
  const junkPatterns = [
    /^who am i\??/i,
    /guess (the|premier league|today's|today’s) /i,
    /\bguess (premier league|the player|the star|this player|this star)\b/i,
    /\bwho (could|will) .* sign\b/i, // transfer "who could X sign" guess pieces
    /\b(quiz|poll|vote|predict(ion)?|pick (your|the) )\b/i,
    /\b(spot the|find the|guess the)\b/i,
  ];
  if (junkPatterns.some((re) => re.test(title))) return true;
  // BBC Sport "who am i" quiz links look like /sport/.../who-am-i or ?...quiz
  if (/who-?am-?i/i.test(link) || /quiz/i.test(link)) return true;
  // Generic catch: title is purely a question about a player number with "No"
  if (/\bguess\b/i.test(hay) && /\bno\.?\s*\d+/i.test(title)) return true;
  return false;
}

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
    { title: "MvCrisis (Telegram)", siteUrl: "https://t.me/s/MvCrisis", feedUrl: "https://t.me/MvCrisis" },
    { title: "Maldives Independent", siteUrl: "https://maldivesindependent.com", feedUrl: "https://maldivesindependent.com/api/rss" },
    { title: "PSM News", siteUrl: "https://psmnews.mv/en/", feedUrl: "https://psmnews.mv/en/feed/" },
    { title: "Edition.mv", siteUrl: "https://edition.mv/", feedUrl: "https://edition.mv/feed/" },
    { title: "Mihaaru", siteUrl: "https://mihaaru.com/", feedUrl: "https://mihaaru.com/feed/" },
    { title: "Vaguthu", siteUrl: "https://vaguthu.mv/", feedUrl: "https://vaguthu.mv/feed/" },
    { title: "Avas.mv", siteUrl: "https://avas.mv/", feedUrl: "https://avas.mv/feed/" },
    { title: "Dhuvas.mv", siteUrl: "https://dhuvas.mv/", feedUrl: "https://dhuvas.mv/feed/" },
  ];
  return [...base, locale === "en" ? SEE_MV_EN : SUN_MV_DV];
}

export const COUNTRY_FEED_GROUPS: { country: string; flag: string; feeds: Omit<FeedSubscription, "id" | "addedAt">[] }[] = [
  {
    country: "Maldives (Local)",
    flag: "🇲🇻",
    feeds: getMaldivesDefaults(getLocale()),
  },
  {
    country: "International News",
    flag: "🌐",
    feeds: [
      { title: "Reuters World", siteUrl: "https://www.reuters.com/", feedUrl: "https://www.reutersagency.com/feed/?best-topics=world" },
      { title: "Associated Press (AP)", siteUrl: "https://apnews.com/", feedUrl: "https://apnews.com/rss" },
      { title: "Al Jazeera English", siteUrl: "https://www.aljazeera.com/", feedUrl: "https://www.aljazeera.com/xml/rss/all.xml" },
      { title: "BBC World News", siteUrl: "https://www.bbc.com/news/world", feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml" },
      { title: "Bloomberg Markets", siteUrl: "https://www.bloomberg.com/", feedUrl: "https://feeds.bloomberg.com/markets/news.rss" },
      { title: "UN News", siteUrl: "https://news.un.org/", feedUrl: "https://news.un.org/feed/subscribe/en/news/all/rss.xml" },
    ],
  },
  {
    country: "United States",
    flag: "🇺🇸",
    feeds: [
      { title: "NPR News", siteUrl: "https://www.npr.org/", feedUrl: "https://feeds.npr.org/1001/rss.xml" },
      { title: "CNN World", siteUrl: "https://www.cnn.com/world", feedUrl: "http://rss.cnn.com/rss/edition_world.rss" },
      { title: "The Verge", siteUrl: "https://www.theverge.com/", feedUrl: "https://www.theverge.com/rss/index.xml" },
      { title: "TechCrunch", siteUrl: "https://techcrunch.com/", feedUrl: "https://techcrunch.com/feed/" },
      { title: "Wall Street Journal", siteUrl: "https://www.wsj.com/", feedUrl: "https://feeds.content.dowjones.io/public/rss/RSSWorldNews" },
      { title: "CNBC Business", siteUrl: "https://www.cnbc.com/", feedUrl: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partner=rss&id=100003114" },
      { title: "NASA Science", siteUrl: "https://www.nasa.gov/", feedUrl: "https://www.nasa.gov/feed/" },
    ],
  },
  {
    country: "United Kingdom",
    flag: "🇬🇧",
    feeds: [
      { title: "BBC World", siteUrl: "https://www.bbc.com/news/world", feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml" },
      { title: "The Guardian", siteUrl: "https://www.theguardian.com/world", feedUrl: "https://www.theguardian.com/world/rss" },
      { title: "Financial Times", siteUrl: "https://www.ft.com/", feedUrl: "https://www.ft.com/rss/home" },
      { title: "BBC Sport", siteUrl: "https://www.bbc.com/sport", feedUrl: "https://feeds.bbci.co.uk/sport/rss.xml" },
      { title: "Sky News", siteUrl: "https://news.sky.com/", feedUrl: "https://feeds.skynews.com/feeds/rss/world.xml" },
    ],
  },
  {
    country: "India",
    flag: "🇮🇳",
    feeds: [
      { title: "NDTV World", siteUrl: "https://www.ndtv.com/world-news", feedUrl: "https://feeds.feedburner.com/ndtvnews-world-news" },
      { title: "The Hindu", siteUrl: "https://www.thehindu.com/", feedUrl: "https://www.thehindu.com/news/national/feeder/default.rss" },
      { title: "Times of India", siteUrl: "https://timesofindia.indiatimes.com/", feedUrl: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms" },
      { title: "Indian Express", siteUrl: "https://indianexpress.com/", feedUrl: "https://indianexpress.com/section/world/feed/" },
    ],
  },
  {
    country: "Qatar & Middle East",
    flag: "🇶🇦",
    feeds: [
      { title: "Al Jazeera", siteUrl: "https://www.aljazeera.com/", feedUrl: "https://www.aljazeera.com/xml/rss/all.xml" },
      { title: "Arab News", siteUrl: "https://www.arabnews.com/", feedUrl: "https://www.arabnews.com/cat/3/rss.xml" },
      { title: "The National AE", siteUrl: "https://www.thenationalnews.com/", feedUrl: "https://www.thenationalnews.com/arc/outboundfeeds/rss/" },
      { title: "Khaleej Times", siteUrl: "https://www.khaleejtimes.com/", feedUrl: "https://www.khaleejtimes.com/rss/world" },
    ],
  },
  {
    country: "Singapore & East Asia",
    flag: "🇸🇬",
    feeds: [
      { title: "CNA (Channel NewsAsia)", siteUrl: "https://www.channelnewsasia.com/", feedUrl: "https://www.channelnewsasia.com/api/v1/rss-outbound/rssnews/8395986" },
      { title: "South China Morning Post", siteUrl: "https://www.scmp.com/", feedUrl: "https://www.scmp.com/rss/91/feed" },
      { title: "Japan Times", siteUrl: "https://www.japantimes.co.jp/", feedUrl: "https://www.japantimes.co.jp/feed/" },
      { title: "Straits Times", siteUrl: "https://www.straitstimes.com/", feedUrl: "https://www.straitstimes.com/news/world/rss.xml" },
    ],
  },
  {
    country: "Europe",
    flag: "🇪🇺",
    feeds: [
      { title: "Deutsche Welle", siteUrl: "https://www.dw.com/", feedUrl: "https://rss.dw.com/rdf/rss-en-all" },
      { title: "France 24", siteUrl: "https://www.france24.com/en/", feedUrl: "https://www.france24.com/en/rss" },
      { title: "Euronews", siteUrl: "https://www.euronews.com/", feedUrl: "https://www.euronews.com/rss?format=mrss&level=theme&name=news" },
    ],
  },
  {
    country: "Australia",
    flag: "🇦🇺",
    feeds: [
      { title: "ABC News Australia", siteUrl: "https://www.abc.net.au/news", feedUrl: "https://www.abc.net.au/news/feed/51120/rss.xml" },
      { title: "Sydney Morning Herald", siteUrl: "https://www.smh.com.au/", feedUrl: "https://www.smh.com.au/rss/feed.xml" },
    ],
  },
  {
    country: "Sri Lanka",
    flag: "🇱🇰",
    feeds: [
      { title: "Daily Mirror SL", siteUrl: "https://www.dailymirror.lk/", feedUrl: "https://www.dailymirror.lk/rss/online_edition" },
      { title: "Colombo Page", siteUrl: "http://www.colombopage.com/", feedUrl: "http://www.colombopage.com/rss.xml" },
    ],
  },
  {
    country: "Canada",
    flag: "🇨🇦",
    feeds: [
      { title: "CBC News World", siteUrl: "https://www.cbc.ca/news/world", feedUrl: "https://www.cbc.ca/cbbc/lineup/rss/world.xml" },
    ],
  },
  {
    country: "Global & Specialty",
    flag: "🌍",
    feeds: [
      { title: "UN News", siteUrl: "https://news.un.org/", feedUrl: "https://news.un.org/feed/subscribe/en/news/all/rss.xml" },
      { title: "Science Daily", siteUrl: "https://www.sciencedaily.com/", feedUrl: "https://www.sciencedaily.com/rss/all.xml" },
      { title: "Ars Technica", siteUrl: "https://arstechnica.com/", feedUrl: "http://feeds.arstechnica.com/arstechnica/index" },
      { title: "ESPN", siteUrl: "https://www.espn.com/", feedUrl: "https://www.espn.com/espn/rss/news" },
    ],
  },
];

export const INTERNATIONAL_FEED_OPTIONS: Omit<FeedSubscription, "id" | "addedAt">[] = COUNTRY_FEED_GROUPS.filter(
  (g) => !g.country.includes("Maldives")
).flatMap((g) => g.feeds);

export const TOPIC_FEED_GROUPS: { id: string; label: string; feeds: Omit<FeedSubscription, "id" | "addedAt">[] }[] = [
  { id: "local", label: "Maldives (Local)", feeds: getMaldivesDefaults(getLocale()) },
  ...COUNTRY_FEED_GROUPS.filter((g) => !g.country.includes("Maldives")).map((g) => ({
    id: g.country.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    label: `${g.flag} ${g.country}`,
    feeds: g.feeds,
  })),
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
    imageUrl: undefined,
    images: [],
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
    imageUrl: undefined,
    images: [],
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
    imageUrl: undefined,
    images: [],
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
    imageUrl: "https://s3.ap-southeast-1.amazonaws.com/media5.psm.mv/media/post/YNjGvVnalAzyqDDMkesHdDI0D.jpg",
    images: ["https://s3.ap-southeast-1.amazonaws.com/media5.psm.mv/media/post/YNjGvVnalAzyqDDMkesHdDI0D.jpg"],
    read: false
  }
];

export function getFeedItems(): FeedItem[] {
  const items = readJson<FeedItem[]>(ITEMS_KEY, []);
  if (items.length === 0) {
    return INITIAL_DEFAULT_FEED_ITEMS;
  }
  // Strip any legacy unsplash URLs from cached items
  return items.map((it) => {
    let img = it.imageUrl;
    if (img && img.includes("unsplash.com")) img = undefined;
    let imgs = (it.images || []).filter((i) => i && !i.includes("unsplash.com"));
    if (!img && imgs.length > 0) img = imgs[0];
    return { ...it, imageUrl: img, images: imgs };
  });
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

/** All curated sources grouped by country/region, for the management UI. */
export function getAllCuratedSources(): { group: string; sources: Omit<FeedSubscription, "id" | "addedAt">[] }[] {
  return COUNTRY_FEED_GROUPS.map((g) => ({
    group: `${g.flag} ${g.country}`,
    sources: g.feeds,
  }));
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
  return entries
    .map((e: any, i: number) => {
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
    })
    .filter((it) => !isJunkFeedItem(it.title, it.link, it.summary));
}

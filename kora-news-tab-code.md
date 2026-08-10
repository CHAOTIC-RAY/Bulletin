# Kora News-Tab Source (verbatim) — Havaa fork base

> Extracted from `CHAOTIC-RAY/Kora-` on 2026-08-10. These files constitute the entire news subsystem that Havaa reuses. Full PRD in `PRD.md`.

> Path prefix `src/...` is relative to the Kora repo root.


## RTL / Dhivehi detection

**`src/lib/textDirection.ts`** (lines 1-11)

```ts
1|const THAANA_RE = /[\u0780-\u07BF]/;
2|const ARABIC_RE = /[\u0600-\u06FF]/;
3|
4|/** Detect RTL text (Dhivehi Thaana, Arabic script). */
5|export function isRtlText(text: string): boolean {
6|  return THAANA_RE.test(text) || ARABIC_RE.test(text);
7|}
8|
9|export function textDirection(text: string): "rtl" | "ltr" {
10|  return isRtlText(text) ? "rtl" : "ltr";
11|}
12|
```


## Feed data model, subscriptions & curated catalogs

**`src/lib/feedStorage.ts`** (lines 1-494)

```ts
1|import { dedupeFeedItems, isFeedItemWithinRetention, isRemovedFeedItem } from "./feedNormalize";
2|
3|export interface FeedSubscription {
4|  id: string;
5|  title: string;
6|  siteUrl: string;
7|  feedUrl: string;
8|  favicon?: string;
9|  folder?: string;
10|  addedAt: number;
11|  lastFetchedAt?: number;
12|  /** When false, source is hidden from the feed and skipped on refresh. Defaults to true. */
13|  enabled?: boolean;
14|}
15|
16|export interface FeedItem {
17|  id: string;
18|  subscriptionId: string;
19|  subscriptionTitle: string;
20|  title: string;
21|  author?: string;
22|  link: string;
23|  summary?: string;
24|  publishedAt: number;
25|  imageUrl?: string;
26|  category?: string;
27|  read: boolean;
28|  /** Saved for later in the Feed "Saved" chip (news tab only). */
29|  saved?: boolean;
30|  savedAt?: number;
31|  /** Optional book id when also clipped into the library. */
32|  savedBookId?: string;
33|  clippedAt?: number;
34|}
35|
36|const SUBSCRIPTIONS_KEY = "kora_feed_subscriptions";
37|const ITEMS_KEY = "kora_feed_items";
38|
39|export const DEFAULT_FEED_SUBSCRIPTIONS: Omit<FeedSubscription, "id" | "addedAt">[] = [
40|  {
41|    title: "Maldives Independent",
42|    siteUrl: "https://maldivesindependent.com",
43|    feedUrl: "https://maldivesindependent.com/api/rss",
44|  },
45|  {
46|    title: "PSM News",
47|    siteUrl: "https://psmnews.mv/en/",
48|    feedUrl: "https://psmnews.mv/en/feed/",
49|  },
50|  {
51|    title: "Edition",
52|    siteUrl: "https://edition.mv/",
53|    feedUrl: "kora://edition.mv/latest",
54|  },
55|  {
56|    title: "Mihaaru",
57|    siteUrl: "https://mihaaru.com/",
58|    feedUrl: "kora://mihaaru.com/latest",
59|  },
60|  {
61|    title: "MV Crisis",
62|    siteUrl: "https://t.me/MvCrisis",
63|    feedUrl: "kora://telegram/MvCrisis",
64|  },
65|];
66|
67|export const INTERNATIONAL_FEED_OPTIONS: Omit<FeedSubscription, "id" | "addedAt">[] = [
68|  {
69|    title: "BBC World",
70|    siteUrl: "https://www.bbc.com/news/world",
71|    feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml",
72|  },
73|  {
74|    title: "The Guardian World",
75|    siteUrl: "https://www.theguardian.com/world",
76|    feedUrl: "https://www.theguardian.com/world/rss",
77|  },
78|  {
79|    title: "Reuters World",
80|    siteUrl: "https://www.reuters.com/world/",
81|    feedUrl: "https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best",
82|  },
83|  {
84|    title: "Al Jazeera",
85|    siteUrl: "https://www.aljazeera.com/",
86|    feedUrl: "https://www.aljazeera.com/xml/rss/all.xml",
87|  },
88|  {
89|    title: "NPR News",
90|    siteUrl: "https://www.npr.org/",
91|    feedUrl: "https://feeds.npr.org/1001/rss.xml",
92|  },
93|  {
94|    title: "The Verge",
95|    siteUrl: "https://www.theverge.com/",
96|    feedUrl: "https://www.theverge.com/rss/index.xml",
97|  },
98|];
99|
100|/** Topic → multiple site feeds. Used by onboarding so users pick interests, not raw URLs. */
101|export interface TopicFeedGroup {
102|  id: string;
103|  label: string;
104|  feeds: Omit<FeedSubscription, "id" | "addedAt">[];
105|}
106|
107|export const TOPIC_FEED_GROUPS: TopicFeedGroup[] = [
108|  {
109|    id: "local",
110|    label: "Local & Updates",
111|    feeds: DEFAULT_FEED_SUBSCRIPTIONS,
112|  },
113|  {
114|    id: "world",
115|    label: "World News",
116|    feeds: [
117|      { title: "BBC World", siteUrl: "https://www.bbc.com/news/world", feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml" },
118|      { title: "The Guardian World", siteUrl: "https://www.theguardian.com/world", feedUrl: "https://www.theguardian.com/world/rss" },
119|      { title: "Reuters World", siteUrl: "https://www.reuters.com/world/", feedUrl: "https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best" },
120|      { title: "Al Jazeera", siteUrl: "https://www.aljazeera.com/", feedUrl: "https://www.aljazeera.com/xml/rss/all.xml" },
121|      { title: "NPR News", siteUrl: "https://www.npr.org/", feedUrl: "https://feeds.npr.org/1001/rss.xml" },
122|    ],
123|  },
124|  {
125|    id: "technology",
126|    label: "Technology",
127|    feeds: [
128|      { title: "The Verge", siteUrl: "https://www.theverge.com/", feedUrl: "https://www.theverge.com/rss/index.xml" },
129|      { title: "Ars Technica", siteUrl: "https://arstechnica.com/", feedUrl: "http://feeds.arstechnica.com/arstechnica/index" },
130|      { title: "TechCrunch", siteUrl: "https://techcrunch.com/", feedUrl: "https://techcrunch.com/feed/" },
131|      { title: "Wired", siteUrl: "https://www.wired.com/", feedUrl: "https://www.wired.com/feed/rss" },
132|    ],
133|  },
134|  {
135|    id: "gaming",
136|    label: "Gaming",
137|    feeds: [
138|      { title: "IGN", siteUrl: "https://www.ign.com/", feedUrl: "https://feeds.ign.com/ign/all" },
139|      { title: "PC Gamer", siteUrl: "https://www.pcgamer.com/", feedUrl: "https://www.pcgamer.com/feeds/all" },
140|      { title: "Polygon", siteUrl: "https://www.polygon.com/", feedUrl: "https://www.polygon.com/rss/index.xml" },
141|      { title: "Eurogamer", siteUrl: "https://www.eurogamer.net/", feedUrl: "https://www.eurogamer.net/feed" },
142|    ],
143|  },
144|  {
145|    id: "movies",
146|    label: "Movies & TV",
147|    feeds: [
148|      { title: "Variety", siteUrl: "https://variety.com/", feedUrl: "https://variety.com/feed/" },
149|      { title: "The Hollywood Reporter", siteUrl: "https://www.hollywoodreporter.com/", feedUrl: "https://www.hollywoodreporter.com/feed/" },
150|      { title: "Empire", siteUrl: "https://www.empireonline.com/", feedUrl: "https://www.empireonline.com/feed/" },
151|      { title: "Collider", siteUrl: "https://collider.com/", feedUrl: "https://collider.com/feed/" },
152|    ],
153|  },
154|  {
155|    id: "science",
156|    label: "Science",
157|    feeds: [
158|      { title: "NASA", siteUrl: "https://www.nasa.gov/", feedUrl: "https://www.nasa.gov/feed/" },
159|      { title: "Nature", siteUrl: "https://www.nature.com/", feedUrl: "https://www.nature.com/nature.rss" },
160|      { title: "Science Daily", siteUrl: "https://www.sciencedaily.com/", feedUrl: "https://www.sciencedaily.com/rss/all.xml" },
161|      { title: "Ars Technica Science", siteUrl: "https://arstechnica.com/science/", feedUrl: "http://feeds.arstechnica.com/arstechnica/science" },
162|    ],
163|  },
164|  {
165|    id: "business",
166|    label: "Business",
167|    feeds: [
168|      { title: "Bloomberg", siteUrl: "https://www.bloomberg.com/", feedUrl: "https://feeds.bloomberg.com/markets/news.rss" },
169|      { title: "CNBC", siteUrl: "https://www.cnbc.com/", feedUrl: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partner=rss&id=10000664" },
170|      { title: "Financial Times", siteUrl: "https://www.ft.com/", feedUrl: "https://www.ft.com/rss/home" },
171|    ],
172|  },
173|  {
174|    id: "sports",
175|    label: "Sports",
176|    feeds: [
177|      { title: "ESPN", siteUrl: "https://www.espn.com/", feedUrl: "https://www.espn.com/espn/rss/news" },
178|      { title: "BBC Sport", siteUrl: "https://www.bbc.com/sport", feedUrl: "https://feeds.bbci.co.uk/sport/rss.xml" },
179|      { title: "Sky Sports", siteUrl: "https://www.skysports.com/", feedUrl: "https://www.skysports.com/rss/12040" },
180|    ],
181|  },
182|];
183|
184|export const TOPIC_FEED_OPTIONS: Omit<FeedSubscription, "id" | "addedAt">[] =
185|  TOPIC_FEED_GROUPS.flatMap((group) => group.feeds);
186|
187|export const CURATED_FEED_OPTIONS: Omit<FeedSubscription, "id" | "addedAt">[] = (() => {
188|  const seen = new Set<string>();
189|  const out: Omit<FeedSubscription, "id" | "addedAt">[] = [];
190|  for (const feed of [...DEFAULT_FEED_SUBSCRIPTIONS, ...INTERNATIONAL_FEED_OPTIONS, ...TOPIC_FEED_OPTIONS]) {
191|    if (seen.has(feed.feedUrl)) continue;
192|    seen.add(feed.feedUrl);
193|    out.push(feed);
194|  }
195|  return out;
196|})();
197|
198|const DEFAULT_FEED_URLS = new Set(DEFAULT_FEED_SUBSCRIPTIONS.map((feed) => feed.feedUrl));
199|const INTERNATIONAL_FEED_URLS = new Set(INTERNATIONAL_FEED_OPTIONS.map((feed) => feed.feedUrl));
200|const CURATED_FEED_URLS = new Set(CURATED_FEED_OPTIONS.map((feed) => feed.feedUrl));
201|
202|export function makeFeedSubscriptionId(feedUrl: string): string {
203|  return `feed-${feedUrl.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}`;
204|}
205|
206|export function isFeedSubscriptionEnabled(sub: Pick<FeedSubscription, "enabled">): boolean {
207|  return sub.enabled !== false;
208|}
209|
210|export function isCuratedFeedUrl(feedUrl: string): boolean {
211|  return CURATED_FEED_URLS.has(feedUrl);
212|}
213|
214|export function isDefaultFeedUrl(feedUrl: string): boolean {
215|  return DEFAULT_FEED_URLS.has(feedUrl);
216|}
217|
218|export function isInternationalFeedUrl(feedUrl: string): boolean {
219|  return INTERNATIONAL_FEED_URLS.has(feedUrl);
220|}
221|
222|/** Replace default seeding with an explicit selection of curated feed URLs. */
223|export function applySelectedFeedSources(feedUrls: string[]): FeedSubscription[] {
224|  const selected = new Set(
225|    feedUrls.length ? feedUrls : DEFAULT_FEED_SUBSCRIPTIONS.map((feed) => feed.feedUrl)
226|  );
227|  const custom = getFeedSubscriptions().filter((sub) => !CURATED_FEED_URLS.has(sub.feedUrl));
228|  const curated = CURATED_FEED_OPTIONS.map((option) => {
229|    const previous = getFeedSubscriptions().find((sub) => sub.feedUrl === option.feedUrl);
230|    return {
231|      ...option,
232|      id: previous?.id || makeFeedSubscriptionId(option.feedUrl),
233|      addedAt: previous?.addedAt || Date.now(),
234|      lastFetchedAt: selected.has(option.feedUrl) ? previous?.lastFetchedAt : previous?.lastFetchedAt,
235|      enabled: selected.has(option.feedUrl),
236|    };
237|  });
238|  const seeded = [...curated, ...custom.map((sub) => ({ ...sub, enabled: sub.enabled !== false }))];
239|  saveFeedSubscriptions(seeded);
240|  localStorage.setItem(FEED_MIGRATION_KEY, "1");
241|  return seeded;
242|}
243|
244|const REMOVED_DEFAULT_FEED_URLS = new Set([
245|  "https://hnrss.org/frontpage",
246|  "https://rss.arxiv.org/rss/cs",
247|  "https://news.ycombinator.com",
248|  "https://arxiv.org/list/cs/recent",
249|  "https://feeds.feedburner.com/ycombinator",
250|]);
251|
252|const FEED_MIGRATION_KEY = "kora_feed_migration_v8";
253|const MALDIVES_INDEPENDENT_OLD_FEED = "https://maldivesindependent.com/api/rss/news";
254|const MALDIVES_INDEPENDENT_FEED = "https://maldivesindependent.com/api/rss";
255|
256|function isRemovedFeedSubscription(sub: FeedSubscription): boolean {
257|  if (REMOVED_DEFAULT_FEED_URLS.has(sub.feedUrl)) return true;
258|  const haystack = `${sub.title} ${sub.feedUrl} ${sub.siteUrl}`.toLowerCase();
259|  return /hacker\s*news|hnrss|ycombinator|news\.ycombinator|arxiv/i.test(haystack);
260|}
261|
262|function migrateMaldivesIndependentFeed(subscriptions: FeedSubscription[]): FeedSubscription[] {
263|  return subscriptions.map((sub) => {
264|    if (sub.feedUrl !== MALDIVES_INDEPENDENT_OLD_FEED) return sub;
265|    return {
266|      ...sub,
267|      feedUrl: MALDIVES_INDEPENDENT_FEED,
268|    };
269|  });
270|}
271|
272|/** Ensure Maldives + international curated sources exist and can be toggled. */
273|function ensureCuratedToggleCatalog(existing: FeedSubscription[]): FeedSubscription[] {
274|  const byUrl = new Map(existing.map((sub) => [sub.feedUrl, sub]));
275|  const curated = CURATED_FEED_OPTIONS.map((option) => {
276|    const previous = byUrl.get(option.feedUrl);
277|    if (previous) {
278|      return {
279|        ...previous,
280|        title: option.title,
281|        siteUrl: option.siteUrl,
282|        feedUrl: option.feedUrl,
283|        enabled: previous.enabled !== false,
284|      };
285|    }
286|    return {
287|      ...option,
288|      id: makeFeedSubscriptionId(option.feedUrl),
289|      addedAt: Date.now(),
290|      // All curated sources start enabled so a fresh install actually loads news.
291|      enabled: true,
292|    };
293|  });
294|
295|  const custom = existing
296|    .filter((sub) => !CURATED_FEED_URLS.has(sub.feedUrl))
297|    .map((sub) => ({ ...sub, enabled: sub.enabled !== false }));
298|
299|  return [...curated, ...custom];
300|}
301|
302|function purgeRemovedFeedData(subscriptions: FeedSubscription[]): FeedSubscription[] {
303|  const filtered = subscriptions.filter((sub) => !isRemovedFeedSubscription(sub));
304|  const removedIds = new Set(
305|    subscriptions.filter((sub) => isRemovedFeedSubscription(sub)).map((sub) => sub.id)
306|  );
307|  if (removedIds.size) {
308|    saveFeedItems(
309|      dedupeFeedItems(getFeedItems().filter((item) => !removedIds.has(item.subscriptionId)))
310|    );
311|  }
312|  return filtered;
313|}
314|
315|function readJson<T>(key: string, fallback: T): T {
316|  try {
317|    const raw = localStorage.getItem(key);
318|    return raw ? (JSON.parse(raw) as T) : fallback;
319|  } catch {
320|    return fallback;
321|  }
322|}
323|
324|function writeJson<T>(key: string, value: T): void {
325|  localStorage.setItem(key, JSON.stringify(value));
326|}
327|
328|export function getFeedSubscriptions(): FeedSubscription[] {
329|  return readJson<FeedSubscription[]>(SUBSCRIPTIONS_KEY, []);
330|}
331|
332|export function saveFeedSubscriptions(subscriptions: FeedSubscription[]): void {
333|  writeJson(SUBSCRIPTIONS_KEY, subscriptions);
334|}
335|
336|export function getEnabledFeedSubscriptions(): FeedSubscription[] {
337|  return getFeedSubscriptions().filter(isFeedSubscriptionEnabled);
338|}
339|
340|export function getFeedItems(): FeedItem[] {
341|  return dedupeFeedItems(readJson<FeedItem[]>(ITEMS_KEY, [])).filter(isFeedItemWithinRetention);
342|}
343|
344|export function saveFeedItems(items: FeedItem[]): void {
345|  const trimmed = dedupeFeedItems(items).slice(0, 500);
346|  writeJson(ITEMS_KEY, trimmed);
347|}
348|
349|export function ensureDefaultSubscriptions(): FeedSubscription[] {
350|  const raw = purgeRemovedFeedData(getFeedSubscriptions());
351|  let existing = migrateMaldivesIndependentFeed(raw);
352|
353|  const subscriptionsChanged =
354|    existing.length !== raw.length ||
355|    existing.some((sub, idx) => sub.feedUrl !== raw[idx]?.feedUrl);
356|  if (subscriptionsChanged) {
357|    saveFeedSubscriptions(existing);
358|    saveFeedItems(dedupeFeedItems(readJson<FeedItem[]>(ITEMS_KEY, [])));
359|  }
360|
361|  if (!existing.length) {
362|    const seeded = ensureCuratedToggleCatalog([]);
363|    saveFeedSubscriptions(seeded);
364|    saveFeedItems(dedupeFeedItems(getFeedItems()));
365|    localStorage.setItem(FEED_MIGRATION_KEY, "1");
366|    return seeded;
367|  }
368|
369|  if (!localStorage.getItem(FEED_MIGRATION_KEY)) {
370|    existing = ensureCuratedToggleCatalog(existing).map((sub) =>
371|      // Force re-fetch for Telegram sources after parser fixes (e.g. MV Crisis).
372|      /^kora:\/\/telegram\//i.test(sub.feedUrl) ? { ...sub, lastFetchedAt: undefined } : sub
373|    );
374|    saveFeedSubscriptions(existing);
375|    saveFeedItems(dedupeFeedItems(readJson<FeedItem[]>(ITEMS_KEY, [])));
376|    localStorage.setItem(FEED_MIGRATION_KEY, "1");
377|    return existing;
378|  }
379|
380|  // Keep curated catalog complete even after the migration flag is set.
381|  const missingCurated = CURATED_FEED_OPTIONS.some(
382|    (option) => !existing.some((sub) => sub.feedUrl === option.feedUrl)
383|  );
384|  if (missingCurated) {
385|    const catalogued = ensureCuratedToggleCatalog(existing);
386|    saveFeedSubscriptions(catalogued);
387|    return catalogued;
388|  }
389|
390|  return existing;
391|}
392|
393|export function setFeedSubscriptionEnabled(subscriptionId: string, enabled: boolean): FeedSubscription[] {
394|  const next = getFeedSubscriptions().map((sub) =>
395|    sub.id === subscriptionId
396|      ? {
397|          ...sub,
398|          enabled,
399|          // Re-fetch when turning a source back on.
400|          lastFetchedAt: enabled ? undefined : sub.lastFetchedAt,
401|        }
402|      : sub
403|  );
404|  saveFeedSubscriptions(next);
405|  return next;
406|}
407|
408|export function addFeedSubscription(sub: Omit<FeedSubscription, "id" | "addedAt">): FeedSubscription {
409|  const subscriptions = getFeedSubscriptions();
410|  const duplicate = subscriptions.find((entry) => entry.feedUrl === sub.feedUrl);
411|  if (duplicate) {
412|    if (duplicate.enabled === false) {
413|      const next = setFeedSubscriptionEnabled(duplicate.id, true);
414|      return next.find((entry) => entry.id === duplicate.id) || duplicate;
415|    }
416|    return duplicate;
417|  }
418|
419|  const entry: FeedSubscription = {
420|    ...sub,
421|    id: CURATED_FEED_URLS.has(sub.feedUrl)
422|      ? makeFeedSubscriptionId(sub.feedUrl)
423|      : `feed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
424|    addedAt: Date.now(),
425|    enabled: sub.enabled !== false,
426|  };
427|  saveFeedSubscriptions([entry, ...subscriptions]);
428|  return entry;
429|}
430|
431|export function removeFeedSubscription(subscriptionId: string): void {
432|  const target = getFeedSubscriptions().find((sub) => sub.id === subscriptionId);
433|  // Curated sources are toggled off instead of deleted.
434|  if (target && isCuratedFeedUrl(target.feedUrl)) {
435|    setFeedSubscriptionEnabled(subscriptionId, false);
436|    return;
437|  }
438|  saveFeedSubscriptions(getFeedSubscriptions().filter((sub) => sub.id !== subscriptionId));
439|  saveFeedItems(getFeedItems().filter((item) => item.subscriptionId !== subscriptionId));
440|}
441|
442|export function mergeFeedItems(incoming: FeedItem[]): FeedItem[] {
443|  const current = readJson<FeedItem[]>(ITEMS_KEY, []);
444|  const combined = [...current, ...incoming.filter((item) => !isRemovedFeedItem(item))];
445|  const merged = dedupeFeedItems(combined);
446|  writeJson(ITEMS_KEY, merged.slice(0, 500));
447|  return merged;
448|}
449|
450|export function markFeedItemRead(itemId: string, read = true): void {
451|  const items = getFeedItems().map((item) => (item.id === itemId ? { ...item, read } : item));
452|  saveFeedItems(items);
453|}
454|
455|/** True when an item belongs in the Feed "Saved" chip. */
456|export function isFeedItemSaved(item: Pick<FeedItem, "saved" | "savedBookId">): boolean {
457|  return item.saved === true || Boolean(item.savedBookId);
458|}
459|
460|/** Save / unsave for later in the news Feed tab (does not clip to library). */
461|export function markFeedItemSavedForLater(itemId: string, saved = true): void {
462|  const items = getFeedItems().map((item) =>
463|    item.id === itemId
464|      ? {
465|          ...item,
466|          saved,
467|          savedAt: saved ? Date.now() : undefined,
468|        }
469|      : item
470|  );
471|  saveFeedItems(items);
472|}
473|
474|/** Mark a feed item as clipped into the book library (and keep it in Saved). */
475|export function markFeedItemSaved(itemId: string, bookId: string): void {
476|  const items = getFeedItems().map((item) =>
477|    item.id === itemId
478|      ? {
479|          ...item,
480|          saved: true,
481|          savedAt: item.savedAt || Date.now(),
482|          savedBookId: bookId,
483|          read: true,
484|          clippedAt: Date.now(),
485|        }
486|      : item
487|  );
488|  saveFeedItems(items);
489|}
490|
491|export function getUnreadFeedCount(): number {
492|  const enabledIds = new Set(getEnabledFeedSubscriptions().map((sub) => sub.id));
493|  return getFeedItems().filter((item) => !item.read && enabledIds.has(item.subscriptionId)).length;
494|}
495|
```


## Daily brief periods & synthetic briefs

**`src/lib/feedBriefs.ts`** (lines 1-257)

```ts
1|import { FeedItem } from "./feedStorage";
2|
3|export interface BriefPeriod {
4|  key: string;
5|  start: Date;
6|  end: Date;
7|  dayLabel: string;
8|  monthLabel: string;
9|}
10|
11|export interface BriefFeedItem extends FeedItem {
12|  briefPeriod: BriefPeriod;
13|}
14|
15|const MONTHS: Record<string, number> = {
16|  january: 0,
17|  jan: 0,
18|  february: 1,
19|  feb: 1,
20|  march: 2,
21|  mar: 2,
22|  april: 3,
23|  apr: 3,
24|  may: 4,
25|  june: 5,
26|  jun: 5,
27|  july: 6,
28|  jul: 6,
29|  august: 7,
30|  aug: 7,
31|  september: 8,
32|  sep: 8,
33|  sept: 8,
34|  october: 9,
35|  oct: 9,
36|  november: 10,
37|  nov: 10,
38|  december: 11,
39|  dec: 11,
40|};
41|
42|function padDate(year: number, month: number, day: number): Date {
43|  return new Date(year, month, day, 12, 0, 0, 0);
44|}
45|
46|function formatMonthLabel(date: Date): string {
47|  return date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
48|}
49|
50|function formatDayLabel(start: Date, end: Date): string {
51|  const startDay = start.getDate();
52|  const endDay = end.getDate();
53|  if (startDay === endDay) return String(startDay);
54|  return `${startDay}-${endDay}`;
55|}
56|
57|function periodKey(start: Date, end: Date): string {
58|  const fmt = (d: Date) =>
59|    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
60|  return `${fmt(start)}_${fmt(end)}`;
61|}
62|
63|function parseMonthToken(token: string): number | null {
64|  return MONTHS[token.toLowerCase().replace(/\./g, "")] ?? null;
65|}
66|
67|export function parseBriefPeriod(summary: string | undefined, publishedAt: number): BriefPeriod {
68|  const fallback = new Date(publishedAt);
69|  const text = (summary || "").replace(/\s+/g, " ").trim();
70|  const year = fallback.getFullYear();
71|
72|  const rangeMatch = text.match(
73|    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\w*\s+(\d{1,2})\s+and\s+(\d{1,2})\b/i
74|  );
75|  if (rangeMatch) {
76|    const month = parseMonthToken(rangeMatch[1]);
77|    if (month != null) {
78|      const start = padDate(year, month, parseInt(rangeMatch[2], 10));
79|      const end = padDate(year, month, parseInt(rangeMatch[3], 10));
80|      return {
81|        key: periodKey(start, end),
82|        start,
83|        end,
84|        dayLabel: formatDayLabel(start, end),
85|        monthLabel: formatMonthLabel(start),
86|      };
87|    }
88|  }
89|
90|  const singleMatch = text.match(
91|    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\w*\s+(\d{1,2})\b/i
92|  );
93|  if (singleMatch) {
94|    const month = parseMonthToken(singleMatch[1]);
95|    if (month != null) {
96|      const start = padDate(year, month, parseInt(singleMatch[2], 10));
97|      return {
98|        key: periodKey(start, start),
99|        start,
100|        end: start,
101|        dayLabel: formatDayLabel(start, start),
102|        monthLabel: formatMonthLabel(start),
103|      };
104|    }
105|  }
106|
107|  const start = padDate(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
108|  return {
109|    key: periodKey(start, start),
110|    start,
111|    end: start,
112|    dayLabel: formatDayLabel(start, start),
113|    monthLabel: formatMonthLabel(start),
114|  };
115|}
116|
117|export function isNewsBriefItem(item: FeedItem): boolean {
118|  if (item.category === "daily-brief") return false;
119|  if (item.category && /brief|roundup|digest/i.test(item.category)) return true;
120|
121|  const haystack = `${item.title} ${item.link} ${item.summary || ""}`.toLowerCase();
122|
123|  if (/\/news-in-brief\//i.test(item.link)) return true;
124|  if (/news[-\s]?in[-\s]?brief/i.test(haystack)) return true;
125|  if (/brief from\b/i.test(haystack)) return true;
126|  if (/\b(daily|evening)\s+(brief|roundup|digest)\b/i.test(haystack)) return true;
127|  if (/\bnews roundup\b/i.test(haystack)) return true;
128|  if (/\bheadlines\b/i.test(item.title) && /\b(brief|roundup|digest)\b/i.test(haystack)) return true;
129|  if (/\b(day in review|today in brief)\b/i.test(haystack)) return true;
130|
131|  return false;
132|}
133|
134|function dayKeyFromTimestamp(ts: number): string {
135|  const d = new Date(ts);
136|  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
137|}
138|
139|function isSameCalendarDay(a: number, b: number): boolean {
140|  return dayKeyFromTimestamp(a) === dayKeyFromTimestamp(b);
141|}
142|
143|/** Build daily headline roundups when feeds don't publish dedicated brief articles. */
144|export function buildSyntheticDailyBriefs(items: FeedItem[]): BriefFeedItem[] {
145|  const grouped = new Map<string, FeedItem[]>();
146|
147|  for (const item of items) {
148|    if (isNewsBriefItem(item)) continue;
149|    const key = `${item.subscriptionId}:${dayKeyFromTimestamp(item.publishedAt)}`;
150|    const list = grouped.get(key) || [];
151|    list.push(item);
152|    grouped.set(key, list);
153|  }
154|
155|  const briefs: BriefFeedItem[] = [];
156|
157|  for (const [key, articles] of grouped) {
158|    if (articles.length < 2) continue;
159|
160|    const sorted = [...articles].sort((a, b) => b.publishedAt - a.publishedAt);
161|    const top = sorted.slice(0, 8);
162|    const headline = top[0];
163|    const summary = top.map((article, index) => `${index + 1}. ${article.title}`).join("\n");
164|    const publishedAt = top[0].publishedAt;
165|
166|    briefs.push({
167|      id: `synthetic-brief-${key}`,
168|      subscriptionId: headline.subscriptionId,
169|      subscriptionTitle: headline.subscriptionTitle,
170|      title: `Daily Brief — ${headline.subscriptionTitle}`,
171|      summary,
172|      link: top[0].link,
173|      publishedAt,
174|      read: top.every((article) => article.read),
175|      category: "daily-brief",
176|      briefPeriod: parseBriefPeriod(summary, publishedAt),
177|    });
178|  }
179|
180|  return briefs.sort((a, b) => b.briefPeriod.end.getTime() - a.briefPeriod.end.getTime());
181|}
182|
183|/** Combined brief for today across all sources (shown at top of Read feed). */
184|export function buildTodayCombinedBrief(items: FeedItem[]): BriefFeedItem | null {
185|  const today = Date.now();
186|  const todays = items
187|    .filter((item) => isSameCalendarDay(item.publishedAt, today) && !isNewsBriefItem(item))
188|    .sort((a, b) => b.publishedAt - a.publishedAt);
189|
190|  if (todays.length < 2) return null;
191|
192|  const bySource = new Map<string, FeedItem[]>();
193|  for (const item of todays) {
194|    const list = bySource.get(item.subscriptionId) || [];
195|    list.push(item);
196|    bySource.set(item.subscriptionId, list);
197|  }
198|
199|  const lines: string[] = [];
200|  for (const [, articles] of bySource) {
201|    const top = articles.slice(0, 2);
202|    for (const article of top) {
203|      lines.push(`• ${article.subscriptionTitle}: ${article.title}`);
204|    }
205|  }
206|
207|  const summary = lines.slice(0, 12).join("\n");
208|  const publishedAt = todays[0].publishedAt;
209|
210|  return {
211|    id: `combined-brief-${dayKeyFromTimestamp(today)}`,
212|    subscriptionId: "all-sources",
213|    subscriptionTitle: "All Sources",
214|    title: "Today's News Brief",
215|    summary,
216|    link: todays[0].link,
217|    publishedAt,
218|    read: false,
219|    category: "daily-brief",
220|    briefPeriod: parseBriefPeriod(summary, publishedAt),
221|  };
222|}
223|
224|export function toBriefFeedItems(items: FeedItem[]): BriefFeedItem[] {
225|  const native = items
226|    .filter((item) => isNewsBriefItem(item))
227|    .map((item) => ({
228|      ...item,
229|      briefPeriod: parseBriefPeriod(item.summary, item.publishedAt),
230|    }));
231|
232|  const nativeKeys = new Set(
233|    native.map((brief) => `${brief.subscriptionId}:${brief.briefPeriod.key}`)
234|  );
235|
236|  const synthetic = buildSyntheticDailyBriefs(items).filter(
237|    (brief) => !nativeKeys.has(`${brief.subscriptionId}:${brief.briefPeriod.key}`)
238|  );
239|
240|  return [...native, ...synthetic].sort(
241|    (a, b) => b.briefPeriod.end.getTime() - a.briefPeriod.end.getTime()
242|  );
243|}
244|
245|export function buildBriefDateChips(briefs: BriefFeedItem[]): BriefPeriod[] {
246|  const map = new Map<string, BriefPeriod>();
247|  for (const brief of briefs) {
248|    if (!map.has(brief.briefPeriod.key)) {
249|      map.set(brief.briefPeriod.key, brief.briefPeriod);
250|    }
251|  }
252|  return Array.from(map.values()).sort((a, b) => b.end.getTime() - a.end.getTime());
253|}
254|
255|export function briefsForPeriod(briefs: BriefFeedItem[], periodKey: string): BriefFeedItem[] {
256|  return briefs.filter((brief) => brief.briefPeriod.key === periodKey);
257|}
258|
```


## On-device daily-brief generator (no AI)

**`src/lib/generateNewsBrief.ts`** (lines 1-232)

```ts
1|export interface BriefArticleInput {
2|  id: string;
3|  source: string;
4|  title: string;
5|  summary?: string;
6|  link: string;
7|}
8|
9|export interface BriefStoryItem {
10|  id: string;
11|  headline: string;
12|  detail: string;
13|  link: string;
14|}
15|
16|export interface BriefSection {
17|  source: string;
18|  intro: string;
19|  items: BriefStoryItem[];
20|}
21|
22|export interface GeneratedDailyBrief {
23|  date: string;
24|  lead: string;
25|  sections: BriefSection[];
26|}
27|
28|const FILLER_PREFIX =
29|  /^(breaking|update|updated|watch|live|video|photos?|opinion|analysis|exclusive|just in|alert|report|reports)\s*[:\-–—|]\s*/i;
30|
31|const TRAILING_NOISE =
32|  /\s*[\-–—|]\s*(read more|click here|full story|more details|source|photo|video|live updates?)\.?$/i;
33|
34|const HTML_TAG = /<[^>]+>/g;
35|
36|const TOPIC_KEYWORDS: Record<string, RegExp> = {
37|  politics: /\b(election|parliament|president|minister|government|policy|vote|cabinet|military|war|diplomat)\b/i,
38|  business: /\b(bank|loan|economy|market|trade|invest|company|business|finance|currency|gdp|tax)\b/i,
39|  sports: /\b(match|cup|goal|team|league|tournament|world cup|score|player|coach|final)\b/i,
40|  weather: /\b(storm|rain|flood|cyclone|weather|temperature|heatwave|drought)\b/i,
41|  health: /\b(hospital|health|disease|virus|vaccine|medical|doctor|patient)\b/i,
42|  crime: /\b(arrest|police|court|trial|sentence|investigation|crime|murder|theft)\b/i,
43|};
44|
45|function stripHtml(text: string): string {
46|  return text.replace(HTML_TAG, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&");
47|}
48|
49|function normalizeWhitespace(text: string): string {
50|  return text.replace(/\s+/g, " ").trim();
51|}
52|
53|function normalizeForCompare(text: string): string {
54|  return normalizeWhitespace(text)
55|    .toLowerCase()
56|    .replace(/[^\w\s]/g, "")
57|    .replace(/\b(the|a|an|in|on|at|to|for|of|and|or|is|are|was|were)\b/g, " ")
58|    .replace(/\s+/g, " ")
59|    .trim();
60|}
61|
62|function wordOverlap(a: string, b: string): number {
63|  const wordsA = new Set(normalizeForCompare(a).split(" ").filter(Boolean));
64|  const wordsB = new Set(normalizeForCompare(b).split(" ").filter(Boolean));
65|  if (!wordsA.size || !wordsB.size) return 0;
66|  let shared = 0;
67|  for (const word of wordsA) {
68|    if (wordsB.has(word)) shared++;
69|  }
70|  return shared / Math.max(wordsA.size, wordsB.size);
71|}
72|
73|function isDuplicate(title: string, seen: string[]): boolean {
74|  return seen.some((existing) => wordOverlap(title, existing) > 0.72);
75|}
76|
77|function limitWords(text: string, max: number): string {
78|  const words = text.split(/\s+/).filter(Boolean);
79|  if (words.length <= max) return text;
80|  return words.slice(0, max).join(" ").replace(/[,;:]$/, "") + "…";
81|}
82|
83|/** Rewrite headline to be direct and straight to the point. */
84|export function rewriteHeadline(title: string): string {
85|  let text = normalizeWhitespace(stripHtml(title));
86|  text = text.replace(FILLER_PREFIX, "");
87|  text = text.replace(/^["'“”]+|["'“”]+$/g, "");
88|  text = text.replace(TRAILING_NOISE, "");
89|  text = text.replace(/\s*\([^)]{0,40}\)\s*$/, ""); // trailing parenthetical
90|
91|  // Split on colon/dash — keep the substantive part
92|  const parts = text.split(/\s*[:\-–—]\s+/);
93|  if (parts.length > 1) {
94|    const substantive = parts.find((part) => part.split(/\s+/).length >= 3) || parts[parts.length - 1];
95|    text = substantive;
96|  }
97|
98|  // Sentence case: capitalize first letter only (preserve acronyms)
99|  if (text.length > 0) {
100|    text = text.charAt(0).toUpperCase() + text.slice(1);
101|  }
102|
103|  return limitWords(text, 12);
104|}
105|
106|/** Extract one crisp detail sentence from summary or title. */
107|export function extractDetail(summary: string | undefined, headline: string): string {
108|  const cleaned = normalizeWhitespace(stripHtml(summary || ""));
109|  let detail = "";
110|
111|  if (cleaned.length > 20) {
112|    const sentences = cleaned.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [cleaned];
113|    detail = sentences
114|      .map((sentence) => normalizeWhitespace(sentence))
115|      .find((sentence) => {
116|        if (sentence.length < 25) return false;
117|        if (wordOverlap(sentence, headline) > 0.85) return false;
118|        if (/^(read more|click|share|subscribe|follow)/i.test(sentence)) return false;
119|        return true;
120|      }) || sentences[0];
121|  }
122|
123|  if (!detail || detail.length < 15) {
124|    detail = headline.endsWith(".") ? headline : `${headline}.`;
125|  }
126|
127|  detail = detail.replace(TRAILING_NOISE, "");
128|  return limitWords(detail, 28);
129|}
130|
131|function detectSectionTheme(headlines: string[]): string {
132|  const scores = new Map<string, number>();
133|  const combined = headlines.join(" ");
134|
135|  for (const [topic, pattern] of Object.entries(TOPIC_KEYWORDS)) {
136|    const matches = combined.match(new RegExp(pattern.source, "gi"));
137|    if (matches) scores.set(topic, matches.length);
138|  }
139|
140|  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
141|  if (!sorted.length || sorted[0][1] === 0) return "general news";
142|
143|  const labels: Record<string, string> = {
144|    politics: "politics and governance",
145|    business: "business and finance",
146|    sports: "sports",
147|    weather: "weather and environment",
148|    health: "health",
149|    crime: "crime and courts",
150|  };
151|
152|  return labels[sorted[0][0]] || "top stories";
153|}
154|
155|function buildSectionIntro(source: string, items: BriefStoryItem[]): string {
156|  const theme = detectSectionTheme(items.map((item) => item.headline));
157|  if (theme === "general news") {
158|    return `${items.length} headline${items.length === 1 ? "" : "s"} from ${source} today.`;
159|  }
160|  return `${source} focuses on ${theme} today — ${items.length} stor${items.length === 1 ? "y" : "ies"}.`;
161|}
162|
163|function buildLead(sections: BriefSection[]): string {
164|  const topHeadlines = sections
165|    .flatMap((section) => section.items.slice(0, 1))
166|    .slice(0, 4)
167|    .map((item) => item.headline.replace(/\.$/, ""));
168|
169|  if (!topHeadlines.length) return "No headlines available for today.";
170|
171|  if (topHeadlines.length === 1) {
172|    return `Today's lead story: ${topHeadlines[0]}.`;
173|  }
174|
175|  const last = topHeadlines.pop();
176|  const joined = topHeadlines.join("; ");
177|  return `Today across your feeds: ${joined}; and ${last}.`;
178|}
179|
180|function dedupeArticles(articles: BriefArticleInput[]): BriefArticleInput[] {
181|  const seen: string[] = [];
182|  const result: BriefArticleInput[] = [];
183|
184|  for (const article of articles) {
185|    if (isDuplicate(article.title, seen)) continue;
186|    seen.push(article.title);
187|    result.push(article);
188|  }
189|
190|  return result;
191|}
192|
193|/** Build a structured daily brief entirely on-device — no AI. */
194|export function buildDailyBrief(articles: BriefArticleInput[], dateKey: string): GeneratedDailyBrief {
195|  const unique = dedupeArticles(articles);
196|  const bySource = new Map<string, BriefArticleInput[]>();
197|
198|  for (const article of unique) {
199|    const list = bySource.get(article.source) || [];
200|    list.push(article);
201|    bySource.set(article.source, list);
202|  }
203|
204|  const sections: BriefSection[] = [];
205|
206|  for (const [source, items] of bySource) {
207|    const top = items.slice(0, 5);
208|    const storyItems: BriefStoryItem[] = top.map((article) => {
209|      const headline = rewriteHeadline(article.title);
210|      return {
211|        id: article.id,
212|        headline,
213|        detail: extractDetail(article.summary, headline),
214|        link: article.link,
215|      };
216|    });
217|
218|    sections.push({
219|      source,
220|      intro: buildSectionIntro(source, storyItems),
221|      items: storyItems,
222|    });
223|  }
224|
225|  sections.sort((a, b) => b.items.length - a.items.length);
226|
227|  return {
228|    date: dateKey,
229|    lead: buildLead(sections),
230|    sections,
231|  };
232|}
233|
```


## Collect today's articles → build brief

**`src/lib/dailyNewsBriefClient.ts`** (lines 1-34)

```ts
1|import type { FeedItem } from "./feedStorage";
2|import type { BriefArticleInput, GeneratedDailyBrief } from "./generateNewsBrief";
3|import { buildDailyBrief } from "./generateNewsBrief";
4|import { isNewsBriefItem } from "./feedBriefs";
5|
6|function dayKeyFromTimestamp(ts: number): string {
7|  const d = new Date(ts);
8|  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
9|}
10|
11|function isSameCalendarDay(a: number, b: number): boolean {
12|  return dayKeyFromTimestamp(a) === dayKeyFromTimestamp(b);
13|}
14|
15|export function collectTodayBriefArticles(items: FeedItem[]): BriefArticleInput[] {
16|  const today = Date.now();
17|  return items
18|    .filter((item) => isSameCalendarDay(item.publishedAt, today) && !isNewsBriefItem(item))
19|    .sort((a, b) => b.publishedAt - a.publishedAt)
20|    .slice(0, 24)
21|    .map((item) => ({
22|      id: item.id,
23|      source: item.subscriptionTitle,
24|      title: item.title,
25|      summary: item.summary,
26|      link: item.link,
27|    }));
28|}
29|
30|export function buildTodayDailyBrief(articles: BriefArticleInput[]): GeneratedDailyBrief | null {
31|  if (articles.length < 2) return null;
32|  const dateKey = dayKeyFromTimestamp(Date.now());
33|  return buildDailyBrief(articles, dateKey);
34|}
35|
```


## News reader theme/prefs model

**`src/lib/newsReaderPrefs.ts`** (lines 1-182)

```ts
1|export type NewsReaderThemeId =
2|  | "app"
3|  | "sepia"
4|  | "night"
5|  | "paper"
6|  | "oled"
7|  | "light"
8|  | "dark"
9|  | "green";
10|
11|export interface NewsReaderPrefs {
12|  fontSize: number;
13|  lineSpacing: number;
14|  paragraphSpacing: number;
15|  fontFamily: string;
16|  marginSize: string;
17|  theme: NewsReaderThemeId;
18|  brightness: number;
19|}
20|
21|export const NEWS_READER_PREFS_KEY = "kora_news_reader_prefs";
22|export const NEWS_READER_PREFS_EVENT = "kora-news-reader-prefs";
23|
24|export const DEFAULT_NEWS_READER_PREFS: NewsReaderPrefs = {
25|  fontSize: 18,
26|  lineSpacing: 1.7,
27|  paragraphSpacing: 1.1,
28|  fontFamily: "font-lexica",
29|  marginSize: "max-w-2xl px-5",
30|  theme: "app",
31|  brightness: 100,
32|};
33|
34|export const NEWS_READER_FONT_OPTIONS = [
35|  { id: "font-serif", label: "Serif" },
36|  { id: "font-sans", label: "Sans" },
37|  { id: "font-lexend", label: "Lexend" },
38|  { id: "font-opendyslexic", label: "OpenDyslexic" },
39|  { id: "font-mono", label: "Mono" },
40|  { id: "font-bookerly", label: "Bookerly" },
41|  { id: "font-chareink", label: "ChareInk7SP" },
42|  { id: "font-lexica", label: "Lexica Ultralegible" },
43|] as const;
44|
45|export const NEWS_READER_MARGIN_OPTIONS = [
46|  { id: "max-w-xl px-4", label: "Narrow" },
47|  { id: "max-w-2xl px-5", label: "Medium" },
48|  { id: "max-w-3xl px-6", label: "Wide" },
49|  { id: "max-w-4xl px-8", label: "Full" },
50|] as const;
51|
52|export const NEWS_READER_THEME_OPTIONS: {
53|  id: NewsReaderThemeId;
54|  label: string;
55|  bg: string;
56|  ring: string;
57|}[] = [
58|  { id: "app", label: "App", bg: "bg-kindle-bg", ring: "ring-kindle-border" },
59|  { id: "sepia", label: "Sepia", bg: "bg-[#f4ecd8]", ring: "ring-[#cbb994]" },
60|  { id: "night", label: "Night", bg: "bg-[#1c1f26]", ring: "ring-[#3a4050]" },
61|  { id: "paper", label: "Paper", bg: "bg-[#faf7f2]", ring: "ring-[#e4ddd2]" },
62|  { id: "oled", label: "OLED", bg: "bg-black", ring: "ring-neutral-700" },
63|  { id: "light", label: "Light", bg: "bg-white", ring: "ring-neutral-300" },
64|  { id: "dark", label: "Dark", bg: "bg-[#1a1a1a]", ring: "ring-neutral-600" },
65|  { id: "green", label: "Green", bg: "bg-[#c7edcc]", ring: "ring-[#7fb987]" },
66|];
67|
68|export function newsReaderThemeClasses(theme: NewsReaderThemeId): {
69|  shell: string;
70|  header: string;
71|  border: string;
72|  muted: string;
73|  content: string;
74|} {
75|  switch (theme) {
76|    case "sepia":
77|      return {
78|        shell: "bg-[#f4ecd8] text-[#3d3426]",
79|        header: "bg-[#efe6d2]/95 text-[#3d3426]",
80|        border: "border-[#cbb994]/70",
81|        muted: "text-[#6f6452]",
82|        content: "text-[#3d3426]",
83|      };
84|    case "night":
85|      return {
86|        shell: "bg-[#1c1f26] text-[#e8eaef]",
87|        header: "bg-[#232833]/95 text-[#e8eaef]",
88|        border: "border-[#3a4050]",
89|        muted: "text-[#9aa3b5]",
90|        content: "text-[#e8eaef]",
91|      };
92|    case "paper":
93|      return {
94|        shell: "bg-[#faf7f2] text-[#2a2621]",
95|        header: "bg-[#f3efe8]/95 text-[#2a2621]",
96|        border: "border-[#e4ddd2]",
97|        muted: "text-[#7a7368]",
98|        content: "text-[#2a2621]",
99|      };
100|    case "oled":
101|      return {
102|        shell: "bg-black text-[#f5f5f5]",
103|        header: "bg-neutral-950/95 text-[#f5f5f5]",
104|        border: "border-neutral-800",
105|        muted: "text-neutral-400",
106|        content: "text-[#f5f5f5]",
107|      };
108|    case "light":
109|      return {
110|        shell: "bg-white text-neutral-900",
111|        header: "bg-white/95 text-neutral-900",
112|        border: "border-neutral-200",
113|        muted: "text-neutral-500",
114|        content: "text-neutral-900",
115|      };
116|    case "dark":
117|      return {
118|        shell: "bg-[#1a1a1a] text-neutral-100",
119|        header: "bg-[#141414]/95 text-neutral-100",
120|        border: "border-neutral-700",
121|        muted: "text-neutral-400",
122|        content: "text-neutral-100",
123|      };
124|    case "green":
125|      return {
126|        shell: "bg-[#c7edcc] text-[#1f3d24]",
127|        header: "bg-[#bfe6c5]/95 text-[#1f3d24]",
128|        border: "border-[#7fb987]/60",
129|        muted: "text-[#3d6a45]",
130|        content: "text-[#1f3d24]",
131|      };
132|    case "app":
133|    default:
134|      return {
135|        shell: "bg-kindle-bg text-kindle-text",
136|        header: "bg-kindle-card/90 text-kindle-text",
137|        border: "border-kindle-border",
138|        muted: "text-kindle-text-muted",
139|        content: "text-kindle-text",
140|      };
141|  }
142|}
143|
144|function normalizePrefs(raw: Partial<NewsReaderPrefs> | null | undefined): NewsReaderPrefs {
145|  const base = { ...DEFAULT_NEWS_READER_PREFS };
146|  if (!raw || typeof raw !== "object") return base;
147|  return {
148|    fontSize: clamp(Number(raw.fontSize) || base.fontSize, 12, 36),
149|    lineSpacing: clamp(Number(raw.lineSpacing) || base.lineSpacing, 1.2, 2.6),
150|    paragraphSpacing: clamp(Number(raw.paragraphSpacing) || base.paragraphSpacing, 0.6, 2.2),
151|    fontFamily: typeof raw.fontFamily === "string" ? raw.fontFamily : base.fontFamily,
152|    marginSize: typeof raw.marginSize === "string" ? raw.marginSize : base.marginSize,
153|    theme: (NEWS_READER_THEME_OPTIONS.some((t) => t.id === raw.theme) ? raw.theme : base.theme) as NewsReaderThemeId,
154|    brightness: clamp(Number(raw.brightness) || base.brightness, 40, 100),
155|  };
156|}
157|
158|function clamp(n: number, min: number, max: number): number {
159|  return Math.min(max, Math.max(min, n));
160|}
161|
162|export function loadNewsReaderPrefs(): NewsReaderPrefs {
163|  try {
164|    const saved = localStorage.getItem(NEWS_READER_PREFS_KEY);
165|    if (!saved) return { ...DEFAULT_NEWS_READER_PREFS };
166|    return normalizePrefs(JSON.parse(saved));
167|  } catch {
168|    return { ...DEFAULT_NEWS_READER_PREFS };
169|  }
170|}
171|
172|export function saveNewsReaderPrefs(prefs: NewsReaderPrefs): void {
173|  const next = normalizePrefs(prefs);
174|  localStorage.setItem(NEWS_READER_PREFS_KEY, JSON.stringify(next));
175|  window.dispatchEvent(new CustomEvent(NEWS_READER_PREFS_EVENT, { detail: next }));
176|}
177|
178|export function patchNewsReaderPrefs(patch: Partial<NewsReaderPrefs>): NewsReaderPrefs {
179|  const next = normalizePrefs({ ...loadNewsReaderPrefs(), ...patch });
180|  saveNewsReaderPrefs(next);
181|  return next;
182|}
183|
```


## Persisted reader prefs hook

**`src/hooks/useNewsReaderPrefs.ts`** (lines 1-33)

```ts
1|import { useEffect, useState } from "react";
2|import {
3|  loadNewsReaderPrefs,
4|  NEWS_READER_PREFS_EVENT,
5|  patchNewsReaderPrefs,
6|  type NewsReaderPrefs,
7|} from "../lib/newsReaderPrefs";
8|
9|/** Shared prefs for Feed article reader and Daily News Brief (persisted). */
10|export function useNewsReaderPrefs() {
11|  const [prefs, setPrefs] = useState<NewsReaderPrefs>(() => loadNewsReaderPrefs());
12|
13|  useEffect(() => {
14|    const sync = () => setPrefs(loadNewsReaderPrefs());
15|    const onCustom = (event: Event) => {
16|      const detail = (event as CustomEvent<NewsReaderPrefs>).detail;
17|      if (detail) setPrefs(detail);
18|      else sync();
19|    };
20|    window.addEventListener(NEWS_READER_PREFS_EVENT, onCustom as EventListener);
21|    window.addEventListener("storage", sync);
22|    return () => {
23|      window.removeEventListener(NEWS_READER_PREFS_EVENT, onCustom as EventListener);
24|      window.removeEventListener("storage", sync);
25|    };
26|  }, []);
27|
28|  const updatePrefs = (patch: Partial<NewsReaderPrefs>) => {
29|    setPrefs(patchNewsReaderPrefs(patch));
30|  };
31|
32|  return { prefs, updatePrefs };
33|}
34|
```


## Image proxy, link previews, thumbnails

**`src/lib/feedPreview.ts`** (lines 1-171)

```ts
1|import { resolveApiUrl } from "./capacitorNative";
2|import { FeedItem, getFeedItems, saveFeedItems } from "./feedStorage";
3|import { dedupeFeedItems } from "./feedNormalize";
4|
5|export interface FeedArticlePreview {
6|  title?: string;
7|  description?: string;
8|  imageUrl?: string;
9|  author?: string;
10|  siteName?: string;
11|}
12|
13|const PREVIEW_PREFIX = "kora_feed_preview_";
14|const PREVIEW_MAX_AGE_MS = 1000 * 60 * 60 * 6;
15|
16|function previewKey(itemId: string): string {
17|  return `${PREVIEW_PREFIX}${itemId}`;
18|}
19|
20|function getCachedPreview(itemId: string): FeedArticlePreview | null {
21|  try {
22|    const raw = sessionStorage.getItem(previewKey(itemId));
23|    if (!raw) return null;
24|    const parsed = JSON.parse(raw) as FeedArticlePreview & { fetchedAt: number };
25|    if (Date.now() - parsed.fetchedAt > PREVIEW_MAX_AGE_MS) {
26|      sessionStorage.removeItem(previewKey(itemId));
27|      return null;
28|    }
29|    return parsed;
30|  } catch {
31|    return null;
32|  }
33|}
34|
35|function setCachedPreview(itemId: string, preview: FeedArticlePreview): void {
36|  try {
37|    sessionStorage.setItem(previewKey(itemId), JSON.stringify({ ...preview, fetchedAt: Date.now() }));
38|  } catch {
39|    // session storage full — ignore
40|  }
41|}
42|
43|export async function fetchFeedPreview(url: string): Promise<FeedArticlePreview> {
44|  const response = await fetch("/api/feed/preview", {
45|    method: "POST",
46|    headers: { "Content-Type": "application/json" },
47|    body: JSON.stringify({ url: url.trim() }),
48|  });
49|
50|  if (!response.ok) {
51|    throw new Error(`Preview failed (${response.status})`);
52|  }
53|
54|  return response.json();
55|}
56|
57|export function markFeedImageBroken(itemId: string): void {
58|  try {
59|    const items = getFeedItems();
60|    const next = items.map((item) =>
61|      item.id === itemId ? { ...item, imageUrl: undefined } : item
62|    );
63|    if (next.some((item, i) => item.imageUrl !== items[i]?.imageUrl)) {
64|      saveFeedItems(dedupeFeedItems(next));
65|    }
66|  } catch {
67|    /* ignore */
68|  }
69|}
70|
71|export function resolveFeedImageSrc(url: string | undefined | null): string | null {
72|  if (!url?.trim()) return null;
73|  let trimmed = url.trim();
74|  if (trimmed.startsWith("http://")) {
75|    trimmed = `https://${trimmed.slice(7)}`;
76|  }
77|  if (trimmed.startsWith("data:")) return trimmed;
78|  // Absolute API / static paths must resolve to the Worker on Capacitor —
79|  // <img src> bypasses the fetch shim.
80|  if (trimmed.startsWith("/")) return resolveApiUrl(trimmed);
81|  if (trimmed.includes("google.com/s2/favicons")) return null;
82|  return resolveApiUrl(`/api/feed/image?url=${encodeURIComponent(trimmed)}`);
83|}
84|
85|export function getFaviconUrl(link: string): string | null {
86|  try {
87|    const host = new URL(link).hostname;
88|    return `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
89|  } catch {
90|    return null;
91|  }
92|}
93|
94|export function getItemThumbnail(item: FeedItem): string | null {
95|  if (item.imageUrl) {
96|    const resolved = resolveFeedImageSrc(item.imageUrl);
97|    if (resolved) return resolved;
98|  }
99|  return null;
100|}
101|
102|function needsPreview(item: FeedItem): boolean {
103|  const badTitle = /^(article url|comments url|link)$/i.test(item.title.trim());
104|  const badSummary = !item.summary || /^(article url|comments url)/i.test(item.summary);
105|  return !item.imageUrl || badTitle || badSummary;
106|}
107|
108|export function applyPreviewToItem(item: FeedItem, preview: FeedArticlePreview): FeedItem {
109|  const badTitle = /^(article url|comments url|link)$/i.test(item.title.trim());
110|  const badSummary = !item.summary || /^(article url|comments url)/i.test(item.summary);
111|
112|  return {
113|    ...item,
114|    title: badTitle && preview.title ? preview.title : item.title,
115|    summary: badSummary && preview.description ? preview.description : item.summary,
116|    imageUrl: item.imageUrl || preview.imageUrl,
117|    author: item.author || preview.author,
118|  };
119|}
120|
121|export function updateFeedItemFromPreview(itemId: string, preview: FeedArticlePreview): FeedItem[] {
122|  const items = getFeedItems().map((item) => {
123|    if (item.id !== itemId) return item;
124|    return applyPreviewToItem(item, preview);
125|  });
126|  const merged = dedupeFeedItems(items);
127|  saveFeedItems(merged);
128|  return merged;
129|}
130|
131|export async function prefetchFeedPreviews(items: FeedItem[], limit = 16): Promise<FeedItem[]> {
132|  const targets = items.filter(needsPreview).slice(0, limit);
133|  if (!targets.length) return getFeedItems();
134|
135|  const byId = new Map<string, FeedArticlePreview>();
136|
137|  // Cap concurrency to avoid hammering the preview API + main thread.
138|  const CONCURRENCY = 3;
139|  let cursor = 0;
140|  async function worker() {
141|    while (cursor < targets.length) {
142|      const index = cursor++;
143|      const item = targets[index];
144|      const cached = getCachedPreview(item.id);
145|      if (cached) {
146|        byId.set(item.id, cached);
147|        continue;
148|      }
149|      try {
150|        const preview = await fetchFeedPreview(item.link);
151|        setCachedPreview(item.id, preview);
152|        byId.set(item.id, preview);
153|      } catch {
154|        // best-effort background prefetch
155|      }
156|    }
157|  }
158|
159|  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker()));
160|
161|  if (!byId.size) return getFeedItems();
162|
163|  const merged = dedupeFeedItems(
164|    getFeedItems().map((item) => {
165|      const preview = byId.get(item.id);
166|      return preview ? applyPreviewToItem(item, preview) : item;
167|    })
168|  );
169|  saveFeedItems(merged);
170|  return merged;
171|}
172|
```


## Cover/image URL resolver

**`src/lib/coverImage.ts`** (lines 1-47)

```ts
1|/**
2| * Resolve a book cover URL for use in <img src>.
3| * Proxies remote http(s) URLs through /api/proxy-image; passes through local,
4| * data, and blob URLs unchanged.
5| *
6| * On Capacitor (APK), relative /api/* paths must be absolute to the Worker —
7| * <img src> does not go through the fetch shim.
8| */
9|import { resolveApiUrl } from "./capacitorNative";
10|
11|export function resolveCoverImageSrc(coverUrl?: string | null): string | null {
12|  if (!coverUrl) return null;
13|  const trimmed = coverUrl.trim();
14|  if (!trimmed) return null;
15|
16|  if (
17|    trimmed.startsWith("data:") ||
18|    trimmed.startsWith("blob:")
19|  ) {
20|    return trimmed;
21|  }
22|
23|  if (trimmed.startsWith("/")) {
24|    // /api/cover-redirect, /api/proxy-image, static assets under /api, etc.
25|    return resolveApiUrl(trimmed);
26|  }
27|
28|  if (trimmed.startsWith("//")) {
29|    return resolveApiUrl(
30|      `/api/proxy-image?url=${encodeURIComponent(`https:${trimmed}`)}`
31|    );
32|  }
33|
34|  if (/^https?:\/\//i.test(trimmed)) {
35|    const secure = trimmed.startsWith("http://")
36|      ? `https://${trimmed.slice(7)}`
37|      : trimmed;
38|    return resolveApiUrl(`/api/proxy-image?url=${encodeURIComponent(secure)}`);
39|  }
40|
41|  return trimmed;
42|}
43|
44|export function shouldProxyCoverUrl(coverUrl: string): boolean {
45|  const trimmed = coverUrl.trim();
46|  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith("//");
47|}
48|
```


## Article extraction (convert-url) + boilerplate strip

**`src/lib/feedArticle.ts`** (lines 1-395)

```ts
1|import { CachedFeedArticle, getCachedFeedArticle, setCachedFeedArticle } from "./feedArticleCache";
2|import type { FeedItem } from "./feedStorage";
3|import { isTelegramArticleLink, telegramPostHtml } from "./telegramFeed";
4|
5|function normalizeHeadingText(value: string): string {
6|  return value
7|    .replace(/<[^>]+>/g, " ")
8|    .replace(/&nbsp;/gi, " ")
9|    .replace(/&amp;/gi, "&")
10|    .replace(/&quot;/gi, '"')
11|    .replace(/&#39;/gi, "'")
12|    .replace(/&lt;/gi, "<")
13|    .replace(/&gt;/gi, ">")
14|    .normalize("NFKD")
15|    .replace(/[\u0300-\u036f]/g, "")
16|    .toLowerCase()
17|    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
18|    .replace(/\s+/g, " ")
19|    .trim();
20|}
21|
22|function titlesMatch(a: string, b: string): boolean {
23|  const left = normalizeHeadingText(a);
24|  const right = normalizeHeadingText(b);
25|  if (!left || !right) return false;
26|  if (left === right) return true;
27|  const shorter = left.length <= right.length ? left : right;
28|  const longer = left.length <= right.length ? right : left;
29|  // Near-identical titles (trailing site name, punctuation, etc.)
30|  if (shorter.length >= 16 && longer.startsWith(shorter)) return true;
31|  if (shorter.length >= 24 && longer.includes(shorter) && longer.length - shorter.length < 40) {
32|    return true;
33|  }
34|  return false;
35|}
36|
37|/** Site chrome headings / footers that should never appear in the reader body. */
38|const FOOTER_SECTION_RE =
39|  /^(topics?|related stories|related articles|related posts|related news|more stories|more news|more from|you may also like|you might also like|recommended|recommended for you|popular|trending|discuss|discussion|comments?|leave a (comment|reply)|join the (conversation|discussion)|sign using|sign in|sign up|log ?in|share this|share article|follow us|newsletter|subscribe|tags?|categories|also read|read more|what to read next|from around the web)$/i;
40|
41|const LEGAL_OR_META_RE =
42|  /^(terms of use|terms (of|&) conditions|privacy policy|code of ethics|editorial policy|contact( us)?|cookie policy|about us|advertise|careers?)$/i;
43|
44|const CHAR_REMAINING_RE = /^\d+\s+characters?\s+remaining$/i;
45|const BARE_DOMAIN_RE = /^(?:www\.)?[a-z0-9-]+\.(?:com|mv|net|org|io|news|media)$/i;
46|
47|export function isArticleFooterMarker(text: string): boolean {
48|  const normalized = text.replace(/\s+/g, " ").trim();
49|  if (!normalized || normalized.length > 80) return false;
50|  if (FOOTER_SECTION_RE.test(normalized)) return true;
51|  if (LEGAL_OR_META_RE.test(normalized)) return true;
52|  if (CHAR_REMAINING_RE.test(normalized)) return true;
53|  if (BARE_DOMAIN_RE.test(normalized)) return true;
54|  return false;
55|}
56|
57|/**
58| * Cut HTML string at the first footer-section heading / legal chrome.
59| * Safe for worker/server string pipelines (no DOM).
60| */
61|export function truncateHtmlAtFooterMarkers(html: string): string {
62|  if (!html.trim()) return html;
63|
64|  const headingMatch = html.search(
65|    /<(h[1-6])(?:\s[^>]*)?>\s*(?:Topics?|Related stories|Related articles|Related posts|Related news|More stories|More news|You may also like|Recommended|Discuss|Discussion|Comments?|Leave a (?:comment|reply)|Sign Using|Sign in|Share this|Tags?)\s*<\/\1>/i
66|  );
67|  if (headingMatch >= 0 && headingMatch > html.length * 0.75) return html.slice(0, headingMatch).trim();
68|
69|  const charMatch = html.search(
70|    /<(?:p|div|span|label)(?:\s[^>]*)?>\s*\d+\s+characters?\s+remaining\s*<\/(?:p|div|span|label)>/i
71|  );
72|  if (charMatch >= 0 && charMatch > html.length * 0.75) return html.slice(0, charMatch).trim();
73|
74|  const legalMatch = html.search(
75|    /<(?:p|div|li|a)(?:\s[^>]*)?>\s*(?:Terms of Use|Privacy Policy|Code of Ethics|Editorial Policy)\s*<\/(?:p|div|li|a)>/i
76|  );
77|  if (legalMatch >= 0 && legalMatch > html.length * 0.75) return html.slice(0, legalMatch).trim();
78|
79|  return html;
80|}
81|
82|function stripLeadingEmpty(parent: ParentNode) {
83|  while (parent.firstChild) {
84|    const node = parent.firstChild;
85|    if (node.nodeType === Node.TEXT_NODE && !(node.textContent || "").trim()) {
86|      parent.removeChild(node);
87|      continue;
88|    }
89|    if (node.nodeType === Node.COMMENT_NODE) {
90|      parent.removeChild(node);
91|      continue;
92|    }
93|    break;
94|  }
95|}
96|
97|function stripLeadingTitleDuplicates(parent: ParentNode, title: string) {
98|  for (;;) {
99|    stripLeadingEmpty(parent);
100|    const el = parent.firstElementChild as HTMLElement | null;
101|    if (!el) return;
102|
103|    const tag = el.tagName.toLowerCase();
104|    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
105|
106|    if (["h1", "h2", "h3", "h4"].includes(tag) && titlesMatch(text, title)) {
107|      el.remove();
108|      continue;
109|    }
110|
111|    // Telegram / summary posts often repeat the title as the first paragraph.
112|    if (tag === "p" && titlesMatch(text, title)) {
113|      el.remove();
114|      continue;
115|    }
116|
117|    if (["div", "section", "article", "header", "main"].includes(tag)) {
118|      if (titlesMatch(text, title)) {
119|        el.remove();
120|        continue;
121|      }
122|      stripLeadingTitleDuplicates(el, title);
123|      if (!(el.textContent || "").trim() && !el.querySelector("img, figure, iframe, video, svg")) {
124|        el.remove();
125|        continue;
126|      }
127|    }
128|
129|    return;
130|  }
131|}
132|
133|function elementLooksLikeFooterBlock(el: Element): boolean {
134|  const text = (el.textContent || "").replace(/\s+/g, " ").trim();
135|  if (!text) return false;
136|  const tag = el.tagName.toLowerCase();
137|
138|  if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag) && isArticleFooterMarker(text)) {
139|    return true;
140|  }
141|
142|  if (isArticleFooterMarker(text)) return true;
143|
144|  // Short link lists that are only legal/nav chrome
145|  if (["ul", "ol", "nav"].includes(tag)) {
146|    const links = Array.from(el.querySelectorAll("a"))
147|      .map((a) => (a.textContent || "").replace(/\s+/g, " ").trim())
148|      .filter(Boolean);
149|    if (
150|      links.length >= 2 &&
151|      links.length <= 12 &&
152|      links.every((label) => LEGAL_OR_META_RE.test(label) || isArticleFooterMarker(label))
153|    ) {
154|      return true;
155|    }
156|  }
157|
158|  return false;
159|}
160|
161|/** Remove Topics / Related / Discuss / legal footer chrome from the end of article HTML. */
162|function stripTrailingArticleBoilerplate(root: HTMLElement) {
163|  const visit = (parent: Element): boolean => {
164|    const kids = Array.from(parent.children);
165|    for (let i = 0; i < kids.length; i++) {
166|      const el = kids[i];
167|      const tag = el.tagName.toLowerCase();
168|
169|      if (elementLooksLikeFooterBlock(el)) {
170|        for (let j = kids.length - 1; j >= i; j--) kids[j].remove();
171|        return true;
172|      }
173|
174|      if (["div", "section", "article", "aside", "main", "header", "footer"].includes(tag)) {
175|        if (visit(el)) {
176|          for (let j = kids.length - 1; j > i; j--) kids[j].remove();
177|          if (!(el.textContent || "").trim() && !el.querySelector("img, figure, iframe, video")) {
178|            el.remove();
179|          }
180|          return true;
181|        }
182|      }
183|    }
184|    return false;
185|  };
186|
187|  visit(root);
188|
189|  // Second pass: drop trailing legal/domain-only nodes left after partial cuts.
190|  for (;;) {
191|    const kids = Array.from(root.children);
192|    const last = kids[kids.length - 1];
193|    if (!last) break;
194|    const text = (last.textContent || "").replace(/\s+/g, " ").trim();
195|    if (
196|      elementLooksLikeFooterBlock(last) ||
197|      LEGAL_OR_META_RE.test(text) ||
198|      BARE_DOMAIN_RE.test(text) ||
199|      CHAR_REMAINING_RE.test(text)
200|    ) {
201|      last.remove();
202|      continue;
203|    }
204|    break;
205|  }
206|}
207|
208|/**
209| * Prepare clipped article HTML for the in-app news reader.
210| * The reader already renders the title as its own <h1>, so strip matching
211| * leading headings / title paragraphs from convert-url output, and cut
212| * site footer chrome (Topics, Related, Discuss, legal links, etc.).
213| */
214|export function prepareFeedArticleHtml(html: string, title: string): string {
215|  if (!html.trim() || typeof DOMParser === "undefined") return html;
216|
217|  try {
218|    const truncated = truncateHtmlAtFooterMarkers(html);
219|    const doc = new DOMParser().parseFromString(truncated, "text/html");
220|    const body = doc.body;
221|    if (!body) return truncated;
222|
223|    body.querySelectorAll("script, style, .author-line").forEach((el) => el.remove());
224|
225|    // convert-url wraps content in a full document with a top-level <h1>.
226|    stripLeadingTitleDuplicates(body, title);
227|
228|    const chapterRoots = body.querySelectorAll(".chapter-content, .chapters-container");
229|    chapterRoots.forEach((root) => {
230|      stripLeadingTitleDuplicates(root, title);
231|      stripTrailingArticleBoilerplate(root as HTMLElement);
232|    });
233|    stripTrailingArticleBoilerplate(body);
234|
235|    return body.innerHTML.trim() || truncated;
236|  } catch {
237|    return html;
238|  }
239|}
240|
241|const FAILED_URL_CACHE = new Map<string, number>();
242|const FAILED_URL_TTL_MS = 15 * 60 * 1000;
243|/** Cap concurrent convert-url calls so the Worker / Browser binding cannot 503. */
244|const CONVERT_INFLIGHT = new Map<string, Promise<{
245|  title: string;
246|  author?: string;
247|  description?: string;
248|  htmlContent: string;
249|}>>();
250|let convertActive = 0;
251|const CONVERT_MAX_CONCURRENT = 2;
252|const convertWaiters: Array<() => void> = [];
253|
254|async function acquireConvertSlot(): Promise<void> {
255|  if (convertActive < CONVERT_MAX_CONCURRENT) {
256|    convertActive += 1;
257|    return;
258|  }
259|  await new Promise<void>((resolve) => convertWaiters.push(resolve));
260|  convertActive += 1;
261|}
262|
263|function releaseConvertSlot(): void {
264|  convertActive = Math.max(0, convertActive - 1);
265|  const next = convertWaiters.shift();
266|  if (next) next();
267|}
268|
269|function markUrlFetchFailed(url: string): void {
270|  FAILED_URL_CACHE.set(url.trim(), Date.now());
271|}
272|
273|function isUrlFetchBlocked(url: string): boolean {
274|  const failedAt = FAILED_URL_CACHE.get(url.trim());
275|  if (!failedAt) return false;
276|  if (Date.now() - failedAt > FAILED_URL_TTL_MS) {
277|    FAILED_URL_CACHE.delete(url.trim());
278|    return false;
279|  }
280|  return true;
281|}
282|
283|export async function fetchArticleContent(url: string): Promise<{
284|  title: string;
285|  author?: string;
286|  description?: string;
287|  htmlContent: string;
288|}> {
289|  const trimmed = url.trim();
290|  if (isUrlFetchBlocked(trimmed)) {
291|    throw new Error("Article fetch unavailable right now. Try again later or open the original link.");
292|  }
293|
294|  const existing = CONVERT_INFLIGHT.get(trimmed);
295|  if (existing) return existing;
296|
297|  const job = (async () => {
298|    await acquireConvertSlot();
299|    try {
300|      const response = await fetch("/api/convert-url", {
301|        method: "POST",
302|        headers: { "Content-Type": "application/json" },
303|        body: JSON.stringify({ url: trimmed }),
304|        signal: AbortSignal.timeout(22000),
305|      });
306|
307|      if (!response.ok) {
308|        if (response.status === 503 || response.status >= 500) {
309|          markUrlFetchFailed(trimmed);
310|        }
311|        const errData = await response.json().catch(() => ({}));
312|        throw new Error(errData.error || `HTTP error ${response.status}`);
313|      }
314|
315|      const data = await response.json();
316|      if (!data.htmlContent || String(data.htmlContent).trim().length < 20) {
317|        throw new Error("Article content was empty. Try opening the original link.");
318|      }
319|      return {
320|        title: data.title || "Article",
321|        author: data.author,
322|        description: data.description,
323|        htmlContent: data.htmlContent,
324|      };
325|    } finally {
326|      releaseConvertSlot();
327|      CONVERT_INFLIGHT.delete(trimmed);
328|    }
329|  })();
330|
331|  CONVERT_INFLIGHT.set(trimmed, job);
332|  return job;
333|}
334|
335|export async function loadFeedArticle(itemId: string, url: string): Promise<CachedFeedArticle> {
336|  const cached = getCachedFeedArticle(itemId);
337|  if (cached) return cached;
338|
339|  const data = await fetchArticleContent(url);
340|  const article: CachedFeedArticle = {
341|    url,
342|    title: data.title,
343|    author: data.author,
344|    description: data.description,
345|    htmlContent: data.htmlContent,
346|    fetchedAt: Date.now(),
347|  };
348|  setCachedFeedArticle(itemId, article);
349|  return article;
350|}
351|
352|/** Resolve article HTML for a feed item (Telegram local, others via convert-url cache). */
353|export async function resolveFeedArticle(item: FeedItem): Promise<CachedFeedArticle> {
354|  const cached = getCachedFeedArticle(item.id);
355|  if (cached) return cached;
356|
357|  if (isTelegramArticleLink(item.link)) {
358|    const article: CachedFeedArticle = {
359|      url: item.link,
360|      title: item.title,
361|      description: item.summary,
362|      htmlContent: telegramPostHtml({
363|        title: item.title,
364|        summary: item.summary,
365|        imageUrl: item.imageUrl,
366|        link: item.link,
367|      }),
368|      fetchedAt: Date.now(),
369|    };
370|    setCachedFeedArticle(item.id, article);
371|    return article;
372|  }
373|
374|  return loadFeedArticle(item.id, item.link);
375|}
376|
377|export function peekFeedArticle(item: FeedItem): CachedFeedArticle | null {
378|  return getCachedFeedArticle(item.id);
379|}
380|
381|export async function prefetchFeedArticles(
382|  items: Array<Pick<FeedItem, "id" | "link" | "title"> & Partial<Pick<FeedItem, "summary" | "imageUrl">>>,
383|  limit = 2
384|): Promise<void> {
385|  const targets = items.slice(0, Math.min(limit, 2));
386|  // Sequential — never blast convert-url in parallel from prefetch.
387|  for (const item of targets) {
388|    if (getCachedFeedArticle(item.id)) continue;
389|    try {
390|      await resolveFeedArticle(item as FeedItem);
391|    } catch {
392|      // best-effort background prefetch
393|    }
394|  }
395|}
396|
```


## TTS text chunking & narration prep

**`src/lib/ttsTextPrep.ts`** (lines 1-261)

```ts
1|import { TtsQualityPreset } from "./ttsSettings";
2|import { isGibberishLine, isGibberishParagraph } from "./audiobookTextFilter";
3|
4|export interface SpeakChunk {
5|  text: string;
6|  pauseAfterMs: number;
7|  rateMultiplier: number;
8|  pitchMultiplier: number;
9|  kind: "paragraph" | "sentence" | "dialogue" | "scene-break" | "list";
10|}
11|
12|const ABBREVIATIONS: Record<string, string> = {
13|  "mr.": "Mister",
14|  "mrs.": "Missus",
15|  "ms.": "Miss",
16|  "dr.": "Doctor",
17|  "prof.": "Professor",
18|  "st.": "Saint",
19|  "vs.": "versus",
20|  "etc.": "et cetera",
21|  "e.g.": "for example",
22|  "i.e.": "that is",
23|  "jr.": "Junior",
24|  "sr.": "Senior",
25|  "no.": "number",
26|  "vol.": "volume",
27|  "ch.": "chapter",
28|  "fig.": "figure",
29|  "approx.": "approximately",
30|  "dept.": "department",
31|};
32|
33|const BOILERPLATE_PATTERNS = [
34|  /^project gutenberg/i,
35|  /^copyright/i,
36|  /^all rights reserved/i,
37|  /^table of contents/i,
38|  /^contents$/i,
39|  /^dedication$/i,
40|  /^acknowledg(e)?ments$/i,
41|  /^license$/i,
42|  /^isbn[:\s]/i,
43|  /^discovery(\s*page)?$/i,
44|  /^prologue$/i,
45|  /^preface$/i,
46|  /^foreword$/i,
47|  /^introduction$/i,
48|  /^cover$/i,
49|  /^title page$/i,
50|  /^also by\b/i,
51|  /^praise for\b/i,
52|  /^about the author$/i,
53|  /^list of (illustrations|characters|tables)$/i,
54|  /^printed in\b/i,
55|  /^published by\b/i,
56|  /^first (edition|published)/i,
57|];
58|
59|function isBoilerplateLine(line: string): boolean {
60|  const trimmed = line.trim();
61|  if (!trimmed) return true;
62|  if (/^\d+$/.test(trimmed)) return true;
63|  if (/^page\s+\d+/i.test(trimmed)) return true;
64|  if (/\.{2,}\s*\d+\s*$/.test(trimmed)) return true;
65|  if (isGibberishLine(trimmed)) return true;
66|  return BOILERPLATE_PATTERNS.some((pattern) => pattern.test(trimmed));
67|}
68|
69|function expandAbbreviations(text: string): string {
70|  return text.replace(/\b([A-Za-z]{1,6})\./g, (match, word: string) => {
71|    const key = `${word.toLowerCase()}.`;
72|    return ABBREVIATIONS[key] || match;
73|  });
74|}
75|
76|function softenPunctuationForSpeech(text: string): string {
77|  return text
78|    .replace(/([,;:])\s*/g, "$1 ")
79|    .replace(/([.!?])\s{2,}/g, "$1 ")
80|    .replace(/(\d),(\d)/g, "$1$2")
81|    .replace(/\b(\d{1,3})\s*%\b/g, "$1 percent")
82|    .replace(/\b(\d{4})\b/g, (year) => {
83|      const value = Number(year);
84|      if (value >= 1000 && value <= 2099) {
85|        const first = Math.floor(value / 100);
86|        const rest = value % 100;
87|        if (rest === 0) return `${first} hundred`;
88|        if (rest < 10) return `${first} oh ${rest}`;
89|      }
90|      return year;
91|    });
92|}
93|
94|function normalizeWhitespace(text: string): string {
95|  return text
96|    .replace(/\r\n/g, "\n")
97|    .replace(/[ \t]+\n/g, "\n")
98|    .replace(/\n{3,}/g, "\n\n")
99|    .replace(/[ \t]{2,}/g, " ")
100|    .trim();
101|}
102|
103|function stripBoilerplate(text: string): string {
104|  const lines = text.split("\n");
105|  const kept = lines.filter((line) => !isBoilerplateLine(line));
106|  return kept.join("\n").trim();
107|}
108|
109|function stripLeadingBoilerplateBlocks(text: string): string {
110|  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
111|  let start = 0;
112|
113|  while (start < paragraphs.length) {
114|    const paragraph = paragraphs[start];
115|    const lines = paragraph.split("\n").map((line) => line.trim()).filter(Boolean);
116|    const mostlyBoilerplate =
117|      lines.length > 0 && lines.filter((line) => isBoilerplateLine(line)).length / lines.length >= 0.6;
118|    if (mostlyBoilerplate || isGibberishParagraph(paragraph)) {
119|      start += 1;
120|      continue;
121|    }
122|    break;
123|  }
124|
125|  return paragraphs.slice(start).join("\n\n").trim();
126|}
127|
128|function stripGibberishParagraphs(text: string): string {
129|  return text
130|    .split(/\n{2,}/)
131|    .map((part) => part.replace(/\n+/g, " ").trim())
132|    .filter((part) => part && !isGibberishParagraph(part))
133|    .join("\n\n")
134|    .trim();
135|}
136|
137|function applyDirectorRules(text: string): string {
138|  let output = text;
139|  output = output.replace(/\s*—\s*/g, " — ");
140|  output = output.replace(/\s*--\s*/g, " — ");
141|  output = output.replace(/\.\.\./g, "…");
142|  output = output.replace(/\s*…\s*/g, " … ");
143|  output = output.replace(/\n\s*\*\s*\*\s*\*\s*\n/g, "\n\n[scene break]\n\n");
144|  output = output.replace(/\n\s*---+\s*\n/g, "\n\n[scene break]\n\n");
145|  output = output.replace(/\[\d+\]/g, "");
146|  output = output.replace(/\((?:footnote|note)[^)]*\)/gi, "");
147|  return output;
148|}
149|
150|function splitParagraphs(text: string): string[] {
151|  return text
152|    .split(/\n{2,}/)
153|    .map((part) => part.replace(/\n+/g, " ").trim())
154|    .filter(Boolean);
155|}
156|
157|function splitSentences(paragraph: string): string[] {
158|  const parts = paragraph.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [paragraph];
159|  return parts.map((part) => part.trim()).filter(Boolean);
160|}
161|
162|function classifyParagraph(paragraph: string): SpeakChunk["kind"] {
163|  if (/^\[scene break\]$/i.test(paragraph)) return "scene-break";
164|  if (/^[-*•]\s+/m.test(paragraph)) return "list";
165|  if (/^["“][^"”]+["”]/.test(paragraph) || /["“][^"”]+["”]$/.test(paragraph)) return "dialogue";
166|  return "paragraph";
167|}
168|
169|function chunkParagraph(paragraph: string, maxChars: number): string[] {
170|  const kind = classifyParagraph(paragraph);
171|  if (kind === "scene-break") return ["[scene break]"];
172|  if (paragraph.length <= maxChars) return [paragraph];
173|
174|  const sentences = splitSentences(paragraph);
175|  const chunks: string[] = [];
176|  let current = "";
177|
178|  for (const sentence of sentences) {
179|    const piece = sentence.trim();
180|    if (!piece) continue;
181|    if ((`${current} ${piece}`).trim().length > maxChars && current) {
182|      chunks.push(current.trim());
183|      current = piece;
184|    } else {
185|      current = current ? `${current} ${piece}` : piece;
186|    }
187|  }
188|  if (current.trim()) chunks.push(current.trim());
189|  return chunks.length ? chunks : [paragraph];
190|}
191|
192|export function prepareTextForNarration(
193|  rawText: string,
194|  options?: { chapterTitle?: string; quality?: TtsQualityPreset }
195|): string {
196|  let text = normalizeWhitespace(rawText);
197|  text = stripBoilerplate(text);
198|  text = stripLeadingBoilerplateBlocks(text);
199|  text = stripGibberishParagraphs(text);
200|  text = expandAbbreviations(text);
201|  text = softenPunctuationForSpeech(text);
202|  text = applyDirectorRules(text);
203|
204|  if (options?.chapterTitle) {
205|    const titlePattern = new RegExp(`^${escapeRegex(options.chapterTitle)}\\s*`, "i");
206|    text = text.replace(titlePattern, "");
207|  }
208|
209|  if (options?.quality === "instant") {
210|    return text;
211|  }
212|
213|  return text;
214|}
215|
216|function escapeRegex(value: string): string {
217|  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
218|}
219|
220|export function buildSpeakChunks(
221|  rawText: string,
222|  options?: { chapterTitle?: string; quality?: TtsQualityPreset; maxChars?: number }
223|): SpeakChunk[] {
224|  const prepared = prepareTextForNarration(rawText, options);
225|  const maxChars = options?.maxChars ?? (options?.quality === "instant" ? 220 : 180);
226|  const paragraphs = splitParagraphs(prepared);
227|  const chunks: SpeakChunk[] = [];
228|
229|  for (const paragraph of paragraphs) {
230|    if (isGibberishParagraph(paragraph)) continue;
231|    const kind = classifyParagraph(paragraph);
232|    const pieces = chunkParagraph(paragraph, maxChars);
233|    for (let i = 0; i < pieces.length; i++) {
234|      const text = pieces[i];
235|      if (isGibberishLine(text)) continue;
236|      chunks.push({
237|        text,
238|        pauseAfterMs:
239|          kind === "scene-break" ? 900 : kind === "dialogue" ? 360 : kind === "list" ? 300 : 280,
240|        rateMultiplier:
241|          kind === "scene-break" ? 0.9 : kind === "dialogue" ? 0.94 : kind === "list" ? 0.95 : 1,
242|        pitchMultiplier: kind === "dialogue" ? 1.02 : 1,
243|        kind,
244|      });
245|    }
246|  }
247|
248|  return chunks.filter((chunk) => chunk.text.trim().length > 2 && !isGibberishLine(chunk.text));
249|}
250|
251|export function estimateChunkDurationSeconds(
252|  chunk: SpeakChunk,
253|  baseRate = 1,
254|  basePitch = 1
255|): number {
256|  const words = chunk.text.split(/\s+/).filter(Boolean).length;
257|  const wordsPerMinute = 155 * baseRate * chunk.rateMultiplier;
258|  const seconds = (words / wordsPerMinute) * 60 + chunk.pauseAfterMs / 1000;
259|  const pitchFactor = basePitch > 1 ? 0.97 : basePitch < 1 ? 1.03 : 1;
260|  return Math.max(chunk.kind === "scene-break" ? 0.4 : 0.8, seconds * pitchFactor);
261|}
262|
```


## TTS settings, voices, languages

**`src/lib/ttsSettings.ts`** (lines 1-382)

```ts
1|import {
2|  getCachedNativeVoices,
3|  refreshNativeVoices,
4|  speakText as speakTextNative,
5|  usesNativeTts,
6|  cancelSpeech,
7|  openNativeTtsInstall,
8|  getNativeTtsStatus,
9|  type KoraVoice,
10|} from "./koraTts";
11|
12|export type TtsQualityPreset = "instant" | "balanced" | "studio";
13|export type TtsPlaybackMode = "narrator" | "speed";
14|export type TtsGenerationMode = "live" | "pregenerate";
15|
16|/** Voice shape shared by Web Speech + Android native TTS. */
17|export type TtsVoice = Pick<
18|  SpeechSynthesisVoice,
19|  "name" | "lang" | "voiceURI" | "localService" | "default"
20|> & { nativeIndex?: number };
21|
22|export interface TtsSettings {
23|  voiceName: string;
24|  voiceLang: string;
25|  rate: number;
26|  pitch: number;
27|  qualityPreset: TtsQualityPreset;
28|  playbackMode: TtsPlaybackMode;
29|  generationMode: TtsGenerationMode;
30|}
31|
32|export const TTS_VOICE_KEY = "kora_tts_voice";
33|export const TTS_VOICE_LANG_KEY = "kora_tts_voice_lang";
34|export const TTS_RATE_KEY = "kora_tts_rate";
35|export const TTS_PITCH_KEY = "kora_tts_pitch";
36|export const TTS_QUALITY_KEY = "kora_tts_quality";
37|export const TTS_MODE_KEY = "kora_tts_mode";
38|export const TTS_GENERATION_KEY = "kora_tts_generation";
39|
40|const DEFAULT_SETTINGS: TtsSettings = {
41|  voiceName: "",
42|  voiceLang: "",
43|  rate: 1,
44|  pitch: 1,
45|  qualityPreset: "balanced",
46|  playbackMode: "narrator",
47|  generationMode: "live",
48|};
49|
50|const PREFERRED_VOICE_NAMES = [
51|  "Samantha",
52|  "Daniel",
53|  "Karen",
54|  "Microsoft Aria Online",
55|  "Microsoft Jenny",
56|  "Microsoft Guy",
57|  "Microsoft Natural",
58|  "Google US English",
59|  "Google UK English Female",
60|  "en-us-x-sfg",
61|  "en-gb-x-rjs",
62|  "Natural",
63|];
64|
65|function asTtsVoice(voice: KoraVoice | SpeechSynthesisVoice): TtsVoice {
66|  return {
67|    name: voice.name,
68|    lang: voice.lang,
69|    voiceURI: voice.voiceURI || voice.name,
70|    localService: voice.localService,
71|    default: voice.default,
72|    nativeIndex: "nativeIndex" in voice ? voice.nativeIndex : undefined,
73|  };
74|}
75|
76|export function getTtsSettings(): TtsSettings {
77|  try {
78|    return {
79|      voiceName: localStorage.getItem(TTS_VOICE_KEY) || DEFAULT_SETTINGS.voiceName,
80|      voiceLang: localStorage.getItem(TTS_VOICE_LANG_KEY) || DEFAULT_SETTINGS.voiceLang,
81|      rate: parseFloat(localStorage.getItem(TTS_RATE_KEY) || "1") || 1,
82|      pitch: parseFloat(localStorage.getItem(TTS_PITCH_KEY) || "1") || 1,
83|      qualityPreset:
84|        (localStorage.getItem(TTS_QUALITY_KEY) as TtsQualityPreset) || DEFAULT_SETTINGS.qualityPreset,
85|      playbackMode:
86|        (localStorage.getItem(TTS_MODE_KEY) as TtsPlaybackMode) || DEFAULT_SETTINGS.playbackMode,
87|      generationMode:
88|        (localStorage.getItem(TTS_GENERATION_KEY) as TtsGenerationMode) ||
89|        DEFAULT_SETTINGS.generationMode,
90|    };
91|  } catch {
92|    return { ...DEFAULT_SETTINGS };
93|  }
94|}
95|
96|export function saveTtsSettings(patch: Partial<TtsSettings>) {
97|  const current = getTtsSettings();
98|  const next = { ...current, ...patch };
99|  try {
100|    if (patch.voiceName !== undefined) localStorage.setItem(TTS_VOICE_KEY, next.voiceName);
101|    if (patch.voiceLang !== undefined) localStorage.setItem(TTS_VOICE_LANG_KEY, next.voiceLang);
102|    if (patch.rate !== undefined) localStorage.setItem(TTS_RATE_KEY, String(next.rate));
103|    if (patch.pitch !== undefined) localStorage.setItem(TTS_PITCH_KEY, String(next.pitch));
104|    if (patch.qualityPreset !== undefined) localStorage.setItem(TTS_QUALITY_KEY, next.qualityPreset);
105|    if (patch.playbackMode !== undefined) localStorage.setItem(TTS_MODE_KEY, next.playbackMode);
106|    if (patch.generationMode !== undefined) {
107|      localStorage.setItem(TTS_GENERATION_KEY, next.generationMode);
108|    }
109|  } catch {
110|    // ignore storage failures
111|  }
112|  return next;
113|}
114|
115|export function getSpeechVoices(): TtsVoice[] {
116|  if (usesNativeTts()) {
117|    const cached = getCachedNativeVoices();
118|    if (cached.length) return cached.map(asTtsVoice);
119|  }
120|  if (typeof window === "undefined" || !window.speechSynthesis) return [];
121|  return window.speechSynthesis.getVoices().map(asTtsVoice);
122|}
123|
124|export function pickDefaultVoice(voices: TtsVoice[]): TtsVoice | null {
125|  if (!voices.length) return null;
126|
127|  for (const preferred of PREFERRED_VOICE_NAMES) {
128|    const match = voices.find(
129|      (voice) =>
130|        (voice.name.includes(preferred) || voice.voiceURI?.includes(preferred)) &&
131|        voice.lang.toLowerCase().startsWith("en")
132|    );
133|    if (match) return match;
134|  }
135|
136|  return (
137|    voices.find((v) => v.lang.toLowerCase().startsWith("en-us") && v.localService) ||
138|    voices.find((v) => v.lang.toLowerCase().startsWith("en") && v.localService) ||
139|    voices.find((v) => v.lang.toLowerCase().startsWith("en")) ||
140|    voices[0]
141|  );
142|}
143|
144|export function resolveSpeechVoice(voiceName?: string, voiceLang?: string): TtsVoice | null {
145|  const voices = getSpeechVoices();
146|  if (!voices.length) return null;
147|
148|  const settings = getTtsSettings();
149|  const targetName = voiceName ?? settings.voiceName;
150|  const targetLang = voiceLang ?? settings.voiceLang;
151|
152|  if (targetName) {
153|    const exact = voices.find(
154|      (v) =>
155|        v.name === targetName &&
156|        (!targetLang || v.lang === targetLang || v.lang.startsWith(`${targetLang}-`))
157|    );
158|    if (exact) return exact;
159|    const byName = voices.find((v) => v.name === targetName);
160|    if (byName) return byName;
161|  }
162|
163|  const langPool = targetLang
164|    ? voices.filter(
165|        (v) => v.lang === targetLang || v.lang.startsWith(`${targetLang.split("-")[0]}-`)
166|      )
167|    : voices;
168|
169|  if (targetLang && langPool.length) {
170|    const picked = pickDefaultVoice(langPool);
171|    if (picked) return picked;
172|  }
173|
174|  const picked = pickDefaultVoice(voices);
175|  if (picked && !settings.voiceName) {
176|    saveTtsSettings({ voiceName: picked.name, voiceLang: picked.lang });
177|  }
178|  return picked;
179|}
180|
181|export function getUniqueVoiceLanguages(
182|  voices: TtsVoice[]
183|): Array<{ code: string; label: string }> {
184|  const codes = new Set<string>();
185|  for (const voice of voices) {
186|    if (voice.lang) codes.add(voice.lang);
187|  }
188|  return Array.from(codes)
189|    .sort((a, b) => a.localeCompare(b))
190|    .map((code) => ({
191|      code,
192|      label: formatVoiceLanguageLabel(code),
193|    }));
194|}
195|
196|export function formatVoiceLanguageLabel(langCode: string): string {
197|  try {
198|    const [language, region] = langCode.split("-");
199|    const languageName =
200|      new Intl.DisplayNames(["en"], { type: "language" }).of(language) || language;
201|    if (!region) return `${languageName} (${langCode})`;
202|    const regionName = new Intl.DisplayNames(["en"], { type: "region" }).of(region) || region;
203|    return `${languageName} (${regionName})`;
204|  } catch {
205|    return langCode;
206|  }
207|}
208|
209|export function getVoicesForLanguage(voices: TtsVoice[], langCode: string): TtsVoice[] {
210|  if (!langCode) return voices;
211|  const base = langCode.split("-")[0];
212|  return voices
213|    .filter((v) => v.lang === langCode || v.lang.startsWith(`${base}-`))
214|    .sort((a, b) => a.name.localeCompare(b.name));
215|}
216|
217|export function formatVoiceOptionLabel(voice: TtsVoice): string {
218|  return voice.name
219|    .replace(/\s+Online\s+\(Natural\)/i, "")
220|    .replace(/Multilingual/i, " Multilingual")
221|    .trim();
222|}
223|
224|export function getEffectiveSpeechRate(baseRate = 1): number {
225|  const settings = getTtsSettings();
226|  const modeMultiplier = settings.playbackMode === "narrator" ? 0.92 : 1.08;
227|  const qualityMultiplier =
228|    settings.qualityPreset === "instant" ? 1.05 : settings.qualityPreset === "studio" ? 0.95 : 1;
229|  return Math.min(2, Math.max(0.5, baseRate * settings.rate * modeMultiplier * qualityMultiplier));
230|}
231|
232|export function getQualityPresetLabel(preset: TtsQualityPreset): string {
233|  switch (preset) {
234|    case "instant":
235|      return "Instant — live system voice";
236|    case "balanced":
237|      return "Balanced — prepared text + smoother flow";
238|    case "studio":
239|      return "Studio — pre-generate chapter audio locally";
240|  }
241|}
242|
243|export function groupVoicesByLanguage(voices: TtsVoice[]): Array<{
244|  language: string;
245|  voices: TtsVoice[];
246|}> {
247|  const groups = new Map<string, TtsVoice[]>();
248|  for (const voice of voices) {
249|    const lang = voice.lang || "unknown";
250|    const languageLabel = (() => {
251|      try {
252|        return new Intl.DisplayNames(["en"], { type: "language" }).of(lang.split("-")[0]) || lang;
253|      } catch {
254|        return lang;
255|      }
256|    })();
257|    const bucket = groups.get(languageLabel) || [];
258|    bucket.push(voice);
259|    groups.set(languageLabel, bucket);
260|  }
261|
262|  return Array.from(groups.entries())
263|    .sort(([a], [b]) => a.localeCompare(b))
264|    .map(([language, groupedVoices]) => ({
265|      language,
266|      voices: groupedVoices.sort((a, b) => a.name.localeCompare(b.name)),
267|    }));
268|}
269|
270|export function subscribeToVoicesChanged(callback: () => void): () => void {
271|  if (usesNativeTts()) {
272|    let cancelled = false;
273|    const emit = () => {
274|      if (!cancelled) callback();
275|    };
276|    void refreshNativeVoices().then(emit);
277|    const poll = window.setInterval(() => {
278|      void refreshNativeVoices().then((voices) => {
279|        emit();
280|        if (voices.length > 0) window.clearInterval(poll);
281|      });
282|    }, 400);
283|    const stopAt = window.setTimeout(() => window.clearInterval(poll), 8000);
284|    return () => {
285|      cancelled = true;
286|      window.clearInterval(poll);
287|      window.clearTimeout(stopAt);
288|    };
289|  }
290|
291|  if (typeof window === "undefined" || !window.speechSynthesis) return () => {};
292|
293|  const handler = () => callback();
294|  window.speechSynthesis.addEventListener("voiceschanged", handler);
295|  try {
296|    window.speechSynthesis.onvoiceschanged = handler;
297|  } catch {
298|    /* ignore */
299|  }
300|
301|  const prime = () => {
302|    try {
303|      void window.speechSynthesis.getVoices();
304|    } catch {
305|      /* ignore */
306|    }
307|    callback();
308|  };
309|  prime();
310|
311|  const started = Date.now();
312|  const poll = window.setInterval(() => {
313|    prime();
314|    if (getSpeechVoices().length > 0 || Date.now() - started > 5000) {
315|      window.clearInterval(poll);
316|    }
317|  }, 250);
318|
319|  return () => {
320|    window.clearInterval(poll);
321|    window.speechSynthesis.removeEventListener("voiceschanged", handler);
322|    try {
323|      if (window.speechSynthesis.onvoiceschanged === handler) {
324|        window.speechSynthesis.onvoiceschanged = null;
325|      }
326|    } catch {
327|      /* ignore */
328|    }
329|  };
330|}
331|
332|/** Call on a user gesture / Capacitor boot so Android WebView / native TTS loads voices. */
333|export function primeSpeechVoices(): TtsVoice[] {
334|  if (usesNativeTts()) {
335|    void refreshNativeVoices();
336|    return getSpeechVoices();
337|  }
338|  if (typeof window === "undefined" || !window.speechSynthesis) return [];
339|  try {
340|    const kick = new SpeechSynthesisUtterance("");
341|    kick.volume = 0;
342|    window.speechSynthesis.speak(kick);
343|    window.speechSynthesis.cancel();
344|  } catch {
345|    /* ignore */
346|  }
347|  return window.speechSynthesis.getVoices().map(asTtsVoice);
348|}
349|
350|export async function speakTestPhrase(phrase = "This is how your narrator will sound.") {
351|  const settings = getTtsSettings();
352|  if (usesNativeTts()) {
353|    await refreshNativeVoices();
354|  }
355|  const voice = resolveSpeechVoice(settings.voiceName, settings.voiceLang);
356|  await cancelSpeech();
357|  try {
358|    await speakTextNative(phrase, {
359|      rate: getEffectiveSpeechRate(1),
360|      pitch: settings.pitch,
361|      voiceName: voice?.name,
362|      voiceLang: voice?.lang || settings.voiceLang || "en-US",
363|      voiceIndex: voice?.nativeIndex,
364|    });
365|  } catch (err) {
366|    const hint = getNativeTtsStatus().error;
367|    throw new Error(hint || (err as Error).message || "Voice test failed.");
368|  }
369|}
370|
371|export function getTtsEngineHint(): string | null {
372|  if (!usesNativeTts()) return null;
373|  const status = getNativeTtsStatus();
374|  if (status.ready && getSpeechVoices().length > 0) return null;
375|  if (status.error) return status.error;
376|  if (!getSpeechVoices().length) {
377|    return "Loading Android system TTS voices…";
378|  }
379|  return null;
380|}
381|
382|export { openNativeTtsInstall, usesNativeTts, cancelSpeech };
383|
```


## Native (Android) + Web Speech TTS bridge

**`src/lib/koraTts.ts`** (lines 1-210)

```ts
1|/**
2| * Unified TTS bridge — Android uses native TextToSpeech via Capacitor;
3| * web/desktop keeps the Web Speech API.
4| */
5|
6|import { registerPlugin } from "@capacitor/core";
7|import { isNativeAndroid } from "./capacitorNative";
8|
9|export interface KoraVoice {
10|  name: string;
11|  lang: string;
12|  voiceURI: string;
13|  localService: boolean;
14|  default: boolean;
15|  /** Index into Android TextToSpeech.getVoices() list */
16|  nativeIndex?: number;
17|}
18|
19|interface NativeVoiceRow {
20|  name: string;
21|  lang: string;
22|  localService?: boolean;
23|  default?: boolean;
24|  index?: number;
25|  voiceURI?: string;
26|}
27|
28|interface KoraTtsPluginApi {
29|  ensureReady(): Promise<{ ready: boolean; engine?: string; error?: string }>;
30|  getVoices(): Promise<{
31|    voices: NativeVoiceRow[];
32|    ready?: boolean;
33|    engine?: string;
34|    error?: string;
35|  }>;
36|  speak(options: {
37|    text: string;
38|    lang?: string;
39|    rate?: number;
40|    pitch?: number;
41|    voiceIndex?: number;
42|    voiceName?: string;
43|  }): Promise<void>;
44|  stop(): Promise<void>;
45|  isSpeaking(): Promise<{ speaking: boolean }>;
46|  openInstall(): Promise<void>;
47|}
48|
49|const KoraTtsNative = registerPlugin<KoraTtsPluginApi>("KoraTts");
50|
51|let nativeVoiceCache: KoraVoice[] = [];
52|let nativeReady: boolean | null = null;
53|let nativeError: string | null = null;
54|let nativeEngine: string | null = null;
55|
56|export function usesNativeTts(): boolean {
57|  return isNativeAndroid();
58|}
59|
60|export function getNativeTtsStatus(): {
61|  ready: boolean | null;
62|  error: string | null;
63|  engine: string | null;
64|} {
65|  return { ready: nativeReady, error: nativeError, engine: nativeEngine };
66|}
67|
68|export function getCachedNativeVoices(): KoraVoice[] {
69|  return nativeVoiceCache.slice();
70|}
71|
72|function mapNativeVoices(rows: NativeVoiceRow[]): KoraVoice[] {
73|  return (rows || []).map((row, i) => ({
74|    name: row.name || `Voice ${i + 1}`,
75|    lang: row.lang || "und",
76|    voiceURI: row.voiceURI || row.name || `native-${i}`,
77|    localService: row.localService !== false,
78|    default: !!row.default,
79|    nativeIndex: typeof row.index === "number" ? row.index : i,
80|  }));
81|}
82|
83|/** Load / refresh Android system TTS voices into the JS cache. */
84|export async function refreshNativeVoices(): Promise<KoraVoice[]> {
85|  if (!usesNativeTts()) return [];
86|  try {
87|    const ready = await KoraTtsNative.ensureReady();
88|    nativeReady = !!ready.ready;
89|    nativeError = ready.error || null;
90|    nativeEngine = ready.engine || null;
91|
92|    const result = await KoraTtsNative.getVoices();
93|    nativeReady = result.ready ?? nativeReady;
94|    nativeError = result.error || nativeError;
95|    nativeEngine = result.engine || nativeEngine;
96|    nativeVoiceCache = mapNativeVoices(result.voices || []);
97|    return nativeVoiceCache.slice();
98|  } catch (err) {
99|    nativeReady = false;
100|    nativeError = (err as Error)?.message || "Native TTS unavailable";
101|    nativeVoiceCache = [];
102|    return [];
103|  }
104|}
105|
106|export async function openNativeTtsInstall(): Promise<void> {
107|  if (!usesNativeTts()) return;
108|  await KoraTtsNative.openInstall();
109|}
110|
111|export async function stopNativeSpeech(): Promise<void> {
112|  if (!usesNativeTts()) return;
113|  try {
114|    await KoraTtsNative.stop();
115|  } catch {
116|    /* ignore */
117|  }
118|}
119|
120|export async function isNativeSpeaking(): Promise<boolean> {
121|  if (!usesNativeTts()) return false;
122|  try {
123|    const { speaking } = await KoraTtsNative.isSpeaking();
124|    return !!speaking;
125|  } catch {
126|    return false;
127|  }
128|}
129|
130|export interface SpeakTextOptions {
131|  rate?: number;
132|  pitch?: number;
133|  voiceName?: string;
134|  voiceLang?: string;
135|  voiceIndex?: number;
136|  /** Abort if another speak starts (web only via cancel). */
137|  signal?: { aborted?: boolean };
138|}
139|
140|/**
141| * Speak text with the best available engine.
142| * Resolves when the utterance finishes (or is interrupted/stopped).
143| */
144|export async function speakText(text: string, opts: SpeakTextOptions = {}): Promise<void> {
145|  const trimmed = (text || "").trim();
146|  if (!trimmed) return;
147|
148|  if (usesNativeTts()) {
149|    if (!nativeVoiceCache.length) {
150|      await refreshNativeVoices();
151|    }
152|    let voiceIndex = opts.voiceIndex;
153|    if (voiceIndex == null && opts.voiceName) {
154|      const match = nativeVoiceCache.find((v) => v.name === opts.voiceName);
155|      if (match && typeof match.nativeIndex === "number") voiceIndex = match.nativeIndex;
156|    }
157|    try {
158|      await KoraTtsNative.speak({
159|        text: trimmed,
160|        lang: opts.voiceLang || "en-US",
161|        rate: opts.rate ?? 1,
162|        pitch: opts.pitch ?? 1,
163|        voiceIndex,
164|        voiceName: opts.voiceName,
165|      });
166|    } catch (err) {
167|      // Interrupted / stopped resolves as success for queue flow; real errors throw.
168|      const message = (err as Error)?.message || String(err);
169|      if (/interrupt|cancel|stop/i.test(message)) return;
170|      throw err instanceof Error ? err : new Error(message);
171|    }
172|    return;
173|  }
174|
175|  if (typeof window === "undefined" || !window.speechSynthesis) {
176|    throw new Error("Text-to-speech is not supported in this browser.");
177|  }
178|
179|  await new Promise<void>((resolve, reject) => {
180|    const utterance = new SpeechSynthesisUtterance(trimmed);
181|    utterance.rate = opts.rate ?? 1;
182|    utterance.pitch = opts.pitch ?? 1;
183|    if (opts.voiceLang) utterance.lang = opts.voiceLang;
184|
185|    if (opts.voiceName) {
186|      const voices = window.speechSynthesis.getVoices();
187|      const match =
188|        voices.find((v) => v.name === opts.voiceName) ||
189|        voices.find((v) => opts.voiceLang && v.lang === opts.voiceLang);
190|      if (match) utterance.voice = match;
191|    }
192|
193|    utterance.onend = () => resolve();
194|    utterance.onerror = (event) => {
195|      if (event.error === "interrupted" || event.error === "canceled") resolve();
196|      else reject(new Error(event.error || "Speech failed"));
197|    };
198|    window.speechSynthesis.speak(utterance);
199|  });
200|}
201|
202|export async function cancelSpeech(): Promise<void> {
203|  if (usesNativeTts()) {
204|    await stopNativeSpeech();
205|    return;
206|  }
207|  if (typeof window !== "undefined" && window.speechSynthesis) {
208|    window.speechSynthesis.cancel();
209|  }
210|}
211|
```


## Chunked TTS player w/ subtitles

**`src/lib/browserTtsPlayer.ts`** (lines 1-485)

```ts
1|import { SpeakChunk, buildSpeakChunks, estimateChunkDurationSeconds } from "./ttsTextPrep";
2|import {
3|  cancelSpeech,
4|  getEffectiveSpeechRate,
5|  getSpeechVoices,
6|  getTtsSettings,
7|  resolveSpeechVoice,
8|  TtsQualityPreset,
9|  TtsVoice,
10|  usesNativeTts,
11|} from "./ttsSettings";
12|import { refreshNativeVoices, speakText } from "./koraTts";
13|import { TtsPlaybackPosition } from "./ttsProgress";
14|import { getNeuralChapterCache } from "./neuralTtsCache";
15|
16|export interface BrowserTtsPlayerCallbacks {
17|  onTimeUpdate?: (currentTime: number, duration: number, estimatedRemaining: number) => void;
18|  onEnded?: () => void;
19|  onPlay?: () => void;
20|  onPause?: () => void;
21|  onError?: (message: string) => void;
22|  onPositionChange?: (position: TtsPlaybackPosition) => void;
23|  onSubtitleUpdate?: (text: string) => void;
24|}
25|
26|interface LoadedChapter {
27|  chunks: SpeakChunk[];
28|  chunkDurations: number[];
29|}
30|
31|function delay(ms: number): Promise<void> {
32|  return new Promise((resolve) => setTimeout(resolve, ms));
33|}
34|
35|function extractTranscriptWindow(text: string, charIndex: number, maxChars = 200): string {
36|  const normalized = text.replace(/\s+/g, " ").trim();
37|  if (!normalized) return "";
38|
39|  const safeIndex = Math.max(0, Math.min(charIndex, normalized.length));
40|
41|  // Prefer the full sentence being spoken.
42|  const sentences = normalized.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [normalized];
43|  let position = 0;
44|  for (const sentence of sentences) {
45|    const end = position + sentence.length;
46|    if (safeIndex >= position && safeIndex <= end) {
47|      return sentence.trim();
48|    }
49|    position = end;
50|  }
51|
52|  // Fall back to a word-aligned window around the current position.
53|  let start = safeIndex;
54|  while (start > 0 && normalized[start - 1] !== " ") start--;
55|  start = Math.max(0, start - 24);
56|
57|  let end = safeIndex;
58|  while (end < normalized.length && normalized[end] !== " ") end++;
59|  end = Math.min(normalized.length, Math.max(end + maxChars, safeIndex + 80));
60|
61|  const lastSpace = normalized.lastIndexOf(" ", end);
62|  if (lastSpace > safeIndex + 20) end = lastSpace;
63|
64|  const excerpt = normalized.slice(start, end).trim();
65|  const prefix = start > 0 ? "…" : "";
66|  const suffix = end < normalized.length ? "…" : "";
67|  return `${prefix}${excerpt}${suffix}`;
68|}
69|
70|export class BrowserTtsPlayer {
71|  private chunks: SpeakChunk[] = [];
72|  private chunkDurations: number[] = [];
73|  private chunkIndex = 0;
74|  private charOffset = 0;
75|  private boundaryTime = 0;
76|  private rate = 1;
77|  private pitch = 1;
78|  private playing = false;
79|  private paused = false;
80|  private tickTimer: ReturnType<typeof setInterval> | null = null;
81|  private callbacks: BrowserTtsPlayerCallbacks = {};
82|  private selectedVoice: TtsVoice | null = null;
83|  private wakeLock: WakeLockSentinel | null = null;
84|  private visibilityHandler: (() => void) | null = null;
85|  private bookId: string | null = null;
86|  private trackIndex: number | null = null;
87|  private quality: TtsQualityPreset = "balanced";
88|
89|  constructor(callbacks?: BrowserTtsPlayerCallbacks) {
90|    if (callbacks) this.callbacks = callbacks;
91|    this.refreshVoice();
92|    this.bindVisibilityHandler();
93|  }
94|
95|  get duration(): number {
96|    return this.chunkDurations.reduce((sum, value) => sum + value, 0);
97|  }
98|
99|  get currentTime(): number {
100|    const completed = this.chunkDurations
101|      .slice(0, this.chunkIndex)
102|      .reduce((sum, value) => sum + value, 0);
103|    return completed + Math.max(this.boundaryTime, this.estimateOffsetTime());
104|  }
105|
106|  get estimatedRemaining(): number {
107|    return Math.max(0, this.duration - this.currentTime);
108|  }
109|
110|  get voiceName(): string {
111|    return this.selectedVoice?.name || "System voice";
112|  }
113|
114|  get playbackPosition(): TtsPlaybackPosition {
115|    return {
116|      chunkIndex: this.chunkIndex,
117|      charOffset: this.charOffset,
118|      estimatedTime: this.currentTime,
119|    };
120|  }
121|
122|  setCallbacks(callbacks: BrowserTtsPlayerCallbacks) {
123|    this.callbacks = callbacks;
124|  }
125|
126|  refreshVoice() {
127|    const settings = getTtsSettings();
128|    this.selectedVoice = resolveSpeechVoice(settings.voiceName, settings.voiceLang);
129|    this.pitch = settings.pitch;
130|  }
131|
132|  setRate(rate: number) {
133|    this.rate = rate;
134|    this.rebuildDurations();
135|    // Don’t restart playback mid-utterance; the ongoing native chunk keeps going,
136|    // and the next chunk picks up the new rate/speed. This removes the audible lag.
137|  }
138|
139|  async loadText(
140|    text: string,
141|    resume?: TtsPlaybackPosition | number,
142|    opts?: { bookId?: string; trackIndex?: number; chapterTitle?: string; quality?: TtsQualityPreset }
143|  ) {
144|    this.stop(false);
145|    this.bookId = opts?.bookId ?? null;
146|    this.trackIndex = opts?.trackIndex ?? null;
147|    this.quality = opts?.quality || getTtsSettings().qualityPreset;
148|
149|    const loaded = await this.resolveChapterChunks(text, opts?.chapterTitle);
150|    this.chunks = loaded.chunks;
151|    this.chunkDurations = loaded.chunkDurations;
152|    this.chunkIndex = 0;
153|    this.charOffset = 0;
154|    this.boundaryTime = 0;
155|
156|    if (typeof resume === "number") {
157|      this.seek(resume);
158|    } else if (resume) {
159|      this.seekToPosition(resume);
160|    }
161|    this.emitSubtitle();
162|  }
163|
164|  seek(seconds: number) {
165|    const clamped = Math.max(0, Math.min(seconds, this.duration || 0));
166|    let remaining = clamped;
167|    let index = 0;
168|
169|    for (let i = 0; i < this.chunkDurations.length; i++) {
170|      if (remaining <= this.chunkDurations[i]) {
171|        index = i;
172|        break;
173|      }
174|      remaining -= this.chunkDurations[i];
175|      index = i + 1;
176|    }
177|
178|    this.chunkIndex = Math.min(index, Math.max(0, this.chunks.length - 1));
179|    this.boundaryTime = index < this.chunks.length ? remaining : 0;
180|    this.charOffset = this.estimateCharOffset(this.chunks[this.chunkIndex]?.text || "", remaining);
181|    this.emitTime();
182|    this.emitSubtitle();
183|  }
184|
185|  seekToPosition(position: TtsPlaybackPosition) {
186|    this.chunkIndex = Math.min(position.chunkIndex, Math.max(0, this.chunks.length - 1));
187|    this.charOffset = position.charOffset;
188|    this.boundaryTime = position.estimatedTime;
189|    this.emitTime();
190|  }
191|
192|  skip(deltaSeconds: number) {
193|    this.seek(this.currentTime + deltaSeconds);
194|    if (this.playing && !this.paused) {
195|      this.stop(false);
196|      void this.play();
197|    }
198|  }
199|
200|  async play() {
201|    if (!usesNativeTts() && (typeof window === "undefined" || !window.speechSynthesis)) {
202|      this.callbacks.onError?.("Text-to-speech is not supported in this browser.");
203|      return;
204|    }
205|    if (!this.chunks.length) {
206|      this.callbacks.onError?.("No speakable text found in this chapter.");
207|      return;
208|    }
209|
210|    await this.waitForVoices();
211|    this.refreshVoice();
212|
213|    if (this.paused && !usesNativeTts() && window.speechSynthesis?.paused) {
214|      window.speechSynthesis.resume();
215|      this.paused = false;
216|      this.playing = true;
217|      this.startTick();
218|      await this.requestWakeLock();
219|      this.callbacks.onPlay?.();
220|      return;
221|    }
222|
223|    this.playing = true;
224|    this.paused = false;
225|    this.callbacks.onPlay?.();
226|    this.startTick();
227|    await this.requestWakeLock();
228|    await this.speakFromIndex(this.chunkIndex);
229|  }
230|
231|  pause() {
232|    void cancelSpeech();
233|    if (!usesNativeTts() && typeof window !== "undefined" && window.speechSynthesis) {
234|      try {
235|        window.speechSynthesis.pause();
236|      } catch {
237|        /* ignore */
238|      }
239|    }
240|    this.paused = true;
241|    this.playing = false;
242|    this.stopTick();
243|    void this.releaseWakeLock();
244|    this.callbacks.onPause?.();
245|    this.emitPosition();
246|  }
247|
248|  stop(notify = true) {
249|    void cancelSpeech();
250|    this.playing = false;
251|    this.paused = false;
252|    this.stopTick();
253|    void this.releaseWakeLock();
254|    if (notify) this.callbacks.onPause?.();
255|  }
256|
257|  destroy() {
258|    this.stop(false);
259|    this.unbindVisibilityHandler();
260|    this.chunks = [];
261|    this.chunkDurations = [];
262|    this.chunkIndex = 0;
263|    this.charOffset = 0;
264|    this.boundaryTime = 0;
265|  }
266|
267|  private async resolveChapterChunks(text: string, chapterTitle?: string): Promise<LoadedChapter> {
268|    if (this.bookId != null && this.trackIndex != null) {
269|      const cached = await getNeuralChapterCache(this.bookId, this.trackIndex);
270|      if (cached?.status === "ready" && cached.chunks.length) {
271|        return {
272|          chunks: cached.chunks,
273|          chunkDurations: cached.chunks.map((chunk) => this.estimateChunkDuration(chunk)),
274|        };
275|      }
276|    }
277|
278|    const chunks = buildSpeakChunks(text, {
279|      chapterTitle,
280|      quality: this.quality,
281|      maxChars: this.quality === "instant" ? 180 : this.quality === "studio" ? 120 : 140,
282|    });
283|    if (!chunks.length) {
284|      throw new Error("No speakable text found in this chapter.");
285|    }
286|    return {
287|      chunks,
288|      chunkDurations: chunks.map((chunk) => this.estimateChunkDuration(chunk)),
289|    };
290|  }
291|
292|  private rebuildDurations() {
293|    this.chunkDurations = this.chunks.map((chunk) => this.estimateChunkDuration(chunk));
294|  }
295|
296|  private estimateChunkDuration(chunk: SpeakChunk): number {
297|    return estimateChunkDurationSeconds(chunk, getEffectiveSpeechRate(this.rate), this.pitch);
298|  }
299|
300|  private estimateOffsetTime(): number {
301|    const chunk = this.chunks[this.chunkIndex];
302|    if (!chunk) return 0;
303|    const ratio = chunk.text.length ? this.charOffset / chunk.text.length : 0;
304|    return (this.chunkDurations[this.chunkIndex] || 0) * ratio;
305|  }
306|
307|  private estimateCharOffset(text: string, secondsIntoChunk: number): number {
308|    const duration = this.chunkDurations[this.chunkIndex] || 1;
309|    const ratio = Math.max(0, Math.min(1, secondsIntoChunk / duration));
310|    return Math.floor(text.length * ratio);
311|  }
312|
313|  private bindVisibilityHandler() {
314|    if (typeof document === "undefined") return;
315|    this.visibilityHandler = () => {
316|      if (document.hidden && this.playing && !this.paused) {
317|        this.pause();
318|      }
319|    };
320|    document.addEventListener("visibilitychange", this.visibilityHandler);
321|  }
322|
323|  private unbindVisibilityHandler() {
324|    if (this.visibilityHandler) {
325|      document.removeEventListener("visibilitychange", this.visibilityHandler);
326|      this.visibilityHandler = null;
327|    }
328|  }
329|
330|  private async requestWakeLock() {
331|    try {
332|      if ("wakeLock" in navigator) {
333|        this.wakeLock = await navigator.wakeLock.request("screen");
334|      }
335|    } catch {
336|      // optional feature
337|    }
338|  }
339|
340|  private async releaseWakeLock() {
341|    try {
342|      await this.wakeLock?.release();
343|    } catch {
344|      // ignore
345|    }
346|    this.wakeLock = null;
347|  }
348|
349|  private startTick() {
350|    this.stopTick();
351|    this.tickTimer = setInterval(() => {
352|      this.emitTime();
353|      if (this.playing && !this.paused) this.emitSubtitle();
354|    }, 200);
355|  }
356|
357|  private stopTick() {
358|    if (this.tickTimer) {
359|      clearInterval(this.tickTimer);
360|      this.tickTimer = null;
361|    }
362|  }
363|
364|  private emitSubtitle(charIndex = this.charOffset): void {
365|    const chunk = this.chunks[this.chunkIndex];
366|    if (!chunk?.text) {
367|      this.callbacks.onSubtitleUpdate?.("");
368|      return;
369|    }
370|    const text = extractTranscriptWindow(chunk.text, charIndex);
371|    this.callbacks.onSubtitleUpdate?.(text);
372|  }
373|
374|  private emitTime() {
375|    this.callbacks.onTimeUpdate?.(this.currentTime, this.duration, this.estimatedRemaining);
376|    this.emitPosition();
377|  }
378|
379|  private emitPosition() {
380|    this.callbacks.onPositionChange?.(this.playbackPosition);
381|  }
382|
383|  private async waitForVoices(timeoutMs = 4000): Promise<void> {
384|    if (usesNativeTts()) {
385|      if (getSpeechVoices().length) return;
386|      await refreshNativeVoices();
387|      if (getSpeechVoices().length) return;
388|      const started = Date.now();
389|      while (Date.now() - started < timeoutMs) {
390|        await delay(200);
391|        await refreshNativeVoices();
392|        if (getSpeechVoices().length) return;
393|      }
394|      return;
395|    }
396|
397|    if (typeof window === "undefined" || !window.speechSynthesis) return;
398|    if (getSpeechVoices().length) return;
399|
400|    await new Promise<void>((resolve) => {
401|      const finish = () => resolve();
402|      const timer = window.setTimeout(finish, timeoutMs);
403|      const poll = window.setInterval(() => {
404|        try {
405|          void window.speechSynthesis.getVoices();
406|        } catch {
407|          /* ignore */
408|        }
409|        if (getSpeechVoices().length) {
410|          window.clearTimeout(timer);
411|          window.clearInterval(poll);
412|          window.speechSynthesis.removeEventListener("voiceschanged", handler);
413|          resolve();
414|        }
415|      }, 200);
416|      const handler = () => {
417|        if (getSpeechVoices().length) {
418|          window.clearTimeout(timer);
419|          window.clearInterval(poll);
420|          window.speechSynthesis.removeEventListener("voiceschanged", handler);
421|          resolve();
422|        }
423|      };
424|      window.speechSynthesis.addEventListener("voiceschanged", handler);
425|      try {
426|        void window.speechSynthesis.getVoices();
427|      } catch {
428|        /* ignore */
429|      }
430|    });
431|  }
432|
433|  private async speakFromIndex(index: number): Promise<void> {
434|    if (!this.playing || index >= this.chunks.length) {
435|      if (this.playing) {
436|        this.playing = false;
437|        this.stopTick();
438|        void this.releaseWakeLock();
439|        this.callbacks.onEnded?.();
440|      }
441|      return;
442|    }
443|
444|    const chunk = this.chunks[index];
445|    if (!chunk?.text) {
446|      await this.speakFromIndex(index + 1);
447|      return;
448|    }
449|
450|    const sliceStart = index === this.chunkIndex && this.charOffset > 0 ? this.charOffset : 0;
451|    const spokenText = chunk.text.slice(sliceStart);
452|    const settings = getTtsSettings();
453|    this.refreshVoice();
454|
455|    this.chunkIndex = index;
456|    this.charOffset = sliceStart;
457|    this.emitSubtitle(sliceStart);
458|    this.emitTime();
459|
460|    try {
461|      await speakText(spokenText, {
462|        rate: getEffectiveSpeechRate(this.rate) * chunk.rateMultiplier,
463|        pitch: settings.pitch * chunk.pitchMultiplier,
464|        voiceName: this.selectedVoice?.name,
465|        voiceLang: this.selectedVoice?.lang || settings.voiceLang || "en-US",
466|        voiceIndex: this.selectedVoice?.nativeIndex,
467|      });
468|    } catch (err) {
469|      if (this.playing) {
470|        console.warn("TTS chunk failed:", err, spokenText.slice(0, 80));
471|      }
472|    }
473|
474|    if (!this.playing) return;
475|
476|    this.chunkIndex = index + 1;
477|    this.charOffset = 0;
478|    this.boundaryTime = 0;
479|    this.emitTime();
480|    if (chunk.pauseAfterMs > 0) await delay(chunk.pauseAfterMs);
481|    if (this.playing) {
482|      await this.speakFromIndex(index + 1);
483|    }
484|  }
485|}
486|
```


## Reader settings UI

**`src/components/NewsReaderSettingsPanel.tsx`** (lines 1-155)

```tsx
1|import React from "react";
2|import {
3|  NEWS_READER_FONT_OPTIONS,
4|  NEWS_READER_MARGIN_OPTIONS,
5|  NEWS_READER_THEME_OPTIONS,
6|  newsReaderThemeClasses,
7|  type NewsReaderPrefs,
8|} from "../lib/newsReaderPrefs";
9|
10|interface NewsReaderSettingsPanelProps {
11|  prefs: NewsReaderPrefs;
12|  onChange: (patch: Partial<NewsReaderPrefs>) => void;
13|  className?: string;
14|}
15|
16|export default function NewsReaderSettingsPanel({
17|  prefs,
18|  onChange,
19|  className = "",
20|}: NewsReaderSettingsPanelProps) {
21|  const theme = newsReaderThemeClasses(prefs.theme);
22|
23|  return (
24|    <div
25|      className={`border-t ${theme.border} ${theme.header} px-4 py-4 space-y-4 max-h-[45vh] overflow-y-auto shrink-0 ${className}`}
26|    >
27|      <p className={`text-[10px] ${theme.muted}`}>
28|        Applies to Feed articles and the Daily News Brief. Saved on this device.
29|      </p>
30|
31|      <div className="space-y-2">
32|        <div className="flex items-center justify-between">
33|          <h4 className="text-xs font-bold">Font Size</h4>
34|          <span className={`text-[10px] font-mono ${theme.muted}`}>{prefs.fontSize}px</span>
35|        </div>
36|        <input
37|          type="range"
38|          min={12}
39|          max={36}
40|          step={1}
41|          value={prefs.fontSize}
42|          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
43|          className="w-full accent-kindle-accent cursor-pointer"
44|        />
45|      </div>
46|
47|      <div className="space-y-2">
48|        <div className="flex items-center justify-between">
49|          <h4 className="text-xs font-bold">Line Spacing</h4>
50|          <span className={`text-[10px] font-mono ${theme.muted}`}>{prefs.lineSpacing.toFixed(1)}</span>
51|        </div>
52|        <input
53|          type="range"
54|          min={1.2}
55|          max={2.6}
56|          step={0.1}
57|          value={prefs.lineSpacing}
58|          onChange={(e) => onChange({ lineSpacing: Number(e.target.value) })}
59|          className="w-full accent-kindle-accent cursor-pointer"
60|        />
61|      </div>
62|
63|      <div className="space-y-2">
64|        <div className="flex items-center justify-between">
65|          <h4 className="text-xs font-bold">Paragraph Spacing</h4>
66|          <span className={`text-[10px] font-mono ${theme.muted}`}>{prefs.paragraphSpacing.toFixed(1)}em</span>
67|        </div>
68|        <input
69|          type="range"
70|          min={0.6}
71|          max={2.2}
72|          step={0.1}
73|          value={prefs.paragraphSpacing}
74|          onChange={(e) => onChange({ paragraphSpacing: Number(e.target.value) })}
75|          className="w-full accent-kindle-accent cursor-pointer"
76|        />
77|      </div>
78|
79|      <div className="space-y-2">
80|        <h4 className={`text-[9px] uppercase tracking-widest font-bold ${theme.muted}`}>Font Family</h4>
81|        <div className="flex flex-wrap gap-2">
82|          {NEWS_READER_FONT_OPTIONS.map((f) => (
83|            <button
84|              key={f.id}
85|              type="button"
86|              onClick={() => onChange({ fontFamily: f.id })}
87|              className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition ${
88|                prefs.fontFamily === f.id
89|                  ? "bg-kindle-text text-kindle-bg border-kindle-text"
90|                  : `${theme.border} ${theme.muted}`
91|              }`}
92|            >
93|              <span className={f.id}>{f.label}</span>
94|            </button>
95|          ))}
96|        </div>
97|      </div>
98|
99|      <div className="space-y-2">
100|        <h4 className={`text-[9px] uppercase tracking-widest font-bold ${theme.muted}`}>Page Width</h4>
101|        <div className="flex flex-wrap gap-2">
102|          {NEWS_READER_MARGIN_OPTIONS.map((m) => (
103|            <button
104|              key={m.id}
105|              type="button"
106|              onClick={() => onChange({ marginSize: m.id })}
107|              className={`px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition ${
108|                prefs.marginSize === m.id
109|                  ? "bg-kindle-text text-kindle-bg border-kindle-text"
110|                  : `${theme.border} ${theme.muted}`
111|              }`}
112|            >
113|              {m.label}
114|            </button>
115|          ))}
116|        </div>
117|      </div>
118|
119|      <div className="space-y-2">
120|        <h4 className={`text-[9px] uppercase tracking-widest font-bold ${theme.muted}`}>Theme</h4>
121|        <div className="grid grid-cols-4 gap-2">
122|          {NEWS_READER_THEME_OPTIONS.map((t) => (
123|            <button
124|              key={t.id}
125|              type="button"
126|              onClick={() => onChange({ theme: t.id })}
127|              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition ${
128|                prefs.theme === t.id ? "border-kindle-accent ring-1 ring-kindle-accent/30" : theme.border
129|              }`}
130|            >
131|              <div className={`w-6 h-6 rounded-md ${t.bg} ring-1 ${t.ring}`} />
132|              <span className="text-[8px] font-bold uppercase tracking-widest">{t.label}</span>
133|            </button>
134|          ))}
135|        </div>
136|      </div>
137|
138|      <div className="space-y-2">
139|        <div className="flex items-center justify-between">
140|          <h4 className="text-xs font-bold">Brightness</h4>
141|          <span className={`text-[10px] font-mono ${theme.muted}`}>{prefs.brightness}%</span>
142|        </div>
143|        <input
144|          type="range"
145|          min={40}
146|          max={100}
147|          step={5}
148|          value={prefs.brightness}
149|          onChange={(e) => onChange({ brightness: Number(e.target.value) })}
150|          className="w-full accent-kindle-accent cursor-pointer"
151|        />
152|      </div>
153|    </div>
154|  );
155|}
156|
```


## News-in-Brief card grid

**`src/components/NewsInBriefPanel.tsx`** (lines 1-168)

```tsx
1|import React, { useEffect, useMemo, useState } from "react";
2|import { BookOpen, ExternalLink } from "lucide-react";
3|import { FeedItem } from "../lib/feedStorage";
4|import {
5|  BriefFeedItem,
6|  briefsForPeriod,
7|  buildBriefDateChips,
8|  toBriefFeedItems,
9|} from "../lib/feedBriefs";
10|import { getItemThumbnail } from "../lib/feedPreview";
11|import { textDirection } from "../lib/textDirection";
12|
13|interface NewsInBriefPanelProps {
14|  items: FeedItem[];
15|  selectedSourceId?: string | null;
16|  onRead: (item: FeedItem) => void;
17|}
18|
19|function BriefCard({
20|  item,
21|  onRead,
22|}: {
23|  item: BriefFeedItem;
24|  onRead: () => void;
25|}) {
26|  const cover = getItemThumbnail(item);
27|  const title = item.title.trim();
28|  const dir = textDirection(title);
29|
30|  return (
31|    <article className="bg-kindle-card border border-kindle-border rounded-2xl overflow-hidden flex flex-col h-full">
32|      {cover ? (
33|        <div className="w-full aspect-[16/9] bg-kindle-bg overflow-hidden">
34|          <img src={cover} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
35|        </div>
36|      ) : null}
37|      <div className="p-4 flex flex-col gap-3 flex-1">
38|        <div className="space-y-1">
39|          <p className="text-[9px] font-bold uppercase tracking-widest text-kindle-text-muted">
40|            {item.subscriptionTitle}
41|          </p>
42|          <h3 className="text-sm font-lexend font-bold text-kindle-text leading-snug" dir={dir}>
43|            {title}
44|          </h3>
45|          {item.summary ? (
46|            <p className="text-xs text-kindle-text-muted leading-relaxed line-clamp-3" dir={textDirection(item.summary)}>
47|              {item.summary}
48|            </p>
49|          ) : null}
50|        </div>
51|        <div className="mt-auto flex gap-2">
52|          <button
53|            type="button"
54|            onClick={onRead}
55|            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-kindle-text text-kindle-bg text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition"
56|          >
57|            <BookOpen className="w-3.5 h-3.5" />
58|            Read
59|          </button>
60|          <a
61|            href={item.link}
62|            target="_blank"
63|            rel="noopener noreferrer"
64|            className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl border border-kindle-border text-kindle-text-muted hover:text-kindle-text transition"
65|            title="Open in browser"
66|          >
67|            <ExternalLink className="w-3.5 h-3.5" />
68|          </a>
69|        </div>
70|      </div>
71|    </article>
72|  );
73|}
74|
75|export default function NewsInBriefPanel({ items, selectedSourceId, onRead }: NewsInBriefPanelProps) {
76|  const briefs = useMemo(() => {
77|    const filtered = selectedSourceId
78|      ? items.filter((item) => item.subscriptionId === selectedSourceId)
79|      : items;
80|    return toBriefFeedItems(filtered);
81|  }, [items, selectedSourceId]);
82|
83|  const dateChips = useMemo(() => buildBriefDateChips(briefs), [briefs]);
84|  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null);
85|
86|  useEffect(() => {
87|    if (!dateChips.length) {
88|      setSelectedPeriodKey(null);
89|      return;
90|    }
91|    if (!selectedPeriodKey || !dateChips.some((chip) => chip.key === selectedPeriodKey)) {
92|      setSelectedPeriodKey(dateChips[0].key);
93|    }
94|  }, [dateChips, selectedPeriodKey]);
95|
96|  const selectedBriefs = useMemo(
97|    () => (selectedPeriodKey ? briefsForPeriod(briefs, selectedPeriodKey) : []),
98|    [briefs, selectedPeriodKey]
99|  );
100|
101|  if (!briefs.length) {
102|    return (
103|      <div className="bg-kindle-card border border-kindle-border rounded-2xl p-10 text-center">
104|        <h3 className="text-lg font-lexend font-bold mb-2">No briefs yet</h3>
105|        <p className="text-sm text-kindle-text-muted max-w-md mx-auto">
106|          News-in-brief roundups from your subscribed sources will appear here after the next feed refresh.
107|        </p>
108|      </div>
109|    );
110|  }
111|
112|  return (
113|    <div className="space-y-5">
114|      <div>
115|        <h2 className="text-sm font-lexend font-bold text-kindle-text mb-1">News in Brief</h2>
116|        <p className="text-[10px] text-kindle-text-muted uppercase tracking-wider font-mono">
117|          Daily roundups from all your sources
118|        </p>
119|      </div>
120|
121|      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
122|        {dateChips.map((chip) => {
123|          const selected = chip.key === selectedPeriodKey;
124|          const hasBriefs = briefs.some((brief) => brief.briefPeriod.key === chip.key);
125|          return (
126|            <button
127|              key={chip.key}
128|              type="button"
129|              onClick={() => setSelectedPeriodKey(chip.key)}
130|              className={`relative shrink-0 w-[4.5rem] h-[4.75rem] rounded-xl border flex flex-col items-center justify-center transition ${
131|                selected
132|                  ? "border-kindle-text bg-kindle-text text-kindle-bg shadow-sm"
133|                  : "border-kindle-border bg-kindle-card text-kindle-text hover:border-kindle-text/50"
134|              }`}
135|            >
136|              {hasBriefs && !selected ? (
137|                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-kindle-text/45" />
138|              ) : null}
139|              {selected ? (
140|                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-kindle-bg/80" />
141|              ) : null}
142|              <span className="text-2xl font-lexend font-bold leading-none">{chip.dayLabel}</span>
143|              <span
144|                className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${
145|                  selected ? "text-kindle-bg/70" : "text-kindle-text-muted"
146|                }`}
147|              >
148|                {chip.monthLabel}
149|              </span>
150|            </button>
151|          );
152|        })}
153|      </div>
154|
155|      {selectedBriefs.length === 0 ? (
156|        <div className="bg-kindle-card border border-dashed border-kindle-border rounded-2xl p-8 text-center text-sm text-kindle-text-muted">
157|          No briefs for this date.
158|        </div>
159|      ) : (
160|        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
161|          {selectedBriefs.map((item) => (
162|            <BriefCard key={item.id} item={item} onRead={() => onRead(item)} />
163|          ))}
164|        </div>
165|      )}
166|    </div>
167|  );
168|}
169|
```


## Today's News Brief card + overlay reader

**`src/components/TodayNewsBriefCard.tsx`** (lines 1-258)

```tsx
1|import React, { useEffect, useMemo, useState } from "react";
2|import { createPortal } from "react-dom";
3|import { ChevronLeft, ExternalLink, Newspaper, Settings2, Zap } from "lucide-react";
4|import type { FeedItem } from "../lib/feedStorage";
5|import { collectTodayBriefArticles, buildTodayDailyBrief } from "../lib/dailyNewsBriefClient";
6|import { useAndroidBackLayer } from "../hooks/useAndroidBackLayer";
7|import { useNewsReaderPrefs } from "../hooks/useNewsReaderPrefs";
8|import { newsReaderThemeClasses } from "../lib/newsReaderPrefs";
9|import NewsReaderSettingsPanel from "./NewsReaderSettingsPanel";
10|
11|interface TodayNewsBriefCardProps {
12|  items: FeedItem[];
13|  onReadArticle: (item: FeedItem) => void;
14|  onOpenTikTokBrief?: () => void;
15|}
16|
17|export default function TodayNewsBriefCard({ items, onReadArticle, onOpenTikTokBrief }: TodayNewsBriefCardProps) {
18|  const articles = useMemo(() => collectTodayBriefArticles(items), [items]);
19|  const brief = useMemo(() => buildTodayDailyBrief(articles), [articles]);
20|  const [open, setOpen] = useState(false);
21|  const [showSettings, setShowSettings] = useState(false);
22|  const [chromeVisible, setChromeVisible] = useState(true);
23|  const { prefs, updatePrefs } = useNewsReaderPrefs();
24|  const theme = useMemo(() => newsReaderThemeClasses(prefs.theme), [prefs.theme]);
25|
26|  const dismiss = useAndroidBackLayer(open, "today-news-brief", () => {
27|    setShowSettings(false);
28|    setOpen(false);
29|  });
30|
31|  useEffect(() => {
32|    if (!open) return;
33|    const prev = document.body.style.overflow;
34|    document.body.style.overflow = "hidden";
35|    return () => {
36|      document.body.style.overflow = prev;
37|    };
38|  }, [open]);
39|
40|  useEffect(() => {
41|    if (!open) setShowSettings(false);
42|  }, [open]);
43|
44|  if (!brief) return null;
45|
46|  const storyCount = brief.sections.reduce((total, section) => total + section.items.length, 0);
47|
48|  const openStory = (storyId: string, link: string) => {
49|    dismiss();
50|    const article = items.find((item) => item.id === storyId);
51|    if (article) {
52|      onReadArticle(article);
53|      return;
54|    }
55|    window.open(link, "_blank", "noopener,noreferrer");
56|  };
57|
58|  const textStyle: React.CSSProperties = {
59|    fontSize: `${prefs.fontSize}px`,
60|    lineHeight: prefs.lineSpacing,
61|  };
62|  const metaStyle: React.CSSProperties = {
63|    fontSize: `${Math.max(11, Math.round(prefs.fontSize * 0.72))}px`,
64|    lineHeight: prefs.lineSpacing,
65|  };
66|  const detailStyle: React.CSSProperties = {
67|    fontSize: `${Math.max(12, Math.round(prefs.fontSize * 0.85))}px`,
68|    lineHeight: prefs.lineSpacing,
69|    marginTop: `${prefs.paragraphSpacing * 0.35}em`,
70|  };
71|
72|  const overlay =
73|    open && typeof document !== "undefined"
74|      ? createPortal(
75|          <div
76|            className={`fixed inset-0 z-[9999] flex flex-col ${theme.shell} sm:bg-black/60 sm:items-center sm:justify-center sm:p-4 animate-in fade-in duration-200`}
77|            style={{
78|              width: "100vw",
79|              height: "100dvh",
80|              maxHeight: "100dvh",
81|              filter: prefs.brightness < 100 ? `brightness(${prefs.brightness}%)` : undefined,
82|            }}
83|            role="presentation"
84|          >
85|            <button
86|              type="button"
87|              aria-label="Close brief"
88|              className="hidden sm:block absolute inset-0 cursor-pointer"
89|              onClick={() => dismiss()}
90|            />
91|
92|            <div
93|              role="dialog"
94|              aria-modal="true"
95|              aria-label="Today's News Brief"
96|              className={`relative flex flex-col w-full h-full min-h-0 overflow-hidden ${theme.shell} sm:h-auto sm:max-h-[88vh] sm:max-w-2xl sm:rounded-2xl sm:border ${theme.border} sm:shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200`}
97|              onClick={(e) => e.stopPropagation()}
98|            >
99|              {/* Floating chrome — no fixed top bar */}
100|              <div
101|                className={`absolute z-20 left-0 right-0 top-0 flex items-start justify-between gap-2 px-[max(0.5rem,var(--kora-safe-left))] pt-[max(0.5rem,var(--kora-safe-top))] pr-[max(0.5rem,var(--kora-safe-right))] pointer-events-none transition-opacity ${
102|                  chromeVisible || showSettings ? "opacity-100" : "opacity-0"
103|                }`}
104|              >
105|                <button
106|                  type="button"
107|                  onClick={() => dismiss()}
108|                  className={`pointer-events-auto p-2.5 rounded-full ${theme.header} border ${theme.border} shadow-lg backdrop-blur-md`}
109|                  aria-label="Back"
110|                >
111|                  <ChevronLeft className="w-5 h-5" />
112|                </button>
113|                <button
114|                  type="button"
115|                  onClick={() => setShowSettings((v) => !v)}
116|                  className={`pointer-events-auto p-2.5 rounded-full ${theme.header} border ${theme.border} shadow-lg backdrop-blur-md`}
117|                  aria-label="Brief reader settings"
118|                  aria-pressed={showSettings}
119|                >
120|                  <Settings2 className="w-4 h-4" />
121|                </button>
122|              </div>
123|
124|              <div
125|                className={`flex-1 overflow-y-auto overscroll-contain pt-[calc(var(--kora-safe-top)+3.25rem)] pb-[calc(var(--kora-safe-bottom)+1.5rem)] min-h-0 ${prefs.marginSize}`}
126|                onClick={() => {
127|                  if (showSettings) {
128|                    setShowSettings(false);
129|                    return;
130|                  }
131|                  setChromeVisible((v) => !v);
132|                }}
133|              >
134|                <div
135|                  className={`space-y-5 ${prefs.fontFamily} ${theme.content}`}
136|                  onClick={(e) => {
137|                    if (showSettings) {
138|                      setShowSettings(false);
139|                      e.stopPropagation();
140|                    } else {
141|                      e.stopPropagation();
142|                    }
143|                  }}
144|                >
145|                  <div className="space-y-1">
146|                    <p className={`text-[9px] font-bold uppercase tracking-widest ${theme.muted}`}>
147|                      Daily News Brief
148|                    </p>
149|                    <h2
150|                      className="font-lexend font-bold"
151|                      style={{ fontSize: `${Math.round(prefs.fontSize * 1.25)}px`, lineHeight: 1.25 }}
152|                    >
153|                      Today&apos;s News Brief
154|                    </h2>
155|                    <p className={`font-mono ${theme.muted}`} style={metaStyle}>
156|                      {storyCount} stories · {brief.sections.length} sources
157|                    </p>
158|                  </div>
159|
160|                  <p className={theme.content} style={textStyle}>
161|                    {brief.lead}
162|                  </p>
163|
164|                  {brief.sections.map((section) => (
165|                    <section
166|                      key={section.source}
167|                      className="space-y-2"
168|                      style={{ marginTop: `${prefs.paragraphSpacing * 0.6}em` }}
169|                    >
170|                      <div className="flex items-baseline justify-between gap-2">
171|                        <h3 className={`text-[10px] font-bold uppercase tracking-widest ${theme.muted}`}>
172|                          {section.source}
173|                        </h3>
174|                        <span className={`font-mono shrink-0 ${theme.muted}`} style={metaStyle}>
175|                          {section.items.length} stor{section.items.length === 1 ? "y" : "ies"}
176|                        </span>
177|                      </div>
178|                      {section.intro ? (
179|                        <p className={theme.muted} style={detailStyle}>
180|                          {section.intro}
181|                        </p>
182|                      ) : null}
183|
184|                      <ul className="space-y-2.5">
185|                        {section.items.map((story) => (
186|                          <li
187|                            key={story.id}
188|                            className={`rounded-xl border ${theme.border} ${theme.header} p-3`}
189|                          >
190|                            <div className="flex items-start justify-between gap-2">
191|                              <div className="min-w-0">
192|                                <p className="font-lexend font-bold leading-snug" style={textStyle}>
193|                                  {story.headline}
194|                                </p>
195|                                <p className={theme.muted} style={detailStyle}>
196|                                  {story.detail}
197|                                </p>
198|                              </div>
199|                              <button
200|                                type="button"
201|                                onClick={() => openStory(story.id, story.link)}
202|                                className={`shrink-0 p-1.5 rounded-lg border ${theme.border} ${theme.muted} hover:opacity-90 transition`}
203|                                title="Read full article"
204|                              >
205|                                <ExternalLink className="w-3.5 h-3.5" />
206|                              </button>
207|                            </div>
208|                          </li>
209|                        ))}
210|                      </ul>
211|                    </section>
212|                  ))}
213|                </div>
214|              </div>
215|              {showSettings ? <NewsReaderSettingsPanel prefs={prefs} onChange={updatePrefs} /> : null}
216|            </div>
217|          </div>,
218|          document.body
219|        )
220|      : null;
221|
222|  return (
223|    <>
224|      <button
225|        type="button"
226|        onClick={() => setOpen(true)}
227|        className="w-full text-left bg-kindle-card border border-kindle-border rounded-2xl p-4 hover:border-kindle-text/35 transition group/card relative"
228|      >
229|        <div className="flex items-center justify-between gap-2 mb-1">
230|          <div className="flex items-center gap-1.5">
231|            <Newspaper className="w-3.5 h-3.5 text-kindle-text-muted shrink-0" />
232|            <p className="text-[9px] font-bold uppercase tracking-widest text-kindle-text-muted">
233|              Daily News Brief
234|            </p>
235|          </div>
236|          {onOpenTikTokBrief && (
237|            <div
238|              onClick={(e) => {
239|                e.stopPropagation();
240|                onOpenTikTokBrief();
241|              }}
242|              className="flex items-center gap-1 px-3 py-1 rounded-full bg-kindle-accent text-white dark:bg-amber-400 dark:text-neutral-900 text-[9px] font-bold uppercase tracking-wider shadow-sm hover:brightness-110 transition cursor-pointer"
243|            >
244|              <Zap className="w-2.5 h-2.5 fill-current animate-pulse text-white dark:text-neutral-900" />
245|              <span>Brief View</span>
246|            </div>
247|          )}
248|        </div>
249|        <h3 className="text-sm font-lexend font-bold text-kindle-text mb-2">Today&apos;s News Brief</h3>
250|        <p className="text-xs text-kindle-text-muted leading-relaxed line-clamp-2">{brief.lead}</p>
251|        <p className="text-[10px] text-kindle-text-muted/80 mt-2 font-mono">
252|          {storyCount} stories · {brief.sections.length} sources · Tap for full brief
253|        </p>
254|      </button>
255|      {overlay}
256|    </>
257|  );
258|}
259|
```


## Voice/language settings UI

**`src/components/TtsVoiceSettings.tsx`** (lines 1-272)

```tsx
1|import React, { useEffect, useMemo, useState } from "react";
2|import { Volume2 } from "lucide-react";
3|import {
4|  formatVoiceOptionLabel,
5|  getQualityPresetLabel,
6|  getSpeechVoices,
7|  getTtsEngineHint,
8|  getTtsSettings,
9|  getUniqueVoiceLanguages,
10|  getVoicesForLanguage,
11|  openNativeTtsInstall,
12|  saveTtsSettings,
13|  speakTestPhrase,
14|  subscribeToVoicesChanged,
15|  TtsGenerationMode,
16|  TtsPlaybackMode,
17|  TtsQualityPreset,
18|  usesNativeTts,
19|} from "../lib/ttsSettings";
20|
21|interface TtsVoiceSettingsProps {
22|  compact?: boolean;
23|  showQualityPresets?: boolean;
24|  showGenerationMode?: boolean;
25|  showTestButton?: boolean;
26|  onSettingsChange?: () => void;
27|}
28|
29|export default function TtsVoiceSettings({
30|  compact = false,
31|  showQualityPresets = true,
32|  showGenerationMode = false,
33|  showTestButton = true,
34|  onSettingsChange,
35|}: TtsVoiceSettingsProps) {
36|  const [settings, setSettings] = useState(getTtsSettings());
37|  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
38|  const [testing, setTesting] = useState(false);
39|  const [testError, setTestError] = useState<string | null>(null);
40|  const [engineHint, setEngineHint] = useState<string | null>(null);
41|
42|  useEffect(() => {
43|    return subscribeToVoicesChanged(() => {
44|      setVoices(getSpeechVoices());
45|      setEngineHint(getTtsEngineHint());
46|    });
47|  }, []);
48|
49|  const languageOptions = useMemo(() => getUniqueVoiceLanguages(voices), [voices]);
50|  const voicesForLanguage = useMemo(
51|    () => getVoicesForLanguage(voices, settings.voiceLang),
52|    [voices, settings.voiceLang]
53|  );
54|
55|  useEffect(() => {
56|    if (!voices.length) return;
57|    if (!settings.voiceLang && languageOptions.length) {
58|      const nextLang = languageOptions.find((opt) => opt.code.startsWith("en"))?.code || languageOptions[0].code;
59|      const next = saveTtsSettings({ voiceLang: nextLang });
60|      setSettings(next);
61|      return;
62|    }
63|    if (
64|      settings.voiceName &&
65|      !voicesForLanguage.some((voice) => voice.name === settings.voiceName)
66|    ) {
67|      const fallback = voicesForLanguage[0];
68|      const next = saveTtsSettings({
69|        voiceName: fallback?.name || "",
70|        voiceLang: fallback?.lang || settings.voiceLang,
71|      });
72|      setSettings(next);
73|    }
74|  }, [languageOptions, settings.voiceLang, settings.voiceName, voices.length, voicesForLanguage]);
75|
76|  const update = (patch: Partial<typeof settings>) => {
77|    const next = saveTtsSettings(patch);
78|    setSettings(next);
79|    onSettingsChange?.();
80|  };
81|
82|  const handleLanguageChange = (langCode: string) => {
83|    const pool = getVoicesForLanguage(voices, langCode);
84|    const keepCurrent = pool.find((voice) => voice.name === settings.voiceName);
85|    update({
86|      voiceLang: langCode,
87|      voiceName: keepCurrent?.name || pool[0]?.name || "",
88|    });
89|  };
90|
91|  const handleTest = async () => {
92|    setTesting(true);
93|    setTestError(null);
94|    try {
95|      await speakTestPhrase();
96|    } catch (err) {
97|      setTestError((err as Error).message);
98|    } finally {
99|      setTesting(false);
100|    }
101|  };
102|
103|  return (
104|    <div className={`space-y-4 ${compact ? "" : "rounded-xl border border-kindle-border bg-kindle-bg/60 p-4"}`}>
105|      <div className="space-y-2">
106|        <label className="text-[10px] font-bold uppercase tracking-wider text-kindle-text-muted flex items-center gap-1">
107|          <Volume2 className="w-3.5 h-3.5" />
108|          Narrator Voice
109|        </label>
110|
111|        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
112|          <div className="space-y-1">
113|            <label className="text-[8px] font-bold uppercase tracking-wider text-kindle-text-muted/80">Language</label>
114|            <select
115|              value={settings.voiceLang}
116|              onChange={(e) => handleLanguageChange(e.target.value)}
117|              className="w-full text-[11px] bg-kindle-card border border-kindle-border rounded-lg px-3 py-2 text-kindle-text focus:outline-none focus:border-kindle-accent"
118|            >
119|              {languageOptions.map((option) => (
120|                <option key={option.code} value={option.code}>
121|                  {option.label}
122|                </option>
123|              ))}
124|            </select>
125|          </div>
126|
127|          <div className="space-y-1">
128|            <label className="text-[8px] font-bold uppercase tracking-wider text-kindle-text-muted/80">Voice</label>
129|            <select
130|              value={settings.voiceName}
131|              onChange={(e) => {
132|                const selected = voicesForLanguage.find((voice) => voice.name === e.target.value);
133|                update({
134|                  voiceName: e.target.value,
135|                  voiceLang: selected?.lang || settings.voiceLang,
136|                });
137|              }}
138|              className="w-full text-[11px] bg-kindle-card border border-kindle-border rounded-lg px-3 py-2 text-kindle-text focus:outline-none focus:border-kindle-accent"
139|            >
140|              {voicesForLanguage.length === 0 ? (
141|                <option value="">
142|                  {voices.length === 0
143|                    ? usesNativeTts()
144|                      ? "Loading Android system voices…"
145|                      : "Loading voices…"
146|                    : "No voices for this language"}
147|                </option>
148|              ) : (
149|                voicesForLanguage.map((voice) => (
150|                  <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
151|                    {formatVoiceOptionLabel(voice)}
152|                  </option>
153|                ))
154|              )}
155|            </select>
156|          </div>
157|        </div>
158|        {engineHint || (usesNativeTts() && voices.length === 0) ? (
159|          <div className="space-y-1 mt-1">
160|            {engineHint ? (
161|              <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-snug">{engineHint}</p>
162|            ) : null}
163|            {usesNativeTts() && voices.length === 0 ? (
164|              <button
165|                type="button"
166|                onClick={() => void openNativeTtsInstall()}
167|                className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 underline"
168|              >
169|                Open Android TTS settings
170|              </button>
171|            ) : null}
172|          </div>
173|        ) : null}
174|      </div>
175|
176|      <div className="grid grid-cols-2 gap-3 pt-1">
177|        <div className="space-y-1.5">
178|          <label className="text-[9px] font-bold uppercase tracking-wider text-kindle-text-muted">Rate ({settings.rate.toFixed(2)}x)</label>
179|          <input
180|            type="range"
181|            min={0.75}
182|            max={1.5}
183|            step={0.05}
184|            value={settings.rate}
185|            onChange={(e) => update({ rate: parseFloat(e.target.value) })}
186|            className="w-full accent-kindle-accent cursor-pointer"
187|          />
188|        </div>
189|        <div className="space-y-1.5">
190|          <label className="text-[9px] font-bold uppercase tracking-wider text-kindle-text-muted">Pitch ({settings.pitch.toFixed(2)})</label>
191|          <input
192|            type="range"
193|            min={0.8}
194|            max={1.2}
195|            step={0.05}
196|            value={settings.pitch}
197|            onChange={(e) => update({ pitch: parseFloat(e.target.value) })}
198|            className="w-full accent-kindle-accent cursor-pointer"
199|          />
200|        </div>
201|      </div>
202|
203|      <div className="flex gap-2 pt-1">
204|        {(["narrator", "speed"] as TtsPlaybackMode[]).map((mode) => (
205|          <button
206|            key={mode}
207|            type="button"
208|            onClick={() => update({ playbackMode: mode })}
209|            className={`flex-1 text-[9px] font-bold uppercase tracking-wider py-2 rounded-lg border transition cursor-pointer ${
210|              settings.playbackMode === mode
211|                ? "bg-kindle-text text-kindle-bg border-kindle-text"
212|                : "border-kindle-border text-kindle-text-muted hover:text-kindle-text bg-kindle-card/40"
213|            }`}
214|          >
215|            {mode === "narrator" ? "Narrator" : "Speed"}
216|          </button>
217|        ))}
218|      </div>
219|
220|      {showQualityPresets && (
221|        <div className="space-y-1.5 pt-1">
222|          <label className="text-[9px] font-bold uppercase tracking-wider text-kindle-text-muted">
223|            Quality Preset
224|          </label>
225|          <select
226|            value={settings.qualityPreset}
227|            onChange={(e) => update({ qualityPreset: e.target.value as TtsQualityPreset })}
228|            className="w-full text-[11px] bg-kindle-card border border-kindle-border rounded-lg px-3 py-2 text-kindle-text focus:outline-none focus:border-kindle-accent"
229|          >
230|            {(["instant", "balanced", "studio"] as TtsQualityPreset[]).map((preset) => (
231|              <option key={preset} value={preset}>
232|                {getQualityPresetLabel(preset)}
233|              </option>
234|            ))}
235|          </select>
236|        </div>
237|      )}
238|
239|      {showGenerationMode && (
240|        <div className="flex gap-2 pt-1">
241|          {(["live", "pregenerate"] as TtsGenerationMode[]).map((mode) => (
242|            <button
243|              key={mode}
244|              type="button"
245|              onClick={() => update({ generationMode: mode })}
246|              className={`flex-1 text-[9px] font-bold uppercase tracking-wider py-2 rounded-lg border transition cursor-pointer ${
247|                settings.generationMode === mode
248|                  ? "bg-kindle-text text-kindle-bg border-kindle-text"
249|                  : "border-kindle-border text-kindle-text-muted hover:text-kindle-text bg-kindle-card/40"
250|              }`}
251|            >
252|              {mode === "live" ? "Speak Live" : "Generate Now"}
253|            </button>
254|          ))}
255|        </div>
256|      )}
257|
258|      {showTestButton && (
259|        <button
260|          type="button"
261|          onClick={handleTest}
262|          disabled={testing}
263|          className="w-full text-[9px] font-bold uppercase tracking-wider py-2.5 rounded-lg border border-kindle-border bg-kindle-card/50 hover:bg-kindle-card transition disabled:opacity-50 text-kindle-text cursor-pointer mt-1"
264|        >
265|          {testing ? "Testing voice…" : "Test Voice"}
266|        </button>
267|      )}
268|
269|      {testError && <p className="text-[9px] text-red-500 font-medium">{testError}</p>}
270|    </div>
271|  );
272|}
273|
```


## Daily Brief TikTok overlay

**`src/components/DailyBriefTikTokView.tsx`** (lines 1-459)

```tsx
1|import React, {useEffect, useRef, useState, useMemo} from"react";
2|import {createPortal} from"react-dom";
3|import {
4| ChevronDown,
5| X,
6| Bookmark,
7| Share2,
8| ExternalLink,
9| Sparkles,
10| Zap,
11| Newspaper,
12| ArrowLeft,
13| CheckCircle2,
14|} from"lucide-react";
15|import type {FeedItem} from"../lib/feedStorage";
16|import {getItemThumbnail} from"../lib/feedPreview";
17|import {collectTodayBriefArticles, buildTodayDailyBrief} from"../lib/dailyNewsBriefClient";
18|import {toast} from"react-hot-toast";
19|import {resolveFeedArticle, prepareFeedArticleHtml} from"../lib/feedArticle";
20|
21|interface DailyBriefTikTokViewProps {
22| items: FeedItem[];
23| isOpen: boolean;
24| onClose: () => void;
25| onSave: (item: FeedItem) => void;
26| onRead: (item: FeedItem) => void;
27| grayscaleCovers?: boolean;
28|}
29|
30|export default function DailyBriefTikTokView({
31| items,
32| isOpen,
33| onClose,
34| onSave,
35| onRead,
36| grayscaleCovers = false,
37|}: DailyBriefTikTokViewProps) {
38| const containerRef = useRef<HTMLDivElement>(null);
39| const touchStartRef = useRef<{x: number; y: number; time: number} | null>(null);
40| const [dragY, setDragY] = useState(0);
41| const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);
42| const [resolvedStories, setResolvedStories] = useState<
43| Record<string, {title: string; html: string; loading: boolean; error?: string}>
44| >({});
45|
46| // Compile today's brief
47| const brief = useMemo(() => {
48| let articles = collectTodayBriefArticles(items);
49| if (articles.length < 2 && items.length > 0) {
50| const sorted = [...items].sort((a, b) => b.publishedAt - a.publishedAt);
51| articles = sorted.slice(0, 24).map((item) => ({
52| id: item.id,
53| source: item.subscriptionTitle,
54| title: item.title,
55| summary: item.summary,
56| link: item.link,
57|}));
58|}
59| if (articles.length < 2) return null;
60| return buildTodayDailyBrief(articles);
61|}, [items]);
62|
63| // Lock body scroll when open
64| useEffect(() => {
65| if (!isOpen) return;
66| const originalStyle = document.body.style.overflow;
67| document.body.style.overflow ="hidden";
68| return () => {
69| document.body.style.overflow = originalStyle;
70|};
71|}, [isOpen]);
72|
73| // Fetch story content if expanded
74| useEffect(() => {
75| if (!isOpen || !expandedStoryId) return;
76| const item = items.find((i) => i.id === expandedStoryId);
77| if (!item || resolvedStories[item.id]) return;
78|
79| setResolvedStories((prev) => ({
80| ...prev,
81| [item.id]: {title: item.title, html:"", loading: true},
82|}));
83|
84| resolveFeedArticle(item)
85| .then((resolved) => {
86| setResolvedStories((prev) => ({
87| ...prev,
88| [item.id]: {
89| title: resolved.title || item.title,
90| html: resolved.htmlContent || item.summary ||"",
91| loading: false,
92|},
93|}));
94|})
95| .catch((err) => {
96| setResolvedStories((prev) => ({
97| ...prev,
98| [item.id]: {
99| title: item.title,
100| html: item.summary ||"",
101| loading: false,
102| error: (err as Error).message,
103|},
104|}));
105|});
106|}, [expandedStoryId, isOpen, items, resolvedStories]);
107|
108| // Handle Swipe Down to return to TikTok Feed
109| const handleTouchStart = (e: React.TouchEvent) => {
110| if (e.touches.length === 1) {
111| touchStartRef.current = {
112| x: e.touches[0].clientX,
113| y: e.touches[0].clientY,
114| time: Date.now(),
115|};
116|}
117|};
118|
119| const handleTouchMove = (e: React.TouchEvent) => {
120| if (!touchStartRef.current) return;
121| const dy = e.touches[0].clientY - touchStartRef.current.y;
122| const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
123|
124| const scrollTop = containerRef.current?.scrollTop || 0;
125| // When pulling down at the top of scroll container
126| if (scrollTop <= 0 && dy > 0 && dy > dx) {
127| setDragY(dy);
128|}
129|};
130|
131| const handleTouchEnd = () => {
132| if (dragY > 60) {
133| onClose();
134|}
135| setDragY(0);
136| touchStartRef.current = null;
137|};
138|
139| // Keyboard navigation: ArrowDown or Escape dismisses back to TikTok Feed
140| const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
141| if (e.key ==="Escape"|| e.key ==="ArrowDown") {
142| e.preventDefault();
143| onClose();
144|}
145|};
146|
147| const handleShareBrief = async () => {
148| if (!brief) return;
149| const text = `Today's Executive News Brief:\n\n${brief.lead}\n\nRead more in Kora!`;
150| try {
151| if (navigator.share) {
152| await navigator.share({
153| title:"Today's News Brief",
154| text,
155| url: window.location.href,
156|});
157|} else {
158| await navigator.clipboard.writeText(text);
159| toast.success("News brief copied to clipboard!");
160|}
161|} catch {
162| await navigator.clipboard.writeText(text);
163| toast.success("News brief copied to clipboard!");
164|}
165|};
166|
167| if (!isOpen) return null;
168|
169| if (!brief) {
170| return createPortal(
171| <div className="fixed inset-0 z-[999] bg-neutral-950 flex flex-col items-center justify-center text-white p-6">
172| <div className="max-w-md text-center space-y-4">
173| <Newspaper className="w-12 h-12 text-kindle-accent mx-auto animate-pulse"/>
174| <h2 className="text-xl font-lexend font-bold">Assembling Your Daily Brief...</h2>
175| <p className="text-sm text-neutral-400">
176| Please make sure you have feed subscriptions configured and active.
177| </p>
178| <button
179| onClick={onClose}
180| className="px-6 py-2.5 rounded-xl bg-white text-black text-xs font-bold uppercase tracking-wider hover:opacity-90 transition"
181| >
182| Go Back
183| </button>
184| </div>
185| </div>,
186| document.body
187| );
188|}
189|
190| const storyCount = brief.sections.reduce((acc, sec) => acc + sec.items.length, 0);
191| const featuredCover = items.find((i) => getItemThumbnail(i)) ? getItemThumbnail(items.find((i) => getItemThumbnail(i))!) : null;
192|
193| return createPortal(
194| <div
195| tabIndex={0}
196| onKeyDown={handleKeyDown}
197| onTouchStart={handleTouchStart}
198| onTouchMove={handleTouchMove}
199| onTouchEnd={handleTouchEnd}
200| style={{
201| transform: dragY > 0 ? `translateY(${dragY}px)` :"none",
202| opacity: dragY > 0 ? Math.max(0.4, 1 - dragY / 300) : 1,
203|}}
204| className="fixed inset-0 z-[999] bg-kindle-bg text-kindle-text flex flex-col overflow-hidden select-none outline-none transition-transform duration-75"
205| >
206| {/* Background artwork overlay */}
207| {featuredCover ? (
208| <>
209| <img
210| src={featuredCover}
211| alt=""
212| referrerPolicy="no-referrer"
213| loading="lazy"
214| className={`absolute inset-0 w-full h-full object-cover opacity-15 filter blur-xl scale-110 pointer-events-none ${
215| grayscaleCovers ?"grayscale":""
216|}`}
217| />
218| <div className="absolute inset-0 bg-gradient-to-t from-kindle-bg via-kindle-bg/90 to-kindle-bg/80 z-0"/>
219| </>
220| ) : (
221| <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(212,165,116,0.15),rgba(240,238,232,1))] (ellipse_80%_80%_at_50%_-20%,rgba(212,165,116,0.15),rgba(10,10,10,1))] z-0"/>
222| )}
223|
224| {/* Floating Immersive Top Bar - TikTok Style */}
225| <div className="relative z-40 flex items-center justify-between gap-3 pt-[max(env(safe-area-inset-top),0.75rem)] px-4 pb-3 border-b border-kindle-border bg-kindle-card/80 backdrop-blur-md">
226| <button
227| type="button"
228| onClick={onClose}
229| className="p-2 rounded-full bg-kindle-bg hover:opacity-80 text-kindle-text transition flex items-center gap-1.5 text-xs font-bold active:scale-95 border border-kindle-border"
230| title="Return to Feed"
231| >
232| <ArrowLeft className="w-4 h-4"/>
233| <span className="font-sans text-[11px] uppercase tracking-wider hidden sm:inline">Feed</span>
234| </button>
235|
236| <div className="bg-kindle-accent/20 border border-kindle-accent/40 rounded-full px-3.5 py-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white shadow-sm">
237| <Zap className="w-3.5 h-3.5 fill-current animate-pulse text-kindle-accent"/>
238| <span>News Brief</span>
239| </div>
240|
241| <button
242| type="button"
243| onClick={onClose}
244| className="p-2 rounded-full border border-kindle-border bg-kindle-bg text-kindle-text hover:opacity-80 active:scale-95 transition"
245| title="Close Brief"
246| >
247| <X className="w-4 h-4"/>
248| </button>
249| </div>
250|
251| {/* SINGLE SLIDE CONTENT VIEW */}
252| <div
253| ref={containerRef}
254| className="relative z-20 flex-1 overflow-y-auto overscroll-contain p-4 md:p-8 space-y-6 max-w-3xl mx-auto w-full select-text scrollbar-thin scrollbar-thumb-kindle-border"
255| >
256| {/* Executive Lead Banner */}
257| <div className="bg-kindle-card border border-kindle-border rounded-2xl p-5 md:p-7 space-y-4 shadow-xl relative overflow-hidden backdrop-blur-md">
258| <div className="flex items-center justify-between gap-2 border-b border-kindle-border pb-3">
259| <div className="flex items-center gap-2 text-amber-800">
260| <Sparkles className="w-4 h-4 fill-current"/>
261| <span className="text-[10px] font-bold uppercase tracking-widest">Single Executive Brief</span>
262| </div>
263| <div className="text-[10px] font-mono text-kindle-text-muted">
264| {storyCount} Stories · {brief.sections.length} Sources
265| </div>
266| </div>
267|
268| <h1 className="text-2xl md:text-4xl font-lexend font-extrabold text-kindle-text tracking-tight leading-tight">
269| Today&apos;s Executive News Brief
270| </h1>
271|
272| <div className="relative pl-4 border-l-2 border-amber-700">
273| <p className="font-serif text-base md:text-xl text-kindle-text-muted italic leading-relaxed">
274| {brief.lead}
275| </p>
276| </div>
277|
278| <div className="flex items-center justify-between pt-2">
279| <button
280| onClick={handleShareBrief}
281| className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-kindle-bg hover:opacity-80 border border-kindle-border text-kindle-text text-xs font-bold transition active:scale-95 cursor-pointer"
282| >
283| <Share2 className="w-3.5 h-3.5"/>
284| <span>Share Brief</span>
285| </button>
286|
287| <button
288| onClick={onClose}
289| className="inline-flex items-center gap-1 text-[11px] text-kindle-text-muted hover:text-kindle-text :text-white transition cursor-pointer"
290| >
291| <ChevronDown className="w-4 h-4 text-amber-700 animate-bounce"/>
292| <span>Swipe down for TikTok Feed</span>
293| </button>
294| </div>
295| </div>
296|
297| {/* Stories List Grouped by Source/Section */}
298| <div className="space-y-6">
299| <div className="flex items-center justify-between px-1">
300| <h2 className="text-sm font-lexend font-bold uppercase tracking-wider text-kindle-text">
301| Key Highlights & Stories
302| </h2>
303| <span className="text-[10px] text-kindle-text-muted font-mono">Tap any story card to expand full text</span>
304| </div>
305|
306| {brief.sections.map((section, sIdx) => (
307| <div key={sIdx} className="space-y-3">
308| <div className="flex items-center gap-2">
309| <span className="text-xs font-bold uppercase tracking-widest text-amber-800 bg-kindle-card px-2.5 py-0.5 rounded-full border border-kindle-border">
310| {section.source}
311| </span>
312| <div className="h-px bg-kindle-border flex-1"/>
313| </div>
314|
315| <div className="space-y-3">
316| {section.items.map((story) => {
317| const originalItem = items.find((i) => i.id === story.id);
318| const isExpanded = expandedStoryId === story.id;
319|
320| return (
321| <div
322| key={story.id}
323| onClick={() => setExpandedStoryId(isExpanded ? null : story.id)}
324| className={`bg-kindle-card border rounded-xl p-4 space-y-3 transition shadow-lg cursor-pointer ${
325| isExpanded ?"border-kindle-accent/60 ring-1 ring-kindle-accent/30 bg-kindle-card":"border-kindle-border hover:border-kindle-text/30"
326|}`}
327| >
328| <div className="flex items-start justify-between gap-3">
329| <div className="space-y-1 flex-1">
330| <h3 className="font-lexend font-bold text-base md:text-lg text-kindle-text hover:text-kindle-accent transition leading-snug">
331| {story.headline}
332| </h3>
333| </div>
334|
335| {/* Action buttons */}
336| <div className="flex items-center gap-1 shrink-0"onClick={(e) => e.stopPropagation()}>
337| {originalItem && (
338| <button
339| onClick={() => {
340| onSave(originalItem);
341| toast.success(
342| originalItem.saved ?"Removed from Save Later":"Saved to Read Later!"
343| );
344|}}
345| className={`p-2 rounded-lg border transition ${
346| originalItem.saved
347| ?"bg-kindle-accent border-kindle-accent text-white"
348| :"bg-kindle-bg border-kindle-border text-kindle-text hover:bg-kindle-border/50"
349|}`}
350| title={originalItem.saved ?"Unsave":"Save for later"}
351| >
352| <Bookmark className={`w-4 h-4 ${originalItem.saved ?"fill-current":""}`} />
353| </button>
354| )}
355|
356| {story.link && (
357| <a
358| href={story.link}
359| target="_blank"
360| rel="noopener noreferrer"
361| className="p-2 rounded-lg bg-kindle-bg border border-kindle-border text-kindle-text hover:bg-kindle-border/50 transition"
362| title="Open original link"
363| >
364| <ExternalLink className="w-4 h-4"/>
365| </a>
366| )}
367| </div>
368| </div>
369|
370| {/* AI Brief detail */}
371| <p className="text-xs md:text-sm font-serif text-kindle-text-muted leading-relaxed bg-kindle-bg p-3 rounded-lg border border-kindle-border">
372| <span className="font-sans font-bold uppercase tracking-wider text-[9px] text-kindle-accent block mb-0.5">
373| AI Executive Summary:
374| </span>
375| {story.detail}
376| </p>
377|
378| {/* Expand / Read original control */}
379| <div className="flex items-center justify-between text-xs pt-1 border-t border-kindle-border">
380| <div className="text-kindle-accent font-sans font-medium flex items-center gap-1 text-[11px]">
381| <span>{isExpanded ?"Collapse Full Story":"Tap card to expand full story"}</span>
382| <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ?"rotate-180":""}`} />
383| </div>
384|
385| {originalItem && (
386| <button
387| type="button"
388| onClick={(e) => {
389| e.stopPropagation();
390| onRead(originalItem);
391| onClose();
392|}}
393| className="text-kindle-text-muted hover:text-kindle-text hover:underline font-medium text-[11px] flex items-center gap-1"
394| title="Open full reader view"
395| >
396| <span>Open Reader</span>
397| {originalItem.read && <CheckCircle2 className="w-3 h-3 text-emerald-500"/>}
398| </button>
399| )}
400| </div>
401|
402| {/* Inline Expanded Full Story Content */}
403| {isExpanded && originalItem && (
404| <div className="mt-2 pt-3 border-t border-kindle-border space-y-2 animate-fade-in text-xs font-serif text-kindle-text">
405| {(() => {
406| const resolved = resolvedStories[originalItem.id];
407| if (!resolved || resolved.loading) {
408| return (
409| <div className="flex items-center gap-2 text-kindle-text-muted italic py-2">
410| <span className="w-3.5 h-3.5 border-2 border-kindle-text-muted border-t-transparent rounded-full animate-spin"/>
411| <span>Fetching article body...</span>
412| </div>
413| );
414|}
415| if (resolved.error) {
416| return (
417| <div className="text-kindle-text-muted italic py-1">
418| {originalItem.summary ||"Unable to fetch online content."}
419| </div>
420| );
421|}
422| const cleanHtml = prepareFeedArticleHtml(resolved.html, resolved.title);
423| return (
424| <div
425| className="prose prose-xs max-w-none space-y-2 leading-relaxed text-kindle-text"
426| dangerouslySetInnerHTML={{__html: cleanHtml || originalItem.summary ||""}}
427| />
428| );
429|})()}
430| </div>
431| )}
432| </div>
433| );
434|})}
435| </div>
436| </div>
437| ))}
438|
439| {/* Bottom gesture footer */}
440| <div className="pt-6 pb-12 text-center space-y-3">
441| <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/15 text-neutral-300 text-xs font-medium">
442| <ChevronDown className="w-4 h-4 text-kindle-accent animate-bounce"/>
443| <span>Swipe down or tap back to return to TikTok Feed</span>
444| </div>
445| <div>
446| <button
447| onClick={onClose}
448| className="px-6 py-2.5 rounded-xl bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-neutral-200 transition"
449| >
450| Back to TikTok Scroll
451| </button>
452| </div>
453| </div>
454| </div>
455| </div>
456| </div>,
457| document.body
458| );
459|}
460|
```


## TikTok vertical news scroll + Ken Burns

**`src/components/FeedTikTokScroll.tsx`** (lines 1-870)

```tsx
1|import React, { useEffect, useRef, useState } from "react";
2|import { Bookmark, ChevronDown, ChevronUp, Filter, Grid, LayoutGrid, Loader2, RefreshCw, Share2, Settings2, Zap } from "lucide-react";
3|import type { FeedItem } from "../lib/feedStorage";
4|import { getItemThumbnail } from "../lib/feedPreview";
5|import { resolveFeedArticle, prepareFeedArticleHtml } from "../lib/feedArticle";
6|import { resolveCoverImageSrc } from "../lib/coverImage";
7|import { toast } from "react-hot-toast";
8|
9|// Ken Burns loop: alternate slow zoom-in / zoom-out / pan so the cover is
10|// always in motion, but never scales below 1 so blank edges never show.
11|// Direction is chosen per-slide from the image size (wide → pan sideways,
12|// tall → zoom) so it doesn't over-zoom a small image into nothing.
13|const KEN_BURNS = `
14|@keyframes koraKBzoomIn {
15|  0% { transform: scale(1.04); }
16|  100% { transform: scale(1.16); }
17|}
18|@keyframes koraKBzoomOut {
19|  0% { transform: scale(1.16); }
20|  100% { transform: scale(1.04); }
21|}
22|@keyframes koraKBpanX {
23|  0% { transform: scale(1.12) translateX(-3.5%); }
24|  100% { transform: scale(1.12) translateX(3.5%); }
25|}
26|@keyframes koraKBpanY {
27|  0% { transform: scale(1.12) translateY(-3.5%); }
28|  100% { transform: scale(1.12) translateY(3.5%); }
29|}
30|.kora-kb {
31|  animation-duration: 22s;
32|  animation-iteration-count: infinite;
33|  animation-direction: alternate;
34|  animation-timing-function: ease-in-out;
35|  will-change: transform;
36|  transform-origin: center center;
37|}
38|.kora-kb-zi { animation-name: koraKBzoomIn; }
39|.kora-kb-zo { animation-name: koraKBzoomOut; }
40|.kora-kb-px { animation-name: koraKBpanX; }
41|.kora-kb-py { animation-name: koraKBpanY; }
42|@media (prefers-reduced-motion: reduce) {
43|  .kora-kb { animation: none !important; transform: scale(1.05) !important; }
44|}
45|`;
46|
47|/**
48| * Build a Kora-styled shareable card image: headline + short description +
49| * cover photo + a deep link that opens the article directly in the Kora app.
50| * Returns a data URL. Pure canvas — no external deps.
51| */
52|async function buildKoraShareImage(item: FeedItem, cover?: string): Promise<string> {
53|  const W = 1080;
54|  const H = 1350;
55|  const canvas = document.createElement("canvas");
56|  canvas.width = W;
57|  canvas.height = H;
58|  const ctx = canvas.getContext("2d");
59|  if (!ctx) throw new Error("canvas unsupported");
60|
61|  const INK = "#1a1a18";
62|  const PAPER = "#ECE8D4";
63|  const ACCENT = "#7c9a5a";
64|  const MUTED = "#6b6357";
65|
66|  // Paper background
67|  ctx.fillStyle = PAPER;
68|  ctx.fillRect(0, 0, W, H);
69|
70|  // Cover image area (top 720px), with accent frame
71|  const imgY = 0;
72|  const imgH = 760;
73|  if (cover) {
74|    let objectUrl: string | null = null;
75|    try {
76|      const proxied = resolveCoverImageSrc(cover) || cover;
77|      try {
78|        const resp = await fetch(proxied);
79|        if (resp.ok) {
80|          const blob = await resp.blob();
81|          objectUrl = URL.createObjectURL(blob);
82|        }
83|      } catch {
84|        // ignore fetch error and fallback to direct URL
85|      }
86|
87|      const img = await new Promise<HTMLImageElement>((res, rej) => {
88|        const im = new Image();
89|        if (!objectUrl) {
90|          im.crossOrigin = "anonymous";
91|        }
92|        im.onload = () => res(im);
93|        im.onerror = rej;
94|        im.src = objectUrl || proxied;
95|      });
96|
97|      // cover-fit
98|      const ratio = Math.min(W / img.width, imgH / img.height);
99|      const dw = img.width * ratio;
100|      const dh = img.height * ratio;
101|      ctx.drawImage(img, (W - dw) / 2, imgY + (imgH - dh) / 2, dw, dh);
102|    } catch (err) {
103|      console.warn("[Kora/Share] Image loading fallback to accent block", err);
104|      ctx.fillStyle = ACCENT;
105|      ctx.fillRect(0, imgY, W, imgH);
106|    } finally {
107|      if (objectUrl) URL.revokeObjectURL(objectUrl);
108|    }
109|  } else {
110|    ctx.fillStyle = ACCENT;
111|    ctx.fillRect(0, imgY, W, imgH);
112|  }
113|  // subtle dark gradient at image bottom for legibility
114|  const grad = ctx.createLinearGradient(0, imgH - 220, 0, imgH);
115|  grad.addColorStop(0, "rgba(0,0,0,0)");
116|  grad.addColorStop(1, "rgba(0,0,0,0.55)");
117|  ctx.fillStyle = grad;
118|  ctx.fillRect(0, imgH - 220, W, 220);
119|
120|  // Load the beautiful Kora wordmark SVG
121|  const logoImg = await new Promise<HTMLImageElement>((res) => {
122|    const im = new Image();
123|    im.onload = () => res(im);
124|    im.onerror = () => res(null as any); // fallback if it fails
125|    im.src = "data:image/svg+xml;base64," + btoa(`
126|      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 287.6 112.78" fill="#ffffff">
127|        <path d="M287.6,104.25c-1.64,4.59-5.45,6.69-10,7.53-8.61,1.57-11.14-.13-16.94-11-4.9,6.39-10.94,10.55-19,11.62-9.95,1.31-19.48-3.36-22.59-11.64-3.59-9.57-.58-19.55,9.17-24.2,9.2-4.38,19.27-7,29.1-10,3-.9,4.36-1.9,3.94-5-.58-4.27-.66-8.66-1.78-12.78-1.63-6-6.3-9-12.29-8.95s-9.29,3-11.31,9.37c-1,3-.55,7-5,7.73-3.67.56-7.22.11-9-3.68s-.78-7.18,2.33-9.9c6.48-5.68,14.43-7.47,22.66-7.93a48.52,48.52,0,0,1,12.88,1.12c10.13,2.22,15.8,8.93,16.21,19.42.43,11,.28,22,.38,33,0,1.66,0,3.33,0,5C276.63,102.86,278.61,104.64,287.6,104.25Zm-26.6-34c-8.44,2.41-16.47,4.43-22.9,10.05-4.55,4-5.81,10.76-3.44,16.45a11.76,11.76,0,0,0,12,7c5.67-.42,13.76-5.58,14.15-10.21C261.46,86,261,78.4,261,70.24Z"/>
128|        <path d="M24.18,0V6.78c0,29.14,0,58.28-.07,87.42,0,6,.3,11.44,7.51,13.29.7.19,1.09,1.61,2,3.05H.64l-.64-1c1.19-1,2.24-2.37,3.61-2.9,3.94-1.53,5.62-4.17,5.61-8.4q-.13-40,0-79.93c0-4.73-1.93-7.46-6.26-9C1.9,9,1.15,7.79.27,7,1.2,6.27,2,5.18,3.09,4.92,9.84,3.24,16.64,1.74,24.18,0Z"/>
129|        <path d="M193.44,110.51H159.7l-.57-1c1.07-.9,2-2.13,3.25-2.62,4.54-1.79,6-5,5.94-9.79-.2-14-.28-28,0-42,.13-5.65-1.58-9.3-7.11-11a3.26,3.26,0,0,1-1.77-2c-.13-.38.8-1.52,1.4-1.67,7-1.75,14.08-3.37,21.77-5.18V51.06l1.11.4,2.54-4.36c3.51-6,8.15-10.58,15.32-11.7,7.35-1.15,12.17,3.38,10.85,10-1,5.16-4.11,6.91-9.13,5.17-12.43-4.32-19.44.57-19.59,13.8-.12,10.66.14,21.33-.21,32-.19,5.71,1.76,9.21,7.35,10.72,1.23.33,2.23,1.52,3.34,2.31Z"/>
130|        <path d="M78.32,110.77c-7.1,0-14.2.08-21.29-.1a4.78,4.78,0,0,1-3-2Q40.66,90.3,27.46,71.89c5.26-5.49,10.61-11.09,16-16.65,2.08-2.15,4.31-4.16,6.37-6.33,3.77-4,3.34-5.72-1.66-8.06a4.92,4.92,0,0,1-2.57-3.51H73.37l.76,1.25C70.3,40.71,66.22,42.48,62.71,45a109.36,109.36,0,0,0-11.2,9.9C48.05,58.27,44.85,61.86,41,66,53.4,80.35,61.76,98.66,79,109.66Z"/>
131|        <path d="M151.77,74.1h0a45.46,45.46,0,0,0-3.51-17.51,33.2,33.2,0,0,0-4.87-8.34l-.23-.28c-.23-.29-.47-.58-.71-.86a29.45,29.45,0,0,0-5.49-5,37.39,37.39,0,0,0-43.9,0,29.71,29.71,0,0,0-5.48,5c-.25.28-.48.57-.72.86l-.22.28a33.2,33.2,0,0,0-4.87,8.34,45.27,45.27,0,0,0-3.51,17.51h0A42.74,42.74,0,0,0,82.47,93a32.76,32.76,0,0,0,15.32,15.69,37.5,37.5,0,0,0,15.86,4.09h.07l1.29,0,1.3,0h.07a37.5,37.5,0,0,0,15.86-4.09A32.73,32.73,0,0,0,147.55,93,42.61,42.61,0,0,0,151.77,74.1ZM133,90.13A66.71,66.71,0,0,1,129.34,99a15.55,15.55,0,0,1-14.18,9h-.29a15.56,15.56,0,0,1-14.19-9A66.63,66.63,0,0,1,97,90.13c-.9-3.49-1.64-7-2.42-10.56a51.39,51.39,0,0,1-.4-8.67c1.25-8.9,3.25-16.72,6.32-21.79,3.52-5.81,9-8.92,14.48-9.21,5.47.29,11,3.4,14.49,9.21,3.07,5.07,5.06,12.89,6.31,21.79a51.39,51.39,0,0,1-.4,8.67C134.63,83.1,133.89,86.64,133,90.13Z"/>
132|      </svg>
133|    `);
134|  });
135|
136|  if (logoImg) {
137|    const logoW = 160;
138|    const logoH = logoW * (112.78 / 287.6);
139|    ctx.drawImage(logoImg, 64, 56, logoW, logoH);
140|  } else {
141|    // Kora wordmark fallback
142|    ctx.fillStyle = "#ffffff";
143|    ctx.font = "700 46px Lexend, Georgia, serif";
144|    ctx.textBaseline = "top";
145|    ctx.fillText("KORA", 64, 56);
146|  }
147|
148|  let y = imgH + 70;
149|
150|  // Source + "READ IN KORA" eyebrow
151|  const source = (() => {
152|    try {
153|      return new URL(item.link).hostname.replace(/^www\./, "");
154|    } catch {
155|      return item.subscriptionTitle || "kora";
156|    }
157|  })();
158|  ctx.fillStyle = ACCENT;
159|  ctx.font = "700 30px Arial, sans-serif";
160|  ctx.fillText(source.toUpperCase(), 64, y);
161|  y += 50;
162|
163|  // Headline (wrap)
164|  ctx.fillStyle = INK;
165|  ctx.font = "700 58px Lexend, Georgia, serif";
166|  const head = item.title || "Kora news";
167|  y = wrapText(ctx, head, 64, y, W - 128, 68, 4);
168|
169|  // Short description (wrap, muted) — clamp to keep the footer visible
170|  const desc = (item.summary || "").replace(/\s+/g, " ").trim();
171|  if (desc) {
172|    y += 28;
173|    ctx.fillStyle = MUTED;
174|    ctx.font = "400 34px Georgia, serif";
175|    y = wrapText(ctx, desc, 64, y, W - 128, 46, 3);
176|  }
177|
178|  // Footer: deep link + tagline
179|  ctx.fillStyle = INK;
180|  ctx.font = "700 32px Arial, sans-serif";
181|  ctx.fillText("Read this in the Kora app →", 64, H - 150);
182|  ctx.fillStyle = MUTED;
183|  ctx.font = "400 28px Arial, sans-serif";
184|  const link = buildKoraDeepLink(item);
185|  ctx.fillText(truncate(link, 56), 64, H - 100);
186|
187|  return canvas.toDataURL("image/png");
188|}
189|
190|function wrapText(
191|  ctx: CanvasRenderingContext2D,
192|  text: string,
193|  x: number,
194|  y: number,
195|  maxW: number,
196|  lineH: number,
197|  maxLines: number
198|): number {
199|  const words = text.split(/\s+/);
200|  let line = "";
201|  let lines = 0;
202|  for (let i = 0; i < words.length; i++) {
203|    const test = line ? line + " " + words[i] : words[i];
204|    if (ctx.measureText(test).width > maxW && line) {
205|      ctx.fillText(line, x, y);
206|      y += lineH;
207|      line = words[i];
208|      lines++;
209|      if (lines >= maxLines - 1) break;
210|    } else {
211|      line = test;
212|    }
213|  }
214|  // last (possibly truncated) line
215|  const remaining = words.slice(words.indexOf(line) + (line ? 1 : 0)).join(" ");
216|  const last = line + (remaining && lines < maxLines - 1 ? " " + remaining : "");
217|  if (lines < maxLines) {
218|    let l = last;
219|    while (ctx.measureText(l + "…").width > maxW && l.length > 1) l = l.slice(0, -1);
220|    ctx.fillText(l + (l.length < last.length ? "…" : ""), x, y);
221|    y += lineH;
222|  }
223|  return y;
224|}
225|
226|function truncate(s: string, n: number): string {
227|  return s.length > n ? s.slice(0, n - 1) + "…" : s;
228|}
229|
230|/** Deep link that opens the article directly in the Kora app (APK + web). */
231|function buildKoraDeepLink(item: FeedItem): string {
232|  try {
233|    return `https://kora.chaoticstudio.workers.dev/news?url=${encodeURIComponent(item.link)}`;
234|  } catch {
235|    return "https://kora.chaoticstudio.workers.dev";
236|  }
237|}
238|
239|interface FeedTikTokScrollProps {
240|  items: FeedItem[];
241|  grayscaleCovers?: boolean;
242|  perfMode?: boolean;
243|  onRead: (item: FeedItem) => void;
244|  onSave: (item: FeedItem) => void;
245|  onExit?: () => void;
246|  onRefresh?: () => void;
247|  onManage?: () => void;
248|  onFilter?: () => void;
249|  onOpenDailyBrief?: () => void;
250|  onToggleLayout?: (layout: "grid" | "scroll") => void;
251|  refreshing?: boolean;
252|  height?: number | null;
253|}
254|
255|/**
256| * TikTok/Reels-style vertical news scroll: one article per screen, swipe or
257| * arrow-key to advance, tap to open the fullscreen reader, Save pill per slide.
258| * Uses theme vars so it works in light/dark/yellow/blue. Respects perf mode
259| * (disables snap + smooth scroll) and reduced-motion.
260| *
261| * Implements an immersive full-screen view on mobile (z-index 110) covering headers
262| * and tab bars, and extracts the progress indicators out of the scroll container to
263| * guarantee perfect snap alignment and no text clipping.
264| */
265|export default function FeedTikTokScroll({
266|  items,
267|  grayscaleCovers,
268|  perfMode,
269|  onRead,
270|  onSave,
271|  onExit,
272|  onRefresh,
273|  onManage,
274|  onFilter,
275|  onOpenDailyBrief,
276|  onToggleLayout,
277|  refreshing,
278|  height,
279|}: FeedTikTokScrollProps) {
280|  const [isDarkMode, setIsDarkMode] = useState(() =>
281|    typeof document !== "undefined" && (document.body.classList.contains("dark") || document.body.className.includes("dark"))
282|  );
283|  const ref = useRef<HTMLDivElement>(null);
284|  const [active, setActive] = useState(0);
285|  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
286|
287|  useEffect(() => {
288|    if (typeof document === "undefined") return;
289|    const updateTheme = () => {
290|      setIsDarkMode(document.body.classList.contains("dark") || document.body.className.includes("dark"));
291|    };
292|    updateTheme();
293|    const observer = new MutationObserver(updateTheme);
294|    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
295|    return () => observer.disconnect();
296|  }, []);
297|
298|  useEffect(() => {
299|    const handleResize = () => setIsMobile(window.innerWidth < 768);
300|    window.addEventListener("resize", handleResize);
301|    return () => window.removeEventListener("resize", handleResize);
302|  }, []);
303|  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
304|  const [articleHtmlMap, setArticleHtmlMap] = useState<Record<string, { html: string; loading: boolean }>>({});
305|  const [autoScroll, setAutoScroll] = useState(false);
306|  const [loadedDims, setLoadedDims] = useState<Record<string, { w: number; h: number }>>({});
307|
308|
309|  // Auto scroll effect for news feed
310|  useEffect(() => {
311|    if (!autoScroll || expandedIndex !== null || !items.length) return;
312|    const interval = setInterval(() => {
313|      const el = ref.current;
314|      if (!el) return;
315|      setActive((prev) => {
316|        const next = (prev + 1) % items.length;
317|        el.children[next]?.scrollIntoView({ behavior: perfMode ? "auto" : "smooth" });
318|        return next;
319|      });
320|    }, 4800);
321|    return () => clearInterval(interval);
322|  }, [autoScroll, expandedIndex, items.length, perfMode]);
323|
324|  // Inject Ken Burns keyframes once.
325|  useEffect(() => {
326|    if (document.getElementById("kora-kb-style")) return;
327|    const style = document.createElement("style");
328|    style.id = "kora-kb-style";
329|    style.textContent = KEN_BURNS;
330|    document.head.appendChild(style);
331|  }, []);
332|
333|  // Pick a Ken Burns variant from the cover's natural dimensions so we never
334|  // over-zoom a tiny image or pan a portrait photo off-screen.
335|  const kbClassFor = (item: FeedItem, idx: number): string => {
336|    const cover = getItemThumbnail(item);
337|    if (!cover) return "";
338|    const key = `kora-kb-dims:${cover}`;
339|    const dims = loadedDims[cover] || (window as any).__koraKbDims?.[key];
340|    const variants = ["kora-kb-zi", "kora-kb-zo", "kora-kb-px", "kora-kb-py"];
341|    if (!dims) {
342|      // No dimensions yet — pick a stable pseudo-random variant from the index.
343|      return `kora-kb ${variants[idx % variants.length]}`;
344|    }
345|    const ratio = dims.w / dims.h;
346|    if (ratio > 1.35) return "kora-kb kora-kb-px";
347|    if (ratio < 0.8) return "kora-kb kora-kb-py";
348|    return `kora-kb ${idx % 2 === 0 ? "kora-kb-zi" : "kora-kb-zo"}`;
349|  };
350|
351|
352|  useEffect(() => {
353|    if (expandedIndex === null) return;
354|    const item = items[expandedIndex];
355|    if (!item) return;
356|    if (articleHtmlMap[item.id]?.loading || articleHtmlMap[item.id]?.html) return;
357|
358|    setArticleHtmlMap((prev) => ({
359|      ...prev,
360|      [item.id]: { html: "", loading: true },
361|    }));
362|
363|    resolveFeedArticle(item)
364|      .then((res) => {
365|        const prepared = prepareFeedArticleHtml(res.htmlContent || "", res.title || item.title);
366|        setArticleHtmlMap((prev) => ({
367|          ...prev,
368|          [item.id]: { html: prepared || item.summary || "", loading: false },
369|        }));
370|      })
371|      .catch(() => {
372|        setArticleHtmlMap((prev) => ({
373|          ...prev,
374|          [item.id]: { html: item.summary || "", loading: false },
375|        }));
376|      });
377|  }, [expandedIndex, items, articleHtmlMap]);
378|
379|  useEffect(() => {
380|    const handleResize = () => {
381|      setIsMobile(window.innerWidth < 768);
382|    };
383|    window.addEventListener("resize", handleResize);
384|    return () => window.removeEventListener("resize", handleResize);
385|  }, []);
386|
387|  // Collapse full details automatically when user scrolls to a different slide
388|  useEffect(() => {
389|    setExpandedIndex(null);
390|  }, [active]);
391|
392|  const handleShare = async (item: FeedItem) => {
393|    try {
394|      const cover = getItemThumbnail(item);
395|      const dataUrl = await buildKoraShareImage(item, cover);
396|      const blob = await (await fetch(dataUrl)).blob();
397|      const fileName = "kora-news.png";
398|      const deepLink = buildKoraDeepLink(item);
399|      const shareText = `${item.title}\n\nRead it in the Kora app: ${deepLink}`;
400|
401|      // 1) Native share sheet with the image card + link (Capacitor — reliable on APK).
402|      try {
403|        const { Share } = await import("@capacitor/share");
404|        const { Filesystem, Directory } = await import("@capacitor/filesystem");
405|        await Filesystem.writeFile({ path: fileName, data: dataUrl, directory: Directory.Cache });
406|        const fileUri = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
407|        await Share.share({
408|          title: item.title,
409|          text: shareText,
410|          files: [fileUri.uri],
411|          dialogTitle: "Share article",
412|        });
413|        return;
414|      } catch (nativeErr) {
415|        console.warn("[Kora/Share] native share failed, trying web", nativeErr);
416|      }
417|
418|      // 2) Web fallback: native share API if available, then copy link.
419|      if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: "image/png" })] })) {
420|        try {
421|          await navigator.share({ files: [new File([blob], fileName, { type: "image/png" })], title: item.title, text: shareText });
422|          return;
423|        } catch { /* user cancelled */ }
424|      }
425|      if (navigator.share) {
426|        try {
427|          await navigator.share({ title: item.title, text: shareText, url: deepLink });
428|          return;
429|        } catch { /* user cancelled */ }
430|      }
431|      const a = document.createElement("a");
432|      a.href = dataUrl;
433|      a.download = fileName;
434|      document.body.appendChild(a);
435|      a.click();
436|      document.body.removeChild(a);
437|      await navigator.clipboard.writeText(item.link);
438|      toast.success("Share card saved & link copied");
439|    } catch {
440|      // Image generation failed — simple link fallback.
441|      try {
442|        await navigator.clipboard.writeText(item.link);
443|        toast.success("Article link copied to clipboard");
444|      } catch {
445|        toast.error("Failed to share");
446|      }
447|    }
448|  };
449|
450|  const go = (dir: 1 | -1) => {
451|    const el = ref.current;
452|    if (!el) return;
453|    const next = Math.min(items.length - 1, Math.max(0, active + dir));
454|    el.children[next]?.scrollIntoView({ behavior: perfMode ? "auto" : "smooth" });
455|  };
456|
457|  useEffect(() => {
458|    const el = ref.current;
459|    if (!el) return;
460|    const io = new IntersectionObserver(
461|      (entries) => {
462|        entries.forEach((e) => {
463|          if (e.isIntersecting) {
464|            const idx = Array.prototype.indexOf.call(el.children, e.target);
465|            if (idx >= 0) setActive(idx);
466|          }
467|        });
468|      },
469|      { root: el, threshold: 0.6 }
470|    );
471|    Array.from(el.children).forEach((c) => io.observe(c));
472|    return () => io.disconnect();
473|  }, [items.length]);
474|
475|  if (!items.length) return null;
476|
477|  // Layout styles
478|  const wrapperStyle = !isMobile && height ? { height: `${height}px` } : undefined;
479|  const sectionStyle = !isMobile && height ? { height: `${height}px` } : undefined;
480|
481|  return (
482|    <div
483|      style={wrapperStyle}
484|      className={
485|        isMobile
486|          ? `fixed inset-0 w-full z-[45] flex flex-col overflow-hidden ${
487|              isDarkMode ? "bg-neutral-950 text-white" : "bg-kindle-bg text-kindle-text"
488|            }`
489|          : "relative w-full rounded-2xl overflow-hidden border border-kindle-border bg-kindle-card shadow-xs"
490|      }
491|    >
492|      {/* 1. Immersive Floating Header for Mobile */}
493|      {isMobile && (
494|        <div className="absolute top-4 left-0 right-0 z-30 flex items-center justify-between pointer-events-none px-4">
495|          <div className="pointer-events-auto">
496|            {onManage && (
497|              <button
498|                type="button"
499|                onClick={onManage}
500|                className={`w-10 h-10 rounded-full border backdrop-blur-md active:scale-95 transition flex items-center justify-center shadow-lg ${
501|                  isDarkMode
502|                    ? "border-white/20 bg-black/60 text-white hover:bg-black/80"
503|                    : "border-kindle-border bg-kindle-card/90 text-kindle-text hover:bg-kindle-card"
504|                }`}
505|                title="Manage Feeds & Sources"
506|              >
507|                <Settings2 className="w-4 h-4" />
508|              </button>
509|            )}
510|          </div>
511|
512|          <div className="pointer-events-auto flex items-center gap-2">
513|            {onToggleLayout && (
514|              <button
515|                type="button"
516|                onClick={() => onToggleLayout("grid")}
517|                className={`w-10 h-10 rounded-full border backdrop-blur-md active:scale-95 transition flex items-center justify-center shadow-lg ${
518|                  isDarkMode
519|                    ? "border-white/20 bg-black/60 text-white hover:bg-black/80"
520|                    : "border-kindle-border bg-kindle-card/90 text-kindle-text hover:bg-kindle-card"
521|                }`}
522|                title="Switch to Grid View"
523|              >
524|                <LayoutGrid className="w-4 h-4" />
525|              </button>
526|            )}
527|            {onRefresh && (
528|              <button
529|                type="button"
530|                onClick={onRefresh}
531|                disabled={refreshing}
532|                className={`w-10 h-10 rounded-full border backdrop-blur-md active:scale-95 transition disabled:opacity-50 flex items-center justify-center shadow-lg ${
533|                  isDarkMode
534|                    ? "border-white/20 bg-black/60 text-white hover:bg-black/80"
535|                    : "border-kindle-border bg-kindle-card/90 text-kindle-text hover:bg-kindle-card"
536|                }`}
537|                title="Refresh Feeds"
538|              >
539|                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
540|              </button>
541|            )}
542|          </div>
543|        </div>
544|      )}
545|      {/* 2. Top Progress Indicators */}
546|      <div className={`absolute left-4 right-4 z-20 flex gap-1 pointer-events-none ${isMobile ? "hidden" : "top-3"}`}>
547|        {items.map((_, i) => (
548|          <div
549|            key={i}
550|            className={`h-1 flex-1 rounded-full transition-colors ${
551|              i <= active ? "bg-kindle-accent" : isDarkMode ? "bg-white/20" : "bg-kindle-border"
552|            }`}
553|          />
554|        ))}
555|      </div>
556|
557|      {/* 3. Snapping Scroll Container */}
558|      <div
559|        ref={ref}
560|        tabIndex={0}
561|        onKeyDown={(e) => {
562|          if (e.key === "ArrowDown" || e.key === " ") {
563|            e.preventDefault();
564|            go(1);
565|          } else if (e.key === "ArrowUp") {
566|            e.preventDefault();
567|            go(-1);
568|          }
569|        }}
570|        className={`w-full h-full overflow-y-auto overscroll-contain scrollbar-none touch-pan-y ${
571|          perfMode
572|            ? ""
573|            : expandedIndex === null
574|              ? "snap-y snap-mandatory [scroll-snap-stop:always]"
575|              : ""
576|        }`}
577|      >
578|        {items.map((item, index) => {
579|          const cover = getItemThumbnail(item);
580|          const isExpanded = expandedIndex === index;
581|          const kbCls = !perfMode ? kbClassFor(item, index) : "";
582|          const isFar = Math.abs(index - active) > 3;
583|
584|          const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
585|            try {
586|              const el = e.currentTarget;
587|              const w = el.naturalWidth, h = el.naturalHeight;
588|              if (w && h && cover) {
589|                const store = ((window as any).__koraKbDims ||= {});
590|                store[`kora-kb-dims:${cover}`] = { w, h };
591|                setLoadedDims((prev) => ({
592|                  ...prev,
593|                  [cover]: { w, h },
594|                }));
595|              }
596|            } catch { /* ignore */ }
597|          };
598|
599|          const source = (() => {
600|            try {
601|              return new URL(item.link).hostname.replace(/^www\./, "");
602|            } catch {
603|              return item.subscriptionTitle;
604|            }
605|          })();
606|          return (
607|            <section
608|              key={item.id}
609|              style={sectionStyle}
610|              className="relative snap-start snap-always [scroll-snap-stop:always] flex flex-col justify-end p-4 md:p-6 h-full w-full shrink-0 overflow-hidden"
611|            >
612|              {cover ? (
613|                isFar ? (
614|                  <div className={`absolute inset-0 ${isDarkMode ? "bg-neutral-950/40" : "bg-kindle-bg/40"} ${isMobile ? "" : "rounded-2xl"}`} />
615|                ) : (
616|                  <img
617|                    src={cover}
618|                    alt=""
619|                    referrerPolicy="no-referrer"
620|                    loading="lazy"
621|                    onLoad={onImgLoad}
622|                    className={
623|                      isMobile
624|                        ? `absolute inset-0 w-full h-full object-cover [transform:translateZ(0)] [will-change:transform,opacity] ${kbCls} ${
625|                            isExpanded ? "blur-sm" : ""
626|                          } ${grayscaleCovers ? "grayscale" : ""}`
627|                        : `absolute inset-0 w-full h-full object-cover rounded-2xl [transform:translateZ(0)] [will-change:transform,opacity] ${kbCls} ${
628|                            isExpanded ? "blur-sm" : ""
629|                          } ${grayscaleCovers ? "grayscale" : ""}`
630|                    }
631|                  />
632|                )
633|              ) : (
634|                <div
635|                  className={
636|                    isMobile
637|                      ? `absolute inset-0 ${
638|                          isDarkMode
639|                            ? "bg-gradient-to-br from-kindle-accent/30 to-black/60"
640|                            : "bg-gradient-to-br from-kindle-accent/20 to-kindle-bg"
641|                        } [transform:translateZ(0)] [will-change:transform,opacity] ${kbCls} ${
642|                          isExpanded ? "blur-xs" : ""
643|                        }`
644|                      : `absolute inset-0 ${
645|                          isDarkMode
646|                            ? "bg-gradient-to-br from-kindle-accent/30 to-black/60"
647|                            : "bg-gradient-to-br from-kindle-accent/20 to-kindle-bg"
648|                        } rounded-2xl [transform:translateZ(0)] [will-change:transform,opacity] ${kbCls} ${
649|                          isExpanded ? "blur-xs" : ""
650|                        }`
651|                  }
652|                />
653|              )}
654|              <div
655|                className={`absolute inset-0 transition-all duration-300 ${
656|                  isMobile ? "" : "rounded-2xl"
657|                } ${
658|                  isExpanded
659|                    ? isDarkMode
660|                      ? "bg-black/95 text-white"
661|                      : "bg-kindle-bg text-kindle-text"
662|                    : isDarkMode
663|                      ? "bg-gradient-to-t from-black/95 via-black/70 via-35% to-black/15 text-white"
664|                      : "bg-gradient-to-t from-[#ECE8D4] via-[#ECE8D4]/95 via-35% to-[#ECE8D4]/20 text-kindle-text"
665|                }`}
666|              />
667|
668|                {/* Floating Side Action Buttons (TikTok style) */}
669|                <div
670|                  className={`absolute right-3 ${isMobile ? "bottom-36" : "bottom-6"} z-30 flex flex-col items-center gap-3`}
671|                  onClick={(e) => e.stopPropagation()}
672|                >
673|                  {/* Filter Button */}
674|                  {onFilter && (
675|                    <button
676|                      type="button"
677|                      onClick={onFilter}
678|                      className="active:scale-95 transition group"
679|                    >
680|                      <div className={`w-10 h-10 rounded-full border backdrop-blur-md flex items-center justify-center shadow-lg transition-all duration-200 ${
681|                        isDarkMode
682|                          ? "bg-black/60 border-white/20 text-white hover:bg-black/80"
683|                          : "bg-kindle-card/90 border-kindle-border text-kindle-text hover:bg-kindle-card"
684|                      }`}>
685|                        <Filter className="w-4 h-4" />
686|                      </div>
687|                    </button>
688|                  )}
689|
690|                  {/* Save Button */}
691|                  <button
692|                    type="button"
693|                    onClick={() => onSave(item)}
694|                    className="active:scale-95 transition group"
695|                  >
696|                    <div className={`w-10 h-10 rounded-full border flex items-center justify-center shadow-lg transition-all duration-200 ${
697|                      item.saved
698|                        ? "bg-kindle-accent border-kindle-accent text-neutral-950 scale-105"
699|                        : isDarkMode
700|                          ? "bg-black/60 border-white/20 text-white hover:bg-black/80 backdrop-blur-md"
701|                          : "bg-kindle-card/90 border-kindle-border text-kindle-text hover:bg-kindle-card backdrop-blur-md"
702|                    }`}>
703|                      <Bookmark className={`w-4 h-4 ${item.saved ? "fill-current" : ""}`} />
704|                    </div>
705|                  </button>
706|
707|                  {/* Share Button */}
708|                  <button
709|                    type="button"
710|                    onClick={() => void handleShare(item)}
711|                    className="active:scale-95 transition group"
712|                  >
713|                    <div className={`w-10 h-10 rounded-full border backdrop-blur-md flex items-center justify-center shadow-lg transition-all duration-200 ${
714|                      isDarkMode
715|                        ? "bg-black/60 border-white/20 text-white hover:bg-black/80"
716|                        : "bg-kindle-card/90 border-kindle-border text-kindle-text hover:bg-kindle-card"
717|                    }`}>
718|                      <Share2 className="w-4 h-4" />
719|                    </div>
720|                  </button>
721|
722|                  {/* Daily Brief Button */}
723|                  {onOpenDailyBrief && (
724|                    <button
725|                      type="button"
726|                      onClick={onOpenDailyBrief}
727|                      className="active:scale-95 transition group"
728|                      title="Open Daily News Brief"
729|                    >
730|                      <div className="w-10 h-10 rounded-full border border-kindle-accent/40 bg-kindle-accent text-neutral-950 flex items-center justify-center hover:opacity-95 shadow-lg transition-all duration-200 relative animate-pulse">
731|                        <Zap className="w-4 h-4 fill-current text-neutral-950" />
732|                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
733|                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
734|                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
735|                        </span>
736|                      </div>
737|                    </button>
738|                  )}
739|                </div>
740|
741|                <div
742|                  className={`relative z-10 cursor-pointer select-text ${isMobile ? "pb-20" : "pb-6"} transition-all duration-300 pr-16 md:pr-24 ${
743|                    isDarkMode
744|                      ? "text-white"
745|                      : "text-kindle-text"
746|                  }`}
747|                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
748|                >
749|                  <span className={`inline-flex items-center flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-1 sm:mb-2 transition-colors ${
750|                    isDarkMode ? "text-white/80" : "text-kindle-text-muted"
751|                  }`}>
752|                    {source}
753|                    {item.read ? (
754|                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${
755|                        isDarkMode ? "bg-white/20 text-white" : "bg-kindle-border text-kindle-text"
756|                      }`}>Read</span>
757|                    ) : (
758|                      <span className="rounded-full px-1.5 py-0.5 text-[9px] bg-kindle-accent text-neutral-950 font-bold">New</span>
759|                    )}
760|                    {item.publishedAt && (
761|                      <>
762|                        <span className="opacity-50 mx-0.5">•</span>
763|                        <span className="opacity-75 tracking-wider lowercase">
764|                          {new Date(item.publishedAt).toLocaleString(undefined, { 
765|                            month: 'short', 
766|                            day: 'numeric',
767|                            hour: 'numeric',
768|                            minute: '2-digit'
769|                          })}
770|                        </span>
771|                      </>
772|                    )}
773|                  </span>
774|                  <h2 className={`text-base sm:text-xl md:text-2xl font-lexend font-bold leading-tight mb-2 sm:mb-3 transition-all ${
775|                    isDarkMode
776|                      ? isExpanded ? "text-white" : "line-clamp-3 sm:line-clamp-4 text-white drop-shadow-md"
777|                      : isExpanded ? "text-kindle-text" : "line-clamp-3 sm:line-clamp-4 text-kindle-text"
778|                  }`}>
779|                    {item.title}
780|                  </h2>
781|
782|                  {/* Expanded Details Section */}
783|                  {isExpanded && (
784|                    <div
785|                      className={`mt-4 overflow-y-auto max-h-[45vh] pr-2 space-y-4 border-t pt-4 transition-colors ${
786|                        isDarkMode
787|                          ? "border-white/10 text-neutral-200"
788|                          : "border-neutral-200 text-neutral-800"
789|                      } scrollbar-thin select-text`}
790|                      onClick={(e) => e.stopPropagation()}
791|                    >
792|                      {articleHtmlMap[item.id]?.loading ? (
793|                        <div className="flex items-center gap-2 py-4">
794|                          <Loader2 className="w-4 h-4 animate-spin text-kindle-accent shrink-0" />
795|                          <p className="text-xs font-sans">Extracting full article…</p>
796|                        </div>
797|                      ) : articleHtmlMap[item.id]?.html ? (
798|                        <div
799|                          dir="auto"
800|                          className={`feed-article-content max-w-none text-xs sm:text-sm font-serif leading-relaxed [&_*]:[unicode-bidi:plaintext] ${
801|                            isDarkMode ? "text-neutral-200" : "text-neutral-900"
802|                          }`}
803|                          dangerouslySetInnerHTML={{ __html: articleHtmlMap[item.id].html }}
804|                        />
805|                      ) : item.summary ? (
806|                        <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-serif">
807|                          {item.summary}
808|                        </p>
809|                      ) : (
810|                        <p className="text-xs sm:text-sm italic opacity-70">
811|                          No content available for this article.
812|                        </p>
813|                      )}
814|
815|                      <div className="pt-2">
816|                        <a
817|                          href={item.link}
818|                          target="_blank"
819|                          rel="noopener noreferrer"
820|                          className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider hover:underline ${
821|                            isDarkMode ? "text-kindle-accent" : "text-neutral-900 underline decoration-kindle-accent decoration-2"
822|                          }`}
823|                        >
824|                          Read Full Original Article →
825|                        </a>
826|                      </div>
827|                    </div>
828|                  )}
829|
830|                  {/* Navigation and State Indicator */}
831|                  <div className={`flex items-center gap-2 mt-3.5 text-[10px] sm:text-[11px] transition-colors ${
832|                    isDarkMode ? "text-white/70" : "text-kindle-text-muted font-medium"
833|                  }`}>
834|                  {isExpanded ? (
835|                    <button
836|                      type="button"
837|                      onClick={(e) => {
838|                        e.stopPropagation();
839|                        setExpandedIndex(null);
840|                      }}
841|                      className="cursor-pointer p-1.5 -m-1.5 flex items-center justify-center hover:opacity-85 transition"
842|                      aria-label="Collapse"
843|                    >
844|                      <ChevronUp className="w-5 h-5" />
845|                    </button>
846|                  ) : (
847|                    <button
848|                      type="button"
849|                      onClick={(e) => {
850|                        e.stopPropagation();
851|                        setExpandedIndex(index);
852|                      }}
853|                      className="cursor-pointer p-1.5 -m-1.5 flex items-center justify-center hover:opacity-85 transition"
854|                      aria-label="Expand"
855|                    >
856|                      <ChevronDown className={`w-5 h-5 animate-bounce ${isDarkMode ? "text-kindle-accent" : "text-kindle-text"}`} />
857|                    </button>
858|                  )}
859|                  <span className="ml-auto font-mono">
860|                    {index + 1}/{items.length}
861|                  </span>
862|                </div>
863|              </div>
864|            </section>
865|          );
866|        })}
867|      </div>
868|    </div>
869|  );
870|}
871|
```


## Full article reader (continuous stack, RTL)

**`src/components/FeedArticleReader.tsx`** (lines 1-520)

```tsx
1|import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
2|import { Bookmark, ChevronLeft, ExternalLink, Loader2, Settings2 } from "lucide-react";
3|import {
4|  peekFeedArticle,
5|  prepareFeedArticleHtml,
6|  prefetchFeedArticles,
7|  resolveFeedArticle,
8|} from "../lib/feedArticle";
9|import { clipUrlToLibrary } from "../lib/feedClipper";
10|import type { FeedItem } from "../lib/feedStorage";
11|import { markFeedItemSaved } from "../lib/feedStorage";
12|import { textDirection } from "../lib/textDirection";
13|import { newsReaderThemeClasses } from "../lib/newsReaderPrefs";
14|import { isTelegramArticleLink } from "../lib/telegramFeed";
15|import { useNewsReaderPrefs } from "../hooks/useNewsReaderPrefs";
16|import NewsReaderSettingsPanel from "./NewsReaderSettingsPanel";
17|
18|interface FeedArticleReaderProps {
19|  item: FeedItem;
20|  queue?: FeedItem[];
21|  userId?: string;
22|  onClose: () => void;
23|  onOpenItem?: (item: FeedItem) => void;
24|  onSaved?: () => void | Promise<void>;
25|}
26|
27|interface StackEntry {
28|  item: FeedItem;
29|  title: string;
30|  html: string;
31|  ready: boolean;
32|  error?: string;
33|}
34|
35|function entryFromCache(feedItem: FeedItem): StackEntry | null {
36|  const cached = peekFeedArticle(feedItem);
37|  if (!cached) return null;
38|  return {
39|    item: feedItem,
40|    title: cached.title || feedItem.title,
41|    html: cached.htmlContent || "",
42|    ready: true,
43|  };
44|}
45|
46|function placeholderEntry(feedItem: FeedItem): StackEntry {
47|  return {
48|    item: feedItem,
49|    title: feedItem.title,
50|    html: "",
51|    ready: false,
52|  };
53|}
54|
55|export default function FeedArticleReader({
56|  item,
57|  queue = [],
58|  userId,
59|  onClose,
60|  onOpenItem,
61|  onSaved,
62|}: FeedArticleReaderProps) {
63|  const [stack, setStack] = useState<StackEntry[]>([]);
64|  const [saving, setSaving] = useState(false);
65|  const { prefs, updatePrefs } = useNewsReaderPrefs();
66|  const [showSettings, setShowSettings] = useState(false);
67|  const [chromeVisible, setChromeVisible] = useState(true);
68|
69|  const scrollRef = useRef<HTMLDivElement>(null);
70|  const articleNodeRefs = useRef(new Map<string, HTMLElement>());
71|  const syncFromScrollRef = useRef(false);
72|  const hasUserScrolledRef = useRef(false);
73|  const sessionStartIdRef = useRef(item.id);
74|  const loadingIdsRef = useRef(new Set<string>());
75|
76|  const theme = useMemo(() => newsReaderThemeClasses(prefs.theme), [prefs.theme]);
77|
78|  const activeEntry = useMemo(
79|    () => stack.find((entry) => entry.item.id === item.id) || stack[0] || null,
80|    [stack, item.id]
81|  );
82|
83|  const fillEntry = useCallback(async (feedItem: FeedItem, force = false) => {
84|    if (!force && loadingIdsRef.current.has(feedItem.id)) return;
85|    loadingIdsRef.current.add(feedItem.id);
86|    try {
87|      const resolved = await resolveFeedArticle(feedItem);
88|      setStack((prev) => {
89|        const inStack = prev.some((entry) => entry.item.id === feedItem.id);
90|        const nextEntry: StackEntry = {
91|          item: feedItem,
92|          title: resolved.title || feedItem.title,
93|          html: resolved.htmlContent || "",
94|          ready: true,
95|        };
96|        if (!inStack) return prev.length ? prev : [nextEntry];
97|        return prev.map((entry) => (entry.item.id === feedItem.id ? nextEntry : entry));
98|      });
99|    } catch (err) {
100|      setStack((prev) => {
101|        const message = (err as Error).message || "Could not load this article.";
102|        if (!prev.some((entry) => entry.item.id === feedItem.id)) {
103|          return [{ ...placeholderEntry(feedItem), ready: true, error: message }];
104|        }
105|        return prev.map((entry) =>
106|          entry.item.id === feedItem.id
107|            ? { ...entry, ready: true, error: message }
108|            : entry
109|        );
110|      });
111|    } finally {
112|      loadingIdsRef.current.delete(feedItem.id);
113|    }
114|  }, []);
115|
116|  // Fresh open / jump to an article that isn't already in the continuous stack.
117|  useEffect(() => {
118|    const existing = stack.find((entry) => entry.item.id === item.id);
119|    if (existing) {
120|      // Retry stuck placeholders (previous fetch dropped or hung).
121|      if (!existing.ready && !existing.error) {
122|        void fillEntry(item, true);
123|      }
124|      return;
125|    }
126|
127|    sessionStartIdRef.current = item.id;
128|    hasUserScrolledRef.current = false;
129|    const cached = entryFromCache(item);
130|    setStack([cached || placeholderEntry(item)]);
131|    scrollRef.current?.scrollTo({ top: 0 });
132|
133|    if (!cached) {
134|      void fillEntry(item, true);
135|    }
136|    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to external item jumps
137|  }, [item.id, fillEntry]);
138|
139|  // Append at most ONE next story when the user is near the end — never walk the whole queue
140|  // (that used to flood /api/convert-url → 503).
141|  const appendNextIfNeeded = useCallback(() => {
142|    if (!queue.length) return;
143|    const last = stack[stack.length - 1];
144|    if (!last) return;
145|    const lastIdx = queue.findIndex((entry) => entry.id === last.item.id);
146|    if (lastIdx < 0 || lastIdx >= queue.length - 1) return;
147|    const nextItem = queue[lastIdx + 1];
148|    if (stack.some((s) => s.item.id === nextItem.id)) return;
149|
150|    setStack((prev) => {
151|      if (prev.some((entry) => entry.item.id === nextItem.id)) return prev;
152|      return [...prev, entryFromCache(nextItem) || placeholderEntry(nextItem)];
153|    });
154|    if (!peekFeedArticle(nextItem)) {
155|      void fillEntry(nextItem);
156|    }
157|  }, [queue, stack, fillEntry]);
158|
159|  // Prefetch only the immediate next article (cache warm, no convert-url storm).
160|  useEffect(() => {
161|    const idx = queue.findIndex((entry) => entry.id === item.id);
162|    if (idx < 0) return;
163|    void prefetchFeedArticles(queue.slice(idx + 1, idx + 2), 1);
164|  }, [queue, item.id]);
165|
166|  // As the user scrolls, the most visible article becomes the active one — no remount.
167|  useEffect(() => {
168|    if (!onOpenItem || stack.length < 2) return;
169|    const root = scrollRef.current;
170|    if (!root) return;
171|
172|    const ratios = new Map<string, number>();
173|
174|    const observer = new IntersectionObserver(
175|      (entries) => {
176|        for (const entry of entries) {
177|          const id = (entry.target as HTMLElement).dataset.articleId;
178|          if (!id) continue;
179|          ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
180|        }
181|
182|        let bestId: string | null = null;
183|        let bestRatio = 0;
184|        for (const [id, ratio] of ratios) {
185|          if (ratio > bestRatio) {
186|            bestRatio = ratio;
187|            bestId = id;
188|          }
189|        }
190|
191|        if (!bestId || bestRatio < 0.45 || bestId === item.id) return;
192|        // Avoid jumping active story while the opening article is still settling.
193|        if (!hasUserScrolledRef.current && bestId !== sessionStartIdRef.current) return;
194|        const next = stack.find((entry) => entry.item.id === bestId);
195|        if (!next) return;
196|
197|        syncFromScrollRef.current = true;
198|        onOpenItem(next.item);
199|      },
200|      {
201|        root,
202|        threshold: [0.25, 0.45, 0.65, 0.85],
203|        rootMargin: "-10% 0px -10% 0px",
204|      }
205|    );
206|
207|    for (const entry of stack) {
208|      const node = articleNodeRefs.current.get(entry.item.id);
209|      if (node) observer.observe(node);
210|    }
211|
212|    return () => observer.disconnect();
213|  }, [stack, item.id, onOpenItem]);
214|
215|  // If parent changes active item without scroll (e.g. tap next card), ease to it.
216|  useEffect(() => {
217|    if (syncFromScrollRef.current) {
218|      syncFromScrollRef.current = false;
219|      return;
220|    }
221|    const node = articleNodeRefs.current.get(item.id);
222|    if (!node || !stack.some((entry) => entry.item.id === item.id)) return;
223|    node.scrollIntoView({ behavior: "auto", block: "start" });
224|  }, [item.id, stack]);
225|
226|  const handleSave = async () => {
227|    const target = activeEntry?.item || item;
228|    setSaving(true);
229|    try {
230|      const book = await clipUrlToLibrary({
231|        url: target.link,
232|        userId,
233|        tags: [
234|          "Feed",
235|          target.subscriptionTitle,
236|          ...(isTelegramArticleLink(target.link) ? ["Telegram"] : []),
237|        ],
238|        sourceLabel: target.subscriptionTitle,
239|      });
240|      markFeedItemSaved(target.id, book.id);
241|      await onSaved?.();
242|    } catch (err) {
243|      alert((err as Error).message || "Could not save to library.");
244|    } finally {
245|      setSaving(false);
246|    }
247|  };
248|
249|  const jumpToEntry = useCallback(
250|    (feedItem: FeedItem) => {
251|      if (!onOpenItem) return;
252|      const node = articleNodeRefs.current.get(feedItem.id);
253|      if (node) {
254|        syncFromScrollRef.current = true;
255|        onOpenItem(feedItem);
256|        node.scrollIntoView({ behavior: "auto", block: "start" });
257|        return;
258|      }
259|      onOpenItem(feedItem);
260|    },
261|    [onOpenItem]
262|  );
263|
264|  const bootstrapping = stack.length === 0 || (stack.length === 1 && !stack[0].ready && !stack[0].error);
265|  const activeLink = activeEntry?.item.link || item.link;
266|
267|  return (
268|    <div
269|      className={`fixed inset-0 z-[9999] flex flex-col ${theme.shell}`}
270|      style={{
271|        width: "100vw",
272|        height: "100dvh",
273|        maxHeight: "100dvh",
274|        filter: prefs.brightness < 100 ? `brightness(${prefs.brightness}%)` : undefined,
275|      }}
276|    >
277|      {/* Side action rail (right edge) — keeps controls clear of the status bar */}
278|      <div
279|        className={`absolute z-20 right-[max(0.5rem,var(--kora-safe-right))] top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 transition-opacity duration-200 ${
280|          chromeVisible || showSettings ? "opacity-100" : "opacity-0"
281|        }`}
282|      >
283|        <button
284|          type="button"
285|          onClick={onClose}
286|          className={`pointer-events-auto p-2.5 rounded-full ${theme.header} border ${theme.border} shadow-lg backdrop-blur-md`}
287|          aria-label="Back"
288|        >
289|          <ChevronLeft className="w-5 h-5" />
290|        </button>
291|        <button
292|          type="button"
293|          onClick={() => setShowSettings((v) => !v)}
294|          className={`pointer-events-auto p-2.5 rounded-full ${theme.header} border ${theme.border} shadow-lg backdrop-blur-md`}
295|          aria-label="News reader settings"
296|          aria-pressed={showSettings}
297|        >
298|          <Settings2 className="w-4 h-4" />
299|        </button>
300|        <button
301|          type="button"
302|          onClick={() => void handleSave()}
303|          disabled={saving || !activeEntry?.ready || !!activeEntry?.error}
304|          className={`pointer-events-auto p-2.5 rounded-full ${theme.header} border ${theme.border} shadow-lg backdrop-blur-md disabled:opacity-50`}
305|          aria-label="Save to library"
306|        >
307|          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bookmark className="w-4 h-4" />}
308|        </button>
309|        <a
310|          href={activeLink}
311|          target="_blank"
312|          rel="noopener noreferrer"
313|          className={`pointer-events-auto p-2.5 rounded-full ${theme.header} border ${theme.border} shadow-lg backdrop-blur-md`}
314|          aria-label="Open original"
315|        >
316|          <ExternalLink className="w-4 h-4" />
317|        </a>
318|      </div>
319|
320|      <div
321|        ref={scrollRef}
322|        className="flex-1 overflow-y-auto overscroll-y-contain min-h-0"
323|        style={{
324|          scrollSnapType: "y mandatory",
325|          WebkitOverflowScrolling: "touch",
326|        }}
327|        onScroll={() => {
328|          const el = scrollRef.current;
329|          if (!el) return;
330|          if (el.scrollTop > 24) hasUserScrolledRef.current = true;
331|          // Near end of current stack → append next story (TikTok-style endless feed).
332|          if (el.scrollTop + el.clientHeight > el.scrollHeight - el.clientHeight * 0.85) {
333|            appendNextIfNeeded();
334|          }
335|        }}
336|        onClick={() => {
337|          if (showSettings) {
338|            setShowSettings(false);
339|            return;
340|          }
341|          setChromeVisible((v) => !v);
342|        }}
343|      >
344|        {bootstrapping ? (
345|          <div className={`h-full flex flex-col items-center justify-center gap-3 ${theme.muted}`}>
346|            <Loader2 className="w-8 h-8 animate-spin" />
347|            <p className="text-xs font-sans">Loading article…</p>
348|          </div>
349|        ) : (
350|          <>
351|            {stack.map((entry, index) => {
352|              const isTelegram = isTelegramArticleLink(entry.item.link);
353|              const displayHtml = entry.ready
354|                ? prepareFeedArticleHtml(entry.html, entry.title || entry.item.title)
355|                : "";
356|              const titleDir = textDirection(entry.title || entry.item.title);
357|
358|              return (
359|                <section
360|                  key={entry.item.id}
361|                  data-article-id={entry.item.id}
362|                  ref={(node) => {
363|                    if (node) articleNodeRefs.current.set(entry.item.id, node);
364|                    else articleNodeRefs.current.delete(entry.item.id);
365|                  }}
366|                  className={`mx-auto ${prefs.marginSize} min-h-full flex flex-col ${
367|                    index === 0 ? "pt-[calc(var(--kora-safe-top)+3.5rem)]" : "pt-8"
368|                  } pb-[calc(var(--kora-safe-bottom)+5rem)]`}
369|                  style={{
370|                    scrollSnapAlign: "start",
371|                    scrollSnapStop: "always",
372|                  }}
373|                  onClick={(e) => {
374|                    if (showSettings) {
375|                      setShowSettings(false);
376|                      e.stopPropagation();
377|                    } else {
378|                      e.stopPropagation();
379|                    }
380|                  }}
381|                >
382|                  <div className="mb-5 space-y-1">
383|                    <p className={`text-[9px] font-bold uppercase tracking-widest ${theme.muted}`}>
384|                      {entry.item.subscriptionTitle}
385|                      {isTelegram ? " · Telegram" : ""}
386|                    </p>
387|                    <h1
388|                      dir={titleDir}
389|                      className={`text-xl md:text-2xl font-lexend font-bold leading-snug ${
390|                        titleDir === "rtl" ? "font-thaana" : ""
391|                      }`}
392|                    >
393|                      {entry.title || entry.item.title}
394|                    </h1>
395|                  </div>
396|
397|                  {!entry.ready ? (
398|                    <div className="space-y-4 py-4">
399|                      {entry.item.summary ? (
400|                        <p className={`text-sm leading-relaxed ${theme.muted}`}>{entry.item.summary}</p>
401|                      ) : null}
402|                      <div className={`flex items-center gap-2 ${theme.muted}`}>
403|                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
404|                        <p className="text-xs font-sans">Loading full article…</p>
405|                      </div>
406|                      <button
407|                        type="button"
408|                        onClick={() => void fillEntry(entry.item, true)}
409|                        className="text-[10px] font-bold uppercase tracking-wider underline opacity-70"
410|                      >
411|                        Retry
412|                      </button>
413|                    </div>
414|                  ) : entry.error ? (
415|                    <div className="space-y-3 py-6">
416|                      <p className="text-sm text-red-400">{entry.error}</p>
417|                      {entry.item.summary ? (
418|                        <p className={`text-sm leading-relaxed ${theme.muted}`}>{entry.item.summary}</p>
419|                      ) : null}
420|                      <div className="flex flex-wrap items-center gap-3">
421|                        <button
422|                          type="button"
423|                          onClick={() => void fillEntry(entry.item, true)}
424|                          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
425|                        >
426|                          <Loader2 className="w-4 h-4" />
427|                          Retry
428|                        </button>
429|                      <a
430|                        href={entry.item.link}
431|                        target="_blank"
432|                        rel="noopener noreferrer"
433|                        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
434|                      >
435|                        <ExternalLink className="w-4 h-4" />
436|                        Open in browser
437|                      </a>
438|                      </div>
439|                    </div>
440|                  ) : (
441|                    <div
442|                      dir="auto"
443|                      className={`feed-article-content max-w-none ${prefs.fontFamily} ${theme.content} [&_*]:[unicode-bidi:plaintext] animate-in fade-in duration-200`}
444|                      style={{
445|                        fontSize: `${prefs.fontSize}px`,
446|                        lineHeight: prefs.lineSpacing,
447|                        ["--news-paragraph-gap" as string]: `${prefs.paragraphSpacing}em`,
448|                      }}
449|                      dangerouslySetInnerHTML={{ __html: displayHtml }}
450|                    />
451|                  )}
452|                </section>
453|              );
454|            })}
455|
456|            <div
457|              className={`mx-auto px-6 pb-[calc(var(--kora-safe-bottom)+4rem)] pt-2 ${prefs.marginSize}`}
458|              onClick={(e) => e.stopPropagation()}
459|            >
460|              {(() => {
461|                const last = stack[stack.length - 1];
462|                const lastIdx = last ? queue.findIndex((entry) => entry.id === last.item.id) : -1;
463|                const nextQueued =
464|                  lastIdx >= 0 && lastIdx < queue.length - 1 ? queue[lastIdx + 1] : null;
465|                const nextInStack = nextQueued
466|                  ? stack.find((entry) => entry.item.id === nextQueued.id)
467|                  : null;
468|
469|                if (nextInStack && !nextInStack.ready && !nextInStack.error) {
470|                  return (
471|                    <div className={`flex items-center justify-center gap-2 py-6 ${theme.muted}`}>
472|                      <Loader2 className="w-4 h-4 animate-spin" />
473|                      <p className="text-[10px] font-bold uppercase tracking-widest">
474|                        Preparing next…
475|                      </p>
476|                    </div>
477|                  );
478|                }
479|
480|                if (nextQueued) {
481|                  return (
482|                    <button
483|                      type="button"
484|                      onClick={() => {
485|                        appendNextIfNeeded();
486|                        // Jump immediately — don't wait for convert-url to finish.
487|                        requestAnimationFrame(() => jumpToEntry(nextQueued));
488|                      }}
489|                      className={`w-full text-left rounded-2xl border ${theme.border} ${theme.header} px-4 py-4 shadow-sm transition-transform active:scale-[0.98]`}
490|                    >
491|                      <p className={`text-[9px] font-bold uppercase tracking-[0.2em] ${theme.muted}`}>
492|                        Swipe up · Next
493|                      </p>
494|                      <p
495|                        dir={textDirection(nextQueued.title)}
496|                        className={`mt-1 text-sm font-lexend font-bold leading-snug line-clamp-2 ${
497|                          textDirection(nextQueued.title) === "rtl" ? "font-thaana" : ""
498|                        }`}
499|                      >
500|                        {nextQueued.title}
501|                      </p>
502|                      <p className={`mt-1 text-[10px] ${theme.muted}`}>{nextQueued.subscriptionTitle}</p>
503|                    </button>
504|                  );
505|                }
506|
507|                return (
508|                  <p className={`text-center text-[10px] font-bold uppercase tracking-widest ${theme.muted}`}>
509|                    End of feed
510|                  </p>
511|                );
512|              })()}
513|            </div>
514|          </>
515|        )}
516|      </div>
517|      {showSettings ? <NewsReaderSettingsPanel prefs={prefs} onChange={updatePrefs} /> : null}
518|    </div>
519|  );
520|}
521|
```


## Feed tab shell (cards, filters, sources)

**`src/components/FeedView.tsx`** (lines 1-1094)

```tsx
1|import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
2|import { useAndroidBackLayer } from "../hooks/useAndroidBackLayer";
3|import {
4|  AlertCircle,
5|  Bookmark,
6|  CheckCircle2,
7|  ExternalLink,
8|  Grid,
9|  Loader2,
10|  Newspaper,
11|  RefreshCw,
12|  Rss,
13|  Settings2,
14|  GalleryVertical,
15|  Trash2,
16|  X,
17|} from "lucide-react";
18|import { toast } from "react-hot-toast";
19|import type { BookMetadata } from "../lib/firebase";
20|import { prefetchFeedArticles } from "../lib/feedArticle";
21|import {
22|  addFeedSubscription,
23|  ensureDefaultSubscriptions,
24|  FeedItem,
25|  FeedSubscription,
26|  getFeedItems,
27|  isCuratedFeedUrl,
28|  isDefaultFeedUrl,
29|  isFeedSubscriptionEnabled,
30|  isInternationalFeedUrl,
31|  markFeedItemRead,
32|  markFeedItemSaved,
33|  mergeFeedItems,
34|  removeFeedSubscription,
35|  saveFeedSubscriptions,
36|  setFeedSubscriptionEnabled,
37|} from "../lib/feedStorage";
38|import { discoverFeed, refreshAllSubscriptions } from "../lib/feedClient";
39|import { clipUrlToLibrary } from "../lib/feedClipper";
40|import { isTelegramArticleLink } from "../lib/telegramFeed";
41|import { isFeedItemWithinRetention } from "../lib/feedNormalize";
42|import { getItemThumbnail, markFeedImageBroken, prefetchFeedPreviews } from "../lib/feedPreview";
43|import { briefPayloadFromFeeds, syncAndroidHomeWidgets } from "../lib/androidWidgets";
44|import { textDirection } from "../lib/textDirection";
45|import FeedArticleReader from "./FeedArticleReader";
46|import NewsInBriefPanel from "./NewsInBriefPanel";
47|import TodayNewsBriefCard from "./TodayNewsBriefCard";
48|import FeedTikTokScroll from "./FeedTikTokScroll";
49|import DailyBriefTikTokView from "./DailyBriefTikTokView";
50|
51|interface FeedViewProps {
52|  userId?: string;
53|  onRefreshLibrary?: () => void | Promise<void>;
54|  onOpenBook?: (book: BookMetadata) => void;
55|  initialUrl?: string | null;
56|  onClearInitialUrl?: () => void;
57|  grayscaleCovers?: boolean;
58|  initialFilter?: string | null;
59|  onClearInitialFilter?: () => void;
60|}
61|
62|type FeedFilter = "all" | "unread" | "saved" | "briefs";
63|/** Feed layout: classic card grid or TikTok-style vertical scroll. */
64|type FeedLayout = "grid" | "scroll";
65|/** Only two card sizes: full-width hero + half-width tile. */
66|type BentoVariant = "featured" | "default";
67|
68|function SourceToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
69|  return (
70|    <button
71|      type="button"
72|      onClick={onClick}
73|      className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
74|        on ? "bg-kindle-accent" : "bg-kindle-accent/25"
75|      }`}
76|      aria-pressed={on}
77|      aria-label={on ? "Turn source off" : "Turn source on"}
78|    >
79|      <div
80|        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow-sm transition-transform ${
81|          on ? "translate-x-5 bg-kindle-bg" : "translate-x-0 bg-kindle-text/70"
82|        }`}
83|      />
84|    </button>
85|  );
86|}
87|
88|function formatFeedDate(timestamp: number): string {
89|  const date = new Date(timestamp);
90|  const now = new Date();
91|  const diff = Date.now() - timestamp;
92|  const minutes = Math.floor(diff / 60000);
93|  if (minutes < 1) return "just now";
94|  if (minutes < 60) return `${minutes}m ago`;
95|  const hours = Math.floor(minutes / 60);
96|  if (hours < 24) return `${hours}h ago`;
97|  const days = Math.floor(hours / 24);
98|  if (days < 7) return `${days}d ago`;
99|  return date.toLocaleDateString(undefined, {
100|    month: "short",
101|    day: "numeric",
102|    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
103|  });
104|}
105|
106|function displayTitle(item: FeedItem): string {
107|  const title = item.title.trim();
108|  if (title && !/^(article url|comments url|link|untitled)$/i.test(title)) return title;
109|  try {
110|    const host = new URL(item.link).hostname.replace(/^www\./, "");
111|    return host || title;
112|  } catch {
113|    return title;
114|  }
115|}
116|
117|function getBentoVariant(index: number): BentoVariant {
118|  // Hero every 5th card (starting at 0); everything else is a half-width tile.
119|  return index % 5 === 0 ? "featured" : "default";
120|}
121|
122|const FeedArticleCard = React.memo(function FeedArticleCard({
123|  item,
124|  cover,
125|  busy,
126|  title,
127|  variant,
128|  grayscaleCovers,
129|  onRead,
130|  onToggleRead,
131|  onSaveLater,
132|}: {
133|  item: FeedItem;
134|  cover: string | null;
135|  busy: boolean;
136|  title: string;
137|  variant: BentoVariant;
138|  grayscaleCovers?: boolean;
139|  onRead: () => void;
140|  onToggleRead: () => void;
141|  onSaveLater: () => void;
142|}) {
143|  const [thumbFailed, setThumbFailed] = useState(false);
144|  const showThumb = cover && !thumbFailed;
145|  const dir = textDirection(title);
146|
147|  const cardClass = variant === "featured" ? "sm:col-span-2" : "sm:col-span-1";
148|  const imageClass =
149|    variant === "featured" ? "w-full aspect-[16/9]" : "w-full aspect-[4/3]";
150|
151|  // Manual swipe (no Framer Motion on the card) — Android WebView blinks text when
152|  // every feed card keeps a compositor transform layer during vertical scroll.
153|  const [dragX, setDragX] = useState(0);
154|  const [isDragging, setIsDragging] = useState(false);
155|  const swipeRef = useRef<{ x: number; y: number; active: boolean } | null>(null);
156|
157|  const finishSwipe = (dx: number) => {
158|    setIsDragging(false);
159|    setDragX(0);
160|    swipeRef.current = null;
161|    const threshold = 120;
162|    if (dx > threshold) onToggleRead();
163|    else if (dx < -threshold) onSaveLater();
164|  };
165|
166|  const onCardPointerDown = (e: React.PointerEvent) => {
167|    if (e.button !== 0) return;
168|    swipeRef.current = { x: e.clientX, y: e.clientY, active: false };
169|  };
170|
171|  const onCardPointerMove = (e: React.PointerEvent) => {
172|    const start = swipeRef.current;
173|    if (!start) return;
174|    const dx = e.clientX - start.x;
175|    const dy = e.clientY - start.y;
176|    if (!start.active) {
177|      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
178|      // Vertical scroll wins — abandon swipe so list scrolling stays smooth.
179|      if (Math.abs(dy) >= Math.abs(dx)) {
180|        swipeRef.current = null;
181|        setIsDragging(false);
182|        setDragX(0);
183|        return;
184|      }
185|      start.active = true;
186|      setIsDragging(true);
187|      try {
188|        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
189|      } catch {
190|        /* ignore */
191|      }
192|    }
193|    setDragX(Math.max(-160, Math.min(160, dx)));
194|  };
195|
196|  const onCardPointerUp = (e: React.PointerEvent) => {
197|    const start = swipeRef.current;
198|    if (!start) return;
199|    const dx = e.clientX - start.x;
200|    if (start.active) finishSwipe(dx);
201|    else {
202|      swipeRef.current = null;
203|      // Tap (no horizontal drag) → open article
204|      if (Math.abs(dx) < 10 && Math.abs(e.clientY - start.y) < 10) onRead();
205|    }
206|  };
207|
208|  const onCardPointerCancel = () => {
209|    swipeRef.current = null;
210|    setIsDragging(false);
211|    setDragX(0);
212|  };
213|
214|  const leftReveal = Math.max(0, Math.min(1, dragX / 60));
215|  const rightReveal = Math.max(0, Math.min(1, -dragX / 60));
216|
217|  return (
218|    <div className={`relative overflow-hidden rounded-2xl ${cardClass} flex flex-col h-full select-none`}>
219|      {/* Swipe underlay — only while dragging */}
220|      {isDragging ? (
221|      <div
222|        className="absolute inset-0 z-0 bg-kindle-bg border border-kindle-border rounded-2xl flex items-center justify-between px-6 pointer-events-none"
223|        aria-hidden
224|      >
225|        <div
226|          style={{ opacity: leftReveal }}
227|          className="flex items-center gap-2 text-kindle-text font-bold text-xs"
228|        >
229|          <div className="p-1.5 rounded-full bg-kindle-card border border-kindle-border shadow-sm">
230|            <CheckCircle2 className="w-5 h-5 text-kindle-text" />
231|          </div>
232|          <span>{item.read ? "Mark Unread" : "Mark Read"}</span>
233|        </div>
234|        <div
235|          style={{ opacity: rightReveal }}
236|          className="flex items-center gap-2 text-kindle-accent font-bold text-xs ml-auto"
237|        >
238|          <span>{item.savedBookId ? "Saved" : "Save to Library"}</span>
239|          <div className="p-1.5 rounded-full bg-kindle-card border border-kindle-border shadow-sm">
240|            <Bookmark className="w-5 h-5 text-kindle-accent" />
241|          </div>
242|        </div>
243|      </div>
244|      ) : null}
245|
246|      {/* Plain article — transform only while swiping (no idle compositor layer) */}
247|      <article
248|        onPointerDown={onCardPointerDown}
249|        onPointerMove={onCardPointerMove}
250|        onPointerUp={onCardPointerUp}
251|        onPointerCancel={onCardPointerCancel}
252|        style={isDragging ? { transform: `translate3d(${dragX}px,0,0)` } : undefined}
253|        className={`feed-article-card relative z-10 bg-kindle-card border rounded-2xl overflow-hidden transition-shadow cursor-pointer hover:border-kindle-text/40 hover:shadow-md flex flex-col flex-1 touch-pan-y ${
254|          item.read
255|            ? "border-kindle-border text-kindle-text-muted"
256|            : "border-kindle-border shadow-sm"
257|        }`}
258|      >
259|        <div className="flex flex-col flex-1 min-h-0">
260|          <div
261|            className={`relative bg-kindle-bg border-b border-kindle-border overflow-hidden text-left ${imageClass}`}
262|          >
263|            {showThumb ? (
264|              <img
265|                src={cover}
266|                alt=""
267|                className={`w-full h-full object-cover pointer-events-none ${
268|                  grayscaleCovers ? "grayscale" : ""
269|                }`}
270|                referrerPolicy="no-referrer"
271|                loading="lazy"
272|                onError={() => {
273|                  setThumbFailed(true);
274|                  markFeedImageBroken(item.id);
275|                }}
276|              />
277|            ) : (
278|              <div className="w-full h-full flex items-center justify-center bg-kindle-bg">
279|                <Rss className="w-6 h-6 text-kindle-text-muted/40" />
280|              </div>
281|            )}
282|            {!item.read && (
283|              <span className="absolute top-2 left-2 w-2 h-2 rounded-full bg-kindle-text shadow-sm" />
284|            )}
285|          </div>
286|
287|          <div className="flex flex-col flex-1 p-3 sm:p-4 pb-4 sm:pb-5 gap-2 sm:gap-3 min-w-0">
288|            <div className="min-w-0 flex-1">
289|              <p className="text-[9px] font-bold uppercase tracking-widest text-kindle-text-muted truncate mb-1">
290|                {item.subscriptionTitle} · {formatFeedDate(item.publishedAt)}
291|              </p>
292|              <h3
293|                dir={dir}
294|                className={`font-lexend font-bold leading-snug ${
295|                  item.read ? "text-kindle-text-muted" : "text-kindle-text"
296|                } ${dir === "rtl" ? "font-thaana" : ""} ${
297|                  variant === "featured" ? "text-base sm:text-lg" : "text-sm"
298|                }`}
299|              >
300|                {title}
301|              </h3>
302|              {item.summary && !/^(article url|comments url)/i.test(item.summary) && (
303|                <p
304|                  dir={textDirection(item.summary)}
305|                  className={`text-kindle-text-muted mt-1.5 leading-relaxed ${
306|                    variant === "featured" ? "text-xs" : "text-[11px]"
307|                  }`}
308|                >
309|                  {item.summary}
310|                </p>
311|              )}
312|            </div>
313|
314|            <div
315|              className="flex items-center gap-1.5 mt-auto min-w-0"
316|              onClick={(e) => e.stopPropagation()}
317|              onPointerDown={(e) => e.stopPropagation()}
318|            >
319|              <button
320|                onClick={onRead}
321|                disabled={busy}
322|                className="hidden sm:flex flex-1 items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-kindle-text text-kindle-bg text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition disabled:opacity-50 min-w-0"
323|              >
324|                {busy ? <Loader2 className="w-3 h-3 animate-spin shrink-0" /> : <Newspaper className="w-3.5 h-3.5 shrink-0" />}
325|                <span className="truncate">Read</span>
326|              </button>
327|              <button
328|                onClick={onToggleRead}
329|                className="flex-1 px-2.5 py-1.5 rounded-xl border border-kindle-border text-[10px] font-bold uppercase tracking-wider text-kindle-text-muted hover:text-kindle-text hover:bg-kindle-bg transition min-w-0"
330|                title={item.read ? "Mark unread" : "Mark read"}
331|              >
332|                <span className="truncate">{item.read ? "Unread" : "Done"}</span>
333|              </button>
334|              <a
335|                href={item.link}
336|                target="_blank"
337|                rel="noopener noreferrer"
338|                className="p-1.5 rounded-xl border border-kindle-border text-kindle-text-muted hover:text-kindle-text hover:bg-kindle-bg transition shrink-0 flex items-center justify-center"
339|                title="Open original"
340|              >
341|                <ExternalLink className="w-3.5 h-3.5" />
342|              </a>
343|            </div>
344|
345|            {item.savedBookId && (
346|              <p className="text-[9px] text-emerald-600 flex items-center gap-1">
347|                <CheckCircle2 className="w-3 h-3" />
348|                Saved to library
349|              </p>
350|            )}
351|          </div>
352|        </div>
353|      </article>
354|    </div>
355|  );
356|});
357|
358|
359|function FeedView({
360|  userId = "",
361|  onRefreshLibrary,
362|  onOpenBook,
363|  initialUrl,
364|  onClearInitialUrl,
365|  grayscaleCovers = false,
366|  initialFilter,
367|  onClearInitialFilter,
368|}: FeedViewProps) {
369|  const [subscriptions, setSubscriptions] = useState<FeedSubscription[]>([]);
370|  const [items, setItems] = useState<FeedItem[]>([]);
371|  const [filter, setFilter] = useState<FeedFilter>("all");
372|  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);
373|  const [refreshing, setRefreshing] = useState(false);
374|  const [refreshError, setRefreshError] = useState<string | null>(null);
375|  const [showManageFeeds, setShowManageFeeds] = useState(false);
376|  const [addFeedUrl, setAddFeedUrl] = useState("");
377|  const [addFeedError, setAddFeedError] = useState<string | null>(null);
378|  const [addingFeed, setAddingFeed] = useState(false);
379|  const [readingArticle, setReadingArticle] = useState<FeedItem | null>(null);
380|  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth < 768 : false);
381|
382|  useEffect(() => {
383|    const handleResize = () => setIsMobile(window.innerWidth < 768);
384|    window.addEventListener("resize", handleResize);
385|    return () => window.removeEventListener("resize", handleResize);
386|  }, []);
387|
388|  const [feedLayout, setFeedLayout] = useState<FeedLayout>(() => {
389|    const v = localStorage.getItem("kora_feed_layout");
390|    if (v === "scroll" || v === "grid") return v;
391|    // Mobile defaults to the immersive vertical scroll feed; desktop to grid.
392|    return window.innerWidth < 768 ? "scroll" : "grid";
393|  });
394|
395|  const persistFeedLayout = (next: FeedLayout) => {
396|    setFeedLayout(next);
397|    localStorage.setItem("kora_feed_layout", next);
398|  };
399|
400|  const performanceMode = localStorage.getItem("kora_performance_mode") === "1";
401|
402|  const effectiveLayout: FeedLayout = feedLayout;
403|
404|  const [showFilterSheet, setShowFilterSheet] = useState(false);
405|
406|  const headerRef = useRef<HTMLElement>(null);
407|  const filterRef = useRef<HTMLDivElement>(null);
408|  const sourcesRef = useRef<HTMLDivElement>(null);
409|  const [scrollContainerHeight, setScrollContainerHeight] = useState<number | null>(null);
410|
411|  const dismissFeedArticle = useAndroidBackLayer(!!readingArticle, "feed-article", () => setReadingArticle(null));
412|  const dismissManageFeeds = useAndroidBackLayer(showManageFeeds, "feed-manage", () => setShowManageFeeds(false));
413|  const [showDailyBriefTikTok, setShowDailyBriefTikTok] = useState(false);
414|  const dismissDailyBriefTikTok = useAndroidBackLayer(showDailyBriefTikTok, "feed-daily-brief-tiktok", () => setShowDailyBriefTikTok(false));
415|
416|  const loadLocalState = useCallback(() => {
417|    const subs = ensureDefaultSubscriptions();
418|    setSubscriptions(subs);
419|    setItems(getFeedItems());
420|  }, []);
421|
422|  const enrichFeedItems = useCallback(async (merged: FeedItem[]) => {
423|    try {
424|      const withPreviews = await prefetchFeedPreviews(merged, 20);
425|      setItems(withPreviews);
426|      void prefetchFeedArticles(withPreviews.slice(0, 2), 1);
427|    } catch {
428|      setItems(merged);
429|    }
430|  }, []);
431|
432|  const refreshFeeds = useCallback(async () => {
433|    const subs = ensureDefaultSubscriptions();
434|    setSubscriptions(subs);
435|    const activeSubs = subs.filter(isFeedSubscriptionEnabled);
436|    setRefreshing(true);
437|    setRefreshError(null);
438|    try {
439|      const incoming = await refreshAllSubscriptions(activeSubs);
440|      if (incoming.length === 0) {
441|        setRefreshError("Couldn't load feeds. The news service may be unreachable — pull to refresh or tap retry.");
442|      }
443|      const merged = mergeFeedItems(incoming);
444|      setItems(merged);
445|      void syncAndroidHomeWidgets({ brief: briefPayloadFromFeeds() });
446|      const fetchedIds = new Set(activeSubs.map((sub) => sub.id));
447|      saveFeedSubscriptions(
448|        subs.map((sub) =>
449|          fetchedIds.has(sub.id) ? { ...sub, lastFetchedAt: Date.now() } : sub
450|        )
451|      );
452|      void enrichFeedItems(merged);
453|    } catch (error) {
454|      console.error("Feed refresh failed:", error);
455|      setRefreshError("Feed refresh failed. Check your connection and try again.");
456|    } finally {
457|      setRefreshing(false);
458|    }
459|  }, [enrichFeedItems]);
460|
461|  useEffect(() => {
462|    loadLocalState();
463|    const subs = ensureDefaultSubscriptions();
464|    const activeSubs = subs.filter(isFeedSubscriptionEnabled);
465|    const newestFetch = Math.max(0, ...activeSubs.map((sub) => sub.lastFetchedAt || 0));
466|    const hasNeverFetched = activeSubs.some((sub) => !sub.lastFetchedAt);
467|    // Skip network refresh when feeds were fetched recently (keeps first paint snappy),
468|    // but always refresh when a newly enabled source has never been fetched.
469|    if (!hasNeverFetched && newestFetch && Date.now() - newestFetch < 5 * 60 * 1000) {
470|      setItems(getFeedItems());
471|      return;
472|    }
473|    void refreshFeeds();
474|  }, [loadLocalState, refreshFeeds]);
475|
476|  useEffect(() => {
477|    if (!initialUrl?.trim()) return;
478|    const url = initialUrl.trim();
479|    onClearInitialUrl?.();
480|    const syntheticItem: FeedItem = {
481|      id: `shared-${Date.now()}`,
482|      subscriptionId: "shared",
483|      subscriptionTitle: "Shared Link",
484|      title: "Shared Article",
485|      link: url,
486|      publishedAt: Date.now(),
487|      read: false,
488|    };
489|    setReadingArticle(syntheticItem);
490|  }, [initialUrl, onClearInitialUrl]);
491|
492|  useEffect(() => {
493|    if (initialFilter) {
494|      if (initialFilter === "briefs" || initialFilter === "saved" || initialFilter === "unread" || initialFilter === "all") {
495|        setFilter(initialFilter);
496|      }
497|      onClearInitialFilter?.();
498|    }
499|  }, [initialFilter, onClearInitialFilter]);
500|
501|  const enabledSubscriptions = useMemo(
502|    () => subscriptions.filter(isFeedSubscriptionEnabled),
503|    [subscriptions]
504|  );
505|  const enabledSubscriptionIds = useMemo(
506|    () => new Set(enabledSubscriptions.map((sub) => sub.id)),
507|    [enabledSubscriptions]
508|  );
509|  const unreadCount = useMemo(
510|    () => items.filter((item) => !item.read && enabledSubscriptionIds.has(item.subscriptionId)).length,
511|    [items, enabledSubscriptionIds]
512|  );
513|
514|  const retainedItems = useMemo(
515|    () =>
516|      items.filter(
517|        (item) => isFeedItemWithinRetention(item) && enabledSubscriptionIds.has(item.subscriptionId)
518|      ),
519|    [items, enabledSubscriptionIds]
520|  );
521|
522|  const visibleItems = useMemo(() => {
523|    return retainedItems
524|      .filter((item) => {
525|        if (filter === "briefs") return false;
526|        if (selectedSubscriptionId && item.subscriptionId !== selectedSubscriptionId) return false;
527|        if (filter === "unread" && item.read) return false;
528|        if (filter === "saved" && !item.savedBookId) return false;
529|        return true;
530|      })
531|      .sort((a, b) => b.publishedAt - a.publishedAt);
532|  }, [retainedItems, filter, selectedSubscriptionId]);
533|
534|  useEffect(() => {
535|    if (feedLayout !== "scroll") {
536|      setScrollContainerHeight(null);
537|      return;
538|    }
539|
540|    const updateHeight = () => {
541|      const appHeader = document.querySelector(".kora-app-header");
542|      const appHeaderHeight = appHeader ? appHeader.getBoundingClientRect().height : 64;
543|
544|      const feedHeaderHeight = headerRef.current ? headerRef.current.getBoundingClientRect().height : 56;
545|      const filterHeight = filterRef.current ? filterRef.current.getBoundingClientRect().height : 36;
546|      const sourcesHeight = sourcesRef.current ? sourcesRef.current.getBoundingClientRect().height : 40;
547|
548|      const isMobile = window.innerWidth < 768;
549|      let bottomOffset = 0;
550|      if (isMobile) {
551|        const footer = document.querySelector(".kora-mobile-footer");
552|        bottomOffset = footer ? footer.getBoundingClientRect().height + 24 : 80;
553|      } else {
554|        bottomOffset = 32;
555|      }
556|
557|      const mainPaddingTop = isMobile ? 16 : 32;
558|
559|      const mediaDock = document.querySelector(".kora-mobile-media-dock");
560|      const mediaDockHeight = mediaDock ? mediaDock.getBoundingClientRect().height : 0;
561|
562|      const totalUsed = appHeaderHeight + feedHeaderHeight + filterHeight + sourcesHeight + bottomOffset + mainPaddingTop + mediaDockHeight + 16;
563|      const calculated = window.innerHeight - totalUsed;
564|
565|      setScrollContainerHeight(Math.max(calculated, 450));
566|    };
567|
568|    updateHeight();
569|    window.addEventListener("resize", updateHeight);
570|    
571|    const timer1 = setTimeout(updateHeight, 50);
572|    const timer2 = setTimeout(updateHeight, 300);
573|
574|    return () => {
575|      window.removeEventListener("resize", updateHeight);
576|      clearTimeout(timer1);
577|      clearTimeout(timer2);
578|    };
579|  }, [feedLayout, filter, selectedSubscriptionId, visibleItems.length]);
580|
581|  useEffect(() => {
582|    if (feedLayout === "scroll") {
583|      const originalOverflow = document.body.style.overflow;
584|      const originalHeight = document.body.style.height;
585|      
586|      document.body.style.overflow = "hidden";
587|      document.body.style.height = "100%";
588|      
589|      return () => {
590|        document.body.style.overflow = originalOverflow;
591|        document.body.style.height = originalHeight;
592|      };
593|    }
594|  }, [feedLayout]);
595|
596|  const maldivesSources = useMemo(
597|    () => subscriptions.filter((sub) => isDefaultFeedUrl(sub.feedUrl)),
598|    [subscriptions]
599|  );
600|  const internationalSources = useMemo(
601|    () => subscriptions.filter((sub) => isInternationalFeedUrl(sub.feedUrl)),
602|    [subscriptions]
603|  );
604|  const customSources = useMemo(
605|    () => subscriptions.filter((sub) => !isCuratedFeedUrl(sub.feedUrl)),
606|    [subscriptions]
607|  );
608|
609|  const handleToggleSource = useCallback(
610|    async (sub: FeedSubscription) => {
611|      const nextEnabled = !isFeedSubscriptionEnabled(sub);
612|      const next = setFeedSubscriptionEnabled(sub.id, nextEnabled);
613|      setSubscriptions(next);
614|      if (selectedSubscriptionId === sub.id && !nextEnabled) {
615|        setSelectedSubscriptionId(null);
616|      }
617|      if (nextEnabled) {
618|        await refreshFeeds();
619|      }
620|    },
621|    [refreshFeeds, selectedSubscriptionId]
622|  );
623|
624|  const handleAddSubscription = async (e: React.FormEvent) => {
625|    e.preventDefault();
626|    if (!addFeedUrl.trim()) return;
627|    setAddingFeed(true);
628|    setAddFeedError(null);
629|    try {
630|      const discovered = await discoverFeed(addFeedUrl.trim());
631|      addFeedSubscription({
632|        title: discovered.title,
633|        siteUrl: discovered.siteUrl,
634|        feedUrl: discovered.feedUrl,
635|      });
636|      setSubscriptions(ensureDefaultSubscriptions());
637|      setShowManageFeeds(false);
638|      setAddFeedUrl("");
639|      await refreshFeeds();
640|    } catch (err) {
641|      setAddFeedError((err as Error).message || "Could not subscribe to this feed.");
642|    } finally {
643|      setAddingFeed(false);
644|    }
645|  };
646|
647|  const handleReadArticle = (item: FeedItem) => {
648|    markFeedItemRead(item.id, true);
649|    setItems(getFeedItems());
650|    setReadingArticle(item);
651|  };
652|
653|  const handleSaveLater = useCallback(async (item: FeedItem) => {
654|    if (item.savedBookId) {
655|      toast("Already saved to library", { icon: "📖" });
656|      return;
657|    }
658|    const tId = toast.loading(`Saving “${item.title}” to library…`);
659|    try {
660|      const book = await clipUrlToLibrary({
661|        url: item.link,
662|        userId,
663|        tags: [
664|          "Feed",
665|          item.subscriptionTitle,
666|          ...(isTelegramArticleLink(item.link) ? ["Telegram"] : []),
667|        ],
668|        sourceLabel: item.subscriptionTitle,
669|      });
670|      markFeedItemSaved(item.id, book.id);
671|      setItems(getFeedItems());
672|      await onRefreshLibrary?.();
673|      toast.success("Saved to library for offline reading", { id: tId });
674|    } catch (err) {
675|      console.error(err);
676|      toast.error((err as Error).message || "Could not save to library.", { id: tId });
677|    }
678|  }, [userId, onRefreshLibrary]);
679|
680|  // Latest actual post time among the visible items — shown next to the count.
681|  const latestPostAt = useMemo(() => {
682|    let max = 0;
683|    for (const it of visibleItems) {
684|      if (it.publishedAt > max) max = it.publishedAt;
685|    }
686|    return max;
687|  }, [visibleItems]);
688|
689|  return (
690|    <div className="space-y-5 md:space-y-7 pb-8 md:pb-10 text-left">
691|      <header ref={headerRef} className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 md:pb-3 border-b border-kindle-border font-sans gap-3">
692|        <div className="flex items-center justify-between w-full sm:w-auto">
693|          <div className="flex items-center gap-2 min-w-0">
694|            <h1 className="text-3xl font-lexend font-bold tracking-tight text-kindle-text truncate">Feed</h1>
695|            {unreadCount > 0 && (
696|              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-kindle-text/10 text-kindle-text border border-kindle-border shrink-0">
697|                {unreadCount} unread
698|              </span>
699|            )}
700|            {latestPostAt > 0 && (
701|              <span
702|                className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-kindle-text/5 text-kindle-text-muted border border-kindle-border shrink-0"
703|                title={`Newest post: ${new Date(latestPostAt).toLocaleString()}`}
704|              >
705|                {visibleItems.length} · {formatFeedDate(latestPostAt)}
706|              </span>
707|            )}
708|          </div>
709|          <p className="hidden md:block text-[10px] text-kindle-text-muted uppercase tracking-wider font-semibold font-mono mt-0.5">
710|            Maldives news and more — tap to read fullscreen.
711|          </p>
712|        </div>
713|        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-between sm:justify-end">
714|          <div className="flex items-center gap-1 bg-kindle-bg p-1 rounded-xl border border-kindle-border">
715|            <button
716|              onClick={() => persistFeedLayout("grid")}
717|              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition flex items-center gap-1 ${
718|                effectiveLayout === "grid"
719|                  ? "bg-kindle-card text-kindle-text shadow-xs border border-kindle-border"
720|                  : "text-kindle-text-muted hover:text-kindle-text"
721|              }`}
722|              title="Grid View"
723|            >
724|              <Grid className="w-3 h-3" />
725|              <span>Grid</span>
726|            </button>
727|            <button
728|              onClick={() => persistFeedLayout("scroll")}
729|              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition flex items-center gap-1 ${
730|                effectiveLayout === "scroll"
731|                  ? "bg-kindle-card text-kindle-text shadow-xs border border-kindle-border"
732|                  : "text-kindle-text-muted hover:text-kindle-text"
733|              }`}
734|              title="TikTok Scroll View"
735|            >
736|              <GalleryVertical className="w-3 h-3" />
737|              <span>Scroll</span>
738|            </button>
739|          </div>
740|          <button
741|            onClick={() => setShowManageFeeds(true)}
742|            className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-kindle-border bg-kindle-card text-[10px] font-bold uppercase tracking-wider text-kindle-text hover:bg-kindle-bg transition shrink-0"
743|          >
744|            <Settings2 className="w-3.5 h-3.5" />
745|            <span>Manage</span>
746|          </button>
747|          <button
748|            onClick={() => void refreshFeeds()}
749|            disabled={refreshing}
750|            className="p-1.5 sm:p-2 rounded-xl border border-kindle-border bg-kindle-card hover:bg-kindle-bg transition disabled:opacity-50 text-kindle-text shrink-0"
751|            title="Refresh feeds"
752|          >
753|            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${refreshing ? "animate-spin" : ""}`} />
754|          </button>
755|        </div>
756|      </header>
757|
758|      <div ref={filterRef} className="flex flex-wrap gap-2">
759|        {[
760|          { id: "all", label: "All" },
761|          { id: "briefs", label: "Briefs" },
762|          { id: "unread", label: "Unread" },
763|          { id: "saved", label: "Saved" },
764|        ].map((chip) => (
765|          <button
766|            key={chip.id}
767|            onClick={() => setFilter(chip.id as FeedFilter)}
768|            className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition ${
769|              filter === chip.id
770|                ? "bg-kindle-text text-kindle-bg border-kindle-text shadow-sm"
771|                : "bg-kindle-bg text-kindle-text border-kindle-border hover:bg-kindle-card"
772|            }`}
773|          >
774|            {chip.label}
775|          </button>
776|        ))}
777|      </div>
778|
779|      <div ref={sourcesRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
780|        <button
781|          onClick={() => setSelectedSubscriptionId(null)}
782|          className={`shrink-0 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition ${
783|            !selectedSubscriptionId
784|              ? "bg-kindle-text text-kindle-bg border-kindle-text shadow-sm"
785|              : "bg-kindle-bg text-kindle-text border-kindle-border hover:bg-kindle-card"
786|          }`}
787|        >
788|          All Sources
789|        </button>
790|        {enabledSubscriptions.map((sub) => (
791|          <button
792|            key={sub.id}
793|            onClick={() => setSelectedSubscriptionId(sub.id)}
794|            className={`shrink-0 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition max-w-[10rem] truncate ${
795|              selectedSubscriptionId === sub.id
796|                ? "bg-kindle-text text-kindle-bg border-kindle-text shadow-sm"
797|                : "bg-kindle-bg text-kindle-text border-kindle-border hover:bg-kindle-card"
798|            }`}
799|            title={sub.title}
800|          >
801|            {sub.title}
802|          </button>
803|        ))}
804|      </div>
805|
806|      {filter === "briefs" ? (
807|        <NewsInBriefPanel
808|          items={retainedItems}
809|          selectedSourceId={selectedSubscriptionId}
810|          onRead={handleReadArticle}
811|        />
812|      ) : refreshing && retainedItems.length === 0 ? (
813|        <div className="flex flex-col items-center justify-center py-16 text-kindle-text-muted">
814|          <Loader2 className="w-8 h-8 animate-spin mb-3" />
815|          <p className="text-sm">Fetching your feeds…</p>
816|        </div>
817|      ) : visibleItems.length === 0 && refreshError ? (
818|        <div className="bg-kindle-card border border-red-500/40 rounded-2xl p-12 text-center">
819|          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4 opacity-80" />
820|          <h3 className="text-lg font-lexend font-bold mb-2">News service unreachable</h3>
821|          <p className="text-sm text-kindle-text-muted max-w-md mx-auto mb-4">
822|            {refreshError}
823|          </p>
824|          <button
825|            type="button"
826|            onClick={() => void refreshFeeds()}
827|            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-kindle-accent text-kindle-bg text-sm font-bold"
828|          >
829|            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
830|            Retry
831|          </button>
832|        </div>
833|      ) : visibleItems.length === 0 ? (
834|        <div className="bg-kindle-card border border-kindle-border rounded-2xl p-12 text-center">
835|          <Newspaper className="w-12 h-12 text-kindle-text-muted mx-auto mb-4 opacity-50" />
836|          <h3 className="text-lg font-lexend font-bold mb-2">No articles here yet</h3>
837|          <p className="text-sm text-kindle-text-muted max-w-md mx-auto">
838|            Add a feed source with Manage above, or share an article link to Kora from your browser.
839|          </p>
840|        </div>
841|      ) : effectiveLayout === "scroll" ? (
842|        <FeedTikTokScroll
843|          items={visibleItems}
844|          grayscaleCovers={grayscaleCovers}
845|          perfMode={performanceMode}
846|          onRead={(item) => void handleReadArticle(item)}
847|          onSave={(item) => void handleSaveLater(item)}
848|          onRefresh={() => void refreshFeeds()}
849|          onManage={() => setShowManageFeeds(true)}
850|          onFilter={() => setShowFilterSheet(true)}
851|          onOpenDailyBrief={() => setShowDailyBriefTikTok(true)}
852|          onToggleLayout={persistFeedLayout}
853|          refreshing={refreshing}
854|          height={scrollContainerHeight}
855|        />
856|      ) : (
857|        <div className="space-y-4">
858|          {filter === "all" && !selectedSubscriptionId && (
859|            <TodayNewsBriefCard
860|              items={retainedItems}
861|              onReadArticle={handleReadArticle}
862|              onOpenTikTokBrief={() => setShowDailyBriefTikTok(true)}
863|            />
864|          )}
865|          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
866|          {visibleItems.map((item, index) => {
867|            const cover = getItemThumbnail(item);
868|            const title = displayTitle(item);
869|            return (
870|              <FeedArticleCard
871|                key={item.id}
872|                item={item}
873|                cover={cover}
874|                busy={false}
875|                title={title}
876|                variant={getBentoVariant(index)}
877|                grayscaleCovers={grayscaleCovers}
878|                onRead={() => void handleReadArticle(item)}
879|                onToggleRead={() => {
880|                  const nextRead = !item.read;
881|                  markFeedItemRead(item.id, nextRead);
882|                  setItems(getFeedItems());
883|                  if (nextRead) {
884|                    toast.success("Marked as read");
885|                  } else {
886|                    toast.success("Marked as unread");
887|                  }
888|                }}
889|                onSaveLater={() => void handleSaveLater(item)}
890|              />
891|            );
892|          })}
893|          </div>
894|        </div>
895|      )}
896|
897|      {showManageFeeds && (
898|        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
899|          <div className="w-full max-w-lg bg-kindle-card border border-kindle-border rounded-2xl p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
900|            <div className="flex items-center justify-between">
901|              <div>
902|                <h3 className="text-sm font-lexend font-bold text-kindle-text">Manage Sources</h3>
903|                <p className="text-[10px] text-kindle-text-muted mt-0.5">
904|                  Toggle sources on or off — nothing is unsubscribed.
905|                </p>
906|              </div>
907|              <button onClick={() => dismissManageFeeds()} className="p-1.5 rounded-lg hover:bg-kindle-bg text-kindle-text">
908|                <X className="w-4 h-4" />
909|              </button>
910|            </div>
911|
912|            <div className="space-y-4">
913|              {[
914|                { label: "Maldives", sources: maldivesSources },
915|                { label: "International", sources: internationalSources },
916|                { label: "Custom", sources: customSources },
917|              ].map((group) =>
918|                group.sources.length ? (
919|                  <div key={group.label} className="space-y-2">
920|                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-kindle-text-muted">
921|                      {group.label}
922|                    </h4>
923|                    {group.sources.map((sub) => {
924|                      const on = isFeedSubscriptionEnabled(sub);
925|                      return (
926|                        <div
927|                          key={sub.id}
928|                          className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-kindle-border ${
929|                            on ? "bg-kindle-bg/50" : "bg-kindle-bg/20 opacity-80"
930|                          }`}
931|                        >
932|                          <div className="min-w-0">
933|                            <p className="text-xs font-bold text-kindle-text truncate">{sub.title}</p>
934|                            <p className="text-[10px] text-kindle-text-muted truncate">
935|                              {sub.feedUrl.startsWith("kora://telegram/")
936|                                ? `Telegram · @${sub.feedUrl.replace(/^kora:\/\/telegram\//i, "")}`
937|                                : sub.siteUrl || sub.feedUrl}
938|                            </p>
939|                          </div>
940|                          <div className="flex items-center gap-2 shrink-0">
941|                            {!isCuratedFeedUrl(sub.feedUrl) ? (
942|                              <button
943|                                onClick={() => {
944|                                  removeFeedSubscription(sub.id);
945|                                  loadLocalState();
946|                                }}
947|                                className="p-2 text-kindle-text-muted hover:text-red-500 transition"
948|                                title="Remove custom source"
949|                              >
950|                                <Trash2 className="w-4 h-4" />
951|                              </button>
952|                            ) : null}
953|                            <SourceToggle on={on} onClick={() => void handleToggleSource(sub)} />
954|                          </div>
955|                        </div>
956|                      );
957|                    })}
958|                  </div>
959|                ) : null
960|              )}
961|            </div>
962|
963|            <div className="border-t border-kindle-border pt-4 space-y-3">
964|              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-kindle-text-muted">Add Custom Source</h4>
965|              <p className="text-[10px] text-kindle-text-muted">
966|                Paste a website or RSS link, or a public Telegram channel (@name or t.me/name).
967|              </p>
968|              <form onSubmit={handleAddSubscription} className="space-y-3">
969|                <input
970|                  type="text"
971|                  required
972|                  value={addFeedUrl}
973|                  onChange={(e) => setAddFeedUrl(e.target.value)}
974|                  placeholder="https://… · @channel · t.me/channel"
975|                  className="w-full bg-kindle-bg border border-kindle-border rounded-xl px-4 py-2.5 text-xs text-kindle-text"
976|                />
977|                {addFeedError && (
978|                  <p className="text-[10px] text-red-500 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
979|                    {addFeedError}
980|                  </p>
981|                )}
982|                <button
983|                  type="submit"
984|                  disabled={addingFeed}
985|                  className="w-full py-2.5 rounded-xl bg-kindle-text text-kindle-bg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
986|                >
987|                  {addingFeed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bookmark className="w-4 h-4" />}
988|                  Add Source
989|                </button>
990|              </form>
991|            </div>
992|          </div>
993|        </div>
994|      )}
995|
996|      {/* Filter & Sources sheet (opened from the scroll-view Filter button) */}
997|      {showFilterSheet && (
998|        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
999|          <div className="w-full sm:max-w-lg bg-kindle-card border border-kindle-border rounded-t-2xl sm:rounded-2xl p-5 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto">
1000|            <div className="flex items-center justify-between">
1001|              <div>
1002|                <h3 className="text-sm font-lexend font-bold text-kindle-text">Filter & Sources</h3>
1003|                <p className="text-[10px] text-kindle-text-muted mt-0.5">
1004|                  Narrow the feed by status or source.
1005|                </p>
1006|              </div>
1007|              <button onClick={() => setShowFilterSheet(false)} className="p-1.5 rounded-lg hover:bg-kindle-bg text-kindle-text">
1008|                <X className="w-4 h-4" />
1009|              </button>
1010|            </div>
1011|
1012|            <div className="flex flex-wrap gap-2">
1013|              {[
1014|                { id: "all", label: "All" },
1015|                { id: "briefs", label: "Briefs" },
1016|                { id: "unread", label: "Unread" },
1017|                { id: "saved", label: "Saved" },
1018|              ].map((chip) => (
1019|                <button
1020|                  key={chip.id}
1021|                  onClick={() => { setFilter(chip.id as FeedFilter); setShowFilterSheet(false); }}
1022|                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition ${
1023|                    filter === chip.id
1024|                      ? "bg-kindle-text text-kindle-bg border-kindle-text shadow-sm"
1025|                      : "bg-kindle-bg text-kindle-text border-kindle-border hover:bg-kindle-card"
1026|                  }`}
1027|                >
1028|                  {chip.label}
1029|                </button>
1030|              ))}
1031|            </div>
1032|
1033|            <div className="space-y-2">
1034|              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-kindle-text-muted">Sources</h4>
1035|              <div className="flex flex-wrap gap-2">
1036|                <button
1037|                  onClick={() => { setSelectedSubscriptionId(null); setShowFilterSheet(false); }}
1038|                  className={`shrink-0 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition ${
1039|                    !selectedSubscriptionId
1040|                      ? "bg-kindle-text text-kindle-bg border-kindle-text shadow-sm"
1041|                      : "bg-kindle-bg text-kindle-text border-kindle-border hover:bg-kindle-card"
1042|                  }`}
1043|                >
1044|                  All Sources
1045|                </button>
1046|                {enabledSubscriptions.map((sub) => (
1047|                  <button
1048|                    key={sub.id}
1049|                    onClick={() => { setSelectedSubscriptionId(sub.id); setShowFilterSheet(false); }}
1050|                    className={`shrink-0 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition max-w-[12rem] truncate ${
1051|                      selectedSubscriptionId === sub.id
1052|                        ? "bg-kindle-text text-kindle-bg border-kindle-text shadow-sm"
1053|                        : "bg-kindle-bg text-kindle-text border-kindle-border hover:bg-kindle-card"
1054|                    }`}
1055|                    title={sub.title}
1056|                  >
1057|                    {sub.title}
1058|                  </button>
1059|                ))}
1060|              </div>
1061|            </div>
1062|          </div>
1063|        </div>
1064|      )}
1065|      {readingArticle && (
1066|        <FeedArticleReader
1067|          item={readingArticle}
1068|          queue={visibleItems}
1069|          userId={userId}
1070|          onClose={() => dismissFeedArticle()}
1071|          onOpenItem={(next) => {
1072|            markFeedItemRead(next.id, true);
1073|            setItems(getFeedItems());
1074|            setReadingArticle(next);
1075|          }}
1076|          onSaved={async () => {
1077|            setItems(getFeedItems());
1078|            await onRefreshLibrary?.();
1079|          }}
1080|        />
1081|      )}
1082|      <DailyBriefTikTokView
1083|        items={retainedItems}
1084|        isOpen={showDailyBriefTikTok}
1085|        onClose={() => dismissDailyBriefTikTok()}
1086|        onSave={(item) => void handleSaveLater(item)}
1087|        onRead={(item) => void handleReadArticle(item)}
1088|        grayscaleCovers={grayscaleCovers}
1089|      />
1090|    </div>
1091|  );
1092|}
1093|
1094|export default React.memo(FeedView);
1095|
```


## Backend news routes — `server.ts` (EXCERPTS)

The full `server.ts` is ~4556 lines; only the news-relevant routes are excerpted here.
Express dev server; in prod these run on the Cloudflare Worker (auto-deployed via CI on push to main).

### /api/feed/preview  (lines 94–105)
```ts
app.post("/api/feed/preview", express.json(), async (req, res) => {
  const articleUrl = req.body.url;
  if (!articleUrl) {
    return res.status(400).json({ error: "Missing url parameter" });
  }
  try {
    const result = await fetchArticlePreview(articleUrl);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Preview failed" });
  }
});
```

### /api/feed/image  (lines 107–123)
```ts
app.get("/api/feed/image", async (req, res) => {
  const imageUrl = req.query.url as string;
  if (!imageUrl) {
    return res.status(400).send("Missing url");
  }
  try {
    const upstream = await proxyFeedImage(imageUrl);
    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "transfer-encoding") res.setHeader(key, value);
    });
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Image proxy failed" });
  }
});
```

### /api/convert-url  (lines 203–238 shown — per-site extraction for Mihaaru/PSM/Edition precedes it)
```ts
app.post("/api/convert-url", express.json(), async (req, res) => {
  const targetUrl = req.body.url || req.query.url as string;
  if (!targetUrl) {
    return res.status(400).json({ error: "Missing url parameter" });
  }
  try {
    console.log(`[Web Clipper] Fetching: ${targetUrl}`);
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (e) {
      return res.status(400).json({ error: "Invalid URL format" });
    }
    const domain = parsedUrl.hostname;
    // SSRF guard: block private/internal hosts
    try {
      assertSafeProxyUrl(targetUrl);
    } catch (e: any) {
      return res.status(403).json({ error: "Proxy blocked: " + (e.message || "invalid URL") });
    }
    // ... fetch raw page, per-site extractors (edition.mv, mihaaru.com, psmnews.mv, wikipedia),
    //     then generic Readability fallback, then return { title, author, description, htmlContent }
  }
});
```

### /api/proxy-image  (lines 2561–2614 shown)
```ts
app.get("/api/proxy-image", async (req, res) => {
  try {
    let imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).send("Missing image URL");
    }
    if (/^data:/i.test(imageUrl) || /^blob:/i.test(imageUrl)) {
      return res.status(400).send("Inline image URLs cannot be proxied");
    }
    // Open Library -M.jpg → -L.jpg upgrade
    if (imageUrl.includes("openlibrary.org") && imageUrl.includes("-M.jpg")) {
      imageUrl = imageUrl.replace("-M.jpg", "-L.jpg");
    }
    if (imageUrl.startsWith("//")) {
      imageUrl = "https:" + imageUrl;
    }
    try {
      assertSafeProxyUrl(imageUrl);
    } catch (e: any) {
      return res.status(403).send("Image proxy blocked: " + (e.message || "invalid URL"));
    }
    const imgRes = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 ... Chrome/121.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*"
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!imgRes.ok) { /* fallback -L → -M, then 404 */ }
    res.setHeader("Content-Type", imgRes.headers.get("content-type") || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    const buffer = await imgRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  }
});
```

### `src/components/FeedTikTokScroll.tsx` — CONTINUED (lines 501–870)

```tsx
501|                  isDarkMode
502|                    ? "border-white/20 bg-black/60 text-white hover:bg-black/80"
503|                    : "border-kindle-border bg-kindle-card/90 text-kindle-text hover:bg-kindle-card"
504|                }`}
505|                title="Manage Feeds & Sources"
506|              >
507|                <Settings2 className="w-4 h-4" />
508|              </button>
509|            )}
510|          </div>
511|
512|          <div className="pointer-events-auto flex items-center gap-2">
513|            {onToggleLayout && (
514|              <button
515|                type="button"
516|                onClick={() => onToggleLayout("grid")}
517|                className={`w-10 h-10 rounded-full border backdrop-blur-md active:scale-95 transition flex items-center justify-center shadow-lg ${
518|                  isDarkMode
519|                    ? "border-white/20 bg-black/60 text-white hover:bg-black/80"
520|                    : "border-kindle-border bg-kindle-card/90 text-kindle-text hover:bg-kindle-card"
521|                }`}
522|                title="Switch to Grid View"
523|              >
524|                <LayoutGrid className="w-4 h-4" />
525|              </button>
526|            )}
527|            {onRefresh && (
528|              <button
529|                type="button"
530|                onClick={onRefresh}
531|                disabled={refreshing}
532|                className={`w-10 h-10 rounded-full border backdrop-blur-md active:scale-95 transition disabled:opacity-50 flex items-center justify-center shadow-lg ${
533|                  isDarkMode
534|                    ? "border-white/20 bg-black/60 text-white hover:bg-black/80"
535|                    : "border-kindle-border bg-kindle-card/90 text-kindle-text hover:bg-kindle-card"
536|                }`}
537|                title="Refresh Feeds"
538|              >
539|                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
540|              </button>
541|            )}
542|          </div>
543|        </div>
544|      )}
545|      {/* 2. Top Progress Indicators */}
546|      <div className={`absolute left-4 right-4 z-20 flex gap-1 pointer-events-none ${isMobile ? "hidden" : "top-3"}`}>
547|        {items.map((_, i) => (
548|          <div
549|            key={i}
550|            className={`h-1 flex-1 rounded-full transition-colors ${
551|              i <= active ? "bg-kindle-accent" : isDarkMode ? "bg-white/20" : "bg-kindle-border"
552|            }`}
553|          />
554|        ))}
555|      </div>
556|
557|      {/* 3. Snapping Scroll Container */}
558|      <div
559|        ref={ref}
560|        tabIndex={0}
561|        onKeyDown={(e) => {
562|          if (e.key === "ArrowDown" || e.key === " ") {
563|            e.preventDefault();
564|            go(1);
565|          } else if (e.key === "ArrowUp") {
566|            e.preventDefault();
567|            go(-1);
568|          }
569|        }}
570|        className={`w-full h-full overflow-y-auto overscroll-contain scrollbar-none touch-pan-y ${
571|          perfMode
572|            ? ""
573|            : expandedIndex === null
574|              ? "snap-y snap-mandatory [scroll-snap-stop:always]"
575|              : ""
576|        }`}
577|      >
578|        {items.map((item, index) => {
579|          const cover = getItemThumbnail(item);
580|          const isExpanded = expandedIndex === index;
581|          const kbCls = !perfMode ? kbClassFor(item, index) : "";
582|          const isFar = Math.abs(index - active) > 3;
583|
584|          const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
585|            try {
586|              const el = e.currentTarget;
587|              const w = el.naturalWidth, h = el.naturalHeight;
588|              if (w && h && cover) {
589|                const store = ((window as any).__koraKbDims ||= {});
590|                store[`kora-kb-dims:${cover}`] = { w, h };
591|                setLoadedDims((prev) => ({
592|                  ...prev,
593|                  [cover]: { w, h },
594|                }));
595|              }
596|            } catch { /* ignore */ }
597|          };
598|
599|          const source = (() => {
600|            try {
601|              return new URL(item.link).hostname.replace(/^www\./, "");
602|            } catch {
603|              return item.subscriptionTitle;
604|            }
605|          })();
606|          return (
607|            <section
608|              key={item.id}
609|              style={sectionStyle}
610|              className="relative snap-start snap-always [scroll-snap-stop:always] flex flex-col justify-end p-4 md:p-6 h-full w-full shrink-0 overflow-hidden"
611|            >
612|              {cover ? (
613|                isFar ? (
614|                  <div className={`absolute inset-0 ${isDarkMode ? "bg-neutral-950/40" : "bg-kindle-bg/40"} ${isMobile ? "" : "rounded-2xl"}`} />
615|                ) : (
616|                  <img
617|                    src={cover}
618|                    alt=""
619|                    referrerPolicy="no-referrer"
620|                    loading="lazy"
621|                    onLoad={onImgLoad}
622|                    className={
623|                      isMobile
624|                        ? `absolute inset-0 w-full h-full object-cover [transform:translateZ(0)] [will-change:transform,opacity] ${kbCls} ${
625|                            isExpanded ? "blur-sm" : ""
626|                          } ${grayscaleCovers ? "grayscale" : ""}`
627|                        : `absolute inset-0 w-full h-full object-cover rounded-2xl [transform:translateZ(0)] [will-change:transform,opacity] ${kbCls} ${
628|                            isExpanded ? "blur-sm" : ""
629|                          } ${grayscaleCovers ? "grayscale" : ""}`
630|                    }
631|                  />
632|                )
633|              ) : (
634|                <div
635|                  className={
636|                    isMobile
637|                      ? `absolute inset-0 ${
638|                          isDarkMode
639|                            ? "bg-gradient-to-br from-kindle-accent/30 to-black/60"
640|                            : "bg-gradient-to-br from-kindle-accent/20 to-kindle-bg"
641|                        } [transform:translateZ(0)] [will-change:transform,opacity] ${kbCls} ${
642|                          isExpanded ? "blur-xs" : ""
643|                        }`
644|                      : `absolute inset-0 ${
645|                          isDarkMode
646|                            ? "bg-gradient-to-br from-kindle-accent/30 to-black/60"
647|                            : "bg-gradient-to-br from-kindle-accent/20 to-kindle-bg"
648|                        } rounded-2xl [transform:translateZ(0)] [will-change:transform,opacity] ${kbCls} ${
649|                          isExpanded ? "blur-xs" : ""
650|                        }`
651|                  }
652|                />
653|              )}
654|              <div
655|                className={`absolute inset-0 transition-all duration-300 ${
656|                  isMobile ? "" : "rounded-2xl"
657|                } ${
658|                  isExpanded
659|                    ? isDarkMode
660|                      ? "bg-black/95 text-white"
661|                      : "bg-kindle-bg text-kindle-text"
662|                    : isDarkMode
663|                      ? "bg-gradient-to-t from-black/95 via-black/70 via-35% to-black/15 text-white"
664|                      : "bg-gradient-to-t from-[#ECE8D4] via-[#ECE8D4]/95 via-35% to-[#ECE8D4]/20 text-kindle-text"
665|                }`}
666|              />
667|
668|                {/* Floating Side Action Buttons (TikTok style) */}
669|                <div
670|                  className={`absolute right-3 ${isMobile ? "bottom-36" : "bottom-6"} z-30 flex flex-col items-center gap-3`}
671|                  onClick={(e) => e.stopPropagation()}
672|                >
673|                  {/* Filter Button */}
674|                  {onFilter && (
675|                    <button
676|                      type="button"
677|                      onClick={onFilter}
678|                      className="active:scale-95 transition group"
679|                    >
680|                      <div className={`w-10 h-10 rounded-full border backdrop-blur-md flex items-center justify-center shadow-lg transition-all duration-200 ${
681|                        isDarkMode
682|                          ? "bg-black/60 border-white/20 text-white hover:bg-black/80"
683|                          : "bg-kindle-card/90 border-kindle-border text-kindle-text hover:bg-kindle-card"
684|                      }`}>
685|                        <Filter className="w-4 h-4" />
686|                      </div>
687|                    </button>
688|                  )}
689|
690|                  {/* Save Button */}
691|                  <button
692|                    type="button"
693|                    onClick={() => onSave(item)}
694|                    className="active:scale-95 transition group"
695|                  >
696|                    <div className={`w-10 h-10 rounded-full border flex items-center justify-center shadow-lg transition-all duration-200 ${
697|                      item.saved
698|                        ? "bg-kindle-accent border-kindle-accent text-neutral-950 scale-105"
699|                        : isDarkMode
700|                          ? "bg-black/60 border-white/20 text-white hover:bg-black/80 backdrop-blur-md"
701|                          : "bg-kindle-card/90 border-kindle-border text-kindle-text hover:bg-kindle-card backdrop-blur-md"
702|                    }`}>
703|                      <Bookmark className={`w-4 h-4 ${item.saved ? "fill-current" : ""}`} />
704|                    </div>
705|                  </button>
706|
707|                  {/* Share Button */}
708|                  <button
709|                    type="button"
710|                    onClick={() => void handleShare(item)}
711|                    className="active:scale-95 transition group"
712|                  >
713|                    <div className={`w-10 h-10 rounded-full border backdrop-blur-md flex items-center justify-center shadow-lg transition-all duration-200 ${
714|                      isDarkMode
715|                        ? "bg-black/60 border-white/20 text-white hover:bg-black/80"
716|                        : "bg-kindle-card/90 border-kindle-border text-kindle-text hover:bg-kindle-card"
717|                    }`}>
718|                      <Share2 className="w-4 h-4" />
719|                    </div>
720|                  </button>
721|
722|                  {/* Daily Brief Button */}
723|                  {onOpenDailyBrief && (
724|                    <button
725|                      type="button"
726|                      onClick={onOpenDailyBrief}
727|                      className="active:scale-95 transition group"
728|                      title="Open Daily News Brief"
729|                    >
730|                      <div className="w-10 h-10 rounded-full border border-kindle-accent/40 bg-kindle-accent text-neutral-950 flex items-center justify-center hover:opacity-95 shadow-lg transition-all duration-200 relative animate-pulse">
731|                        <Zap className="w-4 h-4 fill-current text-neutral-950" />
732|                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
733|                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
734|                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
735|                        </span>
736|                      </div>
737|                    </button>
738|                  )}
739|                </div>
740|
741|                <div
742|                  className={`relative z-10 cursor-pointer select-text ${isMobile ? "pb-20" : "pb-6"} transition-all duration-300 pr-16 md:pr-24 ${
743|                    isDarkMode
744|                      ? "text-white"
745|                      : "text-kindle-text"
746|                  }`}
747|                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
748|                >
749|                  <span className={`inline-flex items-center flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-1 sm:mb-2 transition-colors ${
750|                    isDarkMode ? "text-white/80" : "text-kindle-text-muted"
751|                  }`}>
752|                    {source}
753|                    {item.read ? (
754|                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${
755|                        isDarkMode ? "bg-white/20 text-white" : "bg-kindle-border text-kindle-text"
756|                      }`}>Read</span>
757|                    ) : (
758|                      <span className="rounded-full px-1.5 py-0.5 text-[9px] bg-kindle-accent text-neutral-950 font-bold">New</span>
759|                    )}
760|                    {item.publishedAt && (
761|                      <>
762|                        <span className="opacity-50 mx-0.5">•</span>
763|                        <span className="opacity-75 tracking-wider lowercase">
764|                          {new Date(item.publishedAt).toLocaleString(undefined, { 
765|                            month: 'short', 
766|                            day: 'numeric',
767|                            hour: 'numeric',
768|                            minute: '2-digit'
769|                          })}
770|                        </span>
771|                      </>
772|                    )}
773|                  </span>
774|                  <h2 className={`text-base sm:text-xl md:text-2xl font-lexend font-bold leading-tight mb-2 sm:mb-3 transition-all ${
775|                    isDarkMode
776|                      ? isExpanded ? "text-white" : "line-clamp-3 sm:line-clamp-4 text-white drop-shadow-md"
777|                      : isExpanded ? "text-kindle-text" : "line-clamp-3 sm:line-clamp-4 text-kindle-text"
778|                  }`}>
779|                    {item.title}
780|                  </h2>
781|
782|                  {/* Expanded Details Section */}
783|                  {isExpanded && (
784|                    <div
785|                      className={`mt-4 overflow-y-auto max-h-[45vh] pr-2 space-y-4 border-t pt-4 transition-colors ${
786|                        isDarkMode
787|                          ? "border-white/10 text-neutral-200"
788|                          : "border-neutral-200 text-neutral-800"
789|                      } scrollbar-thin select-text`}
790|                      onClick={(e) => e.stopPropagation()}
791|                    >
792|                      {articleHtmlMap[item.id]?.loading ? (
793|                        <div className="flex items-center gap-2 py-4">
794|                          <Loader2 className="w-4 h-4 animate-spin text-kindle-accent shrink-0" />
795|                          <p className="text-xs font-sans">Extracting full article…</p>
796|                        </div>
797|                      ) : articleHtmlMap[item.id]?.html ? (
798|                        <div
799|                          dir="auto"
800|                          className={`feed-article-content max-w-none text-xs sm:text-sm font-serif leading-relaxed [&_*]:[unicode-bidi:plaintext] ${
801|                            isDarkMode ? "text-neutral-200" : "text-neutral-900"
802|                          }`}
803|                          dangerouslySetInnerHTML={{ __html: articleHtmlMap[item.id].html }}
804|                        />
805|                      ) : item.summary ? (
806|                        <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-serif">
807|                          {item.summary}
808|                        </p>
809|                      ) : (
810|                        <p className="text-xs sm:text-sm italic opacity-70">
811|                          No content available for this article.
812|                        </p>
813|                      )}
814|
815|                      <div className="pt-2">
816|                        <a
817|                          href={item.link}
818|                          target="_blank"
819|                          rel="noopener noreferrer"
820|                          className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider hover:underline ${
821|                            isDarkMode ? "text-kindle-accent" : "text-neutral-900 underline decoration-kindle-accent decoration-2"
822|                          }`}
823|                        >
824|                          Read Full Original Article →
825|                        </a>
826|                      </div>
827|                    </div>
828|                  )}
829|
830|                  {/* Navigation and State Indicator */}
831|                  <div className={`flex items-center gap-2 mt-3.5 text-[10px] sm:text-[11px] transition-colors ${
832|                    isDarkMode ? "text-white/70" : "text-kindle-text-muted font-medium"
833|                  }`}>
834|                  {isExpanded ? (
835|                    <button
836|                      type="button"
837|                      onClick={(e) => {
838|                        e.stopPropagation();
839|                        setExpandedIndex(null);
840|                      }}
841|                      className="cursor-pointer p-1.5 -m-1.5 flex items-center justify-center hover:opacity-85 transition"
842|                      aria-label="Collapse"
843|                    >
844|                      <ChevronUp className="w-5 h-5" />
845|                    </button>
846|                  ) : (
847|                    <button
848|                      type="button"
849|                      onClick={(e) => {
850|                        e.stopPropagation();
851|                        setExpandedIndex(index);
852|                      }}
853|                      className="cursor-pointer p-1.5 -m-1.5 flex items-center justify-center hover:opacity-85 transition"
854|                      aria-label="Expand"
855|                    >
856|                      <ChevronDown className={`w-5 h-5 animate-bounce ${isDarkMode ? "text-kindle-accent" : "text-kindle-text"}`} />
857|                    </button>
858|                  )}
859|                  <span className="ml-auto font-mono">
860|                    {index + 1}/{items.length}
861|                  </span>
862|                </div>
863|              </div>
864|            </section>
865|          );
866|        })}
867|      </div>
868|    </div>
869|  );
870|}
871|
```


### `src/components/FeedArticleReader.tsx` — CONTINUED (lines 501–520)

```tsx
501|                      </p>
502|                      <p className={`mt-1 text-[10px] ${theme.muted}`}>{nextQueued.subscriptionTitle}</p>
503|                    </button>
504|                  );
505|                }
506|
507|                return (
508|                  <p className={`text-center text-[10px] font-bold uppercase tracking-widest ${theme.muted}`}>
509|                    End of feed
510|                  </p>
511|                );
512|              })()}
513|            </div>
514|          </>
515|        )}
516|      </div>
517|      {showSettings ? <NewsReaderSettingsPanel prefs={prefs} onChange={updatePrefs} /> : null}
518|    </div>
519|  );
520|}
521|
```

# Raadhavalhi — Better News Scraping, Source Management, More Maldives Sources

## Goal
1. Scrape **full news + images** for every source using the **best method per source**.
2. Add **Settings + dropdown** to enable/disable sources.
3. Add **local Maldives sources**.

## Approach

### 1. Server-side enrichment in `worker.ts`
Replace the thin `/api/feed-proxy` with a real fetch+parse+enrich pipeline (`/api/feed/fetch`).
- Fetch RSS/Atom with browser UA + follow redirects (proxyFeedImage-style).
- Parse items: title, link, summary, `content:encoded`/content, publishedAt, author, category.
- **Per-source image strategy** (best method per host):
  - RSS-native first: `media:content`/`media:thumbnail`/`enclosure`/`og:image` in feed item.
  - If missing → **scrape the article page** for `og:image` + `twitter:image` (works for BBC/NPR/Al Jazeera/Guardian/Verge).
  - API sources: `edition.mv` + `mihaaru.com` → use their JSON search APIs (full content + image variants) like Kora does.
  - Google News RSS → resolve redirected article URL, then scrape.
- **Full content**: use `content:encoded` when present; for summary-only items, scrape the article `<article>`/main text (top 8 items per feed, 10s timeout, best-effort) so the reader shows full news.
- Return JSON: `{ title, link, items: [{ id, title, link, summary, content, imageUrl, images[], publishedAt, author, source }] }`.
- Keep `/api/feed-proxy` as an alias for backward compat.

### 2. `feedClient.fetchFeed`
- Primary: `GET /api/feed/fetch?url=<feed>` → map JSON to `FeedItem` (content, images, imageUrl).
- Fallback (only if worker missing): rss2json.com (unchanged).
- `collectArticleImages` → reuse worker enrichment (already gets `images`).

### 3. `feedStorage.ts`
- Add Maldives sources: **Sun.mv**, **Vaguthu** (verified 200), keep existing 4; attempt Dhiyas/Haveeru if reachable.
- Add enable/disable helpers: `setFeedSubscriptionEnabled`, `removeFeedSubscription`, `addFeedSubscription` (localStorage-backed), so Settings can toggle.
- Group sources for the management UI (Maldives / World / Tech / Science / Business / Sports).

### 4. Source management UI
- New `SourcesPanel` component: grouped list with per-source enable/disable toggles + "Add custom source" (URL/Telegram).
- Wire into the **Settings** screen (currently LanguageSetup re-used as settings) and add a **source dropdown/filter** in the home header (All / per source) like Kora's FeedView.
- On toggle, persist + refresh affected feed.

### 5. Reader rendering
- `FeedReader` already receives `item`; render `content` (full) with sanitized HTML when present, and pass `images[]` to the reel. Ensure `HavaaFeedScroll`/`MagazineFeedScroll` show `images` gallery.

## Verification
- `npm run build` (vite) + `tsc --noEmit` green.
- Manual: `wrangler dev` (or `tsx server.ts`) + browser, load a feed, confirm items have images + full content; toggle a source off → it disappears; add a Maldives source.
- Commit + push to raadhavalhi main.

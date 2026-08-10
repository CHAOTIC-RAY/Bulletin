# Havaa — News Reimagined for a Generation That Doesn't "Read News"

> Working temp name: **Havaa** (you said we'll rename later). Concept: take the Kora "News" tab, make it a standalone news app, and design for the behavior young people already have — scroll, listen, swipe — instead of fighting it.

---

## 0. Problem framing (why this app exists)

The real problem is **not** "this generation doesn't read news." They consume more information than any generation in history — they just don't read *legacy news format* (headline grids, long articles). The mismatch is **format and effort**, not appetite.

The goal is therefore NOT "make them read news." The goal is: **deliver what news actually is — context, signal, consequence — in a format their behavior already accepts** (vertical scroll, audio on the commute, swipe, short explainers). "Reading news" becomes a side-effect, not the ask.

### Design pillars
1. **Audio-first.** Kora is already an audiobook/TTS reader. A 3-min "daily brief" you *listen* to is news without the reading-tax. Strongest lever.
2. **Swipe / TikTok grammar.** One story per screen, Ken Burns image motion, tap to expand. Meeting them where they are.
3. **Explainer layer, not headline layer.** Lead with *why this matters to YOU* (your city, your money, your feeds). Atomize facts; reveal depth on tap.
4. **Multilingual by default — incl. Dhivehi (Thaana/RTL).** Kora already detects Thaana + Arabic RTL. We make language setup trivial and ship Dhivehi as a first-class supported locale.
5. **Relevance > firehose.** "Why this matters to YOU" beats 500 sources.
6. **Setup is easy.** Pick interests → sources auto-onboard. No pasting RSS URLs.

---

## 1. Source of truth — what we're reusing from Kora

Kora's `src/` already contains a production-grade news subsystem. We are **forking the logic, not rebuilding it**. The following files are the foundation (full code in `kora-news-tab-code.md`):

| Concern | Kora file(s) | What we reuse |
|---|---|---|
| Feed model + subscriptions | `src/lib/feedStorage.ts` | `FeedItem`, `FeedSubscription`, curated catalogs, Maldives + intl defaults, topic groups |
| On-device daily brief | `src/lib/generateNewsBrief.ts`, `src/lib/dailyNewsBriefClient.ts`, `src/lib/feedBriefs.ts` | `buildDailyBrief()`, headline rewrite, dedup, section grouping — **no AI needed** |
| News reader theming | `src/lib/newsReaderPrefs.ts`, `src/hooks/useNewsReaderPrefs.ts`, `src/components/NewsReaderSettingsPanel.tsx` | Font size/spacing, themes (app/sepia/night/oled/green…), brightness, persistence |
| Article extraction | `src/lib/feedArticle.ts`, `src/lib/feedPreview.ts`, `src/lib/coverImage.ts` | `/api/convert-url`, link previews, image proxy, footer/boilerplate stripping |
| **TTS engine** | `src/lib/browserTtsPlayer.ts`, `src/lib/ttsSettings.ts`, `src/lib/ttsTextPrep.ts`, `src/lib/koraTts.ts` | Full chunked player w/ subtitle tracking, voice/lang selection, rate/pitch, native Android bridge |
| Image motion (Ken Burns) | `src/components/FeedTikTokScroll.tsx` (`KEN_BURNS` + `kbClassFor`) | Slow zoom/pan keyframes, dimension-aware variant selection |
| RTL / Dhivehi | `src/lib/textDirection.ts` | `isRtlText()` detects Thaana `\u0780-\u07BF` + Arabic `\u0600-\u06FF`; `textDirection()` → `rtl`/`ltr` |
| TikTok feed | `src/components/FeedTikTokScroll.tsx`, `src/components/DailyBriefTikTokView.tsx` | Vertical snapping scroll, immersive chrome, daily-brief overlay |
| Article reader | `src/components/FeedArticleReader.tsx` | Continuous stack, next-story prefetch, RTL title font |
| Backend routes | `server.ts` `/api/feed/preview`, `/api/feed/image`, `/api/convert-url`, `/api/proxy-image` | Express (dev) — Cloudflare Worker in prod |

**Key insight:** the hard parts (on-device brief generation, TTS, RTL, image animation) are already built and shipped in Kora. Havaa's job is *composition + UX focus*, not reinvention.

---

## 2. Product spec

### 2.1 Onboarding (the "easy setup")
- First launch: a single interest-picker (Kora's `TOPIC_FEED_GROUPS`: Local, World, Tech, Gaming, Movies, Science, Business, Sports).
- Selecting interests auto-enables the matching curated feeds (`applySelectedFeedSources`). No RSS pasting.
- **Language step:** pick app UI language (en, dv [Dhivehi], + others) **and** a preferred TTS narration language. Defaults: UI `en`, narration follows device.
- Dhivehi users get RTL UI + Thaana font (`font-thaana`). TTS uses whatever `dv` voice the device exposes (Android native TTS often has Dhivehi; web falls back gracefully with a notice).

### 2.2 Home — TikTok-style vertical news scroll
- Reuse `FeedTikTokScroll` shell: one `FeedItem` per full screen, snap scrolling, side action rail (Save / Share / Daily Brief), top progress dots.
- **New:** each slide's hero image uses the **Ken Burns motion** copied from Kora (slow zoom/pan, dimension-aware, `prefers-reduced-motion` respected).

### 2.3 Multi-image auto-switching animation (your specific request)
When a `FeedItem` has **more than one image** (gallery / slideshow article), render an **auto-advancing carousel** behind the text instead of a single Ken Burns frame:
- Inner component `AutoImageReel`:
  - Props: `images: string[]`, `intervalMs = 3500`, `transition = "crossfade" | "slide"`.
  - Crossfade between images on a timer; `aria-hidden`, `pointer-events-none`.
  - Pauses on `document.hidden` (visibilitychange) and when the slide is expanded (user reading).
  - Respect `prefers-reduced-motion`: if reduced, show only the first image (no auto-switch).
  - Single-image items keep the Kora Ken Burns treatment.
- Where do multiple images come from? Two paths:
  1. **Article body extraction:** `prepareFeedArticleHtml` already returns article HTML — we scan it for `<img>` tags and collect up to N (e.g. 6) `src`s, then proxy them via `/api/proxy-image` (same as `resolveFeedImageSrc`).
  2. **Feed-level:** most RSS items have one `imageUrl`. For richer galleries we pull from the extracted article on expand/full-read. So the reel is most visible in the **full reader** and as an *enhanced* hero when the feed item links to a gallery.

### 2.4 Listen — TTS daily brief & article narration (your specific request)
- **Daily Brief audio:** build today's brief with `buildTodayDailyBrief(articles)` (on-device, no AI), then feed `brief.lead` + each section intro + story headline/detail into `BrowserTtsPlayer.loadText(...)` and `.play()`.
- **Per-article listen:** in `FeedArticleReader`, a **▶ Listen** button drives `BrowserTtsPlayer` over the extracted article text. Subtitle window (`onSubtitleUpdate`) shows the currently-spoken sentence — great for bilingual/Dhivehi learners.
- **Voice & language:** reuse `TtsVoiceSettings` panel. For Dhivehi, the lang list shows `dv` voices if present; otherwise shows a friendly "Dhivehi voice not installed — tap to add" (Android `openNativeTtsInstall`).
- Reuse `getEffectiveSpeechRate`, quality presets (`instant`/`balanced`/`studio`), playback mode (`narrator`/`speed`).

### 2.5 Reader themes & accessibility
- Reuse `newsReaderThemeClasses` (8 themes), font-size/line/paragraph controls, brightness. All persist via `useNewsReaderPrefs`.
- RTL: any text with Thaana/Arabic gets `dir="rtl"` + `font-thaana` (already wired in `FeedView`/`FeedArticleReader`). Havaa keeps this and adds a global RTL layout switch when UI language = Dhivehi.

### 2.6 Multilingual
- App strings: ship an `i18n` with `en` (default) and `dv` (Dhivehi) to start; structure for easy addition.
- TTS narration language is independent of UI language (read in English, listen in Dhivehi, etc.).
- Dhivehi content sources: keep Kora's Maldives defaults (Mihaaru, PSM News, Edition, Maldives Independent) and let users add Dhivehi RSS.

---

## 3. Architecture

### 3.1 Frontend (Vite + React + TS + Tailwind, same stack as Kora)
```
havaa/
  index.html
  vite.config.ts
  src/
    main.tsx
    App.tsx
    components/
      HavaaFeedScroll.tsx      # fork of FeedTikTokScroll (+ AutoImageReel)
      AutoImageReel.tsx        # NEW multi-image auto-switch
      DailyBriefTikTokView.tsx # fork
      TodayNewsBriefCard.tsx   # fork
      NewsInBriefPanel.tsx     # fork
      NewsReaderSettingsPanel.tsx
      FeedArticleReader.tsx    # fork (+ Listen button)
      TtsVoiceSettings.tsx
      ListenButton.tsx         # NEW wraps BrowserTtsPlayer
      LanguageSetup.tsx        # NEW onboarding language step
    lib/
      feedStorage.ts           # Kora (curated catalogs, subs)
      feedArticle.ts           # Kora (convert-url, extraction)
      feedPreview.ts           # Kora (image proxy, previews)
      feedBriefs.ts            # Kora
      generateNewsBrief.ts     # Kora (on-device brief)
      dailyNewsBriefClient.ts  # Kora
      newsReaderPrefs.ts       # Kora
      browserTtsPlayer.ts      # Kora (TTS engine)
      ttsSettings.ts           # Kora
      ttsTextPrep.ts           # Kora
      koraTts.ts               # Kora (native bridge)
      textDirection.ts         # Kora (RTL/Thaana)
      coverImage.ts            # Kora
      i18n.ts                  # NEW (en, dv)
    hooks/
      useNewsReaderPrefs.ts    # Kora
    types.ts
```

### 3.2 Backend
- Dev: reuse Kora's `server.ts` Express routes: `/api/feed/preview`, `/api/feed/image`, `/api/convert-url`, `/api/proxy-image`. These already do per-site extraction (incl. Mihaaru/PSM/Edition), SSRF guards, Open Library cover upgrade.
- Prod: Cloudflare Worker (Kora already deploys via CI on push to main). The same endpoints exist server-side; Havaa reuses them. **No `wrangler deploy` from local — push to main, CI auto-deploys** (per your Kora workflow).

### 3.3 Data flow
```
User picks interests (onboarding)
  → applySelectedFeedSources(feedUrls)  [localStorage]
  → refreshAllSubscriptions(activeSubs)  [fetch RSS]
  → mergeFeedItems / saveFeedItems       [localStorage, capped 500]
  → prefetchFeedPreviews (image + title fix)
Home scroll renders FeedItem[]
  → tap → FeedArticleReader → resolveFeedArticle → /api/convert-url
  → AutoImageReel collects <img> from extracted HTML
  → Listen → BrowserTtsPlayer over article text
Daily Brief → buildTodayDailyBrief(articles) → TTS or TikTok view
```

---

## 4. New code we must write (the delta beyond forking Kora)

1. `AutoImageReel.tsx` — multi-image auto-switching carousel (crossfade, timer, reduced-motion, pause on hidden/expanded).
2. `ListenButton.tsx` + wire `BrowserTtsPlayer` into `FeedArticleReader` and the Daily Brief (play/pause, subtitle, progress).
3. `LanguageSetup.tsx` — onboarding language + narration step; writes UI lang + TTS lang.
4. `i18n.ts` — `en` + `dv` string tables; `t(key)` helper; RTL flag per locale.
5. App shell `App.tsx` — compose onboarding → home scroll → reader → settings; global RTL layout when locale is RTL.
6. `index.html`/`vite.config.ts` — standalone scaffold (no Kora book/audiobook modules).
7. Multilingual TTS fallback UX (Dhivehi voice missing → install prompt).

Everything else is a **direct fork** of the Kora files listed in §1 (verbatim in `kora-news-tab-code.md`).

---

## 5. Scope & non-goals (v1)
- **In:** vertical news scroll, daily audio brief, per-article listen, multi-image reel, 8 reader themes, multilingual (en/dv) + RTL, easy interest-based onboarding, Kora backend reuse.
- **Out (later):** accounts/cloud sync, personalized ML ranking, paid tiers, editorial human curation, push notifications beyond daily brief, iOS native (Android first via Capacitor like Kora).

---

## 6. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Dhivehi TTS voice often missing on web | Detect, show install prompt (Android native) / graceful text-only fallback + notice |
| RSS fetch CORS/blocked | All fetches go through Kora Worker (`/api/*`); SSRF-guarded proxy |
| convert-url 503 under load | Reuse Kora's concurrency cap (2) + cache + retry/backoff already in `feedArticle.ts` |
| Auto-image reel = bandwidth | Cap N images, lazy-load, pause off-screen, reduced-motion static |
| "Another news app" fatigue | Differentiate via audio + swipe + explainer, not a firehose grid |

---

## 7. Success metric (the actual bet)
Not "time spent reading articles." Instead: **% of daily-active users who complete a listen session** (audio brief or article) + **return rate at 7 days**. If young users will *listen* to a 3-min brief daily, we've solved the original problem without ever asking them to "read."

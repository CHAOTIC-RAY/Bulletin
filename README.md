# Havaa — News, reimagined

A standalone news app forked from the Kora "News" tab. Built for a generation that
scrolls and listens instead of reading headline grids.

## What's inside
- **TikTok-style vertical news scroll** (`HavaaFeedScroll`) — one story per screen, snap scroll.
- **Multi-image auto-switching** (`AutoImageReel`) — when an article has several images, they crossfade automatically (Dhivehi-friendly, respects `prefers-reduced-motion`).
- **Listen (TTS)** — daily brief + per-article narration via `HavaaTts` (Web Speech). Sentence-level subtitle.
- **Daily Brief** — on-device, no-AI brief generator (`generateNewsBrief`) groups today's stories by source.
- **Multilingual** — `en` + `dv` (Dhivehi) UI strings; independent TTS narration language; full RTL layout for Thaana (`textDirection`).
- **Easy setup** — pick interests → sources auto-onboard. No RSS pasting.

## Run it
```bash
npm install
npm run dev      # http://localhost:5173
```

## Reusing Kora's real code
This app is built on Kora's production news subsystem. The verbatim Kora source is in
`kora-news-tab-code.md` and the product spec is in `PRD.md` (temp name: **Havaa**).

- `kora-news-tab-code.md` — all Kora news-tab files (feedStorage, generateNewsBrief, tts*, textDirection, FeedTikTokScroll, FeedArticleReader, server.ts routes…).
- `PRD.md` — full PRD: problem framing, architecture, new-code delta, risks.

## Notes
- Standalone mode fetches RSS via a public RSS→JSON proxy in `feedClient.ts`. In production,
  swap `RSS_PROXY` for Kora's Cloudflare Worker `/api/feed/*` endpoints (auto-deployed via CI
  on push to main — no local `wrangler deploy`).
- Dhivehi TTS voice may be absent on some devices; the app detects this and shows an install hint.

# Havaa — News, reimagined

A standalone news app forked from the Kora "News" tab. Built for a generation that
scrolls and listens instead of reading headline grids.

## What's inside
- **TikTok-style vertical news scroll** (`HavaaFeedScroll`) — one story per screen, snap scroll.
- **Multi-image auto-switching** (`AutoImageReel`) — when an article has several images, they crossfade automatically (Dhivehi-friendly, respects `prefers-reduced-motion`).
- **Listen (TTS)**
  - **Piper** — fully local, in-browser neural voices (`@diffusionstudio/vits-web`, WASM + OPFS). No network needed, works offline. Voices: Ryan (High), LJSpeech (High), Lessac (High), Alan (UK).
  - **Edge TTS** — Microsoft Edge ReadAloud neural voices via the `/api/tts/edge` backend (shared Web-API implementation, runs identically in the dev server and the Cloudflare Worker).
  - **Browser WebSpeech** — built-in system voices (zero download).
- **Daily Brief** — on-device, no-AI brief generator (`generateNewsBrief`) groups today's stories by source.
- **Multilingual** — `en` + `dv` (Dhivehi) UI strings; independent TTS narration language; full RTL layout for Thaana (`textDirection`).
- **Easy setup** — pick interests → sources auto-onboard. No RSS pasting.

## Run it locally (dev server)
```bash
npm install
npm run dev      # http://localhost:3000  (Express + Vite middleware)
```

## Deploy to Cloudflare Workers
This project is a Cloudflare Workers SPA: the static build is served by the
**Static Assets** binding, and `/api/*` requests are handled by the Worker
(`src/worker.ts`). Piper TTS runs entirely in the browser, so it needs no
Worker-side code.

```bash
npm install
npm run build            # builds the SPA into ./dist
npx wrangler login       # one-time browser auth (or set CLOUDFLARE_API_TOKEN)
npm run deploy           # npm run build && wrangler deploy
```

Preview locally with `npm run cf:dev` (serves `dist/` + Worker routes via
`wrangler dev`).

> **Edge TTS note:** Microsoft's reverse-engineered Edge TTS endpoint is frequently
> blocked (returns 401/403) from many networks and Cloudflare's edge. The
> `/api/tts/edge` route will return an honest `502` error in that case — the app
> UI surfaces it and you can switch to the local **Piper** engine, which always
> works. This is by design, not a regression.

### `wrangler.jsonc` highlights
- `main`: `src/worker.ts`
- `assets.directory`: `./dist`, `not_found_handling: "single-page-application"`
- `compatibility_flags`: `["nodejs_compat"]` (for `crypto.subtle` / WebSocket)

## Reusing Kora's real code
This app is built on Kora's production news subsystem. The verbatim Kora source is in
`kora-news-tab-code.md` and the product spec is in `PRD.md` (temp name: **Havaa**).

- `kora-news-tab-code.md` — all Kora news-tab files (feedStorage, generateNewsBrief, tts*, textDirection, FeedTikTokScroll, FeedArticleReader…).
- `PRD.md` — full PRD: problem framing, architecture, new-code delta, risks.

## Notes
- Standalone mode fetches RSS via a public RSS→JSON proxy in `feedClient.ts`, with
  a server-side `/api/feed-proxy` fallback for CORS/Cloudflare-blocked feeds.
- Dhivehi TTS voice may be absent on some devices; the app detects this and shows an install hint.

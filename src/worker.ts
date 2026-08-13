// Cloudflare Worker entry — powers the production deployment.

/// <reference types="@cloudflare/workers-types" />

function isApiRequest(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

async function handleApi(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/health") {
    const pollyCache = Boolean(
      (globalThis as any).FIREBASE_PROJECT_ID || (globalThis as any).AWS_ACCESS_KEY_ID
    );
    return Response.json({ status: "ok", pollyCache });
  }

  if (url.pathname === "/api/tts/polly" && request.method === "POST") {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const text = body?.text;
    if (!text || typeof text !== "string") {
      return Response.json({ error: "Text string is required" }, { status: 400 });
    }
    try {
      // Lazy import so the (Workers-safe) Polly module never crashes Worker init.
      const { synthesizePolly } = await import("./lib/pollyCore");
      const { audio, contentType } = await synthesizePolly(
        text,
        body?.voiceId || "Matthew",
        body?.engine === "standard" ? "standard" : "neural",
        Number(body?.rate) || 1
      );
      return new Response(audio as BodyInit, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch (error: any) {
      return Response.json(
        { error: error?.message || "Polly TTS synthesis failed" },
        { status: 502 }
      );
    }
  }

  if (url.pathname === "/api/feed-proxy" && request.method === "GET") {
    const target = url.searchParams.get("url");
    if (!target) {
      return Response.json({ error: "URL is required" }, { status: 400 });
    }
    try {
      const upstream = await fetch(decodeURIComponent(target), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/xml, text/xml, */*",
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!upstream.ok) {
        return Response.json(
          { error: `Failed to fetch feed: ${upstream.statusText}` },
          { status: upstream.status }
        );
      }
      const text = await upstream.text();
      return new Response(text, {
        headers: { "Content-Type": "application/xml" },
      });
    } catch (error: any) {
      return Response.json({ error: error?.message || "Feed fetch failed" }, { status: 502 });
    }
  }

  // Enriched feed: fetch + parse + per-source image/content enrichment.
  if (url.pathname === "/api/feed/fetch" && request.method === "GET") {
    const target = url.searchParams.get("url");
    if (!target) {
      return Response.json({ error: "URL is required" }, { status: 400 });
    }
    // Edge-cache enriched feeds so repeat loads (and the 300s window) return
    // instantly instead of re-scraping every article via r.jina.ai.
    const cacheKey = new Request(url.toString(), request);
    try {
      const cache = (caches as any).default;
      const cached = await cache.match(cacheKey);
      if (cached) {
        const headers = new Headers(cached.headers);
        headers.set("X-Feed-Cache", "HIT");
        return new Response(cached.body, { status: cached.status, headers });
      }
    } catch { /* cache unavailable — fall through to live */ }

    try {
      const { fetchEnrichedFeed } = await import("./lib/feedEnrich");
      const feed = await fetchEnrichedFeed(decodeURIComponent(target));
      // Never return an empty feed as an error — surface what we got so the
      // client can fall back gracefully instead of the whole request 503ing.
      const resp = new Response(JSON.stringify(feed), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
          "Access-Control-Allow-Origin": "*",
        },
      });
      try { await (caches as any).default.put(cacheKey, resp.clone()); } catch { /* ignore */ }
      return resp;
    } catch (error: any) {
      return Response.json({ error: error?.message || "Feed enrichment failed" }, { status: 502 });
    }
  }

  // Daily news brief — Groq AI polish with on-device fallback.
  if (url.pathname === "/api/brief/groq" && request.method === "POST") {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const articles = body?.articles;
    if (!Array.isArray(articles) || !articles.length) {
      return Response.json({ error: "articles[] required" }, { status: 400 });
    }
    try {
      const { generateBrief } = await import("./lib/groqBrief");
      const apiKey = (typeof body?.key === "string" && body.key.trim()) || env?.GROQ_API_KEY || "";
      const useAi = body?.useAi !== false;
      const d = new Date();
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const result = await generateBrief(articles, dateKey, apiKey, useAi);
      return Response.json(result, {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    } catch (error: any) {
      return Response.json({ error: error?.message || "Brief generation failed" }, { status: 502 });
    }
  }

  // Weather overview for the Daily Paper tab. Maldives uses the official
  // Maldives Meteorological Service; other countries use Open-Meteo.
  if (url.pathname === "/api/weather" && request.method === "GET") {
    const code = url.searchParams.get("country") || "MV";
    try {
      const { fetchWeatherForCountry } = await import("./lib/weatherFetch");
      const forecast = await fetchWeatherForCountry(code);
      return new Response(JSON.stringify(forecast), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=1800",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error: any) {
      return Response.json(
        { error: error?.message || "Weather fetch failed" },
        { status: 502 }
      );
    }
  }

  // Keyless Dhivehi TTS via dhivehi.mv (Common Voice-based). Proxies the audio
  // stream from the browser so no CORS/API-key is needed. Falls back to 502 if
  // the upstream is unreachable. `q` = Thaana text (URL-encoded), `g` = gender
  // (m=male, f=female), `lang` = locale tag (ignored upstream, kept for parity).
  //
  // Recordings are cached at the Cloudflare edge via the Cache API, keyed on a
  // content hash of (text, gender). This is the cross-user "reuse the same
  // recording" store: the first user to read a given article chunk generates it,
  // every subsequent user gets the identical cached MP3 from the edge (no upstream
  // call, no API key, no per-user cost).
  if (url.pathname === "/api/tts/dv" && request.method === "GET") {
    const text = url.searchParams.get("q");
    if (!text) {
      return Response.json({ error: "Text (q) is required" }, { status: 400 });
    }
    const gender = url.searchParams.get("g") || "f";
    const cacheKey = `${gender}|${text}`;
    const cacheKeyHash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(cacheKey)
    );
    const cacheKeyHex = Array.from(new Uint8Array(cacheKeyHash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const cacheUrl = new URL("https://bulletin-tts.dv/" + cacheKeyHex);

    // Serve from edge cache if a previous user already generated this recording.
    const cache = await caches.open("tts-cache");
    const cached = await cache.match(cacheUrl);
    if (cached) {
      return new Response(cached.body, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=2592000",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Range",
          "X-Tts-Cache": "HIT " + cacheKeyHex.slice(0, 8),
        },
      });
    }

    try {
      const upstream = await fetch(
        `https://dhivehi.mv/tools/tts/data/?g=${encodeURIComponent(gender)}&q=${encodeURIComponent(text)}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "audio/mpeg, audio/*, */*",
          },
          signal: AbortSignal.timeout(15000),
        }
      );
      if (!upstream.ok) {
        return Response.json(
          { error: `Dhivehi TTS upstream returned ${upstream.status}` },
          { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
        );
      }
      // Write to the edge cache so every other user (and this user's next read)
      // reuses the generated MP3 instead of regenerating it.
      const ct = upstream.headers.get("Content-Type") || "audio/mpeg";
      const resp = new Response(upstream.body, {
        headers: {
          "Content-Type": ct,
          "Cache-Control": "public, max-age=2592000",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Range",
          "X-Tts-Cache": "MISS " + cacheKeyHex.slice(0, 8),
        },
      });
      try {
        // Cache the readable stream once; clone the body for the response.
        const [cacheStream, respStream] = resp.body?.tee() ?? [resp.body, null];
        if (cacheStream) {
          const cacheCopy = new Response(cacheStream, { headers: resp.headers });
          await cache.put(cacheUrl, cacheCopy);
        }
        return respStream ? new Response(respStream, { headers: resp.headers }) : resp;
      } catch {
        return resp;
      }
    } catch (error: any) {
      return Response.json(
        { error: error?.message || "Dhivehi TTS failed" },
        { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}

export default {
  async fetch(request: Request, env: any, _ctx: unknown): Promise<Response> {
    const url = new URL(request.url);
    if (isApiRequest(url.pathname)) {
      return handleApi(request, env);
    }
    // Static assets (built SPA) are served automatically by the Workers
    // Static Assets binding configured in wrangler.jsonc. This branch only runs
    // if the asset isn't found, in which case we return the SPA shell.
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler;

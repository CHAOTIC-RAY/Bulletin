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
    try {
      const { fetchEnrichedFeed } = await import("./lib/feedEnrich");
      const feed = await fetchEnrichedFeed(decodeURIComponent(target));
      // Never return an empty feed as an error — surface what we got so the
      // client can fall back gracefully instead of the whole request 503ing.
      return new Response(JSON.stringify(feed), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
          "Access-Control-Allow-Origin": "*",
        },
      });
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
    const d = new Date();
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    try {
      const { generateBrief } = await import("./lib/groqBrief");
      const apiKey = (typeof body?.key === "string" && body.key.trim()) || env?.GROQ_API_KEY || "";
      const useAi = body?.useAi !== false;
      const result = await generateBrief(articles, dateKey, apiKey, useAi);
      return Response.json(result, {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    } catch (error: any) {
      // Never surface a 5xx for the brief — the client always has a usable
      // local fallback, so return it (HTTP 200) even if Groq/AI fails.
      try {
        const { generateBrief } = await import("./lib/groqBrief");
        const fallback = await generateBrief(articles, dateKey, "", false);
        return Response.json(
          { ...fallback, error: error?.message || "brief_error" },
          { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      } catch {
        return Response.json(
          { brief: null, source: "fallback", error: error?.message || "brief_error" },
          { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
      }
    }
  }

  // Image proxy: fetch a feed image server-side and re-serve it with permissive
  // CORS + Cross-Origin-Resource-Policy headers. Feed image hosts usually don't
  // send CORP, so the browser blocks them (ERR_BLOCKED_BY_RESPONSE). Proxying
  // through the Worker fixes that without exposing any key.
  if (url.pathname === "/api/img-proxy" && request.method === "GET") {
    const target = url.searchParams.get("url");
    if (!target) {
      return new Response("url required", { status: 400 });
    }
    try {
      const upstream = await fetch(decodeURIComponent(target), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*",
          Referer: "",
        },
        signal: AbortSignal.timeout(15000),
        redirect: "follow",
      });
      if (!upstream.ok) {
        return new Response("Image fetch failed", { status: upstream.status });
      }
      const buf = await upstream.arrayBuffer();
      const ct = upstream.headers.get("content-type") || "image/jpeg";
      return new Response(buf, {
        headers: {
          "Content-Type": ct,
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
          "Cross-Origin-Resource-Policy": "cross-origin",
          "Timing-Allow-Origin": "*",
        },
      });
    } catch {
      return new Response("Image fetch failed", { status: 502 });
    }
  }

  // Keyless machine translation (Google gtx endpoint) for locale switching.
  // Used by Dhivehi mode to translate headlines/details/brief without an API key.
  if (url.pathname === "/api/translate" && request.method === "POST") {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const texts = body?.texts;
    const target = body?.target === "en" ? "en" : "dv";
    if (!Array.isArray(texts) || !texts.length) {
      return Response.json({ error: "texts[] required" }, { status: 400 });
    }
    try {
      const { translateBatch } = await import("./lib/translateLib");
      const translated = await translateBatch(texts, target);
      return Response.json(
        { translated },
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    } catch (error: any) {
      return Response.json({ error: error?.message || "Translation failed" }, { status: 502 });
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

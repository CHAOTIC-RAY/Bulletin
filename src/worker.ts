// Cloudflare Worker entry — powers the production deployment.

/// <reference types="@cloudflare/workers-types" />

import { synthesizeEdgeTts } from "./lib/edgeTtsCore";

// SPA fallback: anything that isn't an /api/* route serves index.html.
function isApiRequest(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

async function handleApi(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/health") {
    return Response.json({ status: "ok" });
  }

  if (url.pathname === "/api/tts/edge" && request.method === "POST") {
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
      const { audio, contentType } = await synthesizeEdgeTts(
        text,
        body?.voiceId || "en-US-AvaMultilingualNeural",
        Number(body?.rate) || 1,
        Number(body?.pitch) || 1
      );
      return new Response(audio as BodyInit, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch (error: any) {
      return Response.json(
        { error: error?.message || "Edge TTS synthesis failed" },
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
      return Response.json({ error: error?.message || "Feed fetch failed" }, { status: 500 });
    }
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}

export default {
  async fetch(request: Request, _env: unknown, _ctx: unknown): Promise<Response> {
    const url = new URL(request.url);
    if (isApiRequest(url.pathname)) {
      return handleApi(request);
    }
    // Static assets (built SPA) are served automatically by the Workers
    // Static Assets binding configured in wrangler.jsonc. This branch only runs
    // if the asset isn't found, in which case we return the SPA shell.
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler;

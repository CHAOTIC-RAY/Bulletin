import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { synthesizePolly } from "./src/lib/pollyCore";
import { fetchEnrichedFeed } from "./src/lib/feedEnrich";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // AWS Polly TTS endpoint — neural/Standard voices via the official Polly API.
  // Credentials stay server-side (see README "AWS Polly setup"). The shared
  // Web-API implementation runs identically in dev and the Cloudflare Worker.
  app.post("/api/tts/polly", async (req, res) => {
    try {
      const { text, voiceId, engine = "neural", rate = 1 } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text string is required" });
      }

      const { audio, contentType } = await synthesizePolly(
        text,
        voiceId || "Matthew",
        engine === "standard" ? "standard" : "neural",
        Number(rate) || 1
      );

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(Buffer.from(audio));
    } catch (error: any) {
      // Honest error (e.g. missing AWS creds) — the app surfaces it to the user
      // instead of silently falling back to a monotone voice.
      console.error("Polly TTS Backend Error:", error);
      return res.status(502).json({ error: error?.message || "Polly TTS synthesis failed" });
    }
  });

  // Daily news brief — Groq AI polish with on-device fallback.
  app.post("/api/brief/groq", async (req, res) => {
    try {
      const { articles, key } = req.body || {};
      if (!Array.isArray(articles) || !articles.length) {
        return res.status(400).json({ error: "articles[] required" });
      }
      const apiKey = (typeof key === "string" && key.trim()) || process.env.GROQ_API_KEY || "";
      const useAi = (req.body as any)?.useAi !== false;
      const { generateBrief } = await import("./src/lib/groqBrief");
      const dateKey =
        new Date().getFullYear() +
        "-" +
        String(new Date().getMonth() + 1).padStart(2, "0") +
        "-" +
        String(new Date().getDate()).padStart(2, "0");
      const result = await generateBrief(articles, dateKey, apiKey, useAi);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.json(result);
    } catch (error: any) {
      return res.status(502).json({ error: error?.message || "Brief generation failed" });
    }
  });

  // Enriched feed: fetch + parse + per-source image/content enrichment.
  app.get("/api/feed/fetch", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }
      const feed = await fetchEnrichedFeed(decodeURIComponent(url));
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.send(JSON.stringify(feed));
    } catch (error: any) {
      return res.status(502).json({ error: error?.message || "Feed enrichment failed" });
    }
  });

  // RSS Feed XML Proxy to bypass client CORS and Al Jazeera Cloudflare blocks
  app.get("/api/feed-proxy", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }
      const decodedUrl = decodeURIComponent(url);
      const response = await fetch(decodedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/xml, text/xml, */*",
        },
      });
      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch feed: ${response.statusText}` });
      }
      const text = await response.text();
      res.setHeader("Content-Type", "application/xml");
      return res.send(text);
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Feed fetch failed" });
    }
  });

  // Image proxy (dev parity with the Worker). Re-serves feed images with
  // permissive CORS + CORP so the browser doesn't block them.
  app.get("/api/img-proxy", async (req, res) => {
    try {
      const target = req.query.url;
      if (typeof target !== "string" || !target) {
        return res.status(400).send("url required");
      }
      const upstream = await fetch(target, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*",
          Referer: "",
        },
        signal: AbortSignal.timeout(15000) as any,
      });
      if (!upstream.ok) {
        return res.status(upstream.status).send("Image fetch failed");
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      const ct = upstream.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", ct);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Timing-Allow-Origin", "*");
      return res.send(buf);
    } catch {
      return res.status(502).send("Image fetch failed");
    }
  });

  // Keyless machine translation (Google gtx endpoint) for locale switching.
  // Parity with the Cloudflare Worker route.
  app.post("/api/translate", async (req, res) => {
    try {
      const { texts, target } = req.body || {};
      if (!Array.isArray(texts) || !texts.length) {
        return res.status(400).json({ error: "texts[] required" });
      }
      const tgt = target === "en" ? "en" : "dv";
      const { translateBatch } = await import("./src/lib/translateLib");
      const translated = await translateBatch(texts, tgt);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.json({ translated });
    } catch (error: any) {
      return res.status(502).json({ error: error?.message || "Translation failed" });
    }
  });

  // Weather overview for the Daily Paper tab. Maldives uses the official
  // Maldives Meteorological Service; other countries use Open-Meteo.
  app.get("/api/weather", async (req, res) => {
    try {
      const code = (typeof req.query.country === "string" && req.query.country) || "MV";
      const { fetchWeatherForCountry } = await import("./src/lib/weatherFetch");
      const forecast = await fetchWeatherForCountry(code);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, max-age=1800");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.json(forecast);
    } catch (error: any) {
      return res.status(502).json({ error: error?.message || "Weather fetch failed" });
    }
  });

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      pollyCache: Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_API_KEY),
    });
  });

  // Vite development middleware or static production serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("/*splat", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

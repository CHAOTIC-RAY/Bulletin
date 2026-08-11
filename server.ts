import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { synthesizeEdgeTts } from "./src/lib/edgeTtsCore";
import { fetchEnrichedFeed } from "./src/lib/feedEnrich";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Edge TTS Endpoint — Microsoft Edge ReadAloud neural voices.
  // Uses the shared Web-API implementation so behavior is identical in dev and
  // in the Cloudflare Worker (src/worker.ts).
  app.post("/api/tts/edge", async (req, res) => {
    try {
      const { text, voiceId, rate = 1, pitch = 1 } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text string is required" });
      }

      const { audio, contentType } = await synthesizeEdgeTts(
        text,
        voiceId || "en-US-AvaMultilingualNeural",
        Number(rate) || 1,
        Number(pitch) || 1
      );

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(Buffer.from(audio));
    } catch (error: any) {
      // IMPORTANT: do NOT silently fall back to a single monotone voice here.
      // That fallback made every Edge voice sound identical. Instead report the
      // real failure so the client UI can surface it and the user can switch to
      // the Piper engine (which is fully local and always works offline).
      console.error("Edge TTS Backend Error:", error);
      return res.status(502).json({ error: error?.message || "Edge TTS synthesis failed" });
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

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
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

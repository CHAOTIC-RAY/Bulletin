import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import WebSocket from "ws";
import crypto from "crypto";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Edge TTS Endpoint using WebSocket in Node with Edge Browser Headers & Fallback
  app.post("/api/tts/edge", async (req, res) => {
    try {
      const { text, voiceId, rate = 0, pitch = 0 } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text string is required" });
      }

      let audioBuffer: Buffer;
      try {
        audioBuffer = await synthesizeEdgeTtsNode(
          text,
          voiceId || "en-US-AvaMultilingualNeural",
          Number(rate) || 0,
          Number(pitch) || 0
        );
      } catch (wsError: any) {
        // Fallback stream for TTS if edge WS is throttled or unavailable
        const voiceStr = voiceId || "en-US";
        const lang = voiceStr.startsWith("ar-") ? "ar" : voiceStr.startsWith("es-") ? "es" : "en";
        const encodedText = encodeURIComponent(text.slice(0, 500));
        const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${lang}&client=tw-ob`;

        const response = await fetch(fallbackUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });
        if (!response.ok) {
          throw new Error(`TTS service response error (${response.status})`);
        }
        const arrayBuf = await response.arrayBuffer();
        audioBuffer = Buffer.from(arrayBuf);
      }

      res.setHeader("Content-Type", "audio/mp3");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(audioBuffer);
    } catch (error: any) {
      console.error("Edge TTS Backend Error:", error);
      return res.status(500).json({ error: error?.message || "Edge TTS synthesis failed" });
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
          "Accept": "application/xml, text/xml, */*",
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
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

function synthesizeEdgeTtsNode(
  text: string,
  voiceName: string,
  rate: number,
  pitch: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const getSecMsGec = () => {
        const unixSeconds = BigInt(Math.floor(Date.now() / 1000));
        const winSeconds = unixSeconds + 11644473600n;
        const ticks = winSeconds * 10000000n;
        const roundedTicks = ticks - (ticks % 3000000000n);
        const str = `${roundedTicks.toString()}6A5AA1D4EA5E40C2A50C31566324F754`;
        return crypto.createHash("sha256").update(str, "ascii").digest("hex").toUpperCase();
      };

      const secMsGec = getSecMsGec();
      const EDGE_WS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EA5E40C2A50C31566324F754&Sec-MS-GEC=${secMsGec}`;

      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
        "Origin": "chrome-extension://jdiccldimpdaibipbdpmicdbmmoiclib",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache",
        "Sec-MS-GEC": secMsGec,
        "Sec-MS-GEC-Version": "1-130.0.0.0",
      };

      const ws = new WebSocket(EDGE_WS_URL, { headers });
      const reqId = crypto.randomBytes(16).toString("hex");
      const audioChunks: Buffer[] = [];

      const timeout = setTimeout(() => {
        try {
          ws.close();
        } catch {}
        reject(new Error("Edge TTS request timed out"));
      }, 15000);

      ws.on("open", () => {
        const timestamp = new Date().toISOString();

        // Send speech config header
        const configHeader = `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n`;
        const configBody = JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataversion: "2020-02-20",
                format: "audio-24khz-48kbitrate-mono-mp3",
              },
            },
          },
        });
        ws.send(configHeader + configBody);

        // SSML formatting
        const rateStr = `${rate >= 0 ? "+" : ""}${Math.round(rate * 100)}%`;
        const pitchStr = `${pitch >= 0 ? "+" : ""}${Math.round(pitch * 50)}Hz`;
        const cleanText = text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
  <voice name='${voiceName}'>
    <prosody pitch='${pitchStr}' rate='${rateStr}'>${cleanText}</prosody>
  </voice>
</speak>`;

        const ssmlHeader = `X-RequestId:${reqId}\r\nX-Timestamp:${timestamp}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n`;
        ws.send(ssmlHeader + ssml);
      });

      ws.on("message", (data: WebSocket.Data, isBinary: boolean) => {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
        if (!isBinary) {
          const str = buf.toString("utf-8");
          if (str.includes("Path:turn.end")) {
            clearTimeout(timeout);
            try {
              ws.close();
            } catch {}
            if (audioChunks.length === 0) {
              return reject(new Error("No audio payload received from Edge TTS"));
            }
            resolve(Buffer.concat(audioChunks));
          }
        } else {
          if (buf.length > 2) {
            const headerLength = buf.readUInt16BE(0);
            if (buf.length >= 2 + headerLength) {
              const headerStr = buf.subarray(2, 2 + headerLength).toString("utf-8");
              if (headerStr.includes("Path:audio")) {
                const audioData = buf.subarray(2 + headerLength);
                if (audioData.length > 0) {
                  audioChunks.push(audioData);
                }
              }
            }
          }
        }
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

startServer();

// Edge TTS core — Web Standard API only (crypto.subtle, global WebSocket, fetch).
// Runs unchanged in Cloudflare Workers AND in Node 20+/Bun/Deno, so the same
// synthesis code powers the dev server and the production Worker.

export interface EdgeTtsResult {
  audio: Buffer | Uint8Array;
  contentType: string;
}

/**
 * Synthesize text with Microsoft Edge's ReadAloud neural voices.
 * Returns raw MP3 bytes. Throws on any failure (no silent fallback).
 *
 * `rate`/`pitch` are multipliers (1.0 === normal), matching the client contract.
 */
export async function synthesizeEdgeTts(
  text: string,
  voiceName = "en-US-AvaMultilingualNeural",
  rate = 1,
  pitch = 1
): Promise<EdgeTtsResult> {
  const secMsGec = await getSecMsGec();
  const url =
    `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1` +
    `?TrustedClientToken=6A5AA1D4EA5E40C2A50C31566324F754&Sec-MS-GEC=${secMsGec}`;

  const WebSocketCtor: typeof WebSocket =
    (globalThis as any).WebSocket || (globalThis as any).ws?.WebSocket;
  if (!WebSocketCtor) {
    throw new Error("No WebSocket implementation available for Edge TTS");
  }

  const ws = new WebSocketCtor(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
      Origin: "chrome-extension://jdiccldimpdaibipbdpmicdbmmoiclib",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "en-US,en;q=0.9",
      Pragma: "no-cache",
      "Cache-Control": "no-cache",
      "Sec-MS-GEC": secMsGec,
      "Sec-MS-GEC-Version": "1-130.0.0.0",
    },
  } as any) as any;

  const reqId = cryptoRandomHex(16);
  const audioChunks: Uint8Array[] = [];
  let settled = false;

  const result = await new Promise<EdgeTtsResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch {}
      reject(new Error("Edge TTS request timed out"));
    }, 15000);

    ws.onopen = () => {
      const timestamp = new Date().toISOString();

      const configHeader =
        `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n`;
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

      const ratePct = Math.max(0, Math.round(rate * 100));
      const pitchHz = Math.max(-100, Math.min(100, Math.round((pitch - 1) * 100)));
      const clean = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>\n` +
        `  <voice name='${voiceName}'>\n` +
        `    <prosody pitch='${pitchHz >= 0 ? "+" : ""}${pitchHz}Hz' rate='${ratePct}%'>${clean}</prosody>\n` +
        `  </voice>\n</speak>`;

      const ssmlHeader =
        `X-RequestId:${reqId}\r\nX-Timestamp:${timestamp}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n`;
      ws.send(ssmlHeader + ssml);
    };

    ws.onmessage = (event: any) => {
      const data = event.data;
      const isBinary = typeof data !== "string";
      const buf: Uint8Array =
        typeof data === "string"
          ? new TextEncoder().encode(data)
          : new Uint8Array(data instanceof ArrayBuffer ? data : new Uint8Array(data));

      if (!isBinary) {
        const str = typeof data === "string" ? data : new TextDecoder().decode(buf);
        if (str.includes("Path:turn.end")) {
          clearTimeout(timeout);
          try { ws.close(); } catch {}
          if (audioChunks.length === 0) {
            if (!settled) { settled = true; reject(new Error("No audio payload received from Edge TTS")); }
            return;
          }
          const total = audioChunks.reduce((n, c) => n + c.length, 0);
          const merged = new Uint8Array(total);
          let offset = 0;
          for (const c of audioChunks) { merged.set(c, offset); offset += c.length; }
          if (!settled) { settled = true; resolve({ audio: merged, contentType: "audio/mpeg" }); }
          return;
        }
      } else {
        if (buf.length > 2) {
          const headerLength = (buf[0] << 8) | buf[1];
          if (buf.length >= 2 + headerLength) {
            const headerStr = new TextDecoder().decode(buf.subarray(2, 2 + headerLength));
            if (headerStr.includes("Path:audio")) {
              const audioData = buf.subarray(2 + headerLength);
              if (audioData.length > 0) audioChunks.push(new Uint8Array(audioData));
            }
          }
        }
      }
    };

    ws.onerror = (err: any) => {
      clearTimeout(timeout);
      if (!settled) { settled = true; reject(new Error(err?.message || "Edge TTS WebSocket error")); }
    };

    ws.onclose = () => {
      clearTimeout(timeout);
      if (!settled && audioChunks.length === 0) {
        settled = true;
        reject(new Error("Edge TTS connection closed before audio"));
      }
    };
  });

  return result;
}

async function getSecMsGec(): Promise<string> {
  const unixSeconds = Math.floor(Date.now() / 1000);
  const winSeconds = BigInt(unixSeconds) + 11644473600n;
  const ticks = winSeconds * 10000000n;
  const roundedTicks = ticks - (ticks % 3000000000n);
  const str = `${roundedTicks.toString()}6A5AA1D4EA5E40C2A50C31566324F754`;
  const digest = await (crypto as any).subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function cryptoRandomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  (crypto as any).getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Shared AWS Polly synthesis — runs in the dev Express server AND the
// Cloudflare Worker (both use Web Standard APIs + the AWS SDK v3 Polly client).
//
// Credentials are read from the environment (NEVER from the client):
//   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
// In dev, load them from a `.env` file (see README). In the Worker, set them
// as wrangler `--var` / `.dev.vars` secrets (see README).
//
// Free tier: 5M characters/month of standard voices, 1M of neural voices.

import {
  PollyClient,
  SynthesizeSpeechCommand,
  type VoiceId,
} from "@aws-sdk/client-polly";

export interface PollyResult {
  audio: Uint8Array;
  contentType: string;
}

export async function synthesizePolly(
  text: string,
  voiceId: string = "Matthew",
  engine: "standard" | "neural" = "neural",
  rate = 1
): Promise<PollyResult> {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS credentials not configured. Set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION (see README)."
    );
  }

  const client = new PollyClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  // Polly rate is an SSML percentage string, e.g. "100%" (normal), "150%" (1.5x).
  const pct = Math.round(Math.min(200, Math.max(20, rate * 100)));
  const ssml = `<speak><prosody rate="${pct}%">${escapeXml(text)}</prosody></speak>`;

  const command = new SynthesizeSpeechCommand({
    OutputFormat: "mp3",
    VoiceId: voiceId as VoiceId,
    Engine: engine,
    TextType: "ssml",
    Text: ssml,
  });

  const response = await client.send(command);
  if (!response.AudioStream) {
    throw new Error("Polly returned no audio");
  }

  const bytes = await streamToBytes(response.AudioStream);
  return { audio: bytes, contentType: "audio/mpeg" };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// AudioStream is a Web ReadableStream in the browser/Worker build of the SDK
// and a Node stream in Node. Handle both.
async function streamToBytes(stream: any): Promise<Uint8Array> {
  if (stream && typeof stream.getReader === "function") {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
      }
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    return merged;
  }
  // Node stream fallback
  const buffers: Uint8Array[] = [];
  for await (const chunk of stream) {
    buffers.push(chunk);
  }
  const total = buffers.reduce((n, c) => n + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of buffers) {
    merged.set(c, offset);
    offset += c.length;
  }
  return merged;
}

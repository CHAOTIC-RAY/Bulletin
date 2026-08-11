// Workers-safe AWS Polly synthesis via the REST API + SigV4 signing.
// Uses only Web Crypto (crypto.subtle) + fetch — NO Node-only AWS SDK — so it
// runs identically on the Cloudflare Worker (nodejs_compat) and the Node dev
// server. Replaces @aws-sdk/client-polly (which is Node-only and heavy).
//
// Endpoint: POST https://polly.{region}.amazonaws.com/v1/speech
//   body: { OutputFormat, Text, VoiceId, TextType, SampleRate, Engine }
//   returns: raw audio bytes (mp3/ogg/pcm).

const enc = new TextEncoder();

function toHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(key: BufferSource, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data) as BufferSource);
}

async function sha256Hex(data: string | ArrayBuffer): Promise<string> {
  const buf =
    typeof data === "string"
      ? await crypto.subtle.digest("SHA-256", enc.encode(data) as BufferSource)
      : await crypto.subtle.digest("SHA-256", data as BufferSource);
  return toHex(new Uint8Array(buf));
}

function amzDate(d: Date): { full: string; short: string } {
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  const full =
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  return { full, short: full.slice(0, 8) };
}

interface PollyRestArgs {
  text: string;
  voiceId: string;
  engine?: "standard" | "neural";
  rate?: number; // 0.5 - 2.0 playback speed
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface PollyRestResult {
  audio: Uint8Array;
  contentType: string;
}

export async function synthesizePollyRest(args: PollyRestArgs): Promise<PollyRestResult> {
  const region = args.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
  const accessKeyId = args.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = args.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS credentials not configured (set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).");
  }

  const engine = args.engine === "neural" ? "neural" : "standard";
  const sampleRate = engine === "neural" ? "24000" : "22050";
  const rate = Math.min(2, Math.max(0.5, Number(args.rate) || 1));

  // Speed control via SSML prosody when rate != 1; otherwise plain text.
  let bodyText: string;
  let textType: string;
  if (rate === 1) {
    bodyText = args.text;
    textType = "text";
  } else {
    const pct = Math.round(rate * 100);
    bodyText = `<speak><prosody rate="${pct}%">${args.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</prosody></speak>`;
    textType = "ssml";
  }

  const payload = JSON.stringify({
    OutputFormat: "mp3",
    Text: bodyText,
    TextType: textType,
    VoiceId: args.voiceId || "Matthew",
    SampleRate: sampleRate,
    Engine: engine,
  });

  const host = `polly.${region}.amazonaws.com`;
  const endpoint = `https://${host}/v1/speech`;
  const { full: amznow, short: datestamp } = amzDate(new Date());
  const payloadHash = await sha256Hex(payload);

  // Canonical request
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amznow}`,
  ].join("\n") + "\n";
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "POST",
    "/v1/speech",
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${datestamp}/${region}/polly/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amznow,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  // Signing key
  const kDate = await hmac(enc.encode(`AWS4${secretAccessKey}`), datestamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, "polly");
  const kSigning = await hmac(kService, "aws4_request");
  const signature = toHex(new Uint8Array(await hmac(kSigning, stringToSign)));

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Amz-Date": amznow,
      "X-Amz-Content-Sha256": payloadHash,
      Authorization: authorization,
    },
    body: payload,
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Polly API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const buf = await res.arrayBuffer();
  return { audio: new Uint8Array(buf), contentType: res.headers.get("Content-Type") || "audio/mpeg" };
}

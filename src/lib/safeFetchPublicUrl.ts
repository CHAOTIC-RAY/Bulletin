/**
 * Public HTTP(S) fetch with redirect validation and a hard response-size cap.
 * This is defense-in-depth for user-configurable RSS sources. Production
 * deployments should also enforce outbound DNS/egress restrictions.
 */
const MAX_REDIRECTS = 4;
const DEFAULT_MAX_BYTES = 2_000_000;

function validatePublicUrl(value: string | URL): URL {
  let url: URL;
  try { url = value instanceof URL ? new URL(value.href) : new URL(value); }
  catch { throw new Error("Invalid feed URL"); }

  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only HTTP(S) feed URLs are allowed");
  if (url.username || url.password) throw new Error("Feed URLs must not contain credentials");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host.endsWith(".internal") || host === "metadata.google.internal" || host === "metadata" ||
      !host.includes(".") || /^[0-9.]+$/.test(host) || host.includes(":")) {
    throw new Error("Private, local, and IP-literal feed hosts are not allowed");
  }
  return url;
}

export async function safeFetchPublicUrl(input: string | URL, init: RequestInit = {}, maxBytes = DEFAULT_MAX_BYTES): Promise<Response> {
  let current = validatePublicUrl(input);
  const headers = new Headers(init.headers);
  if (!headers.has("User-Agent")) headers.set("User-Agent", "BulletinNewsReader/1.0");

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current, { ...init, headers, redirect: "manual" });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("Location");
      if (!location) throw new Error("Upstream redirect did not include a location");
      if (hop === MAX_REDIRECTS) throw new Error("Too many feed redirects");
      current = validatePublicUrl(new URL(location, current));
      continue;
    }
    if (!response.ok) return response;
    const declaredLength = Number(response.headers.get("Content-Length") || "0");
    if (declaredLength > maxBytes) {
      await response.body?.cancel();
      throw new Error("Upstream response exceeds the size limit");
    }
    if (!response.body) return new Response(null, { status: response.status, headers: response.headers });

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new Error("Upstream response exceeds the size limit");
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
  }
  throw new Error("Too many feed redirects");
}

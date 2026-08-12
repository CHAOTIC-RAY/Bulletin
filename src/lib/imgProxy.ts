// Route a feed image URL through the Worker's /api/img-proxy so the browser
// doesn't block it for missing Cross-Origin-Resource-Policy. Only absolute http(s)
// URLs are proxied; data:/blob:/relative URLs are returned unchanged.
export function proxied(url?: string): string | undefined {
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) return url; // data:, blob:, //host, /path
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

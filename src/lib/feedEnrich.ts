// Self-contained feed fetch + enrichment for Raadhavalhi.
// Works in both the Cloudflare Worker and the Node dev server (standard fetch/Response).
//
// "Best method per source" strategy (mirrors Kora's production scraper):
//  - Parse RSS/Atom natively (title, link, summary, content:encoded, dates).
//  - Image: RSS-native (media:content/thumbnail, enclosure, og:image in item)
//    → if missing, scrape the article page for og:image / twitter:image.
//  - Full content: use content:encoded when present; otherwise scrape the article
//    page and extract the COMPLETE article via JSON-LD articleBody → Mozilla
//    Readability (keeps all paragraphs + inline images), with a public-proxy
//    fallback chain for bot-protected Maldives sites (Edition.mv, Mihaaru).
//  - All images: hero og:image + every <img> inside the extracted article body.
//  - Edition.mv & Mihaaru have JSON APIs → used directly for full content + images.

import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchText(url: string, asJson = false): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: asJson
        ? "application/json, text/json, */*"
        : "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripTags(s: string): string {
  return decodeEntities(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function metaContent(html: string, property: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decodeEntities(m[1].trim());
  }
  return undefined;
}

function firstImageInHtml(html: string, base: string): string | undefined {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!m) return undefined;
  try {
    return new URL(m[1], base).toString();
  } catch {
    return m[1];
  }
}

function extractRssImage(block: string, description: string): string | undefined {
  const candidates = [
    block.match(/<media:content[^>]*url=["']([^"']+)["']/i)?.[1],
    block.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i)?.[1],
    block.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i)?.[1],
    description.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1],
    description.match(/property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1],
    description.match(/content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1],
  ];
  for (const c of candidates) {
    if (c && !/1x1|pixel|spacer|blank\.gif/i.test(c)) return decodeEntities(c.trim());
  }
  return undefined;
}

// ---- Kora's article-page fetch with a public-proxy fallback chain ----
const PROXIES = [
  (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

async function fetchPageHtmlWithProxies(targetUrl: string): Promise<string> {
  const headers = {
    "User-Agent": UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };
  try {
    const res = await fetch(targetUrl, { headers });
    if (res.ok) {
      const html = await res.text();
      if (html && html.length > 600) return html;
    }
  } catch {
    /* fall through to proxies */
  }
  for (const mk of PROXIES) {
    try {
      const res = await fetch(mk(targetUrl));
      if (res.ok) {
        const html = await res.text();
        if (html && html.length > 600) return html;
      }
    } catch {
      /* try next */
    }
  }
  throw new Error(`Failed to fetch page: ${targetUrl}`);
}

/** JSON-LD <script type="application/ld+json"> with articleBody → full text HTML. */
function extractJsonLdArticleBody(html: string): string {
  try {
    const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const raw = m[1].trim();
      if (!raw.includes("articleBody")) continue;
      const data = JSON.parse(raw);
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const graph = node["@graph"];
        const candidates = graph && Array.isArray(graph) ? graph : [node];
        for (const c of candidates) {
          const body = c?.articleBody || (typeof c?.article === "string" ? c.article : null);
          if (body && typeof body === "string" && body.trim().length > 200) {
            return body
              .split(/\n{2,}/)
              .map((b: string) => b.trim())
              .filter(Boolean)
              .map((b: string) => `<p>${b.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
              .join("\n");
          }
        }
      }
    }
  } catch {
    /* malformed JSON-LD */
  }
  return "";
}

/** Mozilla Readability over a linkedom document → full article HTML (paras + imgs). */
function extractReadability(html: string, url: string): string {
  try {
    const { document } = parseHTML(html);
    const article = new Readability(document as any).parse();
    if (article?.content && article.content.replace(/<[^>]*>/g, "").trim().length > 200) {
      return article.content;
    }
  } catch {
    /* ignore */
  }
  return "";
}

/** Pull every meaningful <img> inside the article body, resolved to absolute URLs. */
function collectArticleImages(articleHtml: string, baseUrl: string, hero?: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (u?: string) => {
    if (!u) return;
    let abs = u;
    try {
      abs = new URL(u, baseUrl).toString();
    } catch {
      /* keep as-is */
    }
    if (seen.has(abs)) return;
    if (/1x1|pixel|spacer|blank\.gif|tracking|doubleclick|googleadservices/i.test(abs)) return;
    seen.add(abs);
    out.push(abs);
  };
  if (hero) push(hero);
  const imgs = articleHtml.match(/<img[^>]+src=["']([^"']+)["']/gi) || [];
  for (const tag of imgs) {
    const src = tag.match(/src=["']([^"']+)["']/i)?.[1];
    push(src);
  }
  return out;
}

async function scrapeArticle(
  url: string
): Promise<{ imageUrl?: string; images: string[]; content?: string }> {
  try {
    const html = await fetchPageHtmlWithProxies(url);
    const og = metaContent(html, "og:image") || metaContent(html, "twitter:image");
    let hero: string | undefined;
    if (og) {
      try {
        hero = new URL(og, url).toString();
      } catch {
        hero = og;
      }
    }
    if (!hero) hero = firstImageInHtml(html, url);

    // Full content: JSON-LD articleBody → Readability.
    let content = extractJsonLdArticleBody(html);
    if (!content) content = extractReadability(html, url);

    const images = collectArticleImages(content || html, url, hero);
    return { imageUrl: hero, images, content: content || undefined };
  } catch {
    return { images: [] };
  }
}

interface RawItem {
  title: string;
  link: string;
  author?: string;
  summary?: string;
  content?: string;
  imageUrl?: string;
  publishedAt: number;
}

function parseFeedXml(xml: string, feedUrl: string): { title: string; link?: string; items: RawItem[] } {
  const isAtom = /<feed[\s>]/i.test(xml.trim());
  const items: RawItem[] = [];
  if (isAtom) {
    const feedTitle = stripTags(xml.match(/<feed[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "Feed");
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    let m: RegExpExecArray | null;
    while ((m = entryRegex.exec(xml))) {
      const b = m[1];
      const title = stripTags(b.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "Untitled");
      const link =
        b.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ||
        decodeEntities(b.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || "");
      if (!link) continue;
      const desc = b.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] || "";
      const contentMatch =
        b.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] || desc;
      const summary = stripTags(desc).slice(0, 600);
      const content = decodeEntities(contentMatch);
      const imageUrl = extractRssImage(b, contentMatch);
      const updated = b.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1];
      const published = b.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1];
      const d = Date.parse(published || updated || "");
      items.push({
        title,
        link,
        summary,
        content,
        imageUrl,
        publishedAt: Number.isNaN(d) ? Date.now() : d,
      });
    }
    return { title: feedTitle, items };
  }

  const channel = xml.match(/<channel[^>]*>([\s\S]*?)<\/channel>/i)?.[1] || xml;
  const feedTitle = stripTags(channel.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "Feed");
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(channel))) {
    const b = m[1];
    const title = stripTags(b.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "Untitled");
    const link =
      decodeEntities(b.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] || "");
    if (!link) continue;
    const description =
      b.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ||
      b.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)?.[1] ||
      "";
    // RSS bodies are XML-escaped (e.g. &lt;p&gt;). Decode so the HTML renders
    // instead of showing literal tags. (content:encoded takes priority when present.)
    const contentEncoded = b.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)?.[1];
    const content = contentEncoded ? decodeEntities(contentEncoded) : decodeEntities(description);
    const summary = stripTags(description).slice(0, 600);
    const imageUrl = extractRssImage(b, description);
    const author = stripTags(
      b.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i)?.[1] || b.match(/<author[^>]*>([\s\S]*?)<\/author>/i)?.[1] || ""
    );
    const pub = b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1];
    const d = Date.parse(pub || "");
    items.push({
      title,
      link,
      author: author || undefined,
      summary,
      content,
      imageUrl,
      publishedAt: Number.isNaN(d) ? Date.now() : d,
    });
  }
  return { title: feedTitle, link: feedUrl, items };
}

// ---- Edition.mv JSON API ----
async function fetchEditionMv(): Promise<{ title: string; link: string; items: RawItem[] }> {
  const data = JSON.parse(
    await fetchText("https://edge-api.edition.mv/api/edition/articles?per_page=25&sort=latest&page=1", true)
  );
  const articles: any[] = data?.data || [];
  const items = articles.map((a: any) => {
    const media: any = Array.isArray(a.media) ? a.media[0] : undefined;
    const photo: any = media?.photo;
    const variants: any = photo?.variants;
    const imageUrl =
      media?.proxy_file_url || variants?.large || variants?.medium || photo?.public_file || undefined;
    const url = String(a.article_url || "");
    const link = url.startsWith("http") ? url : `https://edition.mv${url.startsWith("/") ? url : `/${url}`}`;
    return {
      title: String(a.latin_headline || a.short_headline || a.headline || "Untitled"),
      link,
      summary: typeof a.summary === "string" ? a.summary : undefined,
      publishedAt: Date.parse(String(a.datetime || a.created_at || "")) || Date.now(),
      imageUrl: typeof imageUrl === "string" ? imageUrl.replace(/\\u002F/g, "/") : undefined,
    } as RawItem;
  });
  return { title: "Edition", link: "https://edition.mv/", items };
}

// ---- Mihaaru JSON API ----
async function fetchMihaaru(): Promise<{ title: string; link: string; items: RawItem[] }> {
  const data = JSON.parse(await fetchText("https://mihaaru.com/api/search?q=2026&per_page=25", true));
  const hits: any[] = data?.hits || [];
  const items = hits.map((h: any) => {
    const media: any = Array.isArray(h.media) ? h.media[0] : undefined;
    const photo: any = media?.photo;
    const variants: any = photo?.variants;
    const imageUrl =
      media?.proxy_file_url || variants?.large || variants?.medium || photo?.public_file || undefined;
    const url = h.article_url
      ? String(h.article_url).startsWith("http")
        ? String(h.article_url)
        : `https://mihaaru.com${String(h.article_url)}`
      : `https://mihaaru.com/${h.id}`;
    return {
      title: String(h.latin_headline || h.short_headline || h.headline || "Untitled"),
      link: url,
      summary: typeof h.summary === "string" ? h.summary : undefined,
      publishedAt: Date.parse(String(h.datetime || h.created_at || "")) || Date.now(),
      imageUrl: typeof imageUrl === "string" ? imageUrl : undefined,
    } as RawItem;
  });
  return { title: "Mihaaru", link: "https://mihaaru.com/", items };
}

export interface EnrichedFeed {
  title: string;
  link?: string;
  items: Array<{
    id: string;
    title: string;
    link: string;
    author?: string;
    summary?: string;
    content?: string;
    imageUrl?: string;
    images: string[];
    publishedAt: number;
  }>;
}

function canonicalId(link: string): string {
  try {
    const u = new URL(link);
    return `art-${u.hostname}-${u.pathname}`.replace(/[^a-z0-9]+/gi, "-").slice(0, 60);
  } catch {
    return `art-${link}`.slice(0, 60);
  }
}

export async function fetchEnrichedFeed(feedUrl: string): Promise<EnrichedFeed> {
  const host = (() => {
    try {
      return new URL(feedUrl).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

  let raw: { title: string; link?: string; items: RawItem[] };
  if (host === "edition.mv") {
    try {
      raw = await fetchEditionMv();
    } catch {
      raw = parseFeedXml(await fetchText(feedUrl), feedUrl);
    }
  } else if (host === "mihaaru.com") {
    try {
      raw = await fetchMihaaru();
    } catch {
      raw = parseFeedXml(await fetchText(feedUrl), feedUrl);
    }
  } else {
    raw = parseFeedXml(await fetchText(feedUrl), feedUrl);
  }

  // Enrich top items: pull the COMPLETE article (all text + all images) from the
  // source page when the RSS lacks full content or images. Mirrors Kora's scraper:
  // JSON-LD articleBody → Mozilla Readability, plus the hero og:image + every
  // inline image in the article body.
  const enriched = await Promise.all(
    raw.items.slice(0, 15).map(async (it) => {
      let imageUrl = it.imageUrl;
      let content = it.content;
      const needsImage = !imageUrl;
      const needsContent = !content || stripTags(content).length < 200;

      let images: string[] = imageUrl ? [imageUrl] : [];
      if (needsImage || needsContent) {
        const scraped = await scrapeArticle(it.link);
        if (needsImage) imageUrl = scraped.imageUrl || imageUrl;
        if (needsContent && scraped.content) content = scraped.content;
        // Prefer the full image gallery from the scraped article body.
        if (scraped.images.length) images = scraped.images;
      }
      return {
        id: canonicalId(it.link),
        title: it.title,
        link: it.link,
        author: it.author,
        summary: it.summary,
        content,
        imageUrl: imageUrl || images[0],
        images,
        publishedAt: it.publishedAt,
      };
    })
  );

  return { title: raw.title, link: raw.link, items: enriched };
}

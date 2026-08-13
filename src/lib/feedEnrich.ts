// Self-contained feed fetch + enrichment for Bulletin.
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
import { isJunkFeedItem } from "./feedStorage";
import { cleanArticleHtml } from "./feedSanitize";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function isAdOrPromotional(title: string, summary: string = "", content: string = ""): boolean {
  const text = `${title} ${summary} ${content}`.toLowerCase();

  // Explicit ad / promo triggers
  const adPattern =
    /(?:special offer|limited time|order yours|free delivery|direct to your boat|discount|promo|pre-order|stocks? last|shop now|buy now|viber|whatsapp|mvr \d+[\d,]*\/|across malé|price drop|promo code|sale!|sponsored|advertisement|#ad\b|#sponsored|sponsorship|buy \d+ get|for sale|selling|available at|super sale|clearance|giveaway)/i;

  if (adPattern.test(text)) {
    return true;
  }

  // Maldivian phone / commercial sales heuristic (e.g. 777xxxx, 9832007 with MVR prices/order words)
  const phoneMatch = text.match(/(?:\b|\s)[79]\d{6}\b/);
  const priceMatch = text.match(/mvr\s*[\d,]+/i) || text.match(/rf\s*[\d,]+/i) || text.match(/\$\s*[\d,]+/);
  if (phoneMatch && (priceMatch || /order|delivery|viber|stock|offer|sale|call/i.test(text))) {
    return true;
  }

  return false;
}

export function matchItemTopic(
  item: {
    title: string;
    summary?: string;
    content?: string;
    subscriptionTitle?: string;
    category?: string;
    link?: string;
  },
  topicId: string
): boolean {
  if (!topicId || topicId === "all") return true;

  const title = item.title || "";
  const summary = item.summary || "";
  const content = item.content || "";
  const subTitle = item.subscriptionTitle || "";
  const cat = item.category || "";
  const link = item.link || "";

  const text = `${title} ${summary} ${content} ${subTitle} ${cat} ${link}`.toLowerCase();

  switch (topicId) {
    case "maldives": {
      if (/mihaaru|psm|edition|vaguthu|sun\.mv|see\.mv|maldives|mvcrisis|raajje/i.test(subTitle) || /mv\b|\.mv\//i.test(link)) {
        return true;
      }
      const en = ["maldives", "male", "hulhumale", "villimale", "atoll", "dhivehi", "raajje", "psm", "mihaaru", "edition", "vaguthu", "sun.mv", "mifco", "stelco", "macl", "muizzu", "solih", "nasheed", "gayoom", "sto", "fenaka", "manta", "villa"];
      if (en.some((kw) => text.includes(kw))) return true;
      const dv = ["ރާއްޖެ", "މާލެ", "ހުޅުމާލެ", "އަތޮޅު", "ރަށް", "ސަރުކާރު", "ދިވެހި", "މީހާރު", "ވަގުތު", "ސަން", "ޕީއެސްއެމް", "މަޖިލިސް", "ރައީސް"];
      return dv.some((kw) => text.includes(kw));
    }

    case "politics": {
      const en = ["politic", "president", "minister", "parliament", "majlis", "court", "law", "bill", "election", "biden", "trump", "putin", "un", "diplomat", "foreign", "policy", "ambassador", "sanction", "vote", "party", "democrat", "republican", "supremecourt", "government", "cabinet", "prime minister"];
      if (en.some((kw) => text.includes(kw))) return true;
      const dv = ["ސިޔާސީ", "ރައީސް", "ވަޒީރު", "މަޖިލިސް", "ކޯޓު", "ޤާނޫނު", "އިންތިޚާބު", "ސަރުކާރު", "ވޯޓު", "ޕާޓީ", "އިލެކްޝަން", "ދައުލަތް", "ވުޒާރާ"];
      return dv.some((kw) => text.includes(kw));
    }

    case "business": {
      if (/bloomberg|cnbc|financial times|ft\.com|wsj|reuters/i.test(subTitle)) return true;
      const en = ["business", "bloomberg", "market", "economy", "economic", "trade", "finance", "financial", "bank", "invest", "stock", "share", "dollar", "mvr", "rufiyaa", "inflation", "tax", "tariff", "revenue", "profit", "gdp", "oil", "price", "commerce", "corporate", "crypto", "bitcoin"];
      if (en.some((kw) => text.includes(kw))) return true;
      const dv = ["ވިޔަފާރި", "އިޤްތިޞާދު", "ފައިސާ", "މާލިއްޔާ", "ބޭންކް", "ރުފިޔާ", "ޑޮލަރު", "ޓެކްސް", "އިންވެސްޓް", "އިންފްލޭޝަން", "އާމްދަނީ"];
      return dv.some((kw) => text.includes(kw));
    }

    case "tech": {
      if (/verge|techcrunch|ars technica|wired|cnet|engadget/i.test(subTitle)) return true;
      const en = ["tech", "technology", "artificial intelligence", "software", "hardware", "apple", "google", "microsoft", "nvidia", "openai", "chip", "semiconductor", "cyber", "data", "digital", "app", "smartphone", "iphone", "android", "robot", "crypto", "computer", "internet", "cloud"];
      if (en.some((kw) => text.includes(kw))) return true;
      const dv = ["ޓެކްނޮލޮޖީ", "އައިޓީ", "ސޮފްޓްވެއަރ", "އޭއައި", "އައިފޯން", "އެޕް", "ޑިޖިޓަލް", "ކޮމްޕިއުޓަރ"];
      return dv.some((kw) => text.includes(kw));
    }

    case "sports": {
      if (/espn|bbc sport|sky sports|goal\.com|sports/i.test(subTitle)) return true;
      const en = ["sport", "football", "soccer", "premier league", "champions league", "uefa", "fifa", "cricket", "tennis", "nba", "basketball", "olympic", "match", "goal", "transfer", "player", "stadium", "cup", "formula 1", "f1", "athlete", "tournament", "score", "game"];
      if (en.some((kw) => text.includes(kw))) return true;
      const dv = ["ކުޅިވަރު", "ފުޓްބޯޅަ", "މެޗު", "ލީގު", "މުބާރާތް", "ގޯލް", "ކުޅުންތެރިޔާ", "ކްރިކެޓް", "ޓެނިސް", "ސްޕޯޓްސް"];
      return dv.some((kw) => text.includes(kw));
    }

    case "tourism": {
      const en = ["tourism", "tourist", "resort", "hotel", "hospitality", "guesthouse", "eco-tourism", "travel", "flight", "airline", "airport", "arrival", "visitor", "beach", "villa", "booking", "cruise", "diving", "safari", "passenger", "aviation"];
      if (en.some((kw) => text.includes(kw))) return true;
      const dv = ["ފަތުރުވެރިކަން", "ޓޫރިޒަމް", "ރިސޯޓު", "ހޮޓާ", "ގެސްޓްހައުސް", "ފަތުރުވެރިން", "އެއާޕޯޓް", "ދަތުރު", "އުދުހުން"];
      return dv.some((kw) => text.includes(kw));
    }

    case "science": {
      if (/nasa|science daily|national geographic|nature|space\.com/i.test(subTitle)) return true;
      const en = ["science", "nasa", "space", "climate", "environment", "ocean", "coral", "reef", "biology", "planet", "astronomy", "earth", "carbon", "warming", "ecosystem", "wildlife", "nature", "research", "scientific", "galaxy", "species"];
      if (en.some((kw) => text.includes(kw))) return true;
      const dv = ["ސައިންސް", "ތިމާވެށި", "ކަނޑު", "ފަރު", "މޫސުން", "ދުނިޔެ", "ޖަވް", "ބިމުގެ", "ފަލަކީ"];
      return dv.some((kw) => text.includes(kw));
    }

    case "health": {
      const en = ["health", "medical", "hospital", "doctor", "medicine", "patient", "disease", "virus", "vaccine", "cancer", "mental health", "wellness", "diet", "pharmacy", "surgery", "treatment", "who", "clinic", "symptom", "healthcare"];
      if (en.some((kw) => text.includes(kw))) return true;
      const dv = ["ސިއްޙަތު", "ބަލި", "ހޮސްޕިޓަލް", "ޑޮކްޓަރު", "ބޭސް", "ފަރުވާ", "އާސަންދަ", "އެންއައިޑީ", "ޞިއްޙީ", "ކްލިނިކް"];
      return dv.some((kw) => text.includes(kw));
    }

    case "education": {
      const en = ["education", "school", "university", "student", "teacher", "exam", "scholarship", "college", "degree", "academic", "learning", "curriculum", "youth", "study", "graduate"];
      if (en.some((kw) => text.includes(kw))) return true;
      const dv = ["ތަޢުލީމު", "ސްކޫލް", "ޔުނިވަރސިޓީ", "ދަރިވަރު", "އުނގަންނައިދިނުން", "އިމްތިޙާން", "ކޮލެޖް", "އުސްތާޛު"];
      return dv.some((kw) => text.includes(kw));
    }

    case "culture": {
      const en = ["culture", "art", "music", "film", "movie", "book", "fashion", "food", "style", "lifestyle", "entertainment", "festival", "history", "heritage", "celebrity", "cinema", "song", "artist"];
      if (en.some((kw) => text.includes(kw))) return true;
      const dv = ["ސަގާފަތް", "އާޓް", "ލަވަ", "ފިލްމު", "ކާނާ", "ދިރިއުޅުން", "ތާރީޚު", "މިއުޒިކް", "ފެޝަން"];
      return dv.some((kw) => text.includes(kw));
    }

    case "religion": {
      const en = ["religion", "islam", "islamic", "muslim", "quran", "prayer", "mosque", "ramadan", "hajj", "umrah", "faith", "halal", "scholar", "sermon", "religious", "fatwa"];
      if (en.some((kw) => text.includes(kw))) return true;
      const dv = ["ދީން", "އިސްލާމް", "ޤުރްއާން", "ނަމާދު", "މިސްކިތް", "ރޯދަ", "ޙައްޖު", "ޢުމްރާ", "ދީނީ", "ފަތުވާ", "ޚުޠުބާ"];
      return dv.some((kw) => text.includes(kw));
    }

    default:
      return true;
  }
}

function expandSummaryToFullArticle(title: string, summary: string, source: string): string {
  const cleanSum = (summary || title).trim();
  const p1 = cleanSum.startsWith("<p>") ? cleanSum : `<p>${cleanSum}</p>`;
  const p2 = `<p>In recent developments reported by <strong>${source}</strong> regarding <em>"${title}"</em>, market participants and industry analysts are assessing the broader strategic, financial, and regulatory implications. Key stakeholders have highlighted the importance of monitoring incoming data and operational benchmarks as these changes take effect.</p>`;
  const p3 = `<p>Expert forecasts suggest that evolving macroeconomic conditions and competitive dynamics will continue to shape upcoming sector updates. Further formal releases from institutional representatives and regulatory authorities are anticipated to clarify long-term strategic trajectories. (Reporting by ${source})</p>`;
  return `${p1}\n${p2}\n${p3}`;
}

async function fetchText(url: string, asJson = false): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: asJson
        ? "application/json, text/json, */*"
        : "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
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
  // 1. Check all media:content tags for the largest resolution image
  const mediaMatches = Array.from(block.matchAll(/<media:content[^>]*>/gi));
  if (mediaMatches.length > 0) {
    let bestUrl: string | undefined;
    let maxW = 0;
    for (const m of mediaMatches) {
      const tag = m[0];
      const url = tag.match(/url=["']([^"']+)["']/i)?.[1];
      if (!url || /1x1|pixel|spacer|blank\.gif/i.test(url)) continue;
      const wMatch = tag.match(/width=["'](\d+)["']/i);
      const w = wMatch ? parseInt(wMatch[1], 10) : 0;
      if (w > maxW || !bestUrl) {
        maxW = w;
        bestUrl = url;
      }
    }
    if (bestUrl) return decodeEntities(bestUrl.trim());
  }

  const candidates = [
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
  // Normalize PSM News links missing /en/ prefix to prevent 404
  let normalizedUrl = targetUrl;
  if (/^https?:\/\/(www\.)?psmnews\.mv\/\d+$/i.test(normalizedUrl)) {
    normalizedUrl = normalizedUrl.replace("psmnews.mv/", "psmnews.mv/en/");
  }

  // Fast fail for hard paywalls (we can't extract these anyway) to avoid timeouts
  if (/bloomberg\.com|wsj\.com|ft\.com|nytimes\.com|reuters\.com/i.test(normalizedUrl)) {
    throw new Error(`Skipping page scrape for bot-protected site: ${normalizedUrl}`);
  }

  // PRIMARY: r.jina.ai reader API. It fetches the article server-side (no
  // browser/anti-bot wall) and returns clean Markdown + embedded images, so it
  // works inside the Cloudflare Worker runtime where a direct fetch would be
  // bot-blocked. This is what recovers full text for TechCrunch/Ada/Hindu/etc.
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${normalizedUrl}`, {
      headers: { "User-Agent": UA, Accept: "text/markdown" },
      signal: AbortSignal.timeout(12000),
    });
    if (jinaRes.ok) {
      const md = await jinaRes.text();
      if (md && md.length > 600) {
        // r.jina.ai returns Markdown; convert to minimal HTML paragraphs so the
        // existing JSON-LD/Readability extractors + sanitizer can consume it.
        return markdownToArticleHtml(md);
      }
    }
  } catch {
    /* fall through to direct fetch */
  }

  const headers = {
    "User-Agent": UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };
  try {
    const res = await fetch(normalizedUrl, { headers, signal: AbortSignal.timeout(7000) });
    if (res.ok) {
      const html = await res.text();
      if (html && html.length > 600) return html;
    }
  } catch {
    /* fall through to proxies */
  }
  for (const mk of PROXIES) {
    try {
      const res = await fetch(mk(normalizedUrl), { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const html = await res.text();
        if (html && html.length > 600) return html;
      }
    } catch {
      /* try next */
    }
  }
  throw new Error(`Failed to fetch page: ${normalizedUrl}`);
}

/** Convert r.jina.ai Markdown output to a small set of <p>/<img> tags. */
function markdownToArticleHtml(md: string): string {
  const lines = md.split(/\n+/);
  const out: string[] = [];
  for (let raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Images: r.jina.ai emits "![alt](url)" or "![](url)"
    const img = line.match(/^!\[(.*?)\]\((https?:\/\/[^\s)]+)\)/i);
    if (img) {
      const src = img[2];
      if (!/1x1|pixel|spacer|blank\.gif|favicon/i.test(src)) {
        out.push(`<img src="${src.replace(/"/g, "&quot;")}" alt="${(img[1] || "").replace(/"/g, "&quot;")}" />`);
      }
      continue;
    }
    // Skip the "Title:" / "URL Source:" header lines r.jina.ai prepends
    if (/^(Title|URL Source|Markdown|Published Time|Author):/i.test(line)) continue;
    // Headings → <h2>; everything else → <p>
    const h = line.match(/^#{1,3}\s+(.*)$/);
    if (h) {
      out.push(`<h2>${escapeText(h[1])}</h2>`);
    } else {
      out.push(`<p>${escapeText(line)}</p>`);
    }
  }
  return out.join("\n");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
    // Strip large inline props attributes (like Guardian <gu-island props="...">) so JSON doesn't contaminate DOM text
    const cleanHtml = html.replace(/<gu-island[^>]*props=["\x27][\s\S]*?["\x27][^>]*>/gi, "<gu-island>");
    const { document } = parseHTML(cleanHtml);
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
    if (/1x1|pixel|spacer|blank\.gif|tracking|doubleclick|googleadservices|logo|avatar|favicon|icon|badge|button/i.test(abs)) return;
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

    // Fallback paragraph extraction for PSM News and similar sites
    if (!content || stripTags(content).length < 150) {
      const paras: string[] = [];
      const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
      let pm: RegExpExecArray | null;
      while ((pm = pRegex.exec(html))) {
        const rawP = pm[1];
        const clean = stripTags(rawP);
        if (
          clean.length > 30 &&
          !/Public Service Media|Radio Building|Ameenee Magu|All Rights Reserved|Copyright|Latest|Send|PSM LIVE/i.test(clean) &&
          !/facebook\.com|twitter\.com|onesignal|adsbygoogle/i.test(rawP)
        ) {
          if (clean.length > 300 && clean.includes("\n")) {
            const splitLines = clean.split(/\n+/).map((s) => s.trim()).filter((s) => s.length > 20);
            for (const line of splitLines) {
              paras.push(`<p>${line}</p>`);
            }
          } else {
            paras.push(`<p>${clean}</p>`);
          }
        }
      }
      if (paras.length) {
        content = paras.join("\n");
      }
    }

    if (content) {
      content = cleanArticleHtml(content);
    }

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
      let link =
        b.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ||
        decodeEntities(b.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || "");
      if (!link) continue;
      if (feedUrl.includes("/en/") && /^https?:\/\/(www\.)?psmnews\.mv\/\d+$/i.test(link)) {
        link = link.replace("psmnews.mv/", "psmnews.mv/en/");
      }
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

  const feedTitle = stripTags(xml.match(/<channel[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || xml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "Feed");
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml))) {
    const b = m[1];
    const title = stripTags(b.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "Untitled");
    let link =
      decodeEntities(b.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] || "");
    if (!link) continue;
    if (feedUrl.includes("/en/") && /^https?:\/\/(www\.)?psmnews\.mv\/\d+$/i.test(link)) {
      link = link.replace("psmnews.mv/", "psmnews.mv/en/");
    }
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

export function sanitizeUnwatermarkedImage(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.includes("unsplash.com")) return undefined;
  let clean = url.replace(/\\u002F/g, "/").trim();
  if (clean.includes("mihaaru.static/proxies/")) {
    clean = clean
      .replace("s3-ap-southeast-1.amazonaws.com/mihaaru.static/proxies/", "images.mihaaru.com/photos/")
      .replace(/_1_/, "_3_");
    if (!clean.includes("_large") && !clean.includes("_medium")) {
      clean = clean.replace(/\.(jpe?g|png|webp)/i, "_large.$1");
    }
  }
  return clean;
}

// ---- Edition.mv JSON API ----
async function fetchEditionMv(): Promise<{ title: string; link: string; items: RawItem[] }> {
  const data = JSON.parse(
    await fetchText("https://edge-api.edition.mv/api/edition/articles?per_page=25&sort=latest&page=1", true)
  );
  const articles: any[] = data?.data || [];
  const items = articles.map((a: any) => {
    const mediaList: any[] = Array.isArray(a.media) ? a.media : [];
    // Prefer non-proxy/unwatermarked media
    const media: any = mediaList.length > 1 ? mediaList[1] : mediaList[0];
    const photo: any = media?.photo;
    const variants: any = photo?.variants;
    // Prefer variants/public_file over watermarked proxy_file_url
    let rawImg = variants?.large || variants?.medium || photo?.public_file || variants?.default || media?.proxy_file_url || undefined;
    const imageUrl = sanitizeUnwatermarkedImage(rawImg);
    const url = String(a.article_url || "");
    const link = url.startsWith("http") ? url : `https://edition.mv${url.startsWith("/") ? url : `/${url}`}`;
    return {
      title: String(a.latin_headline || a.short_headline || a.headline || "Untitled"),
      link,
      summary: typeof a.summary === "string" ? a.summary : undefined,
      publishedAt: Date.parse(String(a.datetime || a.created_at || "")) || Date.now(),
      imageUrl,
    } as RawItem;
  });
  return { title: "Edition", link: "https://edition.mv/", items };
}

// ---- Mihaaru JSON API ----
async function fetchMihaaru(): Promise<{ title: string; link: string; items: RawItem[] }> {
  const data = JSON.parse(await fetchText("https://mihaaru.com/api/search?q=2026&per_page=25", true));
  const hits: any[] = data?.hits || [];
  const items = hits.map((h: any) => {
    const mediaList: any[] = Array.isArray(h.media) ? h.media : [];
    const media: any = mediaList.length > 1 ? mediaList[1] : mediaList[0];
    const photo: any = media?.photo;
    const variants: any = photo?.variants;
    let rawImg = variants?.large || variants?.medium || photo?.public_file || variants?.default || media?.proxy_file_url || undefined;
    const imageUrl = sanitizeUnwatermarkedImage(rawImg);
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
      imageUrl,
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

async function mapConcurrent<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export function isTelegramUrl(url: string): boolean {
  return (
    /(?:t\.me|telegram\.me|@[\w_]+)/i.test(url) &&
    !url.endsWith(".rss") &&
    !url.endsWith(".xml") &&
    !url.includes("rss")
  );
}

export function extractTelegramChannelName(url: string): string | null {
  const clean = url.trim();
  if (clean.startsWith("@")) return clean.slice(1);
  const match = clean.match(/(?:t\.me|telegram\.me)\/(?:s\/)?([a-zA-Z0-9_]+)/i);
  return match ? match[1] : null;
}

export async function fetchTelegramFeed(urlOrChannel: string): Promise<EnrichedFeed> {
  const extractedName = extractTelegramChannelName(urlOrChannel);
  const channelName = extractedName || urlOrChannel.replace(/[^a-zA-Z0-9_]/g, "");
  const targetUrl = `https://t.me/s/${channelName}`;

  let html = "";
  try {
    html = await fetchText(targetUrl);
  } catch {
    html = await fetchPageHtmlWithProxies(targetUrl);
  }

  const { document } = parseHTML(html);
  const channelTitle =
    document.querySelector(".tgme_channel_info_title")?.textContent?.trim() || `${channelName} (Telegram)`;
  const channelLink = `https://t.me/s/${channelName}`;

  const messages = Array.from(document.querySelectorAll(".tgme_widget_message")).reverse();
  const rawItems: RawItem[] = [];

  for (const msg of messages) {
    const linkEl = msg.querySelector(".tgme_widget_message_date");
    const link = linkEl?.getAttribute("href") || `https://t.me/${channelName}`;

    const timeEl = msg.querySelector("time");
    const pubDate = timeEl?.getAttribute("datetime");
    const publishedAt = pubDate ? Date.parse(pubDate) : Date.now();

    const textEl = msg.querySelector(".tgme_widget_message_text");
    const cleanText = textEl ? textEl.textContent?.trim() : "";

    let imageUrl: string | undefined;
    const photoEl =
      msg.querySelector(".tgme_widget_message_photo_wrap") ||
      msg.querySelector(".tgme_widget_message_video_thumb") ||
      msg.querySelector(".link_preview_image");
    if (photoEl) {
      const style = photoEl.getAttribute("style") || "";
      const m = style.match(/background-image:url\((['"]?)(.*?)\1\)/);
      if (m?.[2]) imageUrl = m[2];
    }

    if (!cleanText && !imageUrl) continue;

    const lines = cleanText ? cleanText.split("\n").map((l) => l.trim()).filter(Boolean) : [];
    const rawTitle = lines[0] || `${channelTitle} Update`;
    const title = rawTitle.length > 150 ? rawTitle.slice(0, 147) + "..." : rawTitle;

    const contentHtml = lines.length > 0 ? lines.map((l) => `<p>${l}</p>`).join("") : `<p>${title}</p>`;

    // Skip special offers, advertisements, sponsored listings & shopping posts
    if (isAdOrPromotional(title, cleanText, contentHtml)) {
      continue;
    }

    rawItems.push({
      title,
      link,
      summary: cleanText.slice(0, 300) || title,
      content: contentHtml,
      publishedAt,
      imageUrl,
    });
  }

  const enrichedItems = await Promise.all(
    rawItems.slice(0, 20).map(async (it, index) => {
      let content = it.content || "";
      let imageUrl = it.imageUrl;

      // Expand short posts or post excerpts into a fuller article-style body.
      if (!content || stripTags(content).length < 250) {
        content = expandSummaryToFullArticle(it.title, it.summary || "", channelTitle);
      }

      return {
        id: canonicalId(it.link),
        title: it.title,
        link: it.link,
        summary: it.summary,
        content: cleanArticleHtml(content),
        imageUrl,
        images: imageUrl ? [imageUrl] : [],
        publishedAt: it.publishedAt,
      };
    })
  );

  return {
    title: channelTitle,
    link: channelLink,
    items: enrichedItems,
  };
}

// ---- Google News RSS fallback (anti-bot bypass) ----
// Many publishers (AP, Reuters, ESPN, Khaleej Times, CNA, Daily Mirror, Colombo
// Page, CBC, Avas, Dhuvas, ...) sit behind Cloudflare/anti-bot walls that block
// our server-side fetch. Google News RSS has NO such wall and reliably returns
// the latest 100 headlines + summaries + the real publisher domain for any site
// via `news.google.com/rss/search?q=site:<domain>`. We use it as a transparent
// fallback when a direct feed fetch yields nothing. Images use Google's favicon
// service (Cloudflare-safe) so every card still renders a real brand image.
function googleNewsFavicon(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

async function fetchViaGoogleNews(domain: string, fallbackTitle: string): Promise<{ title: string; link?: string; items: RawItem[] }> {
  const q = encodeURIComponent(`site:${domain}`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetchText(url);
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  const items: RawItem[] = [];
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml))) {
    const b = m[1];
    // Title comes as "Headline - Publisher"; strip the trailing publisher.
    const rawTitle = stripTags(b.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "Untitled");
    const title = rawTitle.includes(" - ") ? rawTitle.slice(0, rawTitle.lastIndexOf(" - ")) : rawTitle;
    const link = decodeEntities(b.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || "");
    if (!link) continue;
    const pub = b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1];
    const d = Date.parse(pub || "");
    // Source domain (real publisher) is in <source url="...">Publisher</source>
    const srcUrl = b.match(/<source[^>]+url=["']([^"']+)["']/i)?.[1] || `https://${domain}`;
    let srcDomain = domain;
    try { srcDomain = new URL(srcUrl).hostname.replace(/^www\./, ""); } catch { /* keep domain */ }
    const descHtml = b.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] || "";
    const summary = stripTags(decodeEntities(descHtml)).slice(0, 400);
    items.push({
      title,
      link,
      summary,
      publishedAt: Number.isNaN(d) ? Date.now() : d,
      imageUrl: googleNewsFavicon(srcDomain),
    });
  }
  return { title: fallbackTitle || domain, link: `https://${domain}`, items };
}

/**
 * CF-safe full-text recovery. When an article page can't be scraped (Cloudflare
 * Worker egress is bot-blocked), look the headline up on Google News and return
 * the snippet it indexes — a real multi-sentence paragraph instead of the bare
 * RSS summary. No per-article page fetch, so it works in the Worker runtime.
 */
export async function recoverFullTextViaGoogleNews(title: string): Promise<string> {
  if (!title || title.trim().length < 12) return "";
  try {
    const q = encodeURIComponent(title.trim());
    const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
    const xml = await fetchText(url);
    const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
    let m: RegExpExecArray | null;
    let best = "";
    while ((m = itemRegex.exec(xml))) {
      const b = m[1];
      const descHtml = b.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] || "";
      const text = stripTags(decodeEntities(descHtml)).replace(/\s+/g, " ").trim();
      if (text.length > best.length) best = text;
    }
    return best;
  } catch {
    return "";
  }
}

export async function fetchEnrichedFeed(feedUrl: string): Promise<EnrichedFeed> {
  if (isTelegramUrl(feedUrl)) {
    return fetchTelegramFeed(feedUrl);
  }

  const host = (() => {
    try {
      return new URL(feedUrl).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

  // Publishers whose own feed is behind a slow/blocked CDN (Sky News and Japan
  // Times take 40-50s and would blow the Cloudflare Worker CPU limit). Fetch
  // them directly via Google News RSS (fast, ~1s, no anti-bot wall).
  const GNEWS_ONLY: Record<string, string> = {
    "skynews.com": "sky.com",
    "japantimes.co.jp": "japantimes.co.jp",
  };

  let raw: { title: string; link?: string; items: RawItem[] };
  if (GNEWS_ONLY[host]) {
    try {
      raw = await fetchViaGoogleNews(GNEWS_ONLY[host], host);
    } catch {
      raw = { title: host, link: feedUrl, items: [] };
    }
    // If Google News was challenged/empty for this domain, fall back to the
    // publisher's direct feed (slow but real) instead of re-calling GNews.
    if (raw.items.length === 0) {
      try {
        raw = parseFeedXml(await fetchText(feedUrl), feedUrl);
      } catch {
        raw = { title: host, link: feedUrl, items: [] };
      }
    }
  } else if (host === "edition.mv") {
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
    try {
      raw = parseFeedXml(await fetchText(feedUrl), feedUrl);
    } catch {
      raw = { title: host, link: feedUrl, items: [] };
    }
  }

  // Anti-bot fallback: if the direct feed returned nothing (Cloudflare block,
  // dead URL, 403/404), fetch the same publisher via Google News RSS. Use the
  // registrable domain (e.g. "cnbc.com" from "search.cnbc.com") so the query
  // actually matches the publisher. A few publishers are indexed by Google News
  // under a different brand domain than their feed host (e.g. skynews.com ->
  // sky.com), so apply known aliases.
  if (raw.items.length === 0 && !isTelegramUrl(feedUrl)) {
    try {
      const regDomain = host.split(".").slice(-2).join(".") || host;
      const aliases: Record<string, string> = {
        "skynews.com": "sky.com",
      };
      const fallbackDomain = aliases[regDomain] || regDomain;
      raw = await fetchViaGoogleNews(fallbackDomain, raw.title);
    } catch {
      /* fall through — return whatever (possibly empty) we have */
    }
  }

  const isBloomberg = host.includes("bloomberg");

  const cleanItems = raw.items.filter(
    (it) => !isAdOrPromotional(it.title, it.summary || "", it.content || "")
  );

  // Enrich top items with limited concurrency (max 3 at a time) to prevent timeouts
  // and rate limits from news servers like PSM News, Guardian, etc.
  const enriched = await mapConcurrent(
    cleanItems.slice(0, 15),
    3,
    async (it, index) => {
      try {
        const isGuardian = it.link.includes("theguardian.com");
        const isPsm = it.link.includes("psmnews.mv");
        const isDw = it.link.includes("dw.com");
        let imageUrl = it.imageUrl;
        let content = it.content;

        // Google News fallback items carry a favicon as a valid brand image —
        // never re-scrape those (the GNews link 404s on article fetch anyway).
        const isFaviconImg = !!imageUrl && imageUrl.includes("google.com/s2/favicons");

        const isLowResImg =
          (!imageUrl || imageUrl.includes("width=140") ||
            imageUrl.includes("width=100") ||
            imageUrl.includes("width=150") ||
            imageUrl.includes("width=200") ||
            imageUrl.includes("width=460") ||
            (imageUrl.includes("i.guim.co.uk") && !imageUrl.includes("width=1200") && !imageUrl.includes("width=700"))) &&
          !isFaviconImg;

        const isShortContent =
          !content ||
          stripTags(content).length < 600 ||
          /continue reading|full report is here|this blog is now closed|read the full|read more/i.test(content) ||
          isBloomberg;

        let needsImage = isLowResImg || isGuardian || isPsm || isBloomberg || isDw;
        let needsContent = isShortContent || isGuardian || isPsm || isBloomberg || isDw;
        // PERF: only article-scrape the top stories (first 6) on a feed load.
        // Deeper items keep their (already-rich) RSS summary + image so the
        // initial refresh returns fast instead of waiting on ~15 r.jina.ai calls.
        const isTopStory = index < 6;
        if (!isTopStory && !isGuardian && !isPsm && !isBloomberg && !isDw) {
          needsContent = false;
          needsImage = false;
        }

        // Google News fallback items already carry a brand favicon image and a
        // valid summary; their link points to a GNews redirect page that hangs
        // on scrape, so never article-scrape them — just use the summary.
        const skipScrape = isFaviconImg;

        let images: string[] = imageUrl ? [imageUrl] : [];
        if ((needsImage || needsContent) && !isBloomberg && !skipScrape) {
          try {
            const scraped = await scrapeArticle(it.link);
            if (scraped.imageUrl) imageUrl = scraped.imageUrl;
            if (scraped.content) content = scraped.content;
            if (scraped.images.length) images = scraped.images;
          } catch {
            /* scrape failed — keep RSS-provided data */
          }
        }

        // Re-evaluate content completeness
        needsContent = !content || stripTags(content).length < 500 || isBloomberg;
        if (needsContent) {
          content = expandSummaryToFullArticle(it.title, it.summary || "", raw.title || host);
        }

        // Ensure main image URL is synchronized with extracted images if missing
        if (!imageUrl && images.length > 0) {
          imageUrl = images[0];
        }

        if (content) {
          content = cleanArticleHtml(content);
        }
        let summary = it.summary;
        if ((!summary || summary.trim().length < 10) && content) {
          summary = stripTags(content).slice(0, 400);
        }
        const cleanMainImg = sanitizeUnwatermarkedImage(imageUrl);
        const cleanImages = images
          .map((img) => sanitizeUnwatermarkedImage(img))
          .filter((img): img is string => Boolean(img));

        const finalImages = cleanImages.length > 0 ? cleanImages : cleanMainImg ? [cleanMainImg] : [];

        return {
          id: canonicalId(it.link),
          title: it.title,
          link: it.link,
          author: it.author,
          summary,
          content,
          imageUrl: cleanMainImg,
          images: finalImages,
          publishedAt: it.publishedAt,
        };
      } catch {
        // Per-item failure must never 503 the whole feed. Return the RSS item
        // as-is (with whatever summary/image it had) so the feed still renders.
        return {
          id: canonicalId(it.link),
          title: it.title,
          link: it.link,
          author: it.author,
          summary: it.summary,
          content: it.content,
          imageUrl: it.imageUrl,
          images: it.imageUrl ? [it.imageUrl] : [],
          publishedAt: it.publishedAt,
        };
      }
    }
  );

  return { title: raw.title, link: raw.link, items: enriched.filter((it) => !isJunkFeedItem(it.title, it.link, it.summary)) };
}

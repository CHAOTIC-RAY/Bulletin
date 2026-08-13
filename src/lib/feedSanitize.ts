import { parseHTML } from "linkedom";

/** Extract all image URLs from HTML strings (e.g. article content or summary). */
export function extractImagesFromHtml(htmlStr: string): string[] {
  if (!htmlStr) return [];
  const images: string[] = [];
  const seen = new Set<string>();
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(htmlStr))) {
    const src = match[1];
    if (src && !seen.has(src) && !/1x1|pixel|spacer|blank\.gif|tracking|doubleclick/i.test(src)) {
      seen.add(src);
      images.push(src);
    }
  }
  return images;
}

/** Remove screen reader noise elements, ads, recommended stories blocks, list noise, and inline images from HTML for news detail view. */
export function cleanArticleHtml(htmlStr: string, options: { removeImages?: boolean } = { removeImages: true }): string {
  if (!htmlStr) return "";
  let cleaned = htmlStr;

  try {
    let doc: Document;
    if (typeof window !== "undefined" && window.DOMParser) {
      const parser = new DOMParser();
      doc = parser.parseFromString(`<div>${cleaned}</div>`, "text/html");
    } else {
      const parsed = parseHTML(`<div>${cleaned}</div>`);
      doc = parsed.document as unknown as Document;
    }

    // 1. Remove noise selectors
    const noiseSelectors = [
      ".sr-only",
      ".screen-reader-only",
      ".visually-hidden",
      ".visuallyhidden",
      ".hidden",
      "[hidden]",
      "[aria-hidden='true']",
      "style",
      "script",
      "iframe",
      "object",
      "embed",
      "form",
      "button",
      "nav",
      "[role='navigation']",
      "[role='complementary']"
    ];
    for (const sel of noiseSelectors) {
      try {
        doc.querySelectorAll(sel).forEach((el: any) => el.remove());
      } catch {
        /* ignore selector issues */
      }
    }

    // 2. Remove Recommended/Related stories blocks
    const blockSelectors = ["section", "aside", "div", "ul", "ol", "nav"];
    for (const sel of blockSelectors) {
      try {
        doc.querySelectorAll(sel).forEach((el: any) => {
          const text = (el.textContent || "").trim();
          const headingText = Array.from(el.querySelectorAll("h1, h2, h3, h4, h5, h6, strong, b"))
            .map((h: any) => h.textContent || "")
            .join(" ");
          const combinedText = (headingText + " " + text.slice(0, 120)).toLowerCase();

          if (
            combinedText.includes("recommended stories") ||
            combinedText.includes("related stories") ||
            combinedText.includes("related articles") ||
            combinedText.includes("more from al jazeera") ||
            combinedText.includes("more from news") ||
            combinedText.includes("keep reading") ||
            combinedText.includes("read next") ||
            combinedText.includes("you might also like") ||
            combinedText.includes("trending stories") ||
            combinedText.includes("related content")
          ) {
            el.remove();
          }
        });
      } catch {
        /* ignore */
      }
    }

    // 3. Remove list noise elements (e.g. "list of 4 items", "list 1 of 4", "end of list")
    try {
      doc.querySelectorAll("*").forEach((el: any) => {
        const text = (el.textContent || "").trim();
        if (
          /^list of \d+ items$/i.test(text) ||
          /^list \d+ of \d+$/i.test(text) ||
          /^end of list$/i.test(text)
        ) {
          el.remove();
        }
      });
    } catch {
      /* ignore */
    }

    // 4. Remove inline <img> and <figure> elements if removeImages is set (to display images in immersive background reel instead of detail view)
    if (options.removeImages !== false) {
      try {
        doc.querySelectorAll("img, figure").forEach((el: any) => el.remove());
      } catch {
        /* ignore */
      }
    }

    cleaned = doc.body?.firstElementChild?.innerHTML || doc.body?.innerHTML || cleaned;
  } catch {
    /* fallback to regex */
  }

  // 5. Regex string fallback cleanup
  if (options.removeImages !== false) {
    cleaned = cleaned.replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, "").replace(/<img[^>]*>/gi, "");
  }

  cleaned = cleaned
    .replace(/<section[^>]*>[\s\S]*?Recommended Stories[\s\S]*?<\/section>/gi, "")
    .replace(/<div[^>]*>[\s\S]*?Recommended Stories[\s\S]*?<\/div>/gi, "")
    .replace(/<span>\s*list of \d+ items\s*<\/span>/gi, "")
    .replace(/<span>\s*list \d+ of \d+\s*<\/span>/gi, "")
    .replace(/<span>\s*end of list\s*<\/span>/gi, "")
    .replace(/list of \d+ items/gi, "")
    .replace(/list \d+ of \d+/gi, "")
    .replace(/\bend of list\b/gi, "")
    .replace(/<p>\s*<\/p>/gi, "");

  return cleaned;
}

/** Extract clean, noise-free plain text for speech synthesis or previews. */
export function cleanTtsText(htmlStr: string): string {
  if (!htmlStr) return "";
  const cleanedHtml = cleanArticleHtml(htmlStr, { removeImages: true });
  let text = cleanedHtml.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/list of \d+ items/gi, "")
    .replace(/list \d+ of \d+/gi, "")
    .replace(/\bend of list\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

/**
 * Detect whether a string contains Thaana script (Arabic-range Dhivehi).
 * Thaana occupies the U+0780–U+07FF Unicode block.
 */
export function containsThaana(text: string): boolean {
  if (!text) return false;
  return /[\u0780-\u07FF]/.test(text);
}

/**
 * Pick the most Dhivehi-natural headline for a feed item.
 *
 * Maldivian RSS feeds (sun.mv, miadhu, avas, etc.) populate `<title>` with a
 * Latin transliteration for SEO/feed-reader compatibility, while the real Thaana
 * headline is the opening of the article body (`<description>`/`<content>`).
 * When the content locale is Dhivehi, prefer the Thaana headline from the body
 * so the reader sees real Dhivehi script instead of a Latin transliteration.
 *
 * `title` — the RSS `<title>` (often Latin). `body` — the article body HTML.
 */
export function getDisplayHeadline(title: string, body: string): string {
  if (!body) return title || "(no title)";
  const plain = cleanTtsText(body);
  // The Thaana headline is typically the first sentence/paragraph of the body.
  const thaanaMatch = plain.match(/[\u0780-\u07FF][\s\S]*?(?=[.!?؟\n]|$)/u);
  if (thaanaMatch && thaanaMatch[0].trim().length >= 3) {
    return thaanaMatch[0].trim();
  }
  // Fall back: if the body starts with Thaana, take the first ~140 chars.
  if (containsThaana(plain)) {
    return plain.slice(0, 140).trim() || title || "(no title)";
  }
  return title || "(no title)";
}

/**
 * Pick the most Dhivehi-natural detail/body sentence for a feed item.
 * For Dhivehi content we want the real Thaana body text (not the Latin RSS
 * summary). Returns the first Thaana sentence of the article body, or a
 * truncated plain-text fallback.
 */
export function getDisplayDetail(body: string): string {
  if (!body) return "";
  const plain = cleanTtsText(body);
  const thaanaMatch = plain.match(/[\u0780-\u07FF][\s\S]*?(?=[.!?؟\n]|$)/u);
  if (thaanaMatch && thaanaMatch[0].trim().length >= 8) {
    return thaanaMatch[0].trim();
  }
  if (containsThaana(plain)) {
    return plain.slice(0, 200).trim();
  }
  return plain.slice(0, 200).trim();
}


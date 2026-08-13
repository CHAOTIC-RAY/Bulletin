// Per-item content-language detection for locale-mode content filtering.
// Thaana Unicode block U+0780–U+07BF. If a headline/summary/body contains any
// Thaana character, the item is Dhivehi (Thaana); otherwise it's Latin/English.

const THAANA_RE = /[ހ-޿]/;

export function isThaana(text?: string): boolean {
  return !!text && THAANA_RE.test(text);
}

export function itemIsDhivehi(item: {
  title?: string;
  summary?: string;
  content?: string;
}): boolean {
  return isThaana(item.title) || isThaana(item.summary) || isThaana(item.content);
}

/**
 * Locale-mode content gate. When the app UI is in Dhivehi (dv), only Thaana
 * items are shown; when in English (en), only Latin/English items are shown.
 * This enforces "no Thaana in English mode" and "no Latin/English in Dhivehi
 * mode" even if mixed-language items slip through a source.
 */
export function itemMatchesUiLocale(
  item: { title?: string; summary?: string; content?: string },
  uiLocale: "en" | "dv"
): boolean {
  const dhivehi = itemIsDhivehi(item);
  return uiLocale === "dv" ? dhivehi : !dhivehi;
}

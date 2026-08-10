// RTL / Dhivehi (Thaana) detection.
const THAANA_RE: RegExp = /[\u0780-\u07BF]/;
const ARABIC_RE: RegExp = /[\u0600-\u06FF]/;

/** Detect RTL text (Dhivehi Thaana, Arabic script). */
export function isRtlText(text: string): boolean {
  return THAANA_RE.test(text) || ARABIC_RE.test(text);
}

export function textDirection(text: string): "rtl" | "ltr" {
  return isRtlText(text) ? "rtl" : "ltr";
}

export function isRtlLang(lang: string): boolean {
  const base = lang.toLowerCase().split("-")[0];
  return base === "dv" || base === "ar" || base === "fa" || base === "he" || base === "ur";
}

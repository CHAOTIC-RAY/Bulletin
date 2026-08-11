// Raadhavalhi i18n — lightweight string table. UI language is independent of TTS narration language.
import { isRtlLang } from "./textDirection";

export type LocaleCode = "en" | "dv";

export const LOCALES: { code: LocaleCode; label: string; english: string; rtl: boolean }[] = [
  { code: "en", label: "English", english: "English", rtl: false },
  { code: "dv", label: "ދިވެހި", english: "Dhivehi", rtl: true },
];

type Dict = Record<string, string>;

const en: Dict = {
  "app.name": "Raadhavalhi",
  "app.tagline": "News, reimagined",
  "onboarding.title": "What do you want to follow?",
  "onboarding.subtitle": "Pick a few interests — we'll load the right sources. No RSS pasting.",
  "onboarding.lang": "App language",
  "onboarding.narrate": "Listen in",
  "onboarding.continue": "Start reading",
  "onboarding.skip": "Use English defaults",
  "home.empty": "No stories yet",
  "home.emptyHint": "Pull to refresh, or pick more interests.",
  "home.refresh": "Refresh",
  "brief.title": "Today's News Brief",
  "brief.listen": "Listen",
  "brief.stop": "Stop",
  "brief.playing": "Playing daily brief…",
  "reader.listen": "Listen to article",
  "reader.stop": "Stop",
  "reader.open": "Open original",
  "reader.save": "Save",
  "reader.back": "Back",
  "common.saved": "Saved",
  "common.source": "Source",
  "setup.easy": "Setup is easy",
  "nav.immersive": "Immersive",
  "nav.magazine": "Paper",
  "nav.closeBrief": "Close Brief",
  "nav.loading": "Loading feeds...",
};

const dv: Dict = {
  "app.name": "ރާދަވަޅި",
  "app.tagline": "ނިއުސް، އާއިން ބަދަލުކޮށެވަ",
  "onboarding.title": "ކޮންކަހަރެއް ތިމްގަން ބައލަނަން ބޭނުނޭ؟",
  "onboarding.subtitle": "ތިބޭ ބޭނުނެއް އިޚްތިޔާރުކޮށެވާ — ތިމްގަން ރައްޔާއި އެކު ސޯސްތައް ލޯޑްކޮށް ދޭނެމެއެވެ.",
  "onboarding.lang": "އެޕްގެ ބަސް",
  "onboarding.narrate": "އައްސާވާ",
  "onboarding.continue": "ކިއންދާ ފަށާ",
  "onboarding.skip": "އިނގިރޭޖީން ވަންނާ",
  "home.empty": "މިހާރު ޚަބަރު ނެތް",
  "home.emptyHint": "ރިފްރެޝްކޮށް ފަށާ، ނުވަތް އިތުރު ބޭނުނުތައް އިޚްތިޔާރުކޮށެވާ.",
  "home.refresh": "ރިފްރެޝް",
  "brief.title": "މިއަދުގެ ނިއުސް ބްރީފް",
  "brief.listen": "އައްސާވާ",
  "brief.stop": "ހިއްކާ",
  "brief.playing": "ދައިލީ ބްރީފް ޕްލޭކޮށް އަންނަ…",
  "reader.listen": "ލިޔުމާއިބެން އައްސާވާ",
  "reader.stop": "ހިއްކާ",
  "reader.open": "އަސްލު ކަނަން ހުށުން",
  "reader.save": "ސޭވް",
  "reader.back": "ފަހައްޓާ",
  "common.saved": "ސޭވްކޮށް",
  "common.source": "ސޯސް",
  "setup.easy": "ސެޓްއަޕް ފަސޭހަ",
  "nav.immersive": "އިމަރސިވް",
  "nav.magazine": "ނޫސް",
  "nav.closeBrief": "ބްރީފް ލައްޕާލާ",
  "nav.loading": "ޚަބަރުތައް ލޯޑްވަނީ...",
};

const TABLES: Record<LocaleCode, Dict> = { en, dv };

export function getLocale(): LocaleCode {
  try {
    const v = localStorage.getItem("raadhavalhi_locale");
    return (v as LocaleCode) || "en";
  } catch {
    return "en";
  }
}
export function setLocale(code: LocaleCode): void {
  localStorage.setItem("raadhavalhi_locale", code);
}
export function t(key: string, locale: LocaleCode = getLocale()): string {
  return TABLES[locale]?.[key] ?? TABLES.en[key] ?? key;
}
export function localeIsRtl(locale: LocaleCode): boolean {
  return isRtlLang(locale);
}

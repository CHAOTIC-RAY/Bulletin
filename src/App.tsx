import React, { useEffect, useState, useMemo } from "react";
import {
  ensureDefaultSubscriptions,
  FeedItem,
  getFeedItems,
  saveFeedItems,
  applySelectedFeedSources,
  getFeedSubscriptions,
  getTopicFeedGroups,
  isFeedSubscriptionEnabled,
  saveFeedSubscriptions,
} from "./lib/feedStorage";
import { refreshAllSubscriptions, collectArticleImages } from "./lib/feedClient";
import { isAdOrPromotional, matchItemTopic } from "./lib/feedEnrich";
import { getLocale, getContentLocale, setContentLocale, LocaleCode, t } from "./lib/i18n";
import BulletinFeedScroll from "./components/BulletinFeedScroll";
import MagazineFeedScroll from "./components/MagazineFeedScroll";
import DailyBriefCard from "./components/DailyBriefCard";
import FeedReader from "./components/FeedReader";
import LanguageSetup from "./components/LanguageSetup";
import LoadingPile from "./components/LoadingPile";
import FilterModal, { FilterOptions, DEFAULT_FILTER_OPTIONS } from "./components/FilterModal";
import { Settings, RefreshCw, BookOpen, Newspaper, SlidersHorizontal } from "lucide-react";
import { Segmented } from "./components/ui/Segmented";
import { IconButton } from "./components/ui/IconButton";
import { AppNav, NavTab } from "./components/AppNav";

type Screen = "setup" | "home";
type ViewMode = "immersive" | "magazine";

export default function App() {
  // MIGRATION: older clients stored bulletin_locale="dv" to mean "read Dhivehi
  // news". The UI is now ALWAYS English (bulletin_locale="en"); Dhivehi content
  // is tracked via bulletin_content_locale. Migrate any stale "dv" UI setting
  // here so the app shell never renders RTL/Thaana on mount.
  if (typeof window !== "undefined" && getLocale() === "dv" && getContentLocale() !== "dv") {
    try { localStorage.setItem("bulletin_locale", "en"); } catch {}
  }
  // The UI is ALWAYS English/LTR. Dhivehi news+Thaana is a *content* choice
  // tracked separately via bulletin_content_locale. Drive document direction
  // from the content locale (not the UI locale) so the RTL/Thaana font only
  // applies to Dhivehi articles in the reader, never to the English UI shell.
  const [contentLocale, setContentLocaleState] = useState<"en" | "dv">(() => getContentLocale());
  const uiLocale: LocaleCode = "en";
  const [screen, setScreen] = useState<Screen>("setup");
  const [narrateLang, setNarrateLang] = useState<string>(
    localStorage.getItem("bulletin_narrate_lang") || "en-US"
  );
  const [items, setItems] = useState<FeedItem[]>([]);
  const [selected, setSelected] = useState<FeedItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem("bulletin_default_view") as ViewMode) || "immersive"
  );
  const [navTab, setNavTab] = useState<NavTab>("feed");
  const [showBrief, setShowBrief] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(DEFAULT_FILTER_OPTIONS);

  const [theme, setThemeState] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("bulletin_theme") as "light" | "dark") || "dark";
  });

  useEffect(() => {
    // If a previous session configured sources, skip setup.
    const subs = ensureDefaultSubscriptions();
    if (subs.length) {
      setScreen("home");
      const cached = getFeedItems();
      setItems(cached);
      // Always show the custom LoadingPile spinner at startup (brand moment),
      // then reveal the feed. Cold loads (no cache) keep it until loadFeeds()
      // returns; warm loads show it for a short minimum (~700ms) so the
      // animation is visible even though the cached feed is already ready.
      setInitialLoading(true);
      const timer = setTimeout(() => {
        void loadFeeds().then(() => {
          if (cached.length > 0) setInitialLoading(false);
        });
      }, 400);
      // Warm-load brand moment: if we already had cached items, drop the spinner
      // after a short minimum so the app still feels fast.
      let minTimer: ReturnType<typeof setTimeout> | undefined;
      if (cached.length > 0) {
        minTimer = setTimeout(() => setInitialLoading(false), 700);
      }
      return () => {
        clearTimeout(timer);
        if (minTimer) clearTimeout(minTimer);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // The app UI is ALWAYS LTR/English, even in Dhivehi news mode. Only the
    // reader article containers (FeedReader/DailyBriefCard) set dir="rtl" +
    // the Thaana font for Dhivehi articles. Do NOT flip the document here.
    document.documentElement.dir = "ltr";
    document.documentElement.lang = "en";
    document.documentElement.style.fontFamily = "inherit";

    // Set theme class on document element
    const currentTheme = localStorage.getItem("bulletin_theme") || "dark";
    if (currentTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const loadFeeds = async () => {
    const subs = ensureDefaultSubscriptions().filter(isFeedSubscriptionEnabled);
    setRefreshing(true);
    try {
      const incoming = await refreshAllSubscriptions(subs);
      if (incoming.length) {
        saveFeedItems(incoming);
        setItems(incoming);
      } else {
        setItems(getFeedItems());
      }
    } catch (e) {
      console.error("Background feed load failed", e);
    } finally {
      setRefreshing(false);
    }
  };

  const onSetupDone = (ui: LocaleCode, narr: string) => {
    const isDv = ui === "dv";

    // Snapshot the content locale *before* this call's writes so we can detect a
    // real switch and clear stale feeds that would otherwise linger.
    const prevContent = getContentLocale();

    // HARD GUARANTEE: the UI is ALWAYS English (LTR). Dhivehi is purely a
    // content/news + TTS choice. bulletin_locale is forced to "en" in the
    // component initializer (above) so the app shell never renders RTL/Thaana.
    // Here we only move the *content* locale, which drives feed sources + TTS
    // + the reader's RTL/Thaana styling for Dhivehi articles.
    const newContent = isDv ? "dv" : "en";
    setContentLocaleState(newContent);
    setContentLocale(newContent);

    if (isDv) {
      localStorage.setItem("bulletin_narrate_lang", "dv-MV");
      localStorage.setItem("bulletin_tts_engine", "dhivehi");
      localStorage.setItem("bulletin_dhivehi_gender", "f");
      setNarrateLang("dv-MV");
    } else {
      setNarrateLang(narr);
      localStorage.setItem("bulletin_narrate_lang", narr);
    }

    // Update local state theme to match localStorage
    const currentTheme = (localStorage.getItem("bulletin_theme") as "light" | "dark") || "dark";
    setThemeState(currentTheme);

    // Re-snapshot to confirm whether the content locale actually changed.
    const nowContent = getContentLocale();
    const groups = getTopicFeedGroups();
    let topicIds = groups.map((g) => g.id);
    if (isDv) {
      topicIds = topicIds.filter((id) => id === "local");
    }

    // When the content locale changes, clear stale subscriptions + items so the
    // feed catalog re-derives from the new locale's topic set instead of
    // leaving English feeds visible under a Dhivehi news mode.
    if (prevContent !== nowContent) {
      saveFeedSubscriptions([]);
      saveFeedItems([]);
      applySelectedFeedSources(topicIds);
    } else if (getFeedSubscriptions().length === 0) {
      applySelectedFeedSources(topicIds);
    }

    setScreen("home");
    setItems(getFeedItems());
    
    // Start generating news in the background smoothly
    setTimeout(() => {
      void loadFeeds();
    }, 800);
  };

  const openReader = async (item: FeedItem) => {
    const imgs = await collectArticleImages(item.link, item.imageUrl ? [item.imageUrl] : []);
    setSelected({ ...item, images: imgs });
  };

  const toggleSave = (item: FeedItem) => {
    const next = items.map((i) => (i.id === item.id ? { ...i, saved: !i.saved, savedAt: !i.saved ? Date.now() : undefined } : i));
    setItems(next);
    saveFeedItems(next);
  };

  // Derive list of available sources and article counts
  const availableSources = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const src = item.subscriptionTitle?.trim() || "General News";
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  // Available topics for filtering
  const availableTopics = [
    { id: "all", label: "All Topics" },
    { id: "maldives", label: "Maldives Local" },
    { id: "politics", label: "Politics & World" },
    { id: "business", label: "Business & Economy" },
    { id: "tech", label: "Technology & AI" },
    { id: "sports", label: "Sports & Football" },
    { id: "tourism", label: "Tourism & Travel" },
    { id: "science", label: "Science & Environment" },
    { id: "health", label: "Health & Medicine" },
    { id: "education", label: "Education & Youth" },
    { id: "culture", label: "Culture & Lifestyle" },
    { id: "religion", label: "Religion & Faith" },
  ];

  // Filter and sort items dynamically
  const displayedItems = useMemo(() => {
    let list = items.filter((item) => {
      // Filter out promotional ads, special offers, and sales listings
      if (isAdOrPromotional(item.title, item.summary || "", item.content || "")) {
        return false;
      }

      const isThaana =
        /[\u0780-\u07BF]/.test(item.title) ||
        /[\u0780-\u07BF]/.test(item.summary || "") ||
        /[\u0780-\u07BF]/.test(item.content || "");
      // Show Thaana (Dhivehi) articles only when the content locale is Dhivehi.
      if (contentLocale !== "dv" && isThaana) {
        return false;
      }

      // Filter by Date Range
      if (filterOptions.dateRange !== "all") {
        const now = Date.now();
        const pub = item.publishedAt || now;
        if (filterOptions.dateRange === "24h" && pub < now - 24 * 3600 * 1000) return false;
        if (filterOptions.dateRange === "7d" && pub < now - 7 * 24 * 3600 * 1000) return false;
        if (filterOptions.dateRange === "30d" && pub < now - 30 * 24 * 3600 * 1000) return false;
      }

      // Filter by Source
      if (filterOptions.selectedSources.length > 0) {
        const srcTitle = item.subscriptionTitle?.trim() || "General News";
        if (!filterOptions.selectedSources.includes(srcTitle)) {
          return false;
        }
      }

      // Filter by Topic
      if (filterOptions.selectedTopic !== "all") {
        if (!matchItemTopic(item, filterOptions.selectedTopic)) {
          return false;
        }
      }

      // Filter by Search Query Keyword
      if (filterOptions.searchQuery.trim()) {
        const q = filterOptions.searchQuery.toLowerCase().trim();
        const text = `${item.title} ${item.summary || ""} ${item.content || ""} ${item.subscriptionTitle || ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });

    // Sorting news items
    return list.sort((a, b) => {
      if (filterOptions.sortBy === "oldest") {
        return (a.publishedAt || 0) - (b.publishedAt || 0);
      }
      if (filterOptions.sortBy === "source") {
        const sa = (a.subscriptionTitle || "").toLowerCase();
        const sb = (b.subscriptionTitle || "").toLowerCase();
        return sa.localeCompare(sb);
      }
      if (filterOptions.sortBy === "title") {
        return a.title.localeCompare(b.title);
      }
      // Default: newest first
      return (b.publishedAt || 0) - (a.publishedAt || 0);
    });
  }, [items, uiLocale, filterOptions]);

  const savedCount = useMemo(() => items.filter((i) => i.saved).length, [items]);

  // The list actually rendered: when the Saved tab is active, restrict to saved.
  const visibleItems = useMemo(
    () => (navTab === "saved" ? displayedItems.filter((i) => i.saved) : displayedItems),
    [displayedItems, navTab]
  );

  const hasActiveFilters =
    filterOptions.sortBy !== "newest" ||
    filterOptions.dateRange !== "all" ||
    filterOptions.selectedTopic !== "all" ||
    filterOptions.selectedSources.length > 0 ||
    filterOptions.searchQuery.trim().length > 0;

  if (screen === "setup") {
    return <LanguageSetup onDone={onSetupDone} items={items} />;
  }

  // Full-screen pile animation on first load (before the feed is ready).
  if (initialLoading) {
    return <LoadingPile label={t("nav.loading")} />;
  }

  const isImmersive = viewMode === "immersive";

  return (
    <div className={`h-[100dvh] w-full overflow-hidden transition-colors duration-500 ${isImmersive ? 'bg-neutral-950 text-white' : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white'}`}>
      
      {/* Top Header Navigation */}
      <div className={`absolute top-0 left-0 right-0 px-4 pt-6 pb-4 transition-all duration-300 pointer-events-none ${isImmersive ? 'z-50' : 'z-40'}`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between pointer-events-auto gap-3">
          
          <div className="flex items-center gap-3 min-w-0">
            <svg
              viewBox="0 0 194.16 232.77"
              role="img"
              aria-label="Bulletin"
              className={`w-8 h-9 object-contain shrink-0 ${isImmersive ? "text-white drop-shadow-md" : "text-ink dark:text-white"}`}
            >
              <path fill="currentColor" d="M194.16,54.97l-6.1,32.94-27.9,24.53,33.82,28.24.03,61.02-33.94,31-141.93.06,36.14-31.52-54.28-.27V.32s130.88-.14,130.88-.14l-.02,31.91-96.06.02.13,141.1L173.69,55.24l-33.37-.25.34-54.99,53.5,54.97ZM159.38,200.81l-.08-87.68-103.43,87.66,103.51.03Z" />
            </svg>
            <span className={`hidden sm:inline font-extrabold tracking-tight text-xl truncate ${isImmersive ? 'text-white drop-shadow-md' : 'text-ink dark:text-white'}`}>{t("app.name")}</span>
          </div>

          <Segmented
            aria-label="Reading mode"
            value={isImmersive ? "immersive" : "magazine"}
            onChange={(v) => setViewMode(v === "immersive" ? "immersive" : "magazine")}
            options={[
              { value: "immersive", label: t("nav.immersive"), icon: <Newspaper className="w-4 h-4" /> },
              { value: "magazine", label: t("nav.magazine"), icon: <BookOpen className="w-4 h-4" /> },
            ]}
          />

          <div className="flex items-center gap-2">
            <IconButton
              label={t("nav.refresh")}
              onClick={() => void loadFeeds()}
              disabled={refreshing}
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin text-amber" : ""}`} />
            </IconButton>
          </div>
        </div>
      </div>

      {/* Full News Brief Overlay Modal */}
      <DailyBriefCard
        items={displayedItems}
        narrateLang={narrateLang}
        isOpen={showBrief}
        onClose={() => setShowBrief(false)}
        showBanner={false}
      />

      <div className={`h-full w-full ${navTab === "feed" ? "pb-20 md:pb-0 md:pl-24" : "pb-20 md:pb-0 md:pl-24"}`}>
        {visibleItems.length ? (
          isImmersive ? (
            <BulletinFeedScroll
              items={visibleItems}
              narrateLang={narrateLang}
              onOpen={openReader}
              onSave={toggleSave}
              onOpenBrief={() => setShowBrief(!showBrief)}
              onOpenFilter={() => setIsFilterOpen(true)}
              hasActiveFilters={hasActiveFilters}
            />
          ) : (
            <MagazineFeedScroll
              items={visibleItems}
              onOpen={openReader}
              onSave={toggleSave}
              narrateLang={narrateLang}
            />
          )
        ) : (
          <div className="h-[100dvh] flex items-center justify-center text-center px-8 flex-col gap-4">
            <div className="p-4 rounded-none bg-amber-500/10 border-2 border-amber-500/35 text-amber-500">
              <SlidersHorizontal className="w-8 h-8" />
            </div>
            <div>
              <p className="text-lg font-bold">
                {navTab === "saved" ? "No saved articles yet" : "No articles found matching filters"}
              </p>
              <p className="text-sm text-neutral-400 mt-1">
                {navTab === "saved"
                  ? "Tap the bookmark on any story to save it here."
                  : "Try resetting your date, topic, or source filter settings."}
              </p>
            </div>
            {navTab !== "saved" && (
              <button
                onClick={() => setFilterOptions(DEFAULT_FILTER_OPTIONS)}
                className="px-4 py-2 bg-amber-500 text-black font-extrabold text-xs uppercase tracking-wider rounded-none border-2 border-black"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}
      </div>

      <AppNav
        active={navTab}
        onChange={(t) => {
          setNavTab(t);
          if (t === "brief") setShowBrief(true);
          if (t === "settings") setScreen("setup");
        }}
        savedCount={savedCount}
      />

      <FilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        options={filterOptions}
        onChangeOptions={setFilterOptions}
        availableSources={availableSources}
        availableTopics={availableTopics}
        totalItemCount={items.length}
        filteredItemCount={displayedItems.length}
      />

      <FeedReader item={selected} narrateLang={narrateLang} onClose={() => setSelected(null)} />

      {refreshing && (
        // Lightweight, NON-blurring indicator so the feed stays sharp while the
        // background refresh runs. (The full LoadingPile animation is shown on
        // cold load via the initialLoading gate above.)
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9998] flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-white/90 text-xs pointer-events-none shadow-lg">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          Updating…
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import {
  ensureDefaultSubscriptions,
  FeedItem,
  getFeedItems,
  saveFeedItems,
  applySelectedFeedSources,
  getFeedSubscriptions,
  isFeedSubscriptionEnabled,
  TOPIC_FEED_GROUPS,
} from "./lib/feedStorage";
import { refreshAllSubscriptions, collectArticleImages } from "./lib/feedClient";
import { getLocale, localeIsRtl, LocaleCode, t } from "./lib/i18n";
import RaadhavalhiFeedScroll from "./components/RaadhavalhiFeedScroll";
import MagazineFeedScroll from "./components/MagazineFeedScroll";
import DailyBriefCard from "./components/DailyBriefCard";
import FeedReader from "./components/FeedReader";
import LanguageSetup from "./components/LanguageSetup";
import { Settings, RefreshCw, LayoutTemplate, Smartphone } from "lucide-react";

type Screen = "setup" | "home";
type ViewMode = "immersive" | "magazine";

export default function App() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [uiLocale, setUiLocale] = useState<LocaleCode>(getLocale());
  const [narrateLang, setNarrateLang] = useState<string>(
    localStorage.getItem("raadhavalhi_narrate_lang") || "en-US"
  );
  const [items, setItems] = useState<FeedItem[]>([]);
  const [selected, setSelected] = useState<FeedItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("immersive");
  const [showBrief, setShowBrief] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  useEffect(() => {
    // If a previous session configured sources, skip setup.
    const subs = ensureDefaultSubscriptions();
    if (subs.length) {
      setScreen("home");
      setItems(getFeedItems());
      void loadFeeds();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.dir = localeIsRtl(uiLocale) ? "rtl" : "ltr";
  }, [uiLocale]);

  const loadFeeds = async () => {
    const subs = ensureDefaultSubscriptions().filter(isFeedSubscriptionEnabled);
    setRefreshing(true);
    const incoming = await refreshAllSubscriptions(subs);
    if (incoming.length) {
      saveFeedItems(incoming);
      setItems(incoming);
    } else {
      setItems(getFeedItems());
    }
    setRefreshing(false);
  };

  const onSetupDone = (ui: LocaleCode, narr: string) => {
    setUiLocale(ui);
    setNarrateLang(narr);
    localStorage.setItem("raadhavalhi_narrate_lang", narr);
    
    // Default all topics on
    applySelectedFeedSources(TOPIC_FEED_GROUPS.map((g) => g.id));
    setScreen("home");
    setItems(getFeedItems());
    void loadFeeds();
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

  if (screen === "setup") {
    return <LanguageSetup onDone={onSetupDone} />;
  }

  const isImmersive = viewMode === "immersive";

  return (
    <div className={`h-[100dvh] w-full overflow-hidden transition-colors duration-500 ${isImmersive ? 'bg-neutral-950 text-white' : 'bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white'}`}>
      
      {/* Top Header Navigation */}
      <div className={`absolute top-0 left-0 right-0 px-4 pt-6 pb-4 transition-all duration-300 pointer-events-none ${isImmersive ? 'z-50' : 'z-40'}`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between pointer-events-auto">
          
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xl tracking-tighter ${isImmersive ? 'bg-white text-black' : 'bg-black text-white dark:bg-white dark:text-black'}`}>
              H
            </div>
            <span className={`font-extrabold tracking-tight text-xl ${isImmersive ? 'text-white drop-shadow-md' : 'text-black dark:text-white'}`}>Raadhavalhi</span>
          </div>

          <div className={`flex items-center p-1 rounded-full backdrop-blur-md shadow-sm border ${isImmersive ? 'bg-black/40 border-white/10' : 'bg-white/80 dark:bg-black/50 border-neutral-200 dark:border-neutral-800'}`}>
            <button
              onClick={() => setViewMode("immersive")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                isImmersive 
                  ? "bg-amber-500 text-black shadow-md" 
                  : "text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline">Immersive</span>
            </button>
            <button
              onClick={() => setViewMode("magazine")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                !isImmersive 
                  ? "bg-black text-white dark:bg-white dark:text-black shadow-md" 
                  : "text-white/60 hover:text-white"
              }`}
            >
              <LayoutTemplate className="w-4 h-4" />
              <span className="hidden sm:inline">Magazine</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadFeeds()}
              disabled={refreshing}
              className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
                isImmersive ? 'bg-black/40 hover:bg-black/60 text-white border-white/10' : 'bg-white dark:bg-neutral-800 shadow-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700'
              }`}
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin text-amber-500" : ""}`} />
            </button>
            <button
              onClick={() => setScreen("setup")}
              className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
                isImmersive ? 'bg-black/40 hover:bg-black/60 text-white border-white/10' : 'bg-white dark:bg-neutral-800 shadow-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700'
              }`}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className={`absolute left-0 right-0 z-40 px-4 max-w-2xl mx-auto transition-all duration-500 ${showBrief && isImmersive ? 'top-24 opacity-100 pointer-events-auto' : 'top-24 opacity-0 pointer-events-none scale-95'}`}>
        <DailyBriefCard items={items} narrateLang={narrateLang} />
        {isImmersive && showBrief && (
          <button onClick={() => setShowBrief(false)} className="mt-4 w-full py-3 bg-black/50 backdrop-blur-md rounded-2xl text-white font-bold border border-white/10">
            Close Brief
          </button>
        )}
      </div>

      <div className={`h-full w-full`}>
        {items.length ? (
          isImmersive ? (
            <RaadhavalhiFeedScroll items={items} narrateLang={narrateLang} onOpen={openReader} onSave={toggleSave} onOpenBrief={() => setShowBrief(!showBrief)} />
          ) : (
            <MagazineFeedScroll 
              items={items} 
              onOpen={openReader} 
              onSave={toggleSave} 
              headerContent={<DailyBriefCard items={items} narrateLang={narrateLang} />}
            />
          )
        ) : (
          <div className="h-[100dvh] flex items-center justify-center text-center px-8">
            <div className="animate-pulse">
              <RefreshCw className="w-12 h-12 mx-auto mb-4 text-amber-500 animate-spin" />
              <p className="text-xl font-bold">Loading feeds...</p>
            </div>
          </div>
        )}
      </div>

      <FeedReader item={selected} narrateLang={narrateLang} onClose={() => setSelected(null)} />
    </div>
  );
}

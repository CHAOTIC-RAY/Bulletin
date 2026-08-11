import React, { useState, useMemo } from "react";
import type { FeedItem } from "../lib/feedStorage";
import { textDirection } from "../lib/textDirection";
import { Bookmark, BookmarkCheck, ArrowUpRight, Newspaper, Globe, Sparkles, Filter, Check } from "lucide-react";

interface Props {
  items: FeedItem[];
  onOpen: (item: FeedItem) => void;
  onSave: (item: FeedItem) => void;
  headerContent?: React.ReactNode;
}

export default function MagazineFeedScroll({ items, onOpen, onSave, headerContent }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  if (!items.length) return null;

  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).toUpperCase();

  // Extract all available filter options from the items feed
  const categoriesList = useMemo(() => {
    const list: { id: string; label: string; count: number }[] = [];

    // All option
    list.push({ id: "ALL", label: "§ FRONT PAGE (ALL)", count: items.length });

    // Saved option
    const savedCount = items.filter((i) => i.saved).length;
    if (savedCount > 0) {
      list.push({ id: "SAVED", label: "★ SAVED STORIES", count: savedCount });
    }

    // Feed sources / subscriptions
    const sourceCounts: Record<string, number> = {};
    items.forEach((item) => {
      const src = item.subscriptionTitle?.trim() || "GENERAL NEWS";
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });

    Object.entries(sourceCounts).forEach(([src, count]) => {
      list.push({
        id: `SRC:${src}`,
        label: `• ${src.toUpperCase()}`,
        count,
      });
    });

    // Keyword topic categories
    const topicKeywords = [
      { id: "TOPIC:WORLD", name: "WORLD NEWS", keywords: ["world", "global", "international", "nation", "diplomacy", "war", "ukraine", "middle east", "asia", "europe"] },
      { id: "TOPIC:TECH", name: "TECHNOLOGY", keywords: ["tech", "ai", "software", "apple", "google", "microsoft", "cyber", "data", "internet", "device", "app"] },
      { id: "TOPIC:BIZ", name: "BUSINESS & MARKETS", keywords: ["business", "market", "economy", "stock", "trade", "finance", "dollar", "bank", "corp", "industry"] },
      { id: "TOPIC:SCI", name: "SCIENCE & CLIMATE", keywords: ["science", "space", "climate", "earth", "nasa", "health", "research", "nature", "virus", "medical"] },
      { id: "TOPIC:CULTURE", name: "CULTURE & ARTS", keywords: ["culture", "art", "film", "music", "book", "entertainment", "movie", "style", "life"] },
    ];

    topicKeywords.forEach((topic) => {
      const count = items.filter((item) => {
        const text = `${item.title} ${item.summary || ""}`.toLowerCase();
        return topic.keywords.some((kw) => text.includes(kw));
      }).length;

      if (count > 0) {
        list.push({
          id: topic.id,
          label: `• ${topic.name}`,
          count,
        });
      }
    });

    return list;
  }, [items]);

  // Filter items according to selected category
  const filteredItems = useMemo(() => {
    if (selectedCategory === "ALL") return items;
    if (selectedCategory === "SAVED") return items.filter((i) => i.saved);
    if (selectedCategory.startsWith("SRC:")) {
      const srcName = selectedCategory.replace("SRC:", "");
      return items.filter((i) => (i.subscriptionTitle?.trim() || "GENERAL NEWS") === srcName);
    }
    if (selectedCategory.startsWith("TOPIC:")) {
      const topicId = selectedCategory;
      const topicKeywords: Record<string, string[]> = {
        "TOPIC:WORLD": ["world", "global", "international", "nation", "diplomacy", "war", "ukraine", "middle east", "asia", "europe"],
        "TOPIC:TECH": ["tech", "ai", "software", "apple", "google", "microsoft", "cyber", "data", "internet", "device", "app"],
        "TOPIC:BIZ": ["business", "market", "economy", "stock", "trade", "finance", "dollar", "bank", "corp", "industry"],
        "TOPIC:SCI": ["science", "space", "climate", "earth", "nasa", "health", "research", "nature", "virus", "medical"],
        "TOPIC:CULTURE": ["culture", "art", "film", "music", "book", "entertainment", "movie", "style", "life"],
      };
      const kws = topicKeywords[topicId] || [];
      return items.filter((item) => {
        const text = `${item.title} ${item.summary || ""}`.toLowerCase();
        return kws.some((kw) => text.includes(kw));
      });
    }
    return items;
  }, [items, selectedCategory]);

  return (
    <div className="h-[100dvh] w-full overflow-y-auto pt-20 pb-16 bg-[#f7f5f0] dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans selection:bg-amber-500 selection:text-black">
      <div className="w-full px-3 sm:px-6 md:px-8 lg:px-12">
        
        {headerContent && <div className="mb-6">{headerContent}</div>}

        {/* --- CLASSIC NEWSPAPER MASTHEAD --- */}
        <header className="text-center pt-2 pb-6 mb-8 border-b-2 border-neutral-900 dark:border-neutral-100">
          {/* Top Issue Bar */}
          <div className="flex items-center justify-between border-b border-t border-neutral-900/40 dark:border-white/30 py-1 px-2 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest text-neutral-700 dark:text-neutral-300 mb-4">
            <span>VOL. CLXXIV NO. 61,420</span>
            <span className="hidden sm:inline">ALL THE NEWS THAT'S FIT TO READ</span>
            <span>{todayStr}</span>
          </div>

          {/* Newspaper Nameplate */}
          <div className="py-2">
            <h1 className="font-serif font-black tracking-tight text-4xl sm:text-6xl md:text-7xl lg:text-8xl uppercase text-neutral-950 dark:text-white drop-shadow-sm">
              The Raadhavalhi Gazette
            </h1>
            <p className="text-xs sm:text-sm font-serif italic text-neutral-600 dark:text-neutral-400 mt-1">
              International Broadsheet • Daily Independent News & Intel
            </p>
          </div>

          {/* Bottom Rule with Interactive Section Category Filters */}
          <div className="border-t-2 border-b border-neutral-900 dark:border-neutral-100 py-2 mt-3">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 px-1">
              <span className="text-[10px] font-mono font-black uppercase text-neutral-400 dark:text-neutral-500 shrink-0 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3 text-amber-600 dark:text-amber-400" /> SECTIONS:
              </span>
              {categoriesList.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`whitespace-nowrap px-3 py-1 text-xs font-mono font-bold tracking-wider transition-all duration-200 shrink-0 border ${
                      isActive
                        ? "bg-amber-500 text-black border-amber-600 shadow-sm font-extrabold scale-105"
                        : "bg-white/60 dark:bg-neutral-900/60 text-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700 hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-400"
                    }`}
                  >
                    {cat.label}
                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? "bg-black/20 text-black font-black" : "text-neutral-500"}`}>
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* Empty state if category filter has no articles */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-neutral-400 dark:border-neutral-800 p-8 my-8 bg-white dark:bg-neutral-900">
            <Newspaper className="w-12 h-12 mx-auto text-neutral-400 mb-4" />
            <h3 className="font-serif font-black text-2xl uppercase text-neutral-900 dark:text-white mb-2">
              No Dispatches In This Section
            </h3>
            <p className="text-sm font-serif text-neutral-600 dark:text-neutral-400 mb-6">
              There are currently no active stories matching the selected category.
            </p>
            <button
              onClick={() => setSelectedCategory("ALL")}
              className="px-5 py-2 bg-amber-500 text-black font-bold uppercase font-mono text-xs tracking-wider border border-black hover:bg-amber-400 transition-colors"
            >
              Return to Front Page
            </button>
          </div>
        ) : (
          /* --- NEWSPAPER BENTO GRID --- */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
            {filteredItems.map((item, index) => {
              const dir = textDirection(item.title);

              // Newspaper broadsheet layout logic: mathematically balanced to prevent empty holes/gaps
              let colSpan = "col-span-12 md:col-span-4";
              let isHero = false;
              let isSpecial = false;
              let isHalfWidth = false; // md:col-span-6
              let isWide = false;      // md:col-span-8
              let isFullWidth = false; // md:col-span-12

              if (index === 0) {
                colSpan = "col-span-12 md:col-span-8 md:row-span-2";
                isHero = true;
              } else if (index === 1) {
                colSpan = "col-span-12 md:col-span-4";
              } else if (index === 2) {
                colSpan = "col-span-12 md:col-span-4";
              } else {
                // Repeating pattern of 13 elements starting from index 3
                const k = (index - 3) % 13;
                if (k === 0 || k === 1) {
                  colSpan = "col-span-12 md:col-span-6";
                  isHalfWidth = true;
                } else if (k === 2) {
                  colSpan = "col-span-12 md:col-span-12";
                  isFullWidth = true;
                } else if (k === 3 || k === 4 || k === 5) {
                  colSpan = "col-span-12 md:col-span-4";
                } else if (k === 6) {
                  colSpan = "col-span-12 md:col-span-8";
                  isWide = true;
                } else if (k === 7) {
                  colSpan = "col-span-12 md:col-span-4";
                } else if (k === 8) {
                  colSpan = "col-span-12 md:col-span-4";
                } else if (k === 9) {
                  colSpan = "col-span-12 md:col-span-8";
                  isWide = true;
                } else if (k === 10 || k === 11) {
                  colSpan = "col-span-12 md:col-span-6";
                  isHalfWidth = true;
                } else if (k === 12) {
                  colSpan = "col-span-12 md:col-span-12";
                  isFullWidth = true;
                }
              }

              isSpecial = index > 0 && index % 5 === 0;

              // Title fonts & sizes based on role
              let titleClass = "text-lg sm:text-xl line-clamp-3";
              if (isHero) {
                titleClass = "text-2xl sm:text-4xl md:text-5xl";
              } else if (isFullWidth) {
                titleClass = "text-xl sm:text-3xl md:text-4xl";
              } else if (isWide) {
                titleClass = "text-xl sm:text-2xl md:text-3xl";
              } else if (isHalfWidth) {
                titleClass = "text-xl sm:text-2xl";
              }

              // Summary fonts & sizes based on role
              let summaryClass = "text-sm sm:text-base md:text-lg line-clamp-3";
              if (isHero) {
                summaryClass = "text-lg sm:text-xl md:text-2xl";
              } else if (isFullWidth) {
                summaryClass = "text-base sm:text-lg md:text-xl line-clamp-4";
              } else if (isWide) {
                summaryClass = "text-sm sm:text-base md:text-lg line-clamp-3";
              }

              return (
                <article
                  key={item.id}
                  onClick={() => onOpen(item)}
                  className={`group cursor-pointer bg-white dark:bg-neutral-900 border ${
                    isSpecial 
                      ? "border-amber-500 dark:border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.05)]" 
                      : "border-neutral-300 dark:border-neutral-800"
                  } p-5 sm:p-6 shadow-[2px_2px_0px_rgba(0,0,0,0.08)] dark:shadow-[2px_2px_0px_rgba(255,255,255,0.05)] hover:border-amber-600 dark:hover:border-amber-500 hover:shadow-lg transition-all duration-300 flex flex-col ${colSpan}`}
                >
                  {/* Article Top Tagline & Date */}
                  <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        {isHero ? "FRONT PAGE DISPATCH" : isSpecial ? "SPECIAL DISPATCH" : item.subscriptionTitle}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSave(item);
                      }}
                      className="text-neutral-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors p-1"
                      title="Bookmark Article"
                    >
                      {item.saved ? (
                        <BookmarkCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 fill-amber-500/20" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Horizontal container for FullWidth/Wide layout on medium screens */}
                  <div className={`flex-1 flex flex-col ${(isFullWidth || isWide) && item.imageUrl ? "md:grid md:grid-cols-12 md:gap-6" : ""}`}>
                    {item.imageUrl && (
                      <div className={`overflow-hidden mb-4 p-1 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 ${
                        isFullWidth || isWide ? "md:col-span-5 md:mb-0" : ""
                      } ${isHero ? "aspect-[16/9]" : isSpecial ? "aspect-[21/9]" : "aspect-[16/10]"}`}>
                        <div className="w-full h-full overflow-hidden relative">
                          <img
                            src={item.imageUrl}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 filter grayscale-[15%] group-hover:grayscale-0"
                          />
                          <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowUpRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Text Container */}
                    <div className={`flex flex-col flex-1 ${isFullWidth || isWide ? "md:col-span-7" : ""}`}>
                      {/* Headline */}
                      <h2
                        dir={dir}
                        className={`font-serif font-black leading-tight text-neutral-950 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors mb-3 ${titleClass} ${dir === "rtl" ? "font-thaana" : ""}`}
                      >
                        {item.title}
                      </h2>

                      {/* Article Dateline & Summary with Drop Cap for Hero */}
                      {item.summary && (
                        <div dir={dir} className={`text-neutral-700 dark:text-neutral-300 leading-relaxed ${summaryClass} mb-4 ${dir === "rtl" ? "font-thaana text-right" : "font-serif"}`}>
                          {isHero ? (
                            <p className={dir === "rtl" ? "" : "first-letter:float-left first-letter:text-5xl first-letter:font-serif first-letter:font-black first-letter:mr-3 first-letter:leading-none first-letter:text-neutral-950 dark:first-letter:text-white"}>
                              {dir !== "rtl" && (
                                <strong className="font-sans font-bold text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400 mr-2">
                                  [DISPATCH]
                                </strong>
                              )}
                              {item.summary}
                            </p>
                          ) : (
                            <p>{item.summary}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Newspaper Footer Meta */}
                  <div className="mt-auto pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                    <span>{new Date(item.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    <span className="flex items-center gap-1">
                      <Newspaper className="w-3 h-3 text-neutral-400" />
                      <span>{Math.max(1, Math.ceil((item.summary || "").length / 220))} min read</span>
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Bottom Broadsheet Footer */}
        <footer className="mt-16 pt-8 border-t-2 border-b border-neutral-900 dark:border-neutral-100 text-center text-xs font-mono text-neutral-600 dark:text-neutral-400 space-y-2 pb-6">
          <p className="font-serif font-bold uppercase tracking-widest text-neutral-900 dark:text-white text-sm">
            End of Current Edition • Raadhavalhi Intelligence Feed
          </p>
          <p>© 2026 Raadhavalhi News Chronicle. Real-time RSS & Neural Speech Aggregator.</p>
        </footer>

      </div>
    </div>
  );
}

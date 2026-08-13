import React, { useState } from "react";
import { X, SlidersHorizontal, RotateCcw, Calendar, FolderTree, Newspaper, ArrowUpDown, Search, Check } from "lucide-react";

export interface FilterOptions {
  sortBy: "newest" | "oldest" | "source" | "title";
  dateRange: "all" | "24h" | "7d" | "30d";
  selectedTopic: string;
  selectedSources: string[]; // list of source titles
  searchQuery: string;
}

export const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  sortBy: "newest",
  dateRange: "all",
  selectedTopic: "all",
  selectedSources: [],
  searchQuery: "",
};

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: FilterOptions;
  onChangeOptions: (opts: FilterOptions) => void;
  availableSources: { title: string; count: number }[];
  availableTopics: { id: string; label: string }[];
  totalItemCount: number;
  filteredItemCount: number;
}

export default function FilterModal({
  isOpen,
  onClose,
  options,
  onChangeOptions,
  availableSources,
  availableTopics,
  totalItemCount,
  filteredItemCount,
}: FilterModalProps) {
  const [sourceSearch, setSourceSearch] = useState("");

  if (!isOpen) return null;

  const activeFiltersCount =
    (options.sortBy !== "newest" ? 1 : 0) +
    (options.dateRange !== "all" ? 1 : 0) +
    (options.selectedTopic !== "all" ? 1 : 0) +
    (options.selectedSources.length > 0 && options.selectedSources.length < availableSources.length ? 1 : 0) +
    (options.searchQuery.trim().length > 0 ? 1 : 0);

  const resetFilters = () => {
    onChangeOptions(DEFAULT_FILTER_OPTIONS);
  };

  const handleSourceToggle = (srcTitle: string) => {
    let next: string[];
    if (options.selectedSources.length === 0) {
      // If currently showing all sources, selecting one means selecting only that source
      next = [srcTitle];
    } else if (options.selectedSources.includes(srcTitle)) {
      next = options.selectedSources.filter((s) => s !== srcTitle);
      if (next.length === 0) {
        // If unselected the last source, revert to all sources
        next = [];
      }
    } else {
      next = [...options.selectedSources, srcTitle];
    }
    onChangeOptions({ ...options, selectedSources: next });
  };

  const selectAllSources = () => {
    onChangeOptions({ ...options, selectedSources: [] });
  };

  const filteredSourcesList = availableSources.filter((s) =>
    s.title.toLowerCase().includes(sourceSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="w-full sm:max-w-2xl max-h-[88vh] bg-neutral-900 border-2 border-neutral-800 border-b-0 text-white rounded-none shadow-2xl flex flex-col overflow-hidden animate-sheet-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Filter and sort feed"
      >
        {/* Sheet grab handle */}
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <span className="h-1.5 w-10 rounded-none bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-none border-2 border-amber-500/30 bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-white">Filter & Sort Feed</h2>
              <p className="text-xs text-neutral-400">
                Customize sorting, date ranges, sources, and topics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-none border border-white/20 text-xs font-semibold bg-white/10 hover:bg-white/20 text-neutral-300 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-none border border-white/20 bg-white/10 hover:bg-white/20 text-neutral-300 flex items-center justify-center transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-neutral-700">
          {/* Keyword Search */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-amber-400" />
              <span>Search Keywords</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={options.searchQuery}
                onChange={(e) => onChangeOptions({ ...options, searchQuery: e.target.value })}
                placeholder="Search articles by title, keyword, or summary..."
                className="w-full bg-neutral-950 border-2 border-white/15 rounded-none px-4 py-2.5 text-sm text-white placeholder-neutral-500 outline-none focus:border-amber-400"
              />
              {options.searchQuery && (
                <button
                  onClick={() => onChangeOptions({ ...options, searchQuery: "" })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Sort By */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
              <span>Sort News By</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "newest", label: "Newest First" },
                { id: "oldest", label: "Oldest First" },
                { id: "source", label: "Source (A-Z)" },
                { id: "title", label: "Title (A-Z)" },
              ].map((s) => {
                const isSelected = options.sortBy === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => onChangeOptions({ ...options, sortBy: s.id as FilterOptions["sortBy"] })}
                    className={`py-2 px-3 rounded-none text-xs font-bold text-center transition-all border-2 ${
                      isSelected
                        ? "bg-amber-500 text-black border-amber-600 shadow-none"
                        : "bg-neutral-950 border-white/10 text-neutral-300 hover:bg-neutral-800"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Filter By Date</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "all", label: "All Time" },
                { id: "24h", label: "Past 24 Hours" },
                { id: "7d", label: "Past 7 Days" },
                { id: "30d", label: "Past 30 Days" },
              ].map((d) => {
                const isSelected = options.dateRange === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => onChangeOptions({ ...options, dateRange: d.id as FilterOptions["dateRange"] })}
                    className={`py-2 px-3 rounded-none text-xs font-bold text-center transition-all border-2 ${
                      isSelected
                        ? "bg-amber-500 text-black border-amber-600 shadow-none"
                        : "bg-neutral-950 border-white/10 text-neutral-300 hover:bg-neutral-800"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Topics */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5 text-amber-400" />
              <span>Filter By Topic</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {availableTopics.map((t) => {
                const isSelected = options.selectedTopic === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onChangeOptions({ ...options, selectedTopic: t.id })}
                    className={`py-1.5 px-3 rounded-none text-xs font-bold transition-all border-2 ${
                      isSelected
                        ? "bg-amber-500 text-black border-amber-600 shadow-none"
                        : "bg-neutral-950 border-white/10 text-neutral-300 hover:bg-neutral-800"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* News Sources Filter */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Newspaper className="w-3.5 h-3.5 text-amber-400" />
                <span>Filter By Source ({availableSources.length})</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllSources}
                  className="text-[11px] font-semibold text-amber-400 hover:underline"
                >
                  Show All
                </button>
              </div>
            </div>

            {availableSources.length > 6 && (
              <input
                type="text"
                value={sourceSearch}
                onChange={(e) => setSourceSearch(e.target.value)}
                placeholder="Filter source list..."
                className="w-full bg-neutral-950 border-2 border-white/10 rounded-none px-3 py-1.5 text-xs text-white placeholder-neutral-500 outline-none"
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {filteredSourcesList.map((s) => {
                const isChecked =
                  options.selectedSources.length === 0 ||
                  options.selectedSources.includes(s.title);

                return (
                  <button
                    key={s.title}
                    onClick={() => handleSourceToggle(s.title)}
                    className={`flex items-center justify-between p-2.5 rounded-none border-2 text-xs font-semibold text-left transition-all ${
                      isChecked
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                        : "bg-neutral-950/60 border-white/5 text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <div
                        className={`w-4 h-4 rounded-none border flex items-center justify-center shrink-0 ${
                          isChecked
                            ? "bg-amber-500 border-amber-500 text-black"
                            : "border-white/20 bg-transparent"
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="truncate">{s.title}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-none border border-white/10 bg-white/10 text-neutral-300 shrink-0">
                      {s.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/40 flex items-center justify-between">
          <div className="text-xs text-neutral-400">
            Showing <strong className="text-white">{filteredItemCount}</strong> of {totalItemCount} articles
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-none border-2 border-black shadow-none transition-all active:scale-95"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
}

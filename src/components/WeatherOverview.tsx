import React, { useEffect, useState } from "react";
import {
  getWeatherCountry,
  getWeatherCountryInfo,
} from "../lib/weatherCountries";
import type { WeatherForecast } from "../lib/weatherData";
import { weatherGlyph } from "../lib/weatherData";
import { CloudOff, MapPin, RefreshCw } from "lucide-react";

interface Props {
  countryCode?: string; // when omitted, reads the user's saved choice
}

function fmtTemp(c?: number): string {
  if (c === undefined || Number.isNaN(c)) return "—";
  return `${Math.round(c)}°C`;
}

function fmtWind(kph?: number): string {
  if (kph === undefined || Number.isNaN(kph)) return "—";
  return `${Math.round(kph)} km/h`;
}

export default function WeatherOverview({ countryCode }: Props) {
  const code = countryCode || getWeatherCountry();
  const info = getWeatherCountryInfo(code);
  const [data, setData] = useState<WeatherForecast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/weather?country=${encodeURIComponent(code)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: any) => {
        if (!alive) return;
        setData(json as WeatherForecast);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message || "Unable to load weather");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [code]);

  if (loading) {
    return (
      <div className="border-2 border-neutral-900 dark:border-neutral-700 bg-[#faf6ec] dark:bg-[#1a1815] shadow-[3px_3px_0px_rgba(0,0,0,0.15)] dark:shadow-[3px_3px_0px_rgba(255,255,255,0.08)] p-5 text-center font-serif italic text-neutral-500 dark:text-neutral-400">
        Loading weather for {info.flag} {info.name}…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="border-2 border-red-500/40 bg-red-500/5 p-5 flex items-center gap-3 text-red-700 dark:text-red-400">
        <CloudOff className="w-5 h-5 shrink-0" />
        <div className="text-sm font-serif">
          <p className="font-bold">Weather unavailable</p>
          <p className="text-xs opacity-80">{error || "Try refreshing."}</p>
        </div>
      </div>
    );
  }

  if (data.source === "unavailable") {
    return (
      <div className="border-2 border-amber-500/40 bg-amber-500/5 p-5 flex items-center gap-3 text-amber-700 dark:text-amber-400">
        <CloudOff className="w-5 h-5 shrink-0" />
        <div className="text-sm font-serif">
          <p className="font-bold">Weather unavailable</p>
          <p className="text-xs opacity-80">The forecast service is temporarily unreachable. Try again shortly.</p>
        </div>
      </div>
    );
  }

  const isMv = data.source === "mv";
  const subtitle = isMv
    ? "Maldives Meteorological Service"
    : `${data.capital} · ${data.country}`;

  return (
    <section className="border-2 border-neutral-900 dark:border-neutral-700 bg-[#faf6ec] dark:bg-[#1a1815] shadow-[3px_3px_0px_rgba(0,0,0,0.15)] dark:shadow-[3px_3px_0px_rgba(255,255,255,0.08)] p-4 sm:p-5">
      {/* Header ribbon */}
      <div className="flex items-center justify-between border-b-2 border-neutral-900 dark:border-neutral-200 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          <h2 className="font-serif font-black uppercase tracking-wide text-base sm:text-lg text-neutral-950 dark:text-white">
            Weather · {info.flag} {info.name}
          </h2>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
          {subtitle}
        </span>
      </div>

      {isMv ? (
        <MvLayout data={data} />
      ) : (
        <OpenMeteoLayout data={data} />
      )}

      {/* Attribution footer */}
      <div className="mt-3 pt-2 border-t border-dashed border-neutral-900/20 dark:border-neutral-700 text-[9px] font-mono uppercase tracking-wide text-neutral-500">
        Source: {data.attribution} · updated{" "}
        {new Date(data.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    </section>
  );
}

function MvLayout({ data }: { data: WeatherForecast }) {
  // The Maldives feed is 3 periods × 5 stations, ordered Tomorrow(5), 48hrs(5),
  // 72hrs(5). Group them by position.
  const periods = ["Tomorrow", "48 hrs", "72 hrs"];
  const byPeriod: Record<string, typeof data.days> = {
    Tomorrow: [],
    "48 hrs": [],
    "72 hrs": [],
  };
  for (let i = 0; i < data.days.length; i++) {
    const periodIdx = Math.floor(i / 5) % periods.length;
    byPeriod[periods[periodIdx]].push(data.days[i]);
  }

  return (
    <div className="space-y-3">
      {periods.map((period) => (
        <div key={period}>
          <div className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-800 dark:text-amber-400 mb-1">
            {period}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {byPeriod[period].map((d, i) => (
              <div
                key={`${period}-${i}`}
                className="border border-neutral-900/20 dark:border-neutral-700 p-2 flex flex-col items-center text-center bg-white/40 dark:bg-black/20"
              >
                <span className="text-[10px] font-mono uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
                  {d.label}
                </span>
                <span className="text-2xl leading-none my-1">{weatherGlyph(d.icon)}</span>
                <span className="font-serif font-bold text-sm text-neutral-950 dark:text-neutral-50">
                  {fmtTemp(d.tempC)}
                </span>
                <span className="text-[10px] text-neutral-600 dark:text-neutral-400 leading-tight">
                  {d.condition}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function OpenMeteoLayout({ data }: { data: WeatherForecast }) {
  const today = data.days[0];
  const rest = data.days.slice(1);
  return (
    <div className="space-y-3">
      {/* Current highlight */}
      {data.current && (
        <div className="flex items-center gap-4 border border-neutral-900/20 dark:border-neutral-700 p-3 bg-white/40 dark:bg-black/20">
          <span className="text-4xl leading-none">{weatherGlyph(data.current.icon)}</span>
          <div>
            <div className="font-serif font-black text-2xl text-neutral-950 dark:text-white">
              {fmtTemp(data.current.tempC)}
            </div>
            <div className="text-xs text-neutral-700 dark:text-neutral-300">
              {data.current.condition}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-wide text-neutral-500 mt-0.5">
              Wind {fmtWind(data.current.windKph)}
              {data.current.humidity !== undefined ? ` · Hum ${Math.round(data.current.humidity)}%` : ""}
            </div>
          </div>
        </div>
      )}

      {/* 7-day forecast */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
        {rest.map((d, i) => (
          <div
            key={`${d.date}-${i}`}
            className="border border-neutral-900/20 dark:border-neutral-700 p-2 flex flex-col items-center text-center bg-white/40 dark:bg-black/20"
          >
            <span className="text-[10px] font-mono uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
              {d.label}
            </span>
            <span className="text-xl leading-none my-1">{weatherGlyph(d.icon)}</span>
            <span className="text-[11px] font-serif font-bold text-neutral-950 dark:text-neutral-50">
              {fmtTemp(d.tempMaxC)}
            </span>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
              {fmtTemp(d.tempMinC)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

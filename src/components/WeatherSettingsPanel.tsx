import React, { useState } from "react";
import {
  WEATHER_COUNTRIES,
  getWeatherCountry,
  getWeatherCountryInfo,
  setWeatherCountry,
} from "../lib/weatherCountries";
import { CloudSun, Check, MapPin } from "lucide-react";

export default function WeatherSettingsPanel() {
  const [code, setCode] = useState<string>(getWeatherCountry());

  const select = (c: string) => {
    setCode(c);
    setWeatherCountry(c);
  };

  const current = getWeatherCountryInfo(code);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
          <CloudSun className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-white">Weather Country</h3>
          <p className="text-xs text-neutral-400">
            National forecast shown in the Daily Paper. Maldives uses the official met service.
          </p>
        </div>
      </div>

      <div className="p-3 rounded-none bg-neutral-900/80 border-2 border-white/10 flex items-center gap-2 text-xs text-neutral-300">
        <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          Showing: <span className="font-bold text-white">{current.flag} {current.name}</span>
          {current.code !== "MV" && (
            <span className="text-neutral-400"> · {current.capital.city}</span>
          )}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {WEATHER_COUNTRIES.map((c) => {
          const on = c.code === code;
          return (
            <button
              key={c.code}
              onClick={() => select(c.code)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-none border-2 text-xs font-bold transition-all ${
                on
                  ? "bg-amber-500/10 border-amber-500/40 text-white"
                  : "bg-black/30 border-white/5 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <span className="truncate flex items-center gap-1.5">
                <span className="text-base leading-none">{c.flag}</span>
                {c.name}
              </span>
              {on && <Check className="w-4 h-4 text-amber-400 shrink-0 ml-1" />}
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-neutral-500 px-1 leading-relaxed">
        Maldives forecast is sourced from the Maldives Meteorological Service (meteorology.gov.mv).
        All other countries use Open-Meteo, which aggregates each nation's official meteorological agency.
        Your choice is saved on this device.
      </p>
    </div>
  );
}

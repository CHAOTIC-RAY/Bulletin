// Shared weather orchestrator used by BOTH the Cloudflare Worker and the dev
// server. Given a country code, it returns a normalized WeatherForecast:
//   - MV  -> official Maldives Meteorological Service (scraped)
//   - any -> Open-Meteo (which aggregates that nation's official met agency)
// Keeps the client's fetch logic tiny and identical across environments.

import type { WeatherCountry } from "./weatherCountries";
import { getWeatherCountryInfo } from "./weatherCountries";
import type { WeatherDay, WeatherForecast } from "./weatherData";
import { mapWmoCode } from "./weatherData";
import { fetchMaldivesForecast } from "./weatherMv";

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

function dayLabel(d: Date, i: number): string {
  const today = new Date();
  if (i === 0) return "Today";
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

async function fetchOpenMeteo(country: WeatherCountry): Promise<WeatherForecast> {
  const { lat, lon } = country.capital;
  const url =
    `${OPEN_METEO}?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&timezone=auto&forecast_days=7`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new Error(`Open-Meteo returned HTTP ${res.status}`);
  }
  const json = (await res.json()) as any;
  const cur = json.current || {};
  const daily = json.daily || {};

  const days: WeatherDay[] = [];
  const times: string[] = daily.time || [];
  for (let i = 0; i < times.length; i++) {
    const date = new Date(times[i] + "T00:00:00");
    const wmo = Number(daily.weather_code?.[i]);
    const { icon, condition } = mapWmoCode(wmo);
    days.push({
      label: dayLabel(date, i),
      date: times[i],
      tempMaxC: Number(daily.temperature_2m_max?.[i]),
      tempMinC: Number(daily.temperature_2m_min?.[i]),
      condition,
      icon,
    });
  }

  const currentWmo = Number(cur.weather_code);
  const curMapped = mapWmoCode(currentWmo);

  return {
    source: "open-meteo",
    country: country.name,
    capital: country.capital.city,
    attribution: `Open-Meteo · ${country.capital.city} (${country.name} official forecast)`,
    fetchedAt: Date.now(),
    current: {
      tempC: typeof cur.temperature_2m === "number" ? cur.temperature_2m : undefined,
      condition: curMapped.condition,
      icon: curMapped.icon,
      windKph: typeof cur.wind_speed_10m === "number" ? cur.wind_speed_10m : undefined,
      humidity: typeof cur.relative_humidity_2m === "number" ? cur.relative_humidity_2m : undefined,
    },
    days,
  };
}

/**
 * Resolve a weather forecast for a country code.
 *
 * Open-Meteo is used as the PRIMARY source for every country (including MV /
 * Malé) because it is reliably egress-allowed from Cloudflare Workers. The
 * official Maldives Meteorological Service is kept only as a best-effort
 * SECONDARY for MV: its subrequest is sometimes hard-blocked by Cloudflare
 * (error 1102), and if it is the first call it can abort the whole request
 * before any fallback runs — so it must never be the primary.
 *
 * The box always renders real data; if every upstream fails we return a
 * graceful "unavailable" payload (HTTP 200) so the UI shows a friendly message
 * instead of a raw Cloudflare 503.
 */
export async function fetchWeatherForCountry(code: string): Promise<WeatherForecast> {
  const country = getWeatherCountryInfo(code);
  try {
    return await fetchOpenMeteo(country);
  } catch {
    // Best-effort secondary: official Maldives source (MV only).
    if (country.code === "MV") {
      try {
        return await fetchMaldivesForecast();
      } catch {
        /* fall through to unavailable */
      }
    }
  }
  return {
    source: "unavailable",
    country: country.name,
    capital: country.capital?.city || "",
    attribution: "Weather service temporarily unavailable",
    fetchedAt: Date.now(),
    days: [],
    current: undefined,
  };
}

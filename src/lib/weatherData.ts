// Shared weather types + icon mapping for the Daily Paper weather overview.
// Used by the client card and by both the Cloudflare Worker and the dev server
// (which share the same /api/weather/mv scraping logic).

export interface WeatherForecast {
  // "mv" = official Maldives Meteorological Service; "open-meteo" = national
  // agency via Open-Meteo; "unavailable" = all upstreams failed (graceful 200)
  source: "mv" | "open-meteo" | "unavailable";
  country: string;
  capital?: string; // present for open-meteo countries
  attribution: string;
  fetchedAt: number;
  // Current conditions (may be a single summary for MV, or current obs for others)
  current?: {
    tempC?: number;
    condition: string;
    icon: WeatherIcon;
    windKph?: number;
    humidity?: number;
  };
  // Multi-period / multi-day forecast
  days: WeatherDay[];
}

export interface WeatherDay {
  label: string; // "Today", "Thu", "Tomorrow", station name, etc.
  date?: string; // ISO date for open-meteo days
  tempC?: number;
  tempMinC?: number;
  tempMaxC?: number;
  condition: string;
  icon: WeatherIcon;
  windKph?: number;
  humidity?: number;
}

export type WeatherIcon =
  | "fine"
  | "partly-cloudy"
  | "cloudy"
  | "showers"
  | "thundershowers"
  | "rain"
  | "drizzle"
  | "snow"
  | "fog"
  | "wind"
  | "haze"
  | "storm";

// Map the Maldives Met Service's SVG icon filenames to our canonical set.
const MV_ICON_MAP: Record<string, WeatherIcon> = {
  Fine: "fine",
  Clear: "fine",
  Sunny: "fine",
  PartlyCloudy: "partly-cloudy",
  Partlycloudy: "partly-cloudy",
  Cloudy: "cloudy",
  Overcast: "cloudy",
  SlightShowers: "showers",
  Showers: "showers",
  SlightThundershowers: "thundershowers",
  Thundershowers: "thundershowers",
  Thunderstorm: "storm",
  Rain: "rain",
  HeavyRain: "rain",
  Drizzle: "drizzle",
  Fog: "fog",
  Mist: "fog",
  Haze: "haze",
  Windy: "wind",
};

export function mapMvIcon(name: string): WeatherIcon {
  return MV_ICON_MAP[name] || "cloudy";
}

// WMO weather codes (Open-Meteo) → canonical icon + human label.
export function mapWmoCode(code: number): { icon: WeatherIcon; condition: string } {
  switch (code) {
    case 0:
      return { icon: "fine", condition: "Clear sky" };
    case 1:
      return { icon: "fine", condition: "Mainly clear" };
    case 2:
      return { icon: "partly-cloudy", condition: "Partly cloudy" };
    case 3:
      return { icon: "cloudy", condition: "Overcast" };
    case 45:
    case 48:
      return { icon: "fog", condition: "Fog" };
    case 51:
    case 53:
    case 55:
      return { icon: "drizzle", condition: "Drizzle" };
    case 56:
    case 57:
      return { icon: "drizzle", condition: "Freezing drizzle" };
    case 61:
      return { icon: "rain", condition: "Light rain" };
    case 63:
      return { icon: "rain", condition: "Rain" };
    case 65:
      return { icon: "rain", condition: "Heavy rain" };
    case 66:
    case 67:
      return { icon: "rain", condition: "Freezing rain" };
    case 71:
      return { icon: "snow", condition: "Light snow" };
    case 73:
      return { icon: "snow", condition: "Snow" };
    case 75:
    case 77:
      return { icon: "snow", condition: "Heavy snow" };
    case 80:
      return { icon: "showers", condition: "Showers" };
    case 81:
      return { icon: "showers", condition: "Heavy showers" };
    case 82:
      return { icon: "showers", condition: "Violent showers" };
    case 85:
    case 86:
      return { icon: "snow", condition: "Snow showers" };
    case 95:
      return { icon: "thundershowers", condition: "Thunderstorms" };
    case 96:
    case 99:
      return { icon: "storm", condition: "Thunderstorms w/ hail" };
    default:
      return { icon: "cloudy", condition: "Unknown" };
  }
}

// Canonical glyph per icon (works in both light & dark themes).
const ICON_GLYPH: Record<WeatherIcon, string> = {
  fine: "☀️",
  "partly-cloudy": "⛅",
  cloudy: "☁️",
  showers: "🌦️",
  thundershowers: "⛈️",
  rain: "🌧️",
  drizzle: "🌦️",
  snow: "🌨️",
  fog: "🌫️",
  wind: "💨",
  haze: "🌫️",
  storm: "⛈️",
};

export function weatherGlyph(icon: WeatherIcon): string {
  return ICON_GLYPH[icon] || "☁️";
}

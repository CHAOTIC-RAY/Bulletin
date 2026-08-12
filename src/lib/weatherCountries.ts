// Weather country registry + persisted user choice.
// Maldives (MV) uses the official Maldives Meteorological Service; every other
// country resolves to its capital's coordinates and is served by Open-Meteo,
// which aggregates each nation's official meteorological agency forecasts.

const WEATHER_COUNTRY_KEY = "bulletin_weather_country";

export interface WeatherCountry {
  code: string;
  name: string;
  flag: string;
  capital: { city: string; lat: number; lon: number };
}

// Curated set covering the app's news regions + common expat/home countries.
export const WEATHER_COUNTRIES: WeatherCountry[] = [
  { code: "MV", name: "Maldives", flag: "🇲🇻", capital: { city: "Malé", lat: 4.175, lon: 73.509 } },
  { code: "IN", name: "India", flag: "🇮🇳", capital: { city: "New Delhi", lat: 28.6139, lon: 77.209 } },
  { code: "LK", name: "Sri Lanka", flag: "🇱🇰", capital: { city: "Colombo", lat: 6.9271, lon: 79.8612 } },
  { code: "US", name: "United States", flag: "🇺🇸", capital: { city: "Washington, D.C.", lat: 38.9072, lon: -77.0369 } },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", capital: { city: "London", lat: 51.5074, lon: -0.1278 } },
  { code: "AU", name: "Australia", flag: "🇦🇺", capital: { city: "Canberra", lat: -35.2809, lon: 149.13 } },
  { code: "CA", name: "Canada", flag: "🇨🇦", capital: { city: "Ottawa", lat: 45.4215, lon: -75.6972 } },
  { code: "SG", name: "Singapore", flag: "🇸🇬", capital: { city: "Singapore", lat: 1.3521, lon: 103.8198 } },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", capital: { city: "Abu Dhabi", lat: 24.4539, lon: 54.3773 } },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", capital: { city: "Riyadh", lat: 24.7136, lon: 46.6753 } },
  { code: "QA", name: "Qatar", flag: "🇶🇦", capital: { city: "Doha", lat: 25.2854, lon: 51.531 } },
  { code: "JP", name: "Japan", flag: "🇯🇵", capital: { city: "Tokyo", lat: 35.6762, lon: 139.6503 } },
  { code: "CN", name: "China", flag: "🇨🇳", capital: { city: "Beijing", lat: 39.9042, lon: 116.4074 } },
  { code: "DE", name: "Germany", flag: "🇩🇪", capital: { city: "Berlin", lat: 52.52, lon: 13.405 } },
  { code: "FR", name: "France", flag: "🇫🇷", capital: { city: "Paris", lat: 48.8566, lon: 2.3522 } },
  { code: "IT", name: "Italy", flag: "🇮🇹", capital: { city: "Rome", lat: 41.9028, lon: 12.4964 } },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", capital: { city: "Pretoria", lat: -25.7479, lon: 28.2293 } },
  { code: "EG", name: "Egypt", flag: "🇪🇬", capital: { city: "Cairo", lat: 30.0444, lon: 31.2357 } },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", capital: { city: "Jakarta", lat: -6.2088, lon: 106.8456 } },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", capital: { city: "Islamabad", lat: 33.6844, lon: 73.0479 } },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", capital: { city: "Dhaka", lat: 23.8103, lon: 90.4125 } },
  { code: "TH", name: "Thailand", flag: "🇹🇭", capital: { city: "Bangkok", lat: 13.7563, lon: 100.5018 } },
];

export function getWeatherCountry(): string {
  try {
    const v = localStorage.getItem(WEATHER_COUNTRY_KEY);
    return v || "MV";
  } catch {
    return "MV";
  }
}

export function setWeatherCountry(code: string): void {
  try {
    localStorage.setItem(WEATHER_COUNTRY_KEY, code);
  } catch {
    /* ignore */
  }
}

export function getWeatherCountryInfo(code = getWeatherCountry()): WeatherCountry {
  return WEATHER_COUNTRIES.find((c) => c.code === code) || WEATHER_COUNTRIES[0];
}

// Parser for the Maldives Meteorological Service homepage (meteorology.gov.mv).
// The site is server-rendered with no public JSON API, so we scrape + parse the
// stable forecast markup. Shared by the Cloudflare Worker and the dev server
// (both import this module), so the client gets identical data in either env.

import { parseHTML } from "linkedom";
import type { WeatherDay, WeatherForecast, WeatherIcon } from "./weatherData";
import { mapMvIcon } from "./weatherData";

const MV_URL = "https://www.meteorology.gov.mv/";

const STATIONS = ["Hulhule", "Hanimaadhoo", "Kadhdhoo", "Kaadehdhoo", "Gan"];

// The first 5 forecast-pill blocks are "Tomorrow" (next 24h) per station;
// the next 5 are "Next 48 hrs"; the final 5 are "Next 72 hrs".
function periodLabelForIndex(i: number): string {
  if (i < 5) return "Tomorrow";
  if (i < 10) return "48 hrs";
  return "72 hrs";
}

interface StationCell {
  station: string;
  icon: WeatherIcon;
  temp: number;
  condition: string;
}

function decodeTemp(raw: string): number {
  const m = raw.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : NaN;
}

export async function fetchMaldivesForecast(): Promise<WeatherForecast> {
  const res = await fetch(MV_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`Maldives met service returned HTTP ${res.status}`);
  }
  const html = await res.text();
  const doc = parseHTML(html) as any;
  const document = doc.document;

  const cells: StationCell[] = [];
  // Each station forecast block: <p class="...forecast-pill...">NAME</p> ... <img .../weather-icons/ICON.svg> ... <h4>30°C</h4> <p ...forecast-text...>COND</p>
  const pills = Array.from(document.querySelectorAll("p.forecast-pill")) as any[];
  for (const pill of pills) {
    const station = (pill.textContent || "").trim();
    if (!STATIONS.includes(station)) continue;
    // Walk forward through the block's siblings to find the icon + temp + condition.
    let node: any = pill.parentElement;
    let icon: WeatherIcon = "cloudy";
    let temp = NaN;
    let condition = "";
    // Inspect the containing column card and a bounded set of following elements.
    const card = node?.closest?.(".col") || node?.parentElement?.parentElement || node;
    const cardText = card ? card.textContent || "" : "";
    const img = card?.querySelector?.('img[src*="weather-icons/"]');
    if (img) {
      const src = img.getAttribute("src") || "";
      const m = src.match(/weather-icons\/([A-Za-z]+)\.svg/);
      if (m) icon = mapMvIcon(m[1]);
    }
    const h4 = card?.querySelector?.("h4");
    if (h4) temp = decodeTemp(h4.textContent || "");
    const cond = card?.querySelector?.("p.forecast-text");
    if (cond) condition = (cond.textContent || "").trim();
    // Fallback: regex over the card text if structured nodes missed.
    if (!condition) {
      const cm = cardText.match(/(\d+°?C?)\s*([A-Za-z][A-Za-z ]+?)(?=\s*(?:<|$))/);
    }
    cells.push({ station, icon, temp, condition: condition || "—" });
  }

  // Group into the 3 forecast periods (Tomorrow / 48 hrs / 72 hrs).
  const periods: Record<string, WeatherDay[]> = { Tomorrow: [], "48 hrs": [], "72 hrs": [] };
  cells.forEach((c, i) => {
    const label = periodLabelForIndex(i);
    periods[label].push({
      label: c.station,
      tempC: Number.isFinite(c.temp) ? c.temp : undefined,
      condition: c.condition,
      icon: c.icon,
    });
  });

  const days: WeatherDay[] = [];
  for (const label of ["Tomorrow", "48 hrs", "72 hrs"]) {
    if (periods[label].length) {
      days.push(...periods[label]);
    }
  }

  return {
    source: "mv",
    country: "Maldives",
    attribution: "Maldives Meteorological Service · meteorology.gov.mv",
    fetchedAt: Date.now(),
    days,
  };
}

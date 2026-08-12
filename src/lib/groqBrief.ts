// Groq-powered daily brief. Uses the on-device buildDailyBrief() as the
// structured input, then asks Groq to polish headlines/details and write a
// natural lead + section intros in the same GeneratedDailyBrief shape.
// If no API key is available, or Groq errors / returns bad JSON, we return the
// local brief unchanged (source: "fallback") so the app never breaks.

import {
  buildDailyBrief,
  type BriefArticleInput,
  type GeneratedDailyBrief,
} from "./generateNewsBrief";

export type BriefSource = "groq" | "fallback";

export interface BriefResult {
  brief: GeneratedDailyBrief;
  source: BriefSource;
  error?: string;
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

interface GroqSection {
  source: string;
  intro: string;
  items: { headline: string; detail: string; link: string }[];
}

function buildPrompt(brief: GeneratedDailyBrief): string {
  const compact = {
    lead: brief.lead,
    sections: brief.sections.map((s) => ({
      source: s.source,
      intro: s.intro,
      items: s.items.map((i) => ({ headline: i.headline, detail: i.detail, link: i.link })),
    })),
  };
  return [
    "You are the editor of a concise, professional news brief for a mobile news app.",
    "You are given a structured draft brief (grouped by source). Rewrite it to read naturally,",
    "like a real journalist's daily summary. Rules:",
    "- Keep the exact same JSON structure and the same number of sections and items.",
    "- Keep each item's 'link' unchanged.",
    "- Rewrite each 'headline' to be clear, factual, and engaging (max ~12 words).",
    "- Rewrite each 'detail' to be a complete, informative sentence (max ~28 words). No clickbait, no 'read more'.",
    "- Rewrite each section 'intro' as one natural sentence summarizing that source's focus today.",
    "- Rewrite 'lead' as one punchy overview sentence covering the day's top stories.",
    "STRICT FACT RULES — violation means your output is rejected:",
    "- You may ONLY rephrase / clean the text already present in the draft. Do NOT add any new",
    "  facts, entities, quotes, statistics, or analysis that are not in the draft brief.",
    "- If the draft's detail/summary is thin or in another language, rephrase what IS there",
    "  (or translate it faithfully) — never invent 'market participants', 'analysts', 'regulatory",
    "  implications', 'macroeconomic conditions', or similar filler.",
    "- If a detail is empty, use the headline as the detail. Do not elaborate.",
    "Respond with ONLY a JSON object, no markdown, no commentary.",
    "Draft brief:\n" + JSON.stringify(compact),
  ].join("\n");
}

function extractJson(text: string): any | null {
  // Groq may wrap JSON in ```json fences — pull the first balanced object.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate.trim());
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function tokenizeWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !/^(the|and|for|with|from|that|this|have|has|are|was|were|been|into|over|about|their|there|what|when|will|your|our|out|new|now|more|than|them|these|those|after|before)$/.test(w)),
  );
}

// Guardrail against LLM fabrication: if a polished detail/intro/lead shares
// almost no meaningful words with the source draft (title/summary), the model
// likely invented facts. In that case we keep the source-faithful local text.
function sourceOverlap(a: string, b: string): number {
  const wa = tokenizeWords(a);
  const wb = tokenizeWords(b);
  if (!wa.size || !wb.size) return 1; // empty side → don't penalize
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.max(wa.size, wb.size);
}

function guardAgainstHallucination(local: GeneratedDailyBrief, polished: GeneratedDailyBrief): GeneratedDailyBrief {
  const localSections = local.sections;
  const out = { ...polished, sections: polished.sections.map((s, si) => {
    const lsec = localSections[si];
    const items = s.items.map((it, ji) => {
      const f = lsec?.items[ji];
      if (!f) return it;
      const srcText = `${f.headline} ${f.detail}`;
      // If the polished detail barely overlaps the source, it's invented → use local.
      if (sourceOverlap(it.detail, srcText) < 0.25 && f.detail.trim().length > 10) {
        return { ...it, detail: f.detail, headline: f.headline };
      }
      return it;
    });
    let intro = s.intro;
    if (lsec && sourceOverlap(intro, lsec.items.map((i) => `${i.headline} ${i.detail}`).join(" ")) < 0.2) {
      intro = lsec.intro;
    }
    return { ...s, intro, items };
  }) };
  // Guard the lead too.
  if (sourceOverlap(polished.lead, local.sections.map((s) => s.items.map((i) => `${i.headline} ${i.detail}`).join(" ")).join(" ")) < 0.15) {
    out.lead = local.lead;
  }
  return out;
}

function coerce(parsed: any, fallback: GeneratedDailyBrief): GeneratedDailyBrief | null {
  if (!parsed || !Array.isArray(parsed.sections)) return null;
  try {
    const sections = parsed.sections.map((s: any, i: number) => {
      const src = s?.source || fallback.sections[i]?.source || "News";
      const items = Array.isArray(s?.items)
        ? s.items.map((it: any, j: number) => {
            const f = fallback.sections[i]?.items[j];
            return {
              id: f?.id || `${src}-${j}`,
              headline: String(it?.headline || f?.headline || "").slice(0, 200),
              detail: String(it?.detail || f?.detail || "").slice(0, 300),
              link: String(it?.link || f?.link || ""),
            };
          })
        : fallback.sections[i]?.items || [];
      return {
        source: src,
        intro: String(s?.intro || fallback.sections[i]?.intro || "").slice(0, 200),
        items,
      };
    });
    const lead = String(parsed.lead || fallback.lead).slice(0, 400);
    return { date: fallback.date, lead, sections };
  } catch {
    return null;
  }
}

/** Build the brief locally, then try to polish it with Groq (only when useAi). Always returns a usable brief. */
export async function generateBrief(articles: BriefArticleInput[], dateKey: string, apiKey?: string, useAi = true): Promise<BriefResult> {
  const local = buildDailyBrief(articles, dateKey);
  if (!useAi || !apiKey) {
    return { brief: local, source: apiKey ? "fallback" : "fallback", error: useAi ? "no_api_key" : "ai_disabled" };
  }
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: "You rewrite news briefs into clean JSON. Only output JSON." },
          { role: "user", content: buildPrompt(local) },
        ],
        temperature: 0.4,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { brief: local, source: "fallback", error: `groq_http_${res.status}` };
    }
    const data = await res.json() as any;
    const content: string = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJson(content);
    const polished = parsed ? coerce(parsed, local) : null;
    if (polished && polished.sections.length) {
      const safe = guardAgainstHallucination(local, polished);
      return { brief: safe, source: "groq" };
    }
    return { brief: local, source: "fallback", error: "groq_bad_json" };
  } catch (e: any) {
    return { brief: local, source: "fallback", error: e?.message || "groq_error" };
  }
}

import "dotenv/config";
import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma.js";


const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const LLM_MODEL = process.env.LLM_MODEL || "llama3";

const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY || "";

const SERP_ENGINE = process.env.SERP_ENGINE || "google";
const SERP_LOCATION = process.env.SERP_LOCATION || "Mumbai,Maharashtra,India";
const SERP_GL = process.env.SERP_GL || "in";
const SERP_HL = process.env.SERP_HL || "en";

if (!SERPAPI_API_KEY) {
  console.error("Missing SERPAPI_API_KEY in .env");
  process.exit(1);
}


const QUERIES = [
  // broad
  "F1 screening Mumbai",
  "F1 screening Thane",
  "F1 screening Navi Mumbai",
  "Formula 1 screening Mumbai",
  "Formula 1 screening Thane",
  "F1 race screening Mumbai pub",

  // localities (Mumbai)
  "F1 screening Bandra",
  "F1 screening Andheri",
  "F1 screening Lower Parel",
  "F1 screening Powai",

  // localities (Thane)
  "F1 screening Thane West",
  "F1 screening Hiranandani Estate Thane",
  "F1 screening Viviana Mall Thane",
  "F1 screening Ghodbunder Road",

  // localities (Navi Mumbai)
  "F1 screening Vashi",
  "F1 screening Nerul",
  "F1 screening Belapur",
  "F1 screening Kharghar",
  "F1 screening Seawoods"
];

async function serpSearch(q: string, num = 10) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", SERP_ENGINE);
  url.searchParams.set("q", q);
  url.searchParams.set("api_key", SERPAPI_API_KEY);

  // These improve locality relevance
  url.searchParams.set("location", SERP_LOCATION);
  url.searchParams.set("gl", SERP_GL);
  url.searchParams.set("hl", SERP_HL);

  // Google typically supports num=10
  url.searchParams.set("num", String(num));

  const res = await fetch(url.toString());
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`SerpAPI error ${res.status}: ${t}`);
  }
  return res.json() as Promise<any>;
}


async function fetchPageText(url: string) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  const html = await res.text();

  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();

  const title = $("title").text().trim();
  const text = $("body").text().replace(/\s+/g, " ").trim();

  // Keep it bounded for local models
  const trimmed = text.slice(0, 14000);
  return { title, text: trimmed };
}

// Ollama's `format` accepts a real JSON Schema and constrains decoding to it,
// so the model structurally cannot emit a value outside an enum.
//
// The previous version passed format: "json" and described the shape inside
// the prompt as "area": "MUMBAI|THANE|NAVI_MUMBAI|UNKNOWN", meaning "pick one".
// format: "json" only guarantees the output parses, not that the values are
// legal, and the model took the pseudo notation literally: rows in the
// database still hold "MUMBAI|NAVI_MUMBAI" and "FP|QUALI|SPRINT|RACE|UNKNOWN"
// as single string values, and the literal word "string" wherever the sample
// showed "address": "string". Constraining decoding is what actually fixes it.
const EVENT_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sport: { type: "string", enum: ["F1"] },
          area: { type: "string", enum: ["MUMBAI", "THANE", "NAVI_MUMBAI", "UNKNOWN"] },
          locality: { type: "string" },
          venueName: { type: "string" },
          address: { type: "string" },
          session: { type: "string", enum: ["FP", "QUALI", "SPRINT", "RACE", "UNKNOWN"] },
          startTimeIST: { type: "string" },
          priceINR: { type: "integer" },
          bookingUrl: { type: "string" },
          contact: { type: "string" },
          notes: { type: "string" },
          sourceUrl: { type: "string" },
          confidence: { type: "number" }
        },
        required: ["area", "venueName", "session", "confidence"]
      }
    }
  },
  required: ["events"]
} as const;

function extractionPrompt(sourceUrl: string, title: string, pageText: string) {
  return `
You are extracting F1 screening events for the Mumbai Metro region ONLY (Mumbai, Thane, Navi Mumbai).

Rules:
- Include events only if they are clearly in Mumbai OR Thane OR Navi Mumbai (or localities within).
- If the page contains no relevant F1 screening event, return an empty events array.
- Choose exactly one area and exactly one session per event. Use UNKNOWN when unsure.
- Leave a string field empty rather than inventing a value or echoing a placeholder.
- startTimeIST: best effort ISO 8601 string, empty when unknown.
- priceINR: integer, 0 when free or unknown.
- confidence: 0.0 to 1.0, how sure you are this is a real F1 screening in the region.

Source URL: ${sourceUrl}
Title: ${title}

Page text:
${pageText}
`.trim();
}

async function callOllama(prompt: string) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLM_MODEL,
      prompt,
      stream: false,
      format: EVENT_SCHEMA
    })
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Ollama error ${res.status}: ${t}`);
  }

  const data = (await res.json()) as any;
  // ollama returns { response: "..." }
  return String(data.response || "").trim();
}

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// Very lightweight dedupe: venue + session + time
async function isDuplicate(venueName: string, session: string, startTimeIST: string, sourceUrl: string) {
  const vn = normalize(venueName);
  const st = normalize(startTimeIST);

  const existing = await prisma.candidate.findFirst({
    where: {
      status: "PENDING",
      venueName: { not: "" }
    },
    orderBy: { createdAt: "desc" }
  });

  // cheap early-out: if same sourceUrl already ingested recently, skip
  const sameSource = await prisma.candidate.findFirst({ where: { sourceUrl } });
  if (sameSource) return true;

  if (!existing) return false;
  if (normalize(existing.venueName) === vn && String(existing.session) === session && normalize(existing.startTimeIST) === st) {
    return true;
  }
  return false;
}

async function main() {
  console.log("Starting ingestion...");
  const urls: { url: string; name: string; snippet: string }[] = [];

  for (const q of QUERIES) {
    console.log(`Searching: ${q}`);
    const r = await serpSearch(q, 10);

    // SerpAPI: organic_results are the normal Google links
    const items = r?.organic_results || [];
    for (const it of items) {
      if (it?.link) {
        urls.push({
          url: it.link,
          name: it.title || "",
          snippet: it.snippet || ""
        });
      }
    }
  }

  // De-dupe URL list
  const seen = new Set<string>();
  const uniqueUrls = urls.filter((u) => {
    if (seen.has(u.url)) return false;
    seen.add(u.url);
    return true;
  });

  console.log(`Unique URLs to process: ${uniqueUrls.length}`);

  for (const item of uniqueUrls) {
    try {
      console.log(`Fetching: ${item.url}`);
      const { title, text } = await fetchPageText(item.url);

      const prompt = extractionPrompt(item.url, title || item.name, text);
      const out = await callOllama(prompt);

      let parsed: any = null;
      try {
        parsed = JSON.parse(out);
      } catch {
        // If local model outputs imperfect JSON, store candidate for manual review as raw
        await prisma.candidate.create({
          data: {
            status: "PENDING",
            confidence: 0.1,
            venueName: "",
            sourceUrl: item.url,
            sourceTitle: title || item.name,
            sourceSnippet: item.snippet || "",
            rawText: text,
            extractedJson: out
          }
        });
        continue;
      }

      const events: any[] = Array.isArray(parsed?.events) ? parsed.events : [];
      if (events.length === 0) continue;

      for (const e of events) {
        const venueName = String(e.venueName || "");
        const session = String(e.session || "UNKNOWN");
        const startTimeIST = String(e.startTimeIST || "");

        if (!venueName) continue;

        const dup = await isDuplicate(venueName, session, startTimeIST, item.url);
        if (dup) continue;

        await prisma.candidate.create({
          data: {
            status: "PENDING",
            confidence: Number(e.confidence || 0.3),
            sport: "F1",
            area: String(e.area || "UNKNOWN") as any,
            locality: String(e.locality || ""),
            venueName,
            address: String(e.address || ""),
            session: session as any,
            startTimeIST,
            priceINR: Number.isFinite(Number(e.priceINR)) ? Number(e.priceINR) : 0,
            bookingUrl: String(e.bookingUrl || ""),
            contact: String(e.contact || ""),
            notes: String(e.notes || ""),
            sourceUrl: item.url,
            sourceTitle: title || item.name,
            sourceSnippet: item.snippet || "",
            rawText: text,
            extractedJson: JSON.stringify(e)
          }
        });
      }
    } catch (err: any) {
      console.log(`Skip (error): ${item.url} :: ${err?.message || err}`);
    }
  }

  console.log("Ingestion done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

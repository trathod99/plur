import { createHash } from "crypto";
import * as cheerio from "cheerio";
import type { EventFetchWarning, NormalizedEvent, TasteProfile } from "../types";
import { isSanFranciscoProfile, profileMentionsEdm } from "../sf-edm";
import { fetchHtml } from "./http";

const BAY_AREA_URL = "https://19hz.info/eventlisting_BayArea.php";
const HOUSTON_URL = "https://19hz.info/eventlisting_Houston.php";

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function parseSortDate(text: string): string | null {
  const m = text.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d, 20, 0, 0));
  return dt.toISOString();
}

function parseTitleCell(text: string): { title: string; venue?: string; city?: string } {
  const t = text.replace(/\s+/g, " ").trim();
  const m = t.match(/^(.+?)\s@\s(.+)\s\(([^)]+)\)\s*$/);
  if (!m) return { title: t };
  return { title: m[1].trim(), venue: m[2].trim(), city: m[3].trim() };
}

function parsePriceCell(text: string): NormalizedEvent["pricing"] | undefined {
  const raw = text.replace(/\s+/g, " ").trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower.startsWith("free")) {
    return { currency: "USD", label: raw.split("|")[0]?.trim() ?? "free" };
  }
  const m = raw.match(/\$(\d+(?:\.\d+)?)(?:\s*-\s*\$?(\d+(?:\.\d+)?))?/);
  if (m) {
    const min = Number.parseFloat(m[1]);
    const max = m[2] ? Number.parseFloat(m[2]) : undefined;
    return {
      currency: "USD",
      min: Number.isFinite(min) ? min : undefined,
      max: max != null && Number.isFinite(max) ? max : undefined,
      label: raw.includes("|") ? raw.split("|").map((s) => s.trim()).join(" · ") : raw,
    };
  }
  return { currency: "USD", label: raw };
}

function parseDayCell(text: string): { label: string; monthHint?: number } {
  const flat = text.replace(/\s+/g, " ").trim();
  const dayMatch = flat.match(/\b([A-Za-z]{3}):\s*([A-Za-z]{3})\s+(\d{1,2})\b/);
  if (dayMatch) {
    const mon = MONTHS[dayMatch[2].toLowerCase().slice(0, 3)];
    if (mon != null) return { label: flat, monthHint: mon };
  }
  return { label: flat };
}

export async function scrape19hzCalendar(params: {
  url: string;
  sourceLabel: string;
}): Promise<{ events: NormalizedEvent[]; warning?: EventFetchWarning }> {
  try {
    const html = await fetchHtml(params.url);
    const $ = cheerio.load(html);
    const events: NormalizedEvent[] = [];

    $("table tbody tr").each((_, tr) => {
      const tds = $(tr).find("> td");
      if (tds.length < 7) return;

      const dateCell = $(tds[0]).text();
      const titleCell = $(tds[1]);
      const tags = $(tds[2]).text().replace(/\s+/g, " ").trim();
      const priceCell = $(tds[3]).text();
      const sortText = $(tds[6]).text();

      const href = titleCell.find("a[href]").first().attr("href")?.trim();
      const link =
        href && (href.startsWith("http://") || href.startsWith("https://")) ? href : undefined;

      const titleText = titleCell.text().replace(/\s+/g, " ").trim();
      const { title, venue, city } = parseTitleCell(titleText);
      if (!title) return;

      const start =
        parseSortDate(sortText) ??
        (() => {
          const { monthHint } = parseDayCell(dateCell);
          if (monthHint == null) return "";
          const now = new Date();
          let y = now.getUTCFullYear();
          if (monthHint < now.getUTCMonth() - 1) y += 1;
          const dMatch = dateCell.match(/(\d{1,2})\b/);
          const day = dMatch ? Number(dMatch[1]) : 1;
          return new Date(Date.UTC(y, monthHint, day, 20, 0, 0)).toISOString();
        })();

      if (!start) return;

      const lineup = tags
        ? tags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

      const idSeed = `${params.sourceLabel}|${title}|${start}|${venue ?? ""}|${city ?? ""}`;
      const idHash = createHash("sha256").update(idSeed).digest("base64url").slice(0, 32);
      events.push({
        id: `19hz:${idHash}`,
        title,
        start,
        venue,
        city,
        country: "US",
        url: link,
        source: `19hz:${params.sourceLabel}`,
        pricing: parsePriceCell(priceCell),
        lineup,
        matchReasons: [],
        score: 0,
      });
    });

    return { events };
  } catch (e) {
    return {
      events: [],
      warning: {
        source: "19hz",
        message: `${params.sourceLabel}: ${e instanceof Error ? e.message : "fetch failed"}`,
      },
    };
  }
}

function isBayAreaCity(city?: string): boolean {
  const c = city?.trim().toLowerCase() ?? "";
  if (!c) return false;
  return (
    c.includes("oakland") ||
    c.includes("berkeley") ||
    c.includes("san jose") ||
    c.includes("sacramento") ||
    c.includes("bay area") ||
    c.includes("napa") ||
    c.includes("sonoma")
  );
}

export function nineteenHzUrlsForProfile(profile: TasteProfile): { url: string; label: string }[] {
  const out = new Map<string, { url: string; label: string }>();

  if (
    isSanFranciscoProfile(profile.city) ||
    isBayAreaCity(profile.city) ||
    (profileMentionsEdm(profile) && (profile.country?.trim().toUpperCase() ?? "US") === "US")
  ) {
    out.set(BAY_AREA_URL, { url: BAY_AREA_URL, label: "bay-area" });
  }

  if (profile.city?.toLowerCase().includes("houston")) {
    out.set(HOUSTON_URL, { url: HOUSTON_URL, label: "houston" });
  }

  const extra = process.env.NINETEEN_HZ_URLS?.trim();
  if (extra) {
    for (const part of extra.split(/[,;\s]+/).filter(Boolean)) {
      if (part.startsWith("http")) out.set(part, { url: part, label: "custom" });
    }
  }

  return [...out.values()];
}

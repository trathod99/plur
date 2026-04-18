import { createHash } from "crypto";
import * as cheerio from "cheerio";
import type { EventFetchWarning, NormalizedEvent } from "../types";
import { fetchHtml } from "./http";

type SchemaEvent = {
  "@type"?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  url?: string;
  location?: {
    name?: string;
    address?: {
      addressLocality?: string;
      addressRegion?: string;
      addressCountry?: string;
    };
  };
  offers?: { price?: string; priceCurrency?: string; url?: string };
};

type SchemaList = {
  "@type"?: string;
  itemListElement?: Array<{ item?: SchemaEvent } | SchemaEvent>;
};

function normalizeStart(isoDate?: string): string {
  if (!isoDate) return "";
  if (isoDate.includes("T")) {
    const t = Date.parse(isoDate);
    return Number.isNaN(t) ? isoDate : new Date(t).toISOString();
  }
  const t = Date.parse(`${isoDate}T21:00:00-08:00`);
  return Number.isNaN(t) ? `${isoDate}T12:00:00Z` : new Date(t).toISOString();
}

function parseLdEvents(html: string): SchemaEvent[] {
  const $ = cheerio.load(html);
  const out: SchemaEvent[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return;
    }

    const pushEvent = (ev: SchemaEvent) => {
      const t = ev["@type"];
      if (t === "Event" || t === "MusicEvent" || t === "TheaterEvent" || t === "Festival") {
        out.push(ev);
      }
    };

    const visit = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      if (Array.isArray(node)) {
        for (const x of node) visit(x);
        return;
      }
      if (o["@graph"] && Array.isArray(o["@graph"])) {
        for (const x of o["@graph"]) visit(x);
        return;
      }
      const typ = o["@type"];
      if (typ === "ItemList" && Array.isArray((o as SchemaList).itemListElement)) {
        for (const li of (o as SchemaList).itemListElement ?? []) {
          if (li && typeof li === "object" && "item" in li) {
            visit((li as { item?: unknown }).item);
          } else {
            visit(li);
          }
        }
        return;
      }
      pushEvent(o as SchemaEvent);
    };

    visit(json);
  });

  return out;
}

function stableId(parts: string[]): string {
  const h = createHash("sha256").update(parts.join("|")).digest("base64url");
  return h.slice(0, 32);
}

function toNormalized(ev: SchemaEvent, source: string): NormalizedEvent | null {
  const name = ev.name?.trim();
  if (!name) return null;
  const start = normalizeStart(ev.startDate);
  if (!start) return null;

  const loc = ev.location;
  const venue = loc?.name;
  const city = loc?.address?.addressLocality;
  const region = loc?.address?.addressRegion;
  const country = loc?.address?.addressCountry;

  let pricing: NormalizedEvent["pricing"];
  const offer = ev.offers;
  if (offer?.price) {
    const n = Number.parseFloat(String(offer.price).replace(/[^0-9.]+/g, ""));
    pricing = {
      currency: offer.priceCurrency ?? "USD",
      min: Number.isFinite(n) ? n : undefined,
      label: offer.url ? "See listing" : undefined,
    };
  }

  const url = ev.url;
  const id = `eventbrite:${source}:${stableId([url ?? "", name, start, venue ?? ""])}`;

  return {
    id,
    title: name,
    start,
    venue,
    city,
    country: country ?? region,
    url,
    source: `eventbrite:${source}`,
    pricing,
    lineup: undefined,
    matchReasons: [],
    score: 0,
  };
}

export async function scrapeEventbriteDiscoverPage(params: {
  url: string;
  sourceLabel: string;
}): Promise<{ events: NormalizedEvent[]; warning?: EventFetchWarning }> {
  try {
    const html = await fetchHtml(params.url);
    const raw = parseLdEvents(html);
    const seen = new Set<string>();
    const events: NormalizedEvent[] = [];

    for (let i = 0; i < raw.length; i += 1) {
      const norm = toNormalized(raw[i], params.sourceLabel);
      if (!norm) continue;
      const k = `${norm.title.toLowerCase()}|${norm.start}|${(norm.venue ?? "").toLowerCase()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      events.push(norm);
    }

    return { events };
  } catch (e) {
    return {
      events: [],
      warning: {
        source: "eventbrite",
        message: `${params.sourceLabel}: ${e instanceof Error ? e.message : "fetch failed"}`,
      },
    };
  }
}

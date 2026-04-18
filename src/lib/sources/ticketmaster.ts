import type { EventFetchWarning, NormalizedEvent } from "../types";

type TmEvent = {
  id: string;
  name: string;
  url?: string;
  dates?: { start?: { localDate?: string; localTime?: string; dateTime?: string } };
  priceRanges?: Array<{ min?: number; max?: number; currency?: string; type?: string }>;
  _embedded?: {
    venues?: Array<{
      name?: string;
      city?: { name?: string };
      country?: { name?: string; countryCode?: string };
    }>;
  };
};

type TmResponse = {
  _embedded?: { events?: TmEvent[] };
};

function pickPricing(e: TmEvent): NormalizedEvent["pricing"] {
  const pr = e.priceRanges?.[0];
  if (!pr || (pr.min == null && pr.max == null)) return undefined;
  return {
    currency: pr.currency ?? "USD",
    min: pr.min,
    max: pr.max,
    label: pr.type,
  };
}

export async function fetchTicketmasterEvents(params: {
  keyword: string;
  countryCode?: string;
  size?: number;
}): Promise<{ events: NormalizedEvent[]; warning?: EventFetchWarning }> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) {
    return {
      events: [],
      warning: {
        source: "ticketmaster",
        message: "Set TICKETMASTER_API_KEY to enable Ticketmaster results.",
      },
    };
  }

  const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  url.searchParams.set("apikey", key);
  url.searchParams.set("keyword", params.keyword);
  url.searchParams.set("classificationName", "music");
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("size", String(params.size ?? 30));
  if (params.countryCode) url.searchParams.set("countryCode", params.countryCode);

  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!res.ok) {
    return {
      events: [],
      warning: {
        source: "ticketmaster",
        message: `Ticketmaster HTTP ${res.status}`,
      },
    };
  }

  const data = (await res.json()) as TmResponse;
  const list = data._embedded?.events ?? [];

  const events: NormalizedEvent[] = list.map((e) => {
    const v = e._embedded?.venues?.[0];
    const start =
      e.dates?.start?.dateTime ??
      [e.dates?.start?.localDate, e.dates?.start?.localTime].filter(Boolean).join("T") ??
      e.dates?.start?.localDate ??
      "";

    return {
      id: `ticketmaster:${e.id}`,
      title: e.name,
      start,
      venue: v?.name,
      city: v?.city?.name,
      country: v?.country?.countryCode ?? v?.country?.name,
      url: e.url,
      source: "ticketmaster",
      pricing: pickPricing(e),
      lineup: undefined,
      matchReasons: [],
      score: 0,
    };
  });

  return { events };
}

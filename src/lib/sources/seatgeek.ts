import type { EventFetchWarning, NormalizedEvent } from "../types";

type SgEvent = {
  id: number;
  short_title?: string;
  title?: string;
  url?: string;
  datetime_utc?: string;
  venue?: { name?: string; city?: string; country?: string };
  stats?: { lowest_price?: number; average_price?: number; highest_price?: number };
  performers?: Array<{ name?: string }>;
};

type SgResponse = { events?: SgEvent[] };

export async function fetchSeatGeekEvents(params: {
  q: string;
  perPage?: number;
}): Promise<{ events: NormalizedEvent[]; warning?: EventFetchWarning }> {
  const clientId = process.env.SEATGEEK_CLIENT_ID;
  if (!clientId) {
    return {
      events: [],
      warning: {
        source: "seatgeek",
        message: "Set SEATGEEK_CLIENT_ID to enable SeatGeek results.",
      },
    };
  }

  const url = new URL("https://api.seatgeek.com/2/events");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("q", params.q);
  url.searchParams.set("type", "concert");
  url.searchParams.set("per_page", String(params.perPage ?? 30));
  url.searchParams.set("sort", "datetime_utc.asc");

  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!res.ok) {
    return {
      events: [],
      warning: { source: "seatgeek", message: `SeatGeek HTTP ${res.status}` },
    };
  }

  const data = (await res.json()) as SgResponse;
  const list = data.events ?? [];

  const events: NormalizedEvent[] = list.map((e) => {
    const prices = e.stats;
    const pricing =
      prices?.lowest_price != null || prices?.highest_price != null
        ? {
            currency: "USD",
            min: prices.lowest_price,
            max: prices.highest_price ?? prices.average_price,
            label: prices.average_price != null ? `avg ${prices.average_price}` : undefined,
          }
        : undefined;

    return {
      id: `seatgeek:${e.id}`,
      title: e.short_title ?? e.title ?? "Event",
      start: e.datetime_utc ?? "",
      venue: e.venue?.name,
      city: e.venue?.city,
      country: e.venue?.country,
      url: e.url,
      source: "seatgeek",
      pricing,
      lineup: e.performers?.map((p) => p.name).filter(Boolean) as string[] | undefined,
      matchReasons: [],
      score: 0,
    };
  });

  return { events };
}

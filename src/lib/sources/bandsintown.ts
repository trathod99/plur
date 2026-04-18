import type { EventFetchWarning, NormalizedEvent } from "../types";

type BitEvent = {
  id?: string;
  title?: string;
  artist_id?: string;
  datetime?: string;
  starts_at?: string;
  venue?: {
    name?: string;
    location?: string;
    city?: string;
    country?: string;
    latitude?: string;
    longitude?: string;
  };
  offers?: Array<{ type?: string; url?: string; status?: string }>;
  url?: string;
  lineup?: Array<{ name?: string }>;
};

export async function fetchBandsintownForArtist(
  artistName: string,
): Promise<{ events: NormalizedEvent[]; warning?: EventFetchWarning }> {
  const appId = process.env.BANDSINTOWN_APP_ID;
  if (!appId) {
    return {
      events: [],
      warning: {
        source: "bandsintown",
        message: "Set BANDSINTOWN_APP_ID to enable Bandsintown results.",
      },
    };
  }

  const slug = encodeURIComponent(artistName.trim());
  const url = `https://rest.bandsintown.com/artists/${slug}/events?app_id=${encodeURIComponent(
    appId,
  )}&date=upcoming`;

  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) {
    return {
      events: [],
      warning: {
        source: "bandsintown",
        message: `Bandsintown HTTP ${res.status} for “${artistName}”`,
      },
    };
  }

  const data = (await res.json()) as BitEvent[] | { errors?: string[] };
  if (!Array.isArray(data)) {
    return {
      events: [],
      warning: {
        source: "bandsintown",
        message: `Bandsintown: ${JSON.stringify(data)}`,
      },
    };
  }

  const events: NormalizedEvent[] = data.map((ev, idx) => {
    const start = ev.datetime ?? ev.starts_at ?? "";
    const ticket = ev.offers?.find((o) => o.type === "Tickets" && o.url);
    const pricing = ticket
      ? { currency: "USD", label: ticket.status === "available" ? "Tickets" : "See listing" }
      : undefined;

    return {
      id: `bandsintown:${ev.id ?? `${artistName}:${idx}`}`,
      title: ev.title ?? `${artistName} live`,
      start,
      venue: ev.venue?.name,
      city: ev.venue?.city ?? ev.venue?.location,
      country: ev.venue?.country,
      url: ticket?.url ?? ev.url,
      source: "bandsintown",
      pricing,
      lineup: ev.lineup?.map((l) => l.name).filter(Boolean) as string[] | undefined,
      matchReasons: [],
      score: 0,
    };
  });

  return { events };
}

import type { EventFetchWarning, NormalizedEvent } from "../types";

const BASE = "https://edmtrain.com/api";

type EdmtrainEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

type EdmtrainLocation = {
  id: number;
  city?: string;
  state?: string;
  stateCode?: string;
  link?: string;
};

type EdmtrainArtist = {
  id: number;
  name: string;
  link?: string;
  b2bInd?: boolean;
};

type EdmtrainVenue = {
  id: number;
  name: string;
  location?: string;
  address?: string;
  state?: string;
};

type EdmtrainEvent = {
  id: number;
  link?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  name?: string;
  festivalInd?: boolean;
  electronicMusicInd?: boolean;
  otherGenreInd?: boolean;
  liveStreamInd?: boolean;
  ages?: string;
  createdDate?: string;
  artistList?: EdmtrainArtist[];
  venue?: EdmtrainVenue;
};

function absolutizeLink(link?: string): string | undefined {
  if (!link) return undefined;
  if (link.startsWith("http")) return link;
  return `https://edmtrain.com${link.startsWith("/") ? "" : "/"}${link}`;
}

function combineDateTime(date: string, time?: string): string {
  if (time) {
    const parsed = Date.parse(time);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  const d = Date.parse(`${date}T21:00:00-07:00`);
  if (!Number.isNaN(d)) return new Date(d).toISOString();
  const fallback = Date.parse(`${date}T12:00:00Z`);
  return Number.isNaN(fallback) ? date : new Date(fallback).toISOString();
}

function parseVenueIds(raw?: string): number[] {
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/g)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

async function edmtrainGet<T>(path: string, client: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("client", client);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as EdmtrainEnvelope<T>;
  if (!json.success) {
    throw new Error(json.message ?? "Edmtrain error");
  }
  return json.data;
}

export async function resolveEdmtrainSanFranciscoLocationId(client: string): Promise<number | null> {
  const override = process.env.EDMTRAIN_SF_LOCATION_ID?.trim();
  if (override) {
    const n = Number.parseInt(override, 10);
    if (Number.isFinite(n)) return n;
  }

  const rows = await edmtrainGet<EdmtrainLocation[]>("/locations", client, {
    state: "California",
    city: "San Francisco",
  });
  const hit = rows.find((r) => r.city?.toLowerCase() === "san francisco") ?? rows[0];
  return hit?.id ?? null;
}

export async function fetchEdmtrainSanFranciscoEvents(params: {
  client: string;
  locationId: number;
  venueIds?: number[];
  excludeLivestreams?: boolean;
}): Promise<{ events: NormalizedEvent[]; warning?: EventFetchWarning }> {
  const query: Record<string, string> = {
    locationIds: String(params.locationId),
    includeElectronicGenreInd: "true",
    includeOtherGenreInd: "false",
  };

  if (params.excludeLivestreams !== false) {
    query.livestreamInd = "false";
  }

  const envVenues = parseVenueIds(process.env.EDMTRAIN_SF_VENUE_IDS);
  const venueIds = [...new Set([...(params.venueIds ?? []), ...envVenues])];
  if (venueIds.length) {
    query.venueIds = venueIds.join(",");
  }

  try {
    const data = await edmtrainGet<EdmtrainEvent[]>("/events", params.client, query);
    const events: NormalizedEvent[] = (data ?? []).map((ev) => {
      const artists = ev.artistList ?? [];
      const lineup = artists.map((a) => a.name).filter(Boolean);
      const title =
        ev.name?.trim() ||
        (lineup.length ? lineup.join(", ") : "Edmtrain event");

      const start = combineDateTime(ev.date, ev.startTime);
      const v = ev.venue;
      const city = v?.location || "San Francisco";

      return {
        id: `edmtrain:${ev.id}`,
        title,
        start,
        venue: v?.name,
        city,
        country: "US",
        url: absolutizeLink(ev.link),
        source: "edmtrain",
        pricing: ev.ages ? { currency: "USD", label: ev.ages } : undefined,
        lineup: lineup.length ? lineup : undefined,
        matchReasons: [],
        score: 0,
      };
    });

    return { events };
  } catch (e) {
    return {
      events: [],
      warning: {
        source: "edmtrain",
        message: e instanceof Error ? e.message : "Edmtrain request failed",
      },
    };
  }
}

export async function fetchEdmtrainEventsForProfile(params: {
  client: string;
  eventName: string;
}): Promise<{ events: NormalizedEvent[]; warning?: EventFetchWarning }> {
  try {
    const data = await edmtrainGet<EdmtrainEvent[]>("/events", params.client, {
      eventName: params.eventName,
      includeElectronicGenreInd: "true",
      includeOtherGenreInd: "false",
      livestreamInd: "false",
    });

    const events: NormalizedEvent[] = (data ?? []).map((ev) => {
      const artists = ev.artistList ?? [];
      const lineup = artists.map((a) => a.name).filter(Boolean);
      const title =
        ev.name?.trim() ||
        (lineup.length ? lineup.join(", ") : params.eventName);

      const start = combineDateTime(ev.date, ev.startTime);
      const v = ev.venue;

      return {
        id: `edmtrain:${ev.id}`,
        title,
        start,
        venue: v?.name,
        city: v?.location,
        country: "US",
        url: absolutizeLink(ev.link),
        source: "edmtrain",
        pricing: ev.ages ? { currency: "USD", label: ev.ages } : undefined,
        lineup: lineup.length ? lineup : undefined,
        matchReasons: [],
        score: 0,
      };
    });

    return { events };
  } catch (e) {
    return {
      events: [],
      warning: {
        source: "edmtrain",
        message: e instanceof Error ? e.message : "Edmtrain request failed",
      },
    };
  }
}

import type { EventFetchWarning, NormalizedEvent } from "../types";

type SkPerformance = {
  artist?: { displayName?: string };
  billing?: string;
  billingIndex?: number;
};

type SkEvent = {
  id: number;
  displayName?: string;
  uri?: string;
  venue?: {
    displayName?: string;
    uri?: string;
    city?: { displayName?: string };
    metroArea?: { displayName?: string; id?: number };
    country?: { displayName?: string };
  };
  start?: { dateTime?: string; date?: string; time?: string };
  performance?: SkPerformance[];
};

type SkCalendarResponse = {
  resultsPage?: {
    status?: string;
    results?: { event?: SkEvent[] };
    error?: { message?: string };
  };
};

function pickStart(e: SkEvent): string {
  const dt = e.start?.dateTime;
  if (dt) return new Date(dt).toISOString();
  const d = e.start?.date;
  if (!d) return "";
  const t = e.start?.time;
  if (t) {
    const parsed = Date.parse(`${d}T${t}`);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  const parsed = Date.parse(`${d}T12:00:00Z`);
  return Number.isNaN(parsed) ? d : new Date(parsed).toISOString();
}

function lineupFrom(e: SkEvent): string[] | undefined {
  const perf = e.performance;
  if (!perf?.length) return undefined;
  const sorted = [...perf].sort(
    (a, b) => (a.billingIndex ?? 999) - (b.billingIndex ?? 999),
  );
  const names = sorted
    .map((p) => p.artist?.displayName)
    .filter((n): n is string => Boolean(n));
  return names.length ? names : undefined;
}

export async function fetchSongkickMetroEvents(params: {
  metroAreaId: number;
  apiKey: string;
  maxPages?: number;
}): Promise<{ events: NormalizedEvent[]; warning?: EventFetchWarning }> {
  const maxPages = params.maxPages ?? 2;
  const collected: SkEvent[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(
      `https://api.songkick.com/api/3.0/metro_areas/${params.metroAreaId}/calendar.json`,
    );
    url.searchParams.set("apikey", params.apiKey);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "50");

    const res = await fetch(url.toString(), { next: { revalidate: 300 } });
    if (!res.ok) {
      return {
        events: [],
        warning: { source: "songkick", message: `Songkick HTTP ${res.status}` },
      };
    }

    const json = (await res.json()) as SkCalendarResponse;
    if (json.resultsPage?.status === "error") {
      return {
        events: [],
        warning: {
          source: "songkick",
          message: json.resultsPage.error?.message ?? "Songkick error",
        },
      };
    }

    const batch = json.resultsPage?.results?.event ?? [];
    if (!batch.length) break;
    collected.push(...batch);
  }

  const events: NormalizedEvent[] = collected.map((e) => {
    const venue = e.venue;
    const city = venue?.city?.displayName ?? venue?.metroArea?.displayName;
    const country = venue?.country?.displayName;

    return {
      id: `songkick:${e.id}`,
      title: e.displayName ?? "Songkick event",
      start: pickStart(e),
      venue: venue?.displayName,
      city,
      country,
      url: e.uri,
      source: "songkick",
      pricing: undefined,
      lineup: lineupFrom(e),
      matchReasons: [],
      score: 0,
    };
  });

  return { events };
}

import type { EventFetchWarning, NormalizedEvent, TasteProfile } from "./types";
import { scoreEventAgainstProfile } from "./match";
import { fetchBandsintownForArtist } from "./sources/bandsintown";
import {
  fetchEdmtrainEventsForProfile,
  fetchEdmtrainSanFranciscoEvents,
  resolveEdmtrainSanFranciscoLocationId,
} from "./sources/edmtrain";
import { fetchSeatGeekEvents } from "./sources/seatgeek";
import { fetchSongkickMetroEvents } from "./sources/songkick";
import { fetchTicketmasterEvents } from "./sources/ticketmaster";
import {
  isSanFranciscoProfile,
  profileMentionsEdm,
  SAN_FRANCISCO_EDM_VENUE_KEYWORDS,
  SONGKICK_SF_METRO_AREA_ID,
  textLooksElectronic,
} from "./sf-edm";

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function dedupeKey(e: NormalizedEvent): string {
  const title = e.title.toLowerCase().replace(/\s+/g, " ").trim();
  const city = (e.city ?? "").toLowerCase();
  return `${title}|${dayKey(e.start)}|${city}`;
}

function mergeEvents(lists: NormalizedEvent[][]): NormalizedEvent[] {
  const map = new Map<string, NormalizedEvent>();
  for (const list of lists) {
    for (const e of list) {
      const k = dedupeKey(e);
      const existing = map.get(k);
      if (!existing) {
        map.set(k, e);
        continue;
      }
      const prefer =
        e.pricing && !existing.pricing
          ? e
          : e.url && !existing.url
            ? e
            : e.lineup && !existing.lineup
              ? e
              : existing;
      const other = prefer === e ? existing : e;
      map.set(k, {
        ...prefer,
        url: prefer.url ?? other.url,
        pricing: prefer.pricing ?? other.pricing,
        lineup: prefer.lineup?.length ? prefer.lineup : other.lineup,
        venue: prefer.venue ?? other.venue,
        source: `${prefer.source}+${other.source}`,
      });
    }
  }
  return [...map.values()];
}

function isVenueKeywordQuery(q: string): boolean {
  const needle = q.trim().toLowerCase();
  return SAN_FRANCISCO_EDM_VENUE_KEYWORDS.some((v) => v.toLowerCase() === needle);
}

export async function gatherAndScoreEvents(profile: TasteProfile): Promise<{
  events: NormalizedEvent[];
  warnings: EventFetchWarning[];
}> {
  const warnings: EventFetchWarning[] = [];
  const chunks: NormalizedEvent[][] = [];

  const country = profile.country?.trim() || "US";
  const cityQ = profile.city?.trim();

  const queries = new Set<string>();
  for (const a of profile.favoriteArtists) {
    const t = a.trim();
    if (t) queries.add(t);
  }
  for (const g of profile.genres) {
    const t = g.trim();
    if (t) queries.add(t);
  }
  const narr = profile.narrative.trim();
  if (narr.length >= 3) queries.add(narr.slice(0, 80));

  if (queries.size === 0 && cityQ) queries.add(`${cityQ} concert`);

  if (queries.size === 0) {
    return { events: [], warnings: [] };
  }

  if (isSanFranciscoProfile(cityQ)) {
    for (const v of SAN_FRANCISCO_EDM_VENUE_KEYWORDS) queries.add(v);
  }

  const edmtrainClient = process.env.EDMTRAIN_CLIENT?.trim();
  if (edmtrainClient) {
    if (isSanFranciscoProfile(cityQ)) {
      const locId = await resolveEdmtrainSanFranciscoLocationId(edmtrainClient);
      if (locId == null) {
        warnings.push({
          source: "edmtrain",
          message: "Could not resolve San Francisco location id (check EDMTRAIN_SF_LOCATION_ID).",
        });
      } else {
        const sf = await fetchEdmtrainSanFranciscoEvents({
          client: edmtrainClient,
          locationId: locId,
        });
        if (sf.warning) warnings.push(sf.warning);
        chunks.push(sf.events);
      }
    }

    const edmtrainQueries = [...queries]
      .filter((q) => q.trim().length >= 3 && !isVenueKeywordQuery(q))
      .slice(0, 4);

    for (const q of edmtrainQueries) {
      const et = await fetchEdmtrainEventsForProfile({ client: edmtrainClient, eventName: q });
      if (et.warning) warnings.push(et.warning);
      chunks.push(et.events);
    }
  } else if (profileMentionsEdm(profile)) {
    warnings.push({
      source: "edmtrain",
      message:
        "Set EDMTRAIN_CLIENT (from edmtrain.com/developer-api) for electronic-focused listings and optional SF venue bundles.",
    });
  }

  const songkickKey = process.env.SONGKICK_API_KEY?.trim();
  if (songkickKey && isSanFranciscoProfile(cityQ)) {
    const sk = await fetchSongkickMetroEvents({
      metroAreaId: SONGKICK_SF_METRO_AREA_ID,
      apiKey: songkickKey,
      maxPages: 2,
    });
    if (sk.warning) warnings.push(sk.warning);
    const skEvents =
      profileMentionsEdm(profile) && sk.events.length
        ? sk.events.filter((e) =>
            textLooksElectronic([e.title, ...(e.lineup ?? [])].join(" ")),
          )
        : sk.events;
    if (profileMentionsEdm(profile) && sk.events.length && !skEvents.length) {
      warnings.push({
        source: "songkick",
        message:
          "Songkick metro results were filtered to electronic cues from your taste; broaden genres or narrative if this removed everything.",
      });
    }
    chunks.push(skEvents);
  } else if (isSanFranciscoProfile(cityQ) && profileMentionsEdm(profile)) {
    warnings.push({
      source: "songkick",
      message:
        "Set SONGKICK_API_KEY to pull the broader Bay Area calendar (metro 26330) alongside club-specific searches.",
    });
  }

  for (const q of [...queries].slice(0, 8)) {
    const tm = await fetchTicketmasterEvents({
      keyword: q,
      countryCode: country,
      size: 25,
    });
    if (tm.warning) warnings.push(tm.warning);
    chunks.push(tm.events);

    const sg = await fetchSeatGeekEvents({ q, perPage: 25 });
    if (sg.warning) warnings.push(sg.warning);
    chunks.push(sg.events);

    if (!isVenueKeywordQuery(q)) {
      const bit = await fetchBandsintownForArtist(q);
      if (bit.warning) warnings.push(bit.warning);
      chunks.push(bit.events);
    }
  }

  const merged = mergeEvents(chunks);

  const scored = merged.map((e) => {
    const { score, matchReasons } = scoreEventAgainstProfile(e, profile);
    return { ...e, score, matchReasons };
  });

  const maxScore = scored.reduce((m, e) => Math.max(m, e.score), 0);
  const threshold = maxScore > 0 ? Math.max(2, Math.floor(maxScore * 0.35)) : 0;

  const ranked = scored
    .filter((e) => (maxScore === 0 ? true : e.score >= threshold))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });

  const upcoming = ranked.filter((e) => {
    const t = new Date(e.start).getTime();
    return Number.isNaN(t) || t > Date.now() - 86400000;
  });

  const slice = (maxScore === 0 ? upcoming.slice(0, 24) : upcoming).slice(0, 80);
  return { events: slice, warnings };
}

import type { EventFetchWarning, NormalizedEvent, TasteProfile } from "./types";
import { scoreEventAgainstProfile } from "./match";
import { fetchBandsintownForArtist } from "./sources/bandsintown";
import { fetchSeatGeekEvents } from "./sources/seatgeek";
import { fetchTicketmasterEvents } from "./sources/ticketmaster";

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

  for (const q of [...queries].slice(0, 6)) {
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

    const bit = await fetchBandsintownForArtist(q);
    if (bit.warning) warnings.push(bit.warning);
    chunks.push(bit.events);
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

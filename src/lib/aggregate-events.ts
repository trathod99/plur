import type { EventFetchWarning, NormalizedEvent, TasteProfile } from "./types";
import { scoreEventAgainstProfile } from "./match";
import { scrapeEventbriteDiscoverPage } from "./scrape/eventbrite-ld";
import { eventbritePlaceSegmentsForProfile } from "./scrape/place-slugs";
import {
  isSanFranciscoProfile,
  profileMentionsEdm,
  SAN_FRANCISCO_EVENTBRITE_VENUE_SLUGS,
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

function slugifyKeyword(q: string): string {
  return q
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function gatherAndScoreEvents(profile: TasteProfile): Promise<{
  events: NormalizedEvent[];
  warnings: EventFetchWarning[];
}> {
  const warnings: EventFetchWarning[] = [];
  const chunks: NormalizedEvent[][] = [];

  const cityQ = profile.city?.trim();
  const segments = eventbritePlaceSegmentsForProfile(profile);
  const sf = isSanFranciscoProfile(cityQ);

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

  if (queries.size === 0 && cityQ) queries.add(`${cityQ} music`);

  if (queries.size === 0) {
    warnings.push({
      source: "eventbrite",
      message:
        "Add favorite artists, genres, or notes so we can build Eventbrite search URLs to scrape.",
    });
    return { events: [], warnings };
  }

  const segmentList =
    segments.length > 0 ? segments : (profileMentionsEdm(profile) ? ["united-states"] : []);

  if (!segmentList.length) {
    warnings.push({
      source: "eventbrite",
      message:
        "Set home city (e.g. San Francisco) or mention electronic genres in your taste so we can pick a regional Eventbrite browse path to scrape.",
    });
    return { events: [], warnings };
  }

  for (const seg of segmentList) {
    const music = await scrapeEventbriteDiscoverPage({
      url: `https://www.eventbrite.com/d/${seg}/music--events/`,
      sourceLabel: `${seg}-music`,
    });
    if (music.warning) warnings.push(music.warning);
    const rows =
      profileMentionsEdm(profile) && music.events.length
        ? music.events.filter((e) => textLooksElectronic([e.title, e.venue ?? ""].join(" ")))
        : music.events;
    if (profileMentionsEdm(profile) && music.events.length && !rows.length) {
      warnings.push({
        source: "eventbrite",
        message: `${seg}-music: all rows were filtered out as non-electronic; broaden your taste cues.`,
      });
    }
    chunks.push(rows);
  }

  if (sf) {
    for (const slug of SAN_FRANCISCO_EVENTBRITE_VENUE_SLUGS) {
      const page = await scrapeEventbriteDiscoverPage({
        url: `https://www.eventbrite.com/d/ca--san-francisco/${slug}/events/`,
        sourceLabel: `sf-venue-${slug}`,
      });
      if (page.warning) warnings.push(page.warning);
      chunks.push(page.events);
    }
  }

  const keywordSegments = segmentList.slice(0, 3);
  for (const q of [...queries].slice(0, 6)) {
    const slug = slugifyKeyword(q);
    if (slug.length < 2) continue;
    for (const seg of keywordSegments) {
      const page = await scrapeEventbriteDiscoverPage({
        url: `https://www.eventbrite.com/d/${seg}/${encodeURIComponent(slug)}/events/`,
        sourceLabel: `${seg}-q-${slug}`,
      });
      if (page.warning) warnings.push(page.warning);
      chunks.push(page.events);
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

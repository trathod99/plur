import {
  isSanFranciscoProfile,
  profileMentionsEdm,
  SAN_FRANCISCO_VENUE_HINTS,
} from "./sf-edm";
import type { NormalizedEvent, TasteProfile } from "./types";

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((t) => t.length > 2),
  );
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n;
}

export function scoreEventAgainstProfile(
  event: Omit<NormalizedEvent, "score" | "matchReasons">,
  profile: TasteProfile,
): Pick<NormalizedEvent, "score" | "matchReasons"> {
  const reasons: string[] = [];
  let score = 0;

  const hay = [
    event.title,
    event.venue ?? "",
    event.city ?? "",
    ...(event.lineup ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const narrativeTokens = tokenize(profile.narrative);
  const genreTokens = new Set(
    profile.genres.flatMap((g) => [...tokenize(g), g.toLowerCase()]),
  );

  for (const artist of profile.favoriteArtists) {
    const a = artist.trim();
    if (!a) continue;
    const needle = a.toLowerCase();
    if (hay.includes(needle)) {
      score += 12;
      reasons.push(`Matches favorite artist “${a}”`);
    } else if (overlapScore(tokenize(a), tokenize(hay)) >= 1) {
      score += 6;
      reasons.push(`Likely related to “${a}”`);
    }
  }

  for (const g of profile.genres) {
    const gl = g.toLowerCase();
    if (gl && hay.includes(gl)) {
      score += 4;
      reasons.push(`Genre cue “${g}”`);
    }
  }

  const narrHits = overlapScore(narrativeTokens, tokenize(hay));
  if (narrHits > 0) {
    score += Math.min(8, narrHits * 2);
    reasons.push("Overlaps with your taste notes");
  }

  if (genreTokens.size) {
    const gh = tokenize(hay);
    const gHits = overlapScore(genreTokens, gh);
    if (gHits > 0) {
      score += Math.min(6, gHits * 2);
      reasons.push("Genre overlap with free-text genres");
    }
  }

  if (profile.city && event.city) {
    if (event.city.toLowerCase() === profile.city.toLowerCase()) {
      score += 3;
      reasons.push(`In your city (${profile.city})`);
    }
  }

  if (isSanFranciscoProfile(profile.city)) {
    const venueHay = (event.venue ?? "").toLowerCase();
    const hit = SAN_FRANCISCO_VENUE_HINTS.find((h) => venueHay.includes(h));
    if (hit) {
      score += 4;
      reasons.push(`SF club / venue match (${hit})`);
    }
  }

  if (profileMentionsEdm(profile) && event.source === "edmtrain") {
    score += 3;
    reasons.push("Electronic-focused listing (Edmtrain)");
  }

  return { score, matchReasons: [...new Set(reasons)] };
}

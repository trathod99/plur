/**
 * Eventbrite venue URL slugs under `/d/ca--san-francisco/{slug}/events/`
 * (HTML pages with JSON-LD ItemList).
 */
export const SAN_FRANCISCO_EVENTBRITE_VENUE_SLUGS = [
  "public-works",
  "halcyon-sf",
  "1015-folsom",
  "the-midway-sf",
  "august-hall-sf",
  "great-northern-sf",
  "dna-lounge",
  "audio-sf",
  "temple-sf",
  "monarch-sf",
  "f8-bar",
  "rickshaw-stop",
  "the-fillmore-sf",
  "bill-graham-civic-auditorium",
] as const;

/** Substrings matched against `venue` (case-insensitive) for a small local boost in scoring. */
export const SAN_FRANCISCO_VENUE_HINTS = [
  "public works",
  "halcyon",
  "midway",
  "1015 folsom",
  "august hall",
  "great northern",
  "dna lounge",
  "audio",
  "temple",
  "f8",
  "monarch",
  "bill graham",
  "the fillmore",
  "independent",
  "rickshaw stop",
  "knockout",
] as const;

export function isSanFranciscoProfile(city?: string): boolean {
  if (!city) return false;
  const c = city.trim().toLowerCase();
  return c === "san francisco" || c === "sf" || c.includes("san francisco");
}

const EDM_KEYWORDS = [
  "edm",
  "electronic",
  "house",
  "techno",
  "rave",
  "trance",
  "dnb",
  "drum and bass",
  "bass music",
  "bass",
  "garage",
  "ukg",
  "dubstep",
  "hardstyle",
  "club",
];

export function profileMentionsEdm(profile: {
  narrative: string;
  favoriteArtists: string[];
  genres: string[];
}): boolean {
  const blob = [profile.narrative, ...profile.genres, ...profile.favoriteArtists]
    .join(" ")
    .toLowerCase();
  return EDM_KEYWORDS.some((k) => blob.includes(k));
}

export function textLooksElectronic(text: string): boolean {
  const blob = text.toLowerCase();
  return EDM_KEYWORDS.some((k) => blob.includes(k)) || /\bdj\b/.test(blob);
}

/** Eventbrite `/d/{segment}/…` location segments (HTML discover pages). */
const CITY_SEGMENTS: Record<string, string[]> = {
  "san francisco": ["ca--san-francisco", "ca--oakland", "ca--berkeley"],
  sf: ["ca--san-francisco", "ca--oakland", "ca--berkeley"],
  "los angeles": ["ca--los-angeles"],
  la: ["ca--los-angeles"],
  "new york": ["ny--new-york"],
  nyc: ["ny--new-york"],
  chicago: ["il--chicago"],
  austin: ["tx--austin"],
  "las vegas": ["nv--las-vegas"],
  miami: ["fl--miami"],
  seattle: ["wa--seattle"],
  denver: ["co--denver", "us--denver", "united-states--denver"],
  boston: ["ma--boston"],
  "washington dc": ["dc--washington"],
  dc: ["dc--washington"],
  oakland: ["ca--oakland"],
  berkeley: ["ca--berkeley"],
  sacramento: ["ca--sacramento"],
  "san jose": ["ca--san-jose"],
  "san diego": ["ca--san-diego"],
  philadelphia: ["pa--philadelphia"],
  phoenix: ["az--phoenix"],
  atlanta: ["ga--atlanta"],
  dallas: ["tx--dallas"],
  houston: ["tx--houston"],
  portland: ["or--portland"],
  nashville: ["tn--nashville"],
  detroit: ["mi--detroit"],
  minneapolis: ["mn--minneapolis"],
};

function slugifyCity(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function eventbritePlaceSegmentsForProfile(profile: {
  city?: string;
  country?: string;
}): string[] {
  const cityField = profile.city?.split(",")[0]?.trim().toLowerCase() ?? "";
  const raw = cityField;
  if (!raw) return [];

  if (CITY_SEGMENTS[raw]) return [...CITY_SEGMENTS[raw]];

  const compact = raw.replace(/[^a-z0-9]+/g, " ").trim();
  if (CITY_SEGMENTS[compact]) return [...CITY_SEGMENTS[compact]];

  const slug = slugifyCity(profile.city ?? "");
  if (!slug) return [];

  const cc = profile.country?.trim().toUpperCase();
  if (cc === "US" || !cc) {
    return [`us--${slug}`, `united-states--${slug}`];
  }

  const ccLower = profile.country?.trim().toLowerCase() ?? "";
  if (ccLower.length === 2) {
    return [`${ccLower}--${slug}`];
  }

  return [];
}

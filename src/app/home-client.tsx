"use client";

import { useMemo, useState } from "react";
import type { EventFetchWarning, NormalizedEvent, TasteProfile } from "@/lib/types";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "TBA";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPrice(p?: NormalizedEvent["pricing"]): string {
  if (!p) return "Pricing TBA";
  if (p.min != null && p.max != null && p.min !== p.max) {
    return `${p.currency} ${p.min}–${p.max}${p.label ? ` (${p.label})` : ""}`;
  }
  if (p.min != null) return `${p.currency} from ${p.min}`;
  if (p.label) return p.label;
  return "See listing";
}

type Props = {
  initialProfile: TasteProfile;
};

export default function HomeClient({ initialProfile }: Props) {
  const [profile, setProfile] = useState(initialProfile);
  const [narrative, setNarrative] = useState(initialProfile.narrative);
  const [artistsText, setArtistsText] = useState(initialProfile.favoriteArtists.join(", "));
  const [genresText, setGenresText] = useState(initialProfile.genres.join(", "));
  const [city, setCity] = useState(initialProfile.city ?? "");
  const [country, setCountry] = useState(initialProfile.country ?? "US");
  const [saving, setSaving] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [events, setEvents] = useState<NormalizedEvent[]>([]);
  const [warnings, setWarnings] = useState<EventFetchWarning[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const dirty = useMemo(() => {
    const artists = artistsText
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const genres = genresText
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return (
      narrative !== profile.narrative ||
      artists.join("|") !== profile.favoriteArtists.join("|") ||
      genres.join("|") !== profile.genres.join("|") ||
      (city || "") !== (profile.city ?? "") ||
      (country || "") !== (profile.country ?? "")
    );
  }, [artistsText, city, country, genresText, narrative, profile]);

  async function saveProfile() {
    setSaving(true);
    setMessage(null);
    try {
      const favoriteArtists = artistsText
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const genres = genresText
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          narrative,
          favoriteArtists,
          genres,
          city: city.trim() || undefined,
          country: country.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const next = (await res.json()) as TasteProfile;
      setProfile(next);
      setMessage("Profile saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function loadRecommendations() {
    setLoadingRecs(true);
    setMessage(null);
    try {
      const res = await fetch("/api/recommendations", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        events: NormalizedEvent[];
        warnings: EventFetchWarning[];
      };
      setEvents(data.events);
      setWarnings(data.warnings);
      if (data.events.length === 0) {
        setMessage(
          "No scored matches yet. Set home city (e.g. San Francisco or Houston), add genres or artists, or check warnings if 19hz did not apply.",
        );
      } else {
        setMessage(`Found ${data.events.length} suggestions (deduped across sources).`);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load recommendations.");
    } finally {
      setLoadingRecs(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-10 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Live music radar
        </p>
        <h1 className="font-sans text-3xl font-semibold tracking-tight sm:text-4xl">
          Track your taste, discover shows
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          Describe how you like to dance and what you chase on lineups. The app scrapes the regional
          calendars on 19hz.info (Bay Area or Houston, depending on your home city and taste), merges
          duplicates, and ranks what lines up with your profile—including dates and price hints from the
          listing table when present.
        </p>
      </header>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60">
          <h2 className="text-lg font-semibold">Your taste</h2>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Free-form notes</span>
            <textarea
              className="min-h-32 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder="Melodic techno, warm sound systems, sunrise sets, small rooms over stadiums…"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Favorite artists (comma-separated)</span>
            <input
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
              value={artistsText}
              onChange={(e) => setArtistsText(e.target.value)}
              placeholder="Fred again.., Amelie Lens, Jon Hopkins"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Genres / vibes (comma-separated)</span>
            <input
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
              value={genresText}
              onChange={(e) => setGenresText(e.target.value)}
              placeholder="techno, drum & bass, indie electronic"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Home city (optional)</span>
              <input
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="San Francisco"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Country code</span>
              <input
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="US"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving || !dirty}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save taste profile"}
            </button>
            {profile.updatedAt ? (
              <span className="text-xs text-zinc-500">
                Last saved {new Date(profile.updatedAt).toLocaleString()}
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="text-lg font-semibold">Recommendations</h2>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Recommendations come only from <strong>19hz.info</strong> HTML tables (no third-party listing
            sites that often block bots). If nothing loads, check warnings—usually city/country does not
            match a known calendar. Optional{" "}
            <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-800">SCRAPE_USER_AGENT</code>{" "}
            in <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-800">.env.local</code> can
            help if fetches are blocked.
          </p>
          <button
            type="button"
            onClick={loadRecommendations}
            disabled={loadingRecs}
            className="w-full rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:hover:bg-zinc-900 sm:w-auto"
          >
            {loadingRecs ? "Querying sources…" : "Refresh show matches"}
          </button>
          {warnings.length > 0 && (
            <ul className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
              {warnings.map((w) => (
                <li key={`${w.source}-${w.message}`}>
                  <span className="font-semibold">{w.source}:</span> {w.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {message && (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          {message}
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Ranked events</h2>
        {events.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No events loaded yet. Save your taste, add API keys, then press refresh.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-violet-600 uppercase dark:text-violet-400">
                      {e.source} · score {e.score}
                    </p>
                    <h3 className="text-lg font-semibold leading-snug">{e.title}</h3>
                  </div>
                  {e.url && (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      Tickets
                    </a>
                  )}
                </div>
                <dl className="grid gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <dt className="sr-only">When</dt>
                    <dd className="font-medium text-zinc-900 dark:text-zinc-100">{formatWhen(e.start)}</dd>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <dt className="sr-only">Where</dt>
                    <dd>
                      {[e.venue, e.city, e.country].filter(Boolean).join(" · ") || "Venue TBA"}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <dt className="sr-only">Pricing</dt>
                    <dd>{formatPrice(e.pricing)}</dd>
                  </div>
                  {e.lineup && e.lineup.length > 0 && (
                    <div>
                      <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                        Lineup hints
                      </dt>
                      <dd className="text-sm">{e.lineup.slice(0, 6).join(", ")}</dd>
                    </div>
                  )}
                </dl>
                {e.matchReasons.length > 0 && (
                  <ul className="flex flex-wrap gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                    {e.matchReasons.map((r) => (
                      <li key={r} className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900">
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

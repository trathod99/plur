#!/usr/bin/env npx tsx
/**
 * Headless CLI for taste profile + event recommendations.
 * Shares `data/profile.json` with the Next app (override dir with PLUR_DATA_DIR).
 */

import { readFileSync, existsSync } from "fs";
import path from "path";
import { gatherAndScoreEvents } from "../src/lib/aggregate-events";
import { readProfile, writeProfile } from "../src/lib/profile-store";
import type { TasteProfile } from "../src/lib/types";

function loadEnvLocal(): void {
  const p = path.join(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  const raw = readFileSync(p, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnvLocal();

function usage(): never {
  console.error(`plur — headless taste + events

Usage:
  npx tsx scripts/plur-cli.ts profile show
  npx tsx scripts/plur-cli.ts profile set [--narrative TEXT] [--artists CSV] [--genres CSV]
                         [--city CITY] [--country CC]
  npx tsx scripts/plur-cli.ts events list [--json] [--limit N]

Environment:
  PLUR_DATA_DIR   Directory containing profile.json (default: ./data)
`);
  process.exit(1);
}

function argv(): string[] {
  return process.argv.slice(2);
}

function splitCsv(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function pickFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return undefined;
  return args[i + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

async function cmdProfileShow(): Promise<void> {
  const p = await readProfile();
  console.log(JSON.stringify(p, null, 2));
}

async function cmdProfileSet(args: string[]): Promise<void> {
  const existing = await readProfile();
  const narrative = pickFlag(args, "--narrative") ?? existing.narrative;
  const artistsRaw = pickFlag(args, "--artists");
  const genresRaw = pickFlag(args, "--genres");
  const city = pickFlag(args, "--city");
  const country = pickFlag(args, "--country");

  const profile: TasteProfile = {
    narrative,
    favoriteArtists: artistsRaw !== undefined ? splitCsv(artistsRaw) : existing.favoriteArtists,
    genres: genresRaw !== undefined ? splitCsv(genresRaw) : existing.genres,
    city: city !== undefined ? city || undefined : existing.city,
    country: country !== undefined ? country || undefined : existing.country,
    updatedAt: new Date().toISOString(),
  };
  await writeProfile(profile);
  console.log("Saved profile.");
  console.log(JSON.stringify(profile, null, 2));
}

async function cmdEventsList(args: string[]): Promise<void> {
  const asJson = hasFlag(args, "--json");
  const limitRaw = pickFlag(args, "--limit");
  const limit = limitRaw ? Math.max(1, Number.parseInt(limitRaw, 10) || 80) : 80;

  const profile = await readProfile();
  const { events, warnings } = await gatherAndScoreEvents(profile);

  if (warnings.length) {
    for (const w of warnings) {
      console.error(`[warn] ${w.source}: ${w.message}`);
    }
  }

  const slice = events.slice(0, limit);
  if (asJson) {
    console.log(JSON.stringify({ profile, events: slice }, null, 2));
    return;
  }

  if (!slice.length) {
    console.log("No events matched (or all fetches failed). Try broadening taste or check warnings.");
    return;
  }

  for (const e of slice) {
    const when = new Date(e.start).toLocaleString();
    const where = [e.venue, e.city].filter(Boolean).join(" · ") || "—";
    const price =
      e.pricing?.min != null
        ? `${e.pricing.currency} ${e.pricing.min}${e.pricing.max != null ? `–${e.pricing.max}` : ""}`
        : (e.pricing?.label ?? "—");
    const link = e.url ?? "";
    console.log(
      `${when}\tscore ${e.score}\t${e.source}\t${e.title}\t${where}\t${price}${link ? `\t${link}` : ""}`,
    );
    if (e.matchReasons.length) {
      console.log(`  → ${e.matchReasons.join("; ")}`);
    }
  }
}

async function main(): Promise<void> {
  const args = argv();
  if (args.length < 2) usage();

  const [a, b] = args;
  if (a === "profile" && b === "show") {
    await cmdProfileShow();
    return;
  }
  if (a === "profile" && b === "set") {
    await cmdProfileSet(args.slice(2));
    return;
  }
  if (a === "events" && b === "list") {
    await cmdEventsList(args.slice(2));
    return;
  }
  usage();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

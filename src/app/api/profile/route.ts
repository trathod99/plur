import { NextResponse } from "next/server";
import type { TasteProfile } from "@/lib/types";
import { readProfile, writeProfile } from "@/lib/profile-store";

export async function GET() {
  const profile = await readProfile();
  return NextResponse.json(profile);
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<TasteProfile>;
  const existing = await readProfile();

  const profile: TasteProfile = {
    narrative: typeof body.narrative === "string" ? body.narrative : existing.narrative,
    favoriteArtists: Array.isArray(body.favoriteArtists)
      ? body.favoriteArtists.filter((x): x is string => typeof x === "string")
      : existing.favoriteArtists,
    genres: Array.isArray(body.genres)
      ? body.genres.filter((x): x is string => typeof x === "string")
      : existing.genres,
    city: typeof body.city === "string" ? body.city : existing.city,
    country: typeof body.country === "string" ? body.country : existing.country,
    updatedAt: new Date().toISOString(),
  };

  await writeProfile(profile);
  return NextResponse.json(profile);
}

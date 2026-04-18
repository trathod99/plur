import { promises as fs } from "fs";
import path from "path";
import type { TasteProfile } from "./types";

const PROFILE_PATH = path.join(process.cwd(), "data", "profile.json");

const defaultProfile = (): TasteProfile => ({
  narrative: "",
  favoriteArtists: [],
  genres: [],
  updatedAt: "",
});

export async function readProfile(): Promise<TasteProfile> {
  try {
    const raw = await fs.readFile(PROFILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<TasteProfile>;
    return {
      ...defaultProfile(),
      ...parsed,
      favoriteArtists: Array.isArray(parsed.favoriteArtists)
        ? parsed.favoriteArtists
        : [],
      genres: Array.isArray(parsed.genres) ? parsed.genres : [],
    };
  } catch {
    return defaultProfile();
  }
}

export async function writeProfile(profile: TasteProfile): Promise<void> {
  await fs.mkdir(path.dirname(PROFILE_PATH), { recursive: true });
  await fs.writeFile(PROFILE_PATH, JSON.stringify(profile, null, 2), "utf8");
}

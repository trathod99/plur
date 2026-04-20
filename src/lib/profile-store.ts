import { promises as fs } from "fs";
import path from "path";
import type { TasteProfile } from "./types";

export function getProfileJsonPath(): string {
  const root = process.env.PLUR_DATA_DIR?.trim();
  const dir = root ? path.resolve(root) : path.join(process.cwd(), "data");
  return path.join(dir, "profile.json");
}

const defaultProfile = (): TasteProfile => ({
  narrative: "",
  favoriteArtists: [],
  genres: [],
  updatedAt: "",
});

export async function readProfile(): Promise<TasteProfile> {
  try {
    const raw = await fs.readFile(getProfileJsonPath(), "utf8");
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
  const file = getProfileJsonPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(profile, null, 2), "utf8");
}

export type TasteProfile = {
  narrative: string;
  favoriteArtists: string[];
  genres: string[];
  city?: string;
  country?: string;
  updatedAt: string;
};

export type Money = {
  currency: string;
  min?: number;
  max?: number;
  label?: string;
};

export type NormalizedEvent = {
  id: string;
  title: string;
  start: string;
  venue?: string;
  city?: string;
  country?: string;
  url?: string;
  source: string;
  pricing?: Money;
  lineup?: string[];
  matchReasons: string[];
  score: number;
};

export type EventFetchWarning = {
  source: string;
  message: string;
};

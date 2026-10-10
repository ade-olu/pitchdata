// Hero banner background photos, keyed by football-data.org club ID (clubId in the API).
// Files live in public/hero/, so the src is a plain URL path (Vite serves public/ at the site root).

// A single background photo and how to display it
type HeroPhoto = {
  src: string;
  credit: string; // Photographer + license; required for CC BY / CC BY-SA images
  position?: string; // CSS object-position, to keep the crowd visible behind the gradient
};

// A club's default photo, plus optional photos for specific seasons
type HeroImage = HeroPhoto & {
  seasons?: Record<number, HeroPhoto>; // Keyed by season start year (2025 = 2025/26)
};

// Champion club photos. Add a new entry the first time a club wins a league.
// 57 Arsenal, 81 Barcelona, 108 Inter, 5 Bayern, 524 PSG
export const HERO_IMAGES: Record<number, HeroImage> = {
  // TODO: add more champion club photos as needed
  57: { src: "/hero/57.webp", credit: "", position: "center" },
};

// Used when a champion has no photo yet
export const FALLBACK_HERO: HeroPhoto = {
  src: "",
  credit: "",
};

// Pick the photo for a champion: season photo > club photo > fallback
export function getHeroImage(clubId: number | null, startYear: number) {
  const club = clubId != null ? HERO_IMAGES[clubId] : undefined;
  return club?.seasons?.[startYear] ?? club ?? FALLBACK_HERO;
}

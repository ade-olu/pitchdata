// Hand-written hero headlines, keyed by "<league code>-<season start year>"
// Seasons without an entry fall back to a generic headline built in HeroBanner.

type SeasonStory = {
  headline: string;
  summary: string;
};

export const SEASON_STORIES: Record<string, SeasonStory> = {
  "PL-2025": {
    headline: "Arsenal end the wait.",
    summary:
      "Arsenal held off Manchester City by 7 points, sealing their first Premier League title since the Invincibles of 2003/04.",
  },
};

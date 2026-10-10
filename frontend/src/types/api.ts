// Types for the JSON returned by the Express API (backend/api)

// A season, identified by its start year (2025 = 2025/26). Pass startYear as ?season= to league and club routes.
export type Season = {
  startYear: number;
  label: string; // e.g. "2025/26"
};

// One league in GET /api/leagues
export type League = {
  leagueId: number;
  name: string;
  code: string;
  seasons: Season[]; // Newest first
};

// One club's row in GET /api/leagues/:code/standings
export type Standing = {
  clubId: number;
  name: string;
  shortName: string;
  tla: string; // Three-letter abbreviation for the club
  crestUrl: string;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number | null;
  longestWinStreak: number | null;
  longestWinlessStreak: number | null;
};

// Full response from GET /api/leagues/:code/standings
export type StandingsResponse = {
  league: { code: string; name: string };
  season: Season;
  championClubId: number | null;
  standings: Standing[];
};

// One match in GET /api/leagues/:code/matches
export type Match = {
  matchId: number;
  matchday: number;
  utcDate: string;
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
  homeClubName: string;
  homeClubId: number;
  awayClubName: string;
  awayClubId: number;
};

// One player in GET /api/leagues/:code/scorers (top scorers only, ordered by goals)
export type Scorer = {
  playerName: string;
  goals: number;
  assists: number | null;
  clubId: number;
  clubName: string;
  crestUrl: string;
};

// Types for the JSON returned by the Express API (backend/api)

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

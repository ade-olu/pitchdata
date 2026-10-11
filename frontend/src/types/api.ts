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

// A club a player played for, inside Player.clubs
export type PlayerClub = {
  clubId: number;
  name: string;
  shortName: string;
  crestUrl: string;
};

// One player in GET /api/leagues/:code/players (stats from Understat, every player in the league)
export type Player = {
  understatId: number;
  playerName: string;
  position: string; // Understat's position codes, e.g. "F S"
  games: number;
  minutes: number;
  goals: number; // Doesn't include own goals
  assists: number;
  xG: number;
  xA: number;
  shots: number;
  keyPasses: number;
  clubs: PlayerClub[]; // Two or more for a mid-season transfer within the league
};

// Full response from GET /api/leagues/:code/players
export type PlayersResponse = {
  totals: {
    players: number;
    goals: number;
    assists: number;
    xG: number;
    xA: number;
  }; // Covers every player in the league, whatever ?limit= is
  players: Player[];
};

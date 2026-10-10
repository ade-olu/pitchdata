// api/routes/leagues.js
// This file defines the routes for league-related API endpoints.

const express = require("express");
const db = require("../db");

const router = express.Router();

// Find a league's season by league code and start year (2025 = 2025/26).
// Without a start year, returns the league's latest season.
function findSeason(code, startYear) {
  const row = db
    .prepare(
      `
    SELECT
      s.season_id AS seasonId, s.start_year AS startYear, s.label,
      s.champion_club_id AS championClubId,
      l.league_id AS leagueId, l.name, l.code
    FROM seasons s
    JOIN leagues l ON l.league_id = s.league_id
    WHERE l.code = ? AND (? IS NULL OR s.start_year = ?)
    ORDER BY s.start_year DESC
    LIMIT 1
  `,
    )
    .get(code.toUpperCase(), startYear, startYear);

  return row;
}

// Find the season for a request's :code and optional ?season=, or send a 400/404 and return null.
function resolveSeason(req, res) {
  const { code } = req.params;
  const { season } = req.query;

  if (season !== undefined && !/^\d{4}$/.test(season)) {
    res
      .status(400)
      .json({ error: `season must be a start year like 2025, got "${season}"` });
    return null;
  }

  const startYear = season === undefined ? null : Number(season);
  const row = findSeason(code, startYear);

  if (!row) {
    res.status(404).json({
      error:
        startYear === null
          ? `No league found with code "${code}"`
          : `No ${startYear} season found for league "${code}"`,
    });
    return null;
  }

  return row;
}

// Get all available leagues, each with its seasons (newest first).
router.get("/", (req, res) => {
  const leagues = db
    .prepare("SELECT league_id AS leagueId, name, code FROM leagues")
    .all();

  const seasons = db
    .prepare(
      `
    SELECT league_id AS leagueId, start_year AS startYear, label
    FROM seasons
    ORDER BY start_year DESC
  `,
    )
    .all();

  res.json(
    leagues.map((league) => ({
      ...league,
      seasons: seasons
        .filter((season) => season.leagueId === league.leagueId)
        .map(({ startYear, label }) => ({ startYear, label })),
    })),
  );
});

// Get the standings for a league.
router.get("/:code/standings", (req, res) => {
  const season = resolveSeason(req, res);
  if (!season) return;

  const standings = db
    .prepare(
      `
    SELECT
      c.club_id AS clubId, c.name, c.short_name AS shortName, c.tla,
      c.crest_url AS crestUrl,
      cs.games_played AS gamesPlayed, cs.wins, cs.draws, cs.losses, cs.points,
      cs.goals_for AS goalsFor, cs.goals_against AS goalsAgainst,
      cs.clean_sheets AS cleanSheets,
      cs.longest_win_streak AS longestWinStreak,
      cs.longest_winless_streak AS longestWinlessStreak
    FROM club_season_stats cs
    JOIN clubs c ON c.club_id = cs.club_id
    WHERE cs.season_id = ?
    ORDER BY cs.points DESC, (cs.goals_for - cs.goals_against) DESC
  `,
    )
    .all(season.seasonId);

  res.json({
    league: { code: season.code, name: season.name },
    season: { startYear: season.startYear, label: season.label },
    championClubId: season.championClubId,
    standings,
  });
});

// Get all matches for a league.
router.get("/:code/matches", (req, res) => {
  const season = resolveSeason(req, res);
  if (!season) return;

  let sql = `
    SELECT
      m.match_id AS matchId, m.matchday, m.utc_date AS utcDate, m.status,
      m.home_goals AS homeGoals, m.away_goals AS awayGoals,
      hc.name AS homeClubName, hc.club_id AS homeClubId,
      ac.name AS awayClubName, ac.club_id AS awayClubId
    FROM matches m
    JOIN clubs hc ON hc.club_id = m.home_club_id
    JOIN clubs ac ON ac.club_id = m.away_club_id
    WHERE m.season_id = ?
  `;

  const params = [season.seasonId];

  // Filter matches by matchday when provided.
  if (req.query.matchday) {
    sql += " AND m.matchday = ?";
    params.push(Number(req.query.matchday));
  }

  sql += " ORDER BY m.utc_date DESC";

  const matches = db.prepare(sql).all(...params);
  res.json(matches);
});

// Get the top scorers for a league.
router.get("/:code/scorers", (req, res) => {
  const season = resolveSeason(req, res);
  if (!season) return;

  // Limit the number of scorers returned.
  const limit = Number(req.query.limit) || 20;

  const scorers = db
    .prepare(
      `
    SELECT
      ps.player_name AS playerName, ps.goals, ps.assists,
      c.club_id AS clubId, c.name AS clubName, c.crest_url AS crestUrl
    FROM player_season_stats ps
    JOIN clubs c ON c.club_id = ps.club_id
    WHERE ps.season_id = ?
    ORDER BY ps.goals DESC
    LIMIT ?
  `,
    )
    .all(season.seasonId, limit);

  res.json(scorers);
});

module.exports = router;

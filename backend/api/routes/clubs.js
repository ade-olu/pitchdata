// api/routes/clubs.js
// This file defines the routes for club-related API endpoints.

const express = require("express");
const db = require("../db");

const router = express.Router();

// Read the optional ?season= start year, or send a 400 and return undefined if it's malformed.
// Returns null when no season was asked for.
function parseSeason(req, res) {
  const { season } = req.query;

  if (season === undefined) return null;

  if (!/^\d{4}$/.test(season)) {
    res
      .status(400)
      .json({ error: `season must be a start year like 2025, got "${season}"` });
    return undefined;
  }

  return Number(season);
}

// Get a club's profile and stats for one season (?season=, defaults to its latest).
router.get("/:id", (req, res) => {
  const clubId = Number(req.params.id);
  const startYear = parseSeason(req, res);
  if (startYear === undefined) return;

  const club = db
    .prepare(
      `
    SELECT
      club_id AS clubId, name, short_name AS shortName, tla,
      crest_url AS crestUrl
    FROM clubs WHERE club_id = ?
  `,
    )
    .get(clubId);

  if (!club) {
    return res.status(404).json({ error: `No club found with id ${clubId}` });
  }

  // Get the club's stats for the requested season, or its latest one. Null if it didn't play that season.
  const stats = db
    .prepare(
      `
    SELECT
      cs.season_id AS seasonId, s.start_year AS startYear,
      s.label AS seasonLabel, l.name AS leagueName, l.code AS leagueCode,
      cs.games_played AS gamesPlayed, cs.wins, cs.draws, cs.losses, cs.points,
      cs.goals_for AS goalsFor, cs.goals_against AS goalsAgainst,
      cs.home_points AS homePoints, cs.away_points AS awayPoints,
      cs.home_wins AS homeWins, cs.home_draws AS homeDraws,
      cs.home_losses AS homeLosses,
      cs.away_wins AS awayWins, cs.away_draws AS awayDraws,
      cs.away_losses AS awayLosses,
      cs.home_goals_for AS homeGoalsFor,
      cs.home_goals_against AS homeGoalsAgainst,
      cs.away_goals_for AS awayGoalsFor,
      cs.away_goals_against AS awayGoalsAgainst,
      cs.clean_sheets AS cleanSheets,
      cs.longest_win_streak AS longestWinStreak,
      cs.longest_winless_streak AS longestWinlessStreak,
      cs.biggest_win_match_id AS biggestWinMatchId,
      cs.biggest_loss_match_id AS biggestLossMatchId
    FROM club_season_stats cs
    JOIN seasons s ON s.season_id = cs.season_id
    JOIN leagues l ON l.league_id = s.league_id
    WHERE cs.club_id = ? AND (? IS NULL OR s.start_year = ?)
    ORDER BY s.start_year DESC
    LIMIT 1
  `,
    )
    .get(clubId, startYear, startYear);

  res.json({ club, stats: stats ?? null });
});

// Get the matches played by a club, optionally for one season (?season=).
router.get("/:id/matches", (req, res) => {
  const clubId = Number(req.params.id);
  const startYear = parseSeason(req, res);
  if (startYear === undefined) return;

  const club = db
    .prepare("SELECT club_id FROM clubs WHERE club_id = ?")
    .get(clubId);

  if (!club) {
    return res.status(404).json({ error: `No club found with id ${clubId}` });
  }

  // Get the club's matches, with the most recent first.
  const matches = db
    .prepare(
      `
    SELECT
      m.match_id AS matchId, m.matchday, m.utc_date AS utcDate, m.status,
      m.home_goals AS homeGoals, m.away_goals AS awayGoals,
      hc.name AS homeClubName, hc.club_id AS homeClubId,
      ac.name AS awayClubName, ac.club_id AS awayClubId
    FROM matches m
    JOIN seasons s ON s.season_id = m.season_id
    JOIN clubs hc ON hc.club_id = m.home_club_id
    JOIN clubs ac ON ac.club_id = m.away_club_id
    WHERE (m.home_club_id = ? OR m.away_club_id = ?)
      AND (? IS NULL OR s.start_year = ?)
    ORDER BY m.utc_date DESC
  `,
    )
    .all(clubId, clubId, startYear, startYear);

  res.json(matches);
});

module.exports = router;

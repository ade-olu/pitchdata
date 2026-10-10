// api/routes/clubs.js
// This file defines the routes for club-related API endpoints.

const express = require("express");
const db = require("../db");

const router = express.Router();

// Get a club's profile and season stats.
router.get("/:id", (req, res) => {
  const clubId = Number(req.params.id);

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

  // Get the club's stats for its current season.
  const stats = db
    .prepare(
      `
    SELECT
      cs.season_id AS seasonId, l.name AS leagueName, l.code AS leagueCode,
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
    WHERE cs.club_id = ?
  `,
    )
    .get(clubId);

  res.json({ club, stats });
});

// Get all matches played by a club.
router.get("/:id/matches", (req, res) => {
  const clubId = Number(req.params.id);

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
    JOIN clubs hc ON hc.club_id = m.home_club_id
    JOIN clubs ac ON ac.club_id = m.away_club_id
    WHERE m.home_club_id = ? OR m.away_club_id = ?
    ORDER BY m.utc_date DESC
  `,
    )
    .all(clubId, clubId);

  res.json(matches);
});

module.exports = router;

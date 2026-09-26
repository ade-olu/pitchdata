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
    SELECT club_id, name, short_name, tla, crest_url
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
      cs.season_id, l.name AS league_name, l.code AS league_code,
      cs.games_played, cs.wins, cs.draws, cs.losses, cs.points,
      cs.goals_for, cs.goals_against,
      cs.home_points, cs.away_points,
      cs.home_wins, cs.home_draws, cs.home_losses,
      cs.away_wins, cs.away_draws, cs.away_losses,
      cs.home_goals_for, cs.home_goals_against,
      cs.away_goals_for, cs.away_goals_against,
      cs.clean_sheets, cs.longest_win_streak, cs.longest_winless_streak,
      cs.biggest_win_match_id, cs.biggest_loss_match_id
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
      m.match_id, m.matchday, m.utc_date, m.status,
      m.home_goals, m.away_goals,
      hc.name AS home_club_name, hc.club_id AS home_club_id,
      ac.name AS away_club_name, ac.club_id AS away_club_id
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

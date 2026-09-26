// api/routes/leagues.js
// This file defines the routes for league-related API endpoints.

const express = require("express");
const db = require("../db");

const router = express.Router();

// Find a league and its current season by league code.
function findSeason(code) {
  const row = db
    .prepare(
      `
    SELECT s.season_id, s.champion_club_id, l.league_id, l.name, l.code
    FROM seasons s
    JOIN leagues l ON l.league_id = s.league_id
    WHERE l.code = ?
  `,
    )
    .get(code.toUpperCase());

  return row;
}

// Get all available leagues.
router.get("/", (req, res) => {
  const leagues = db.prepare("SELECT league_id, name, code FROM leagues").all();
  res.json(leagues);
});

// Get the standings for a league.
router.get("/:code/standings", (req, res) => {
  const season = findSeason(req.params.code);

  if (!season) {
    return res
      .status(404)
      .json({ error: `No league found with code "${req.params.code}"` });
  }

  const standings = db
    .prepare(
      `
    SELECT
      c.club_id, c.name, c.short_name, c.tla, c.crest_url,
      cs.games_played, cs.wins, cs.draws, cs.losses, cs.points,
      cs.goals_for, cs.goals_against,
      cs.clean_sheets, cs.longest_win_streak, cs.longest_winless_streak
    FROM club_season_stats cs
    JOIN clubs c ON c.club_id = cs.club_id
    WHERE cs.season_id = ?
    ORDER BY cs.points DESC, (cs.goals_for - cs.goals_against) DESC
  `,
    )
    .all(season.season_id);

  res.json({
    league: { code: season.code, name: season.name },
    champion_club_id: season.champion_club_id,
    standings,
  });
});

// Get all matches for a league.
router.get("/:code/matches", (req, res) => {
  const season = findSeason(req.params.code);

  if (!season) {
    return res
      .status(404)
      .json({ error: `No league found with code "${req.params.code}"` });
  }

  let sql = `
    SELECT
      m.match_id, m.matchday, m.utc_date, m.status,
      m.home_goals, m.away_goals,
      hc.name AS home_club_name, hc.club_id AS home_club_id,
      ac.name AS away_club_name, ac.club_id AS away_club_id
    FROM matches m
    JOIN clubs hc ON hc.club_id = m.home_club_id
    JOIN clubs ac ON ac.club_id = m.away_club_id
    WHERE m.season_id = ?
  `;

  const params = [season.season_id];

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
  const season = findSeason(req.params.code);

  if (!season) {
    return res
      .status(404)
      .json({ error: `No league found with code "${req.params.code}"` });
  }

  // Limit the number of scorers returned.
  const limit = Number(req.query.limit) || 20;

  const scorers = db
    .prepare(
      `
    SELECT
      ps.player_name, ps.goals, ps.assists,
      c.club_id, c.name AS club_name, c.crest_url
    FROM player_season_stats ps
    JOIN clubs c ON c.club_id = ps.club_id
    WHERE ps.season_id = ?
    ORDER BY ps.goals DESC
    LIMIT ?
  `,
    )
    .all(season.season_id, limit);

  res.json(scorers);
});

module.exports = router;

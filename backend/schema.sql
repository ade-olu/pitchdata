-- ============================================================
-- Season Recap — Database Schema
-- ============================================================
-- This file describes the SHAPE of the database: what tables
-- exist, what columns each one has, and how tables relate to
-- each other. It does NOT contain any actual data — running
-- this file just builds empty tables, ready to be filled in
-- by the Python scripts.
--
-- 6 tables total: leagues, seasons, clubs, matches,
-- player_season_stats, club_season_stats
-- ============================================================

-- PRAGMA = a SQLite-specific settings command (not standard SQL).
-- This one turns ON foreign key enforcement. Without it, SQLite
-- will silently let you insert a match that points to a club_id
-- that doesn't exist. With it on, that insert will fail loudly,
-- which is what we want — better to catch a bad insert early.
PRAGMA foreign_keys = ON;


-- ------------------------------------------------------------
-- TABLE: leagues
-- One row per competition (e.g. Premier League). Starting with
-- just PL, but the table is built to hold more later.
-- ------------------------------------------------------------
CREATE TABLE leagues (
    league_id   INTEGER PRIMARY KEY,   -- we reuse the API's own competition id (2021 for PL) instead of letting SQLite invent one, so it always matches what the API sends us
    name        TEXT NOT NULL,         -- e.g. "Premier League"
    code        TEXT NOT NULL          -- e.g. "PL" — short code, useful for building API URLs later
);


-- ------------------------------------------------------------
-- TABLE: seasons
-- One row per league PER YEAR (e.g. Premier League 2025/26).
-- Also holds league-wide season stats that only make sense
-- once the whole season is loaded (champion, total goals, etc.)
-- — these start out NULL and get filled in by a later script.
-- ------------------------------------------------------------
CREATE TABLE seasons (
    season_id           INTEGER PRIMARY KEY AUTOINCREMENT,  -- AUTOINCREMENT = SQLite assigns 1, 2, 3... automatically each time a row is added. We use this (instead of reusing an API id) because seasons don't have one natural id of their own.
    league_id            INTEGER NOT NULL,
    start_year           INTEGER NOT NULL,   -- e.g. 2025 (the API's "season" filter value)
    label                 TEXT,               -- human-readable, e.g. "2025/26"
    champion_club_id      INTEGER,            -- filled in later, once /standings is fetched
    total_goals           INTEGER,            -- filled in later, by the aggregate-calculation script
    biggest_win_match_id  INTEGER,            -- filled in later; points at a row in the matches table

    -- FOREIGN KEY = "this column's value must exist as a primary key
    -- somewhere in the table named after REFERENCES." It's how SQLite
    -- keeps tables honest and connected to each other.
    FOREIGN KEY (league_id)           REFERENCES leagues(league_id),
    FOREIGN KEY (champion_club_id)    REFERENCES clubs(club_id),
    FOREIGN KEY (biggest_win_match_id) REFERENCES matches(match_id),

    -- UNIQUE across two columns together = you can't have two rows
    -- with the same (league_id, start_year) pair. This is what lets
    -- 02_fetch_matches.py check "does this season already exist?"
    -- before inserting a duplicate.
    UNIQUE (league_id, start_year)
);


-- ------------------------------------------------------------
-- TABLE: clubs
-- One row per club. Shared across all leagues/seasons — a club
-- doesn't get a new row just because a new season starts.
-- ------------------------------------------------------------
CREATE TABLE clubs (
    club_id     INTEGER PRIMARY KEY,   -- reuses the API's own team id, same reasoning as leagues.league_id
    name        TEXT NOT NULL,         -- e.g. "Arsenal FC"
    short_name  TEXT,                  -- e.g. "Arsenal"
    tla         TEXT,                  -- three-letter code, e.g. "ARS"
    crest_url   TEXT                   -- link to the club's badge image
);


-- ------------------------------------------------------------
-- TABLE: matches
-- One row per match played. This is the biggest table —
-- 380 rows for a full Premier League season.
-- ------------------------------------------------------------
CREATE TABLE matches (
    match_id      INTEGER PRIMARY KEY,  -- reuses the API's own match id
    season_id     INTEGER NOT NULL,
    matchday      INTEGER,
    utc_date      TEXT,                 -- stored as ISO text, e.g. "2025-08-16T14:00:00Z" — SQLite has no dedicated date type, so text in this sortable format is the standard approach
    status        TEXT,                 -- e.g. "FINISHED"
    home_club_id  INTEGER NOT NULL,
    away_club_id  INTEGER NOT NULL,
    home_goals    INTEGER,
    away_goals    INTEGER,
    attendance    INTEGER,              -- currently NULL for every row — see the open "attendance gap" item in the project outline

    FOREIGN KEY (season_id)    REFERENCES seasons(season_id),
    FOREIGN KEY (home_club_id) REFERENCES clubs(club_id),
    FOREIGN KEY (away_club_id) REFERENCES clubs(club_id)
);

-- An INDEX doesn't change what data you can store — it just makes
-- certain lookups much faster, by giving SQLite a pre-sorted shortcut
-- instead of scanning every row. Worth adding on any column you'll
-- filter or sort by often.
CREATE INDEX idx_matches_season   ON matches(season_id);   -- "give me all matches for this season" — used constantly
CREATE INDEX idx_matches_utc_date ON matches(utc_date);    -- needed for anything sorted chronologically (e.g. form trend), since match order isn't guaranteed by the API


-- ------------------------------------------------------------
-- TABLE: player_season_stats
-- One row per player PER SEASON PER CLUB (a player who is
-- transferred mid-season would get two rows — one per club).
-- ------------------------------------------------------------
CREATE TABLE player_season_stats (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id    INTEGER NOT NULL,
    club_id      INTEGER NOT NULL,
    player_name  TEXT NOT NULL,
    goals        INTEGER DEFAULT 0,
    assists      INTEGER DEFAULT 0,   -- API sometimes sends null for this — the fetch script converts null to 0 before inserting, so this column should never actually be empty

    FOREIGN KEY (season_id) REFERENCES seasons(season_id),
    FOREIGN KEY (club_id)   REFERENCES clubs(club_id),

    -- This is "the uniqueness guard" mentioned in the handoff:
    -- it stops the same player/club/season combination from ever
    -- being inserted twice, even if you accidentally run the
    -- fetch script more than once.
    UNIQUE (season_id, club_id, player_name)
);

CREATE INDEX idx_player_stats_season_club ON player_season_stats(season_id, club_id);


-- ------------------------------------------------------------
-- TABLE: club_season_stats
-- One row per club PER SEASON. This is the "everything about
-- how this club's season went" table — mostly filled in by the
-- aggregate-calculation script (Phase 5), not the raw fetch
-- scripts, since most of these values require looping through
-- that club's matches and doing math rather than being handed
-- to us directly by the API.
-- ------------------------------------------------------------
CREATE TABLE club_season_stats (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id              INTEGER NOT NULL,
    club_id                INTEGER NOT NULL,

    games_played           INTEGER,
    wins                   INTEGER,
    draws                  INTEGER,
    losses                 INTEGER,
    points                 INTEGER,
    goals_for              INTEGER,
    goals_against          INTEGER,

    -- These six can come straight from the /standings endpoint's
    -- HOME and AWAY tables (FETCHED), rather than being calculated —
    -- see the note in the project outline.
    home_points             INTEGER,
    away_points              INTEGER,
    home_wins INTEGER, home_draws INTEGER, home_losses INTEGER,
    away_wins INTEGER, away_draws INTEGER, away_losses INTEGER,
    home_goals_for INTEGER, home_goals_against INTEGER,
    away_goals_for INTEGER, away_goals_against INTEGER,

    -- These require real game logic (COMPUTED) — filled in later
    clean_sheets            INTEGER,
    biggest_win_match_id     INTEGER,
    biggest_loss_match_id    INTEGER,
    longest_win_streak       INTEGER,
    longest_winless_streak   INTEGER,
    avg_home_attendance      REAL,     -- REAL = SQLite's decimal-number type, since this is an average, not a whole number. Currently unfillable — see the attendance gap.

    FOREIGN KEY (season_id)             REFERENCES seasons(season_id),
    FOREIGN KEY (club_id)                REFERENCES clubs(club_id),
    FOREIGN KEY (biggest_win_match_id)   REFERENCES matches(match_id),
    FOREIGN KEY (biggest_loss_match_id)  REFERENCES matches(match_id),

    UNIQUE (season_id, club_id)   -- one stats row per club per season, no duplicates
);

CREATE INDEX idx_club_season_stats_season ON club_season_stats(season_id);

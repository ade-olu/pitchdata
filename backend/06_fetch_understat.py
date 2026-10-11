"""
06_fetch_understat.py

Fetches stats for EVERY player in each league-season from understat.com
(goals, assists, minutes, xG, xA and more) and loads them into
understat_player_stats + understat_player_clubs. This fills the gap
left by 03_fetch_scorers.py, which only gets the top 100 scorers.

Understat has no official API. This uses the same JSON endpoint the
league pages on understat.com load their tables from, so it could
change or break without warning. No api_key.txt needed.

Understat names clubs differently from football-data.org ("Bayern
Munich" vs "FC Bayern München"), so each Understat team is matched to
a club_id from that league-season's matches. Names that can't be
matched automatically go in UNDERSTAT_CLUB_NAMES below.

Safe to re-run anytime, including mid-season: each league-season's
rows are deleted and re-inserted, so stats always reflect the latest
fetch. Run 02_fetch_matches.py first, since clubs are matched against
the matches table.
"""

import re
import time
import sqlite3
import unicodedata
import requests


DB_FILE = "football.db"

# Kept in sync with SEASONS in 02_fetch_matches.py
SEASONS = [2023, 2024, 2025]

# Kept as its own copy (rather than imported from 02_fetch_matches.py)
# so this script can run independently on its own. "understat" is the
# league's name in Understat URLs
LEAGUES = [
    {"id": 2021, "name": "Premier League", "code": "PL",  "understat": "EPL"},
    {"id": 2014, "name": "La Liga",         "code": "PD",  "understat": "La_liga"},
    {"id": 2019, "name": "Serie A",         "code": "SA",  "understat": "Serie_A"},
    {"id": 2002, "name": "Bundesliga",      "code": "BL1", "understat": "Bundesliga"},
    {"id": 2015, "name": "Ligue 1",         "code": "FL1", "understat": "Ligue_1"},
]

# Understat team names that don't share enough words with the
# football-data.org name to be matched automatically.
# Understat name -> clubs.name
UNDERSTAT_CLUB_NAMES = {
    "Bayern Munich": "FC Bayern München",
    "FC Cologne": "1. FC Köln",
    "Borussia M.Gladbach": "Borussia Mönchengladbach",
    "RasenBallsport Leipzig": "RB Leipzig",
    "Rennes": "Stade Rennais FC 1901",
}

# Understat only answers this endpoint for requests that look like
# they come from its own league page
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "X-Requested-With": "XMLHttpRequest",
}

# Understat isn't rate limited like football-data.org, but there's no
# need to hit an unofficial site any faster than this
SECONDS_BETWEEN_REQUESTS = 3


def fetch_league_data(understat_league, start_year):
    # Returns {"teams": {...}, "players": [...], "dates": [...]}.
    # Every player value comes back as a string, e.g. "goals": "27"
    url = f"https://understat.com/getLeagueData/{understat_league}/{start_year}"
    headers = {
        **HEADERS,
        "Referer": f"https://understat.com/league/{understat_league}/{start_year}",
    }
    response = requests.get(url, headers=headers, timeout=30)

    if response.status_code != 200:
        raise Exception(
            f"Understat request failed for {understat_league} {start_year} "
            f"with status {response.status_code}: {response.text[:200]}"
        )

    data = response.json()
    print(
        f"  Fetched {len(data['players'])} players and "
        f"{len(data['teams'])} teams."
    )
    return data


def get_season_id(cursor, league_id, start_year):
    # Only looks up an existing season as it doesn't create one. If none is
    # found, 02_fetch_matches.py hasn't been run for this league yet
    cursor.execute(
        "SELECT season_id FROM seasons WHERE league_id = ? AND start_year = ?",
        (league_id, start_year),
    )
    row = cursor.fetchone()

    if row is None:
        raise Exception(
            f"No season found for league_id {league_id}, start_year "
            f"{start_year}. Run 02_fetch_matches.py for this "
            "league first."
        )

    return row[0]


def get_season_clubs(cursor, season_id):
    # Returns (club_id, name, short_name) for every club that played a
    # match in this season
    cursor.execute(
        """SELECT club_id, name, short_name FROM clubs
           WHERE club_id IN (
               SELECT home_club_id FROM matches WHERE season_id = ?
               UNION
               SELECT away_club_id FROM matches WHERE season_id = ?
           )""",
        (season_id, season_id),
    )
    return cursor.fetchall()


def name_words(name):
    # "Club Atlético de Madrid" -> {"club", "atletico", "de", "madrid"}.
    # Strips accents and punctuation so names compare on plain words
    plain = unicodedata.normalize("NFKD", name)
    plain = plain.encode("ascii", "ignore").decode().lower()
    return set(re.findall(r"[a-z0-9]+", plain))


def match_club(understat_name, clubs):
    # Finds the club_id for an Understat team name among this season's
    # clubs. Raises if there's no single clear match, so a wrong mapping
    # never gets saved silently
    if understat_name in UNDERSTAT_CLUB_NAMES:
        wanted = UNDERSTAT_CLUB_NAMES[understat_name]
        candidates = [club for club in clubs if club[1] == wanted]
    else:
        # Every word of the Understat name has to appear in the club's
        # name or short name, e.g. "Atletico Madrid" -> "Club Atlético de Madrid"
        words = name_words(understat_name)
        candidates = [
            club for club in clubs
            if words <= name_words(club[1]) | name_words(club[2] or "")
        ]

        # "Barcelona" fits both FC Barcelona and RCD Espanyol de Barcelona,
        # so on a tie keep the club whose name has the fewest extra words
        if len(candidates) > 1:
            extra = {club: len(name_words(club[1]) - words) for club in candidates}
            fewest = min(extra.values())
            candidates = [club for club in candidates if extra[club] == fewest]

    if len(candidates) != 1:
        season_names = ", ".join(sorted(club[1] for club in clubs))
        raise Exception(
            f'Could not match Understat team "{understat_name}" to a club '
            f"({len(candidates)} matches). Add it to UNDERSTAT_CLUB_NAMES. "
            f"Clubs this season: {season_names}"
        )

    return candidates[0][0]


def build_club_lookup(data, clubs):
    # Understat team name -> club_id for every team in the response
    lookup = {}
    for team in data["teams"].values():
        lookup[team["title"]] = match_club(team["title"], clubs)
    return lookup


def replace_players(cursor, players, club_lookup, season_id):
    # Clears this season's rows first so players whose stats changed (or
    # who were dropped by Understat) don't leave stale rows behind.
    # understat_player_clubs rows have to go first because of the foreign key
    cursor.execute(
        """DELETE FROM understat_player_clubs WHERE player_stats_id IN
           (SELECT id FROM understat_player_stats WHERE season_id = ?)""",
        (season_id,),
    )
    cursor.execute(
        "DELETE FROM understat_player_stats WHERE season_id = ?",
        (season_id,),
    )

    for player in players:
        cursor.execute(
            """INSERT INTO understat_player_stats
               (season_id, understat_player_id, player_name, position,
                games, minutes, goals, non_penalty_goals, assists, shots,
                key_passes, yellow_cards, red_cards,
                xg, npxg, xa, xg_chain, xg_buildup)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                season_id,
                int(player["id"]),
                player["player_name"],
                player["position"],
                int(player["games"]),
                int(player["time"]),
                int(player["goals"]),
                int(player["npg"]),
                int(player["assists"]),
                int(player["shots"]),
                int(player["key_passes"]),
                int(player["yellow_cards"]),
                int(player["red_cards"]),
                float(player["xG"]),
                float(player["npxG"]),
                float(player["xA"]),
                float(player["xGChain"]),
                float(player["xGBuildup"]),
            ),
        )
        player_stats_id = cursor.lastrowid

        # A mid-season transfer comes through as "Chelsea,Everton"
        for team_name in player["team_title"].split(","):
            cursor.execute(
                """INSERT OR IGNORE INTO understat_player_clubs
                   (player_stats_id, club_id) VALUES (?, ?)""",
                (player_stats_id, club_lookup[team_name]),
            )

    print(f"  Inserted {len(players)} player rows.")


def main():
    connection = sqlite3.connect(DB_FILE)
    cursor = connection.cursor()

    jobs = [(year, league) for year in SEASONS for league in LEAGUES]

    for i, (year, league) in enumerate(jobs, start=1):
        print(f"\n[{i}/{len(jobs)}] {league['name']} ({league['code']}) {year}")

        season_id = get_season_id(cursor, league["id"], year)
        data = fetch_league_data(league["understat"], year)

        # Match every team before touching the database, so a missing
        # mapping stops the run without wiping this season's rows
        club_lookup = build_club_lookup(data, get_season_clubs(cursor, season_id))
        replace_players(cursor, data["players"], club_lookup, season_id)

        connection.commit()

        print(f"  season_id = {season_id}")

        if i < len(jobs):
            time.sleep(SECONDS_BETWEEN_REQUESTS)

    connection.close()

    print(
        f"\nDone. Fetched and inserted Understat player stats for "
        f"{len(LEAGUES)} leagues x {len(SEASONS)} seasons."
    )


if __name__ == "__main__":
    main()

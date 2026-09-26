"""
04_fetch_standings.py

Fetches league standings for the 2025/26 season across the same 5
leagues used in the other scripts, merges the TOTAL/HOME/AWAY tables
football-data.org returns into one combined row per club, and saves
that into club_season_stats. Also records each season's champion
(the club in 1st place in the TOTAL table).

Unlike 02 and 03, this script uses INSERT OR REPLACE instead of
INSERT OR IGNORE. Matches and scorer counts are historical facts that
don't change once recorded, but a league table updates every
matchday, so we want each re-run to overwrite the numbers with the
latest standings rather than leave the old ones in place.

"""

import time
import sqlite3
import requests


DB_FILE = "football.db"
API_KEY_FILE = "api_key.txt"

SEASON_START_YEAR = 2025

# Kept as its own copy so this script can run independently of the others
LEAGUES = [
    {"id": 2021, "name": "Premier League", "code": "PL"},
    {"id": 2014, "name": "La Liga",         "code": "PD"},
    {"id": 2019, "name": "Serie A",         "code": "SA"},
    {"id": 2002, "name": "Bundesliga",      "code": "BL1"},
    {"id": 2015, "name": "Ligue 1",         "code": "FL1"},
]

SECONDS_BETWEEN_LEAGUES = 3


def load_api_key():
    with open(API_KEY_FILE, "r") as f:
        return f.read().strip()


def fetch_standings(api_key, league_code):
    headers = {"X-Auth-Token": api_key}
    params = {"season": SEASON_START_YEAR}

    url = f"https://api.football-data.org/v4/competitions/{league_code}/standings"
    response = requests.get(url, headers=headers, params=params)

    if response.status_code != 200:
        raise Exception(
            f"API request failed for {league_code} standings with status "
            f"{response.status_code}: {response.text}"
        )

    data = response.json()

    # The response contains a list of table blocks (TOTAL, HOME, AWAY) rather than a single table  
    # build_club_stats() below sorts out which block is which
    return data["standings"]


def get_season_id(cursor, league_id):
    # Look-up only - this script expects 02_fetch_matches.py to have
    # already created the season row.
    cursor.execute(
        "SELECT season_id FROM seasons WHERE league_id = ? AND start_year = ?",
        (league_id, SEASON_START_YEAR),
    )
    row = cursor.fetchone()

    if row is None:
        raise Exception(
            f"No season found for league_id {league_id}, start_year "
            f"{SEASON_START_YEAR}. Run 02_fetch_matches.py for this "
            "league first."
        )

    return row[0]


def ensure_club(cursor, team):
    # Safety net in case a club here somehow isn't already in the table
    cursor.execute(
        """INSERT OR IGNORE INTO clubs (club_id, name, short_name, tla, crest_url)
           VALUES (?, ?, ?, ?, ?)""",
        (
            team["id"],
            team.get("name"),
            team.get("shortName"),
            team.get("tla"),
            team.get("crest"),
        ),
    )


def build_club_stats(standings):
    # Build one combined dictionary per club by walking through the TOTAL, HOME, and AWAY blocks in turn 
    # Keying by club_id means each club ends up with a single merged entry
    stats = {}

    for block in standings:
        table_type = block.get("type")  # "TOTAL", "HOME", or "AWAY"

        # Skip any block types we're not expecting (e.g. group stages)
        if table_type not in ("TOTAL", "HOME", "AWAY"):
            continue

        for row in block["table"]:
            team = row["team"]
            club_id = team["id"]

            if club_id not in stats:
                stats[club_id] = {"team": team}

            entry = stats[club_id]

            if table_type == "TOTAL":
                entry["games_played"] = row["playedGames"]
                entry["wins"] = row["won"]
                entry["draws"] = row["draw"]
                entry["losses"] = row["lost"]
                entry["points"] = row["points"]
                entry["goals_for"] = row["goalsFor"]
                entry["goals_against"] = row["goalsAgainst"]
            elif table_type == "HOME":
                entry["home_points"] = row["points"]
                entry["home_wins"] = row["won"]
                entry["home_draws"] = row["draw"]
                entry["home_losses"] = row["lost"]
                entry["home_goals_for"] = row["goalsFor"]
                entry["home_goals_against"] = row["goalsAgainst"]
            elif table_type == "AWAY":
                entry["away_points"] = row["points"]
                entry["away_wins"] = row["won"]
                entry["away_draws"] = row["draw"]
                entry["away_losses"] = row["lost"]
                entry["away_goals_for"] = row["goalsFor"]
                entry["away_goals_against"] = row["goalsAgainst"]

    return stats


def find_champion_club_id(standings):
    # Find the club in position 1 of the TOTAL table. Returns None if
    # there's no clear #1 yet (e.g. season still in progress)
    for block in standings:
        if block.get("type") == "TOTAL":
            for row in block["table"]:
                if row["position"] == 1:
                    return row["team"]["id"]
    return None


def save_club_stats(cursor, stats, season_id):
    saved = 0
    for club_id, entry in stats.items():
        ensure_club(cursor, entry["team"])

        cursor.execute(
            """INSERT OR REPLACE INTO club_season_stats
               (season_id, club_id, games_played, wins, draws, losses,
                points, goals_for, goals_against,
                home_points, home_wins, home_draws, home_losses,
                home_goals_for, home_goals_against,
                away_points, away_wins, away_draws, away_losses,
                away_goals_for, away_goals_against)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                season_id,
                club_id,
                entry.get("games_played"),
                entry.get("wins"),
                entry.get("draws"),
                entry.get("losses"),
                entry.get("points"),
                entry.get("goals_for"),
                entry.get("goals_against"),
                entry.get("home_points"),
                entry.get("home_wins"),
                entry.get("home_draws"),
                entry.get("home_losses"),
                entry.get("home_goals_for"),
                entry.get("home_goals_against"),
                entry.get("away_points"),
                entry.get("away_wins"),
                entry.get("away_draws"),
                entry.get("away_losses"),
                entry.get("away_goals_for"),
                entry.get("away_goals_against"),
            ),
        )
        saved += 1

    print(f"  Saved standings for {saved} clubs.")


def save_champion(cursor, season_id, champion_club_id):
    if champion_club_id is None:
        print("  No champion yet (season likely still in progress).")
        return

    cursor.execute(
        "UPDATE seasons SET champion_club_id = ? WHERE season_id = ?",
        (champion_club_id, season_id),
    )
    print(f"  champion_club_id set to {champion_club_id}.")


def main():
    api_key = load_api_key()

    connection = sqlite3.connect(DB_FILE)
    cursor = connection.cursor()

    for i, league in enumerate(LEAGUES, start=1):
        print(f"\n[{i}/{len(LEAGUES)}] {league['name']} ({league['code']})")

        season_id = get_season_id(cursor, league["id"])
        standings = fetch_standings(api_key, league["code"])

        club_stats = build_club_stats(standings)
        save_club_stats(cursor, club_stats, season_id)

        champion_club_id = find_champion_club_id(standings)
        save_champion(cursor, season_id, champion_club_id)

        connection.commit()

        print(f"  season_id = {season_id}")

        if i < len(LEAGUES):
            time.sleep(SECONDS_BETWEEN_LEAGUES)

    connection.close()

    print(f"\nDone. Fetched and saved standings for {len(LEAGUES)} leagues.")


if __name__ == "__main__":
    main()

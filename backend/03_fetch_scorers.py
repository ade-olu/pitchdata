"""
03_fetch_scorers.py

Fetches top scorers for every season in SEASONS across the same 5
leagues used in 02_fetch_matches.py, and loads them into
player_season_stats.

Safe to re-run: uses INSERT OR IGNORE. Note this means goal/assist
counts won't update if a player's stats change later in the season -
re-running just skips rows that already exist. If live updates matter
later, that would need INSERT OR REPLACE or a manual UPDATE instead.
"""

import time
import sqlite3
import requests


DB_FILE = "football.db"
API_KEY_FILE = "api_key.txt"

# Kept in sync with SEASONS in 02_fetch_matches.py
SEASONS = [2023, 2024, 2025]

# Kept as its own copy (rather than imported from 02_fetch_matches.py)
# so this script can run independently on its own
LEAGUES = [
    {"id": 2021, "name": "Premier League", "code": "PL"},
    {"id": 2014, "name": "La Liga",         "code": "PD"},
    {"id": 2019, "name": "Serie A",         "code": "SA"},
    {"id": 2002, "name": "Bundesliga",      "code": "BL1"},
    {"id": 2015, "name": "Ligue 1",         "code": "FL1"},
]

# The API defaults to only 10 scorers per league, but we want the top 100 for each
SCORERS_LIMIT = 100

# Pause between requests to stay under the free tier's 10 calls/minute
SECONDS_BETWEEN_REQUESTS = 7


def load_api_key():
    with open(API_KEY_FILE, "r") as f:
        return f.read().strip()


def fetch_scorers(api_key, league_code, start_year):
    headers = {"X-Auth-Token": api_key}
    params = {"season": start_year, "limit": SCORERS_LIMIT}

    url = f"https://api.football-data.org/v4/competitions/{league_code}/scorers"
    response = requests.get(url, headers=headers, params=params)

    if response.status_code != 200:
        raise Exception(
            f"API request failed for {league_code} scorers with status "
            f"{response.status_code}: {response.text}"
        )

    data = response.json()
    scorers = data["scorers"]

    print(f"  Fetched {len(scorers)} scorers for {league_code}.")
    return scorers


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


def ensure_club(cursor, team):
    # Safety net in case a scorer's club somehow isn't already in the
    # table from 02_fetch_matches.py
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


def insert_scorers(cursor, scorers, season_id):
    inserted = 0
    for entry in scorers:
        player = entry["player"]
        team = entry["team"]

        ensure_club(cursor, team)

        # API sends null for assists when there are none
        # Convert to 0 so the column is never left empty
        assists = entry.get("assists")
        if assists is None:
            assists = 0

        cursor.execute(
            """INSERT OR IGNORE INTO player_season_stats
               (season_id, club_id, player_name, goals, assists)
               VALUES (?, ?, ?, ?, ?)""",
            (
                season_id,
                team["id"],
                player["name"],
                entry.get("goals", 0),
                assists,
            ),
        )
        inserted += 1

    print(f"  Inserted/verified {inserted} scorer rows.")


def main():
    api_key = load_api_key()

    connection = sqlite3.connect(DB_FILE)
    cursor = connection.cursor()

    jobs = [(year, league) for year in SEASONS for league in LEAGUES]

    for i, (year, league) in enumerate(jobs, start=1):
        print(f"\n[{i}/{len(jobs)}] {league['name']} ({league['code']}) {year}")

        season_id = get_season_id(cursor, league["id"], year)
        scorers = fetch_scorers(api_key, league["code"], year)
        insert_scorers(cursor, scorers, season_id)

        connection.commit()

        print(f"  season_id = {season_id}")

        if i < len(jobs):
            time.sleep(SECONDS_BETWEEN_REQUESTS)

    connection.close()

    print(
        f"\nDone. Fetched and inserted scorers for {len(LEAGUES)} leagues "
        f"x {len(SEASONS)} seasons."
    )


if __name__ == "__main__":
    main()

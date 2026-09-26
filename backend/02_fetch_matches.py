"""
02_fetch_matches.py

Fetches all matches for the 2025/26 season across 5 leagues (Premier
League, La Liga, Serie A, Bundesliga, Ligue 1) from football-data.org
and loads them into the database, along with their leagues, seasons,
and clubs.

Safe to re-run: every insert uses INSERT OR IGNORE, so existing rows
are left alone instead of erroring or duplicating.
"""

import time
import sqlite3
import requests  # Not in the standard library - install via requirements.txt


DB_FILE = "football.db"
API_KEY_FILE = "api_key.txt"

SEASON_START_YEAR = 2025  # The API refers to the 2025/26 season as "2025"
SEASON_LABEL = "2025/26"

# football-data.org's own ids and codes for each league, so they line up directly with what the API sends back
LEAGUES = [
    {"id": 2021, "name": "Premier League", "code": "PL"},
    {"id": 2014, "name": "La Liga",         "code": "PD"},
    {"id": 2019, "name": "Serie A",         "code": "SA"},
    {"id": 2002, "name": "Bundesliga",      "code": "BL1"},
    {"id": 2015, "name": "Ligue 1",         "code": "FL1"},
]

# Small pause between leagues to stay comfortably under the API's rate limit
SECONDS_BETWEEN_LEAGUES = 3


def load_api_key():
    # Kept in its own file so the real key never ends up in a script
    with open(API_KEY_FILE, "r") as f:
        return f.read().strip()


def fetch_matches(api_key, league_code):
    headers = {"X-Auth-Token": api_key}
    params = {"season": SEASON_START_YEAR}

    url = f"https://api.football-data.org/v4/competitions/{league_code}/matches"
    response = requests.get(url, headers=headers, params=params)

    if response.status_code != 200:
        raise Exception(
            f"API request failed for {league_code} with status "
            f"{response.status_code}: {response.text}"
        )

    data = response.json()

    matches = data["matches"]
    expected_count = data["resultSet"]["count"]

    # Make sure we got everything the API says it sent, not a partial response
    if len(matches) != expected_count:
        raise Exception(
            f"{league_code}: expected {expected_count} matches but got "
            f"{len(matches)}. Response may be incomplete."
        )

    print(f"  Fetched {len(matches)} matches for {league_code}.")
    return matches


def ensure_league(cursor, league_id, league_name, league_code):
    cursor.execute(
        "INSERT OR IGNORE INTO leagues (league_id, name, code) VALUES (?, ?, ?)",
        (league_id, league_name, league_code),
    )


def ensure_season(cursor, league_id):
    # season_id is auto-generated, so we check for an existing row first instead of using INSERT OR IGNORE
    cursor.execute(
        "SELECT season_id FROM seasons WHERE league_id = ? AND start_year = ?",
        (league_id, SEASON_START_YEAR),
    )
    row = cursor.fetchone()

    if row is not None:
        return row[0]

    cursor.execute(
        "INSERT INTO seasons (league_id, start_year, label) VALUES (?, ?, ?)",
        (league_id, SEASON_START_YEAR, SEASON_LABEL),
    )
    return cursor.lastrowid


def ensure_clubs(cursor, matches):
    # Keying by club id naturally de-dupes clubs that appear in multiple matches (home in some, away in others)
    clubs = {}
    for match in matches:
        home = match["homeTeam"]
        away = match["awayTeam"]
        clubs[home["id"]] = home
        clubs[away["id"]] = away

    for club_id, club in clubs.items():
        cursor.execute(
            """INSERT OR IGNORE INTO clubs (club_id, name, short_name, tla, crest_url)
               VALUES (?, ?, ?, ?, ?)""",
            (
                club_id,
                club.get("name"),
                club.get("shortName"),
                club.get("tla"),
                club.get("crest"),
            ),
        )

    print(f"  Inserted/verified {len(clubs)} unique clubs.")


def insert_matches(cursor, matches, season_id):
    inserted = 0
    for match in matches:
        score = match["score"]["fullTime"]

        cursor.execute(
            """INSERT OR IGNORE INTO matches
               (match_id, season_id, matchday, utc_date, status,
                home_club_id, away_club_id, home_goals, away_goals, attendance)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                match["id"],
                season_id,
                match["matchday"],
                match["utcDate"],
                match["status"],
                match["homeTeam"]["id"],
                match["awayTeam"]["id"],
                score.get("home"),
                score.get("away"),
                None,  # Attendance isn't available on this endpoint/tier
            ),
        )
        inserted += 1

    print(f"  Inserted/verified {inserted} matches.")


def main():
    api_key = load_api_key()

    connection = sqlite3.connect(DB_FILE)
    cursor = connection.cursor()

    for i, league in enumerate(LEAGUES, start=1):
        print(f"\n[{i}/{len(LEAGUES)}] {league['name']} ({league['code']})")

        matches = fetch_matches(api_key, league["code"])

        ensure_league(cursor, league["id"], league["name"], league["code"])
        season_id = ensure_season(cursor, league["id"])
        ensure_clubs(cursor, matches)
        insert_matches(cursor, matches, season_id)

        # Commit after each league so partial progress is saved even if a later league fails
        connection.commit()

        print(f"  season_id = {season_id}")

        if i < len(LEAGUES):
            time.sleep(SECONDS_BETWEEN_LEAGUES)

    connection.close()

    print(f"\nDone. Fetched and inserted {len(LEAGUES)} leagues.")


if __name__ == "__main__":
    main()

"""
05_calculate_aggregates.py

Calculates 5 stats per club per season that need actual game logic
rather than a direct API value: clean sheets, biggest win, biggest
loss, longest win streak, and longest winless streak. Works entirely
from data already in football.db (the matches table from
02_fetch_matches.py). No API calls, no api_key.txt needed.

Safe to re-run anytime, including mid-season: each run recalculates
these 5 columns from whatever matches currently exist and overwrites
the previous values, so numbers naturally grow as more matches are
played.
"""

import sqlite3


DB_FILE = "football.db"


def get_all_seasons(cursor):
    # Returns a list of all season_ids in the database, oldest first. This
    # script doesn't care about league or year, it just wants to process
    # every season that exists
    cursor.execute("SELECT season_id FROM seasons ORDER BY season_id")
    return [row[0] for row in cursor.fetchall()]


def get_clubs_in_season(cursor, season_id):
    # Returns a list of all club_ids that played at least one match in this
    # season. This is a union of home and away clubs, so each club appears
    # only once even if it played multiple matches
    cursor.execute(
        """SELECT home_club_id FROM matches WHERE season_id = ?
           UNION
           SELECT away_club_id FROM matches WHERE season_id = ?""",
        (season_id, season_id),
    )
    return [row[0] for row in cursor.fetchall()]


def get_club_matches(cursor, season_id, club_id):
    # Returns a list of all matches for this club in this season, ordered by date.
    # Each row is a tuple of (match_id, utc_date, home_club_id, away_club_id, home_goals, away_goals)
    cursor.execute(
        """SELECT match_id, utc_date, home_club_id, away_club_id,
                  home_goals, away_goals
           FROM matches
           WHERE season_id = ?
             AND status = 'FINISHED'
             AND (home_club_id = ? OR away_club_id = ?)
           ORDER BY utc_date ASC""",
        (season_id, club_id, club_id),
    )
    return cursor.fetchall()


def calculate_club_aggregates(club_id, matches):
    # Walks through the club's matches in order, keeping running
    # totals, the same way you'd tally a season by hand

    clean_sheets = 0

    best_win_diff = -1          # -1 so even a 1-0 win counts as better than "no win yet"
    best_win_match_id = None

    best_loss_diff = -1
    best_loss_match_id = None

    current_win_streak = 0
    longest_win_streak = 0

    current_winless_streak = 0
    longest_winless_streak = 0

    for match_id, utc_date, home_id, away_id, home_goals, away_goals in matches:
        # Determine which side of the match this club was on, so we can
        # calculate "us" vs "them" for clean sheets, win/loss, etc
        if club_id == home_id:
            us, them = home_goals, away_goals
        else:
            us, them = away_goals, home_goals

        # Guard against an incomplete row rather than crashing on one bad match
        if us is None or them is None:
            continue

        if them == 0:
            clean_sheets += 1

        diff = us - them

        if diff > 0:
            # WIN
            if diff > best_win_diff:
                best_win_diff = diff
                best_win_match_id = match_id

            current_win_streak += 1
            longest_win_streak = max(longest_win_streak, current_win_streak)
            current_winless_streak = 0  # a win resets the winless counter

        else:
            # DRAW or LOSS. Both count toward "winless"
            current_win_streak = 0  # a non-win resets the win counter
            current_winless_streak += 1
            longest_winless_streak = max(longest_winless_streak, current_winless_streak)

            if diff < 0:
                # LOSS specifically. Track how bad it was
                loss_diff = them - us  # positive number, e.g. lost 1-3 -> loss_diff = 2
                if loss_diff > best_loss_diff:
                    best_loss_diff = loss_diff
                    best_loss_match_id = match_id

    return {
        "clean_sheets": clean_sheets,
        "biggest_win_match_id": best_win_match_id,
        "biggest_loss_match_id": best_loss_match_id,
        "longest_win_streak": longest_win_streak,
        "longest_winless_streak": longest_winless_streak,
    }


def save_aggregates(cursor, season_id, club_id, aggregates):
    # Make sure there's a row for this club in this season, even if it has no matches yet
    cursor.execute(
        "INSERT OR IGNORE INTO club_season_stats (season_id, club_id) VALUES (?, ?)",
        (season_id, club_id),
    )

    # Update only the 5 computed columns this script owns, leaving
    # everything else (points, wins, home/away splits, etc.) untouched
    cursor.execute(
        """UPDATE club_season_stats
           SET clean_sheets = ?,
               biggest_win_match_id = ?,
               biggest_loss_match_id = ?,
               longest_win_streak = ?,
               longest_winless_streak = ?
           WHERE season_id = ? AND club_id = ?""",
        (
            aggregates["clean_sheets"],
            aggregates["biggest_win_match_id"],
            aggregates["biggest_loss_match_id"],
            aggregates["longest_win_streak"],
            aggregates["longest_winless_streak"],
            season_id,
            club_id,
        ),
    )


def main():
    connection = sqlite3.connect(DB_FILE)
    cursor = connection.cursor()

    seasons = get_all_seasons(cursor)
    print(f"Found {len(seasons)} season(s) to process.")

    for season_id in seasons:
        club_ids = get_clubs_in_season(cursor, season_id)
        print(f"\nSeason {season_id}: {len(club_ids)} clubs")

        for club_id in club_ids:
            matches = get_club_matches(cursor, season_id, club_id)
            aggregates = calculate_club_aggregates(club_id, matches)
            save_aggregates(cursor, season_id, club_id, aggregates)

        # Commit after each season so we don't lose everything if the script is interrupted mid-run
        connection.commit()
        print(f"  Saved aggregates for {len(club_ids)} clubs.")

    connection.close()
    print(f"\nDone. Processed {len(seasons)} season(s).")


if __name__ == "__main__":
    main()

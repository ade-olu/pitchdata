"""
01_create_database.py

Builds a fresh SQLite database from schema.sql. Deletes any existing
football.db first, so it's safe to re-run at any point during development.
"""

import os
import sqlite3

DB_FILE = "football.db"
SCHEMA_FILE = "schema.sql"


def create_database():
    # Start clean if a database already exists from a previous run
    if os.path.exists(DB_FILE):
        os.remove(DB_FILE)
        print(f"Removed existing {DB_FILE}. Starting fresh.")

    # Creates the database file and opens a connection to it
    connection = sqlite3.connect(DB_FILE)
    cursor = connection.cursor()

    # Load the schema (table + index definitions) from file
    with open(SCHEMA_FILE, "r") as f:
        schema_sql = f.read()

    # executescript() runs multiple SQL statements at once, which we need
    # here since schema.sql contains several CREATE TABLE/INDEX statements
    cursor.executescript(schema_sql)
    connection.commit()

    print(f"{DB_FILE} created successfully from {SCHEMA_FILE}.")

    # Verify the tables were created correctly
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
    )
    tables = cursor.fetchall()

    print(f"\nTables found ({len(tables)}):")
    for row in tables:
        print(f"  - {row[0]}")

    connection.close()


if __name__ == "__main__":
    create_database()

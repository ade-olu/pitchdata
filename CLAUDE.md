# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

pitchdata is a football (soccer) season-stats app for the 2025/26 season of five leagues (PL, PD/La Liga, SA, BL1, FL1). It has three parts that share one SQLite file, `backend/football.db`:

1. **Python ingestion pipeline** (`backend/0N_*.py`) pulls data from football-data.org v4 and writes it to SQLite.
2. **Express API** (`backend/api/`) serves that database read-only as JSON on port 3001.
3. **React frontend** (`frontend/`, Vite + TypeScript + React 19 with React Compiler, SCSS, react-router-dom) is in early development. So far it has only an app shell with a `Sidebar`. It doesn't call the API yet and has no `<Routes>`.

There is no test suite anywhere in the repo.

## Commands

### Data pipeline (run from `backend/`, since the scripts use relative paths to `football.db`, `schema.sql`, and `api_key.txt`)

```
pip install -r requirements.txt
python 01_create_database.py     # DELETES football.db and rebuilds empty tables from schema.sql
python 02_fetch_matches.py       # leagues, seasons, clubs, matches
python 03_fetch_scorers.py       # player_season_stats (top 100 per league)
python 04_fetch_standings.py     # club_season_stats totals/home/away + seasons.champion_club_id
python 05_calculate_aggregates.py  # computed club stats; no API calls
```

Scripts 02–04 need a football-data.org key in `backend/api_key.txt` (gitignored). They pause 3s between leagues to stay under the rate limit.

### API (from `backend/api/`)

```
npm install
node server.js      # http://localhost:3001; there is no npm start script
```

### Frontend (from `frontend/`)

```
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build
npm run lint       # eslint
npm run preview    # serve the production build
```

## Architecture notes

- **Script order matters.** 02 creates the `seasons` rows; 03 and 04 only look them up and raise an error if they're missing. 05 reads only the `matches` table and processes every season in the database.
- **Write semantics are deliberately different per script:**
  - 02 and 03 use `INSERT OR IGNORE`. Re-running them won't update existing rows, so scorer goal counts go stale mid-season.
  - 04 uses `INSERT OR REPLACE` on `club_season_stats` so standings refresh on each run. Because REPLACE deletes the whole row first, it wipes the five computed columns. **Always re-run 05 after 04.**
  - 05 does an `UPDATE` on only its five columns (`clean_sheets`, `biggest_win_match_id`, `biggest_loss_match_id`, `longest_win_streak`, `longest_winless_streak`) and leaves everything else alone.
- **IDs come from the API.** `leagues.league_id`, `clubs.club_id` and `matches.match_id` reuse football-data.org IDs. `seasons.season_id` is autoincrement and unique on `(league_id, start_year)`.
- **The `LEAGUES` list is copied into each fetch script on purpose** so each one can run on its own. If you change the leagues, update all three copies.
- **Some columns are always NULL:** `matches.attendance` and `club_season_stats.avg_home_attendance`, because the API tier doesn't provide attendance. `seasons.total_goals` and `seasons.biggest_win_match_id` are in the schema, but no script fills them yet.
- **The API assumes one season per league.** `findSeason()` in `routes/leagues.js` and the club stats query in `routes/clubs.js` use `.get()` without filtering by year. Adding a second season would make them return an arbitrary row.
- The API opens the database with `readonly: true, fileMustExist: true`. Stop the server before running `01_create_database.py`, because Windows won't delete a file that's open.
- Routes: `/api/leagues`, `/api/leagues/:code/{standings,matches?matchday=,scorers?limit=}`, `/api/clubs/:id`, `/api/clubs/:id/matches`. League codes are uppercased before lookup.
- `football.db` is committed to git.

## Frontend notes

- **Layout:** `main.tsx` wraps `<App>` in `BrowserRouter`. `App.tsx` renders `<Sidebar>` plus an empty `<main className="app__main">` and keeps the selected league in `useState`. Components go in `src/components/<Name>/<Name>.tsx` with a matching `<Name>.scss` beside them. Global styles are in `src/styles/`.
- **Styling:** plain SCSS with BEM class names (`sidebar__nav-item--active`). Colors are SCSS variables at the top of each component file. There are no shared tokens yet. `index.scss` declares the self-hosted **Haffer** font (trial `.woff`/`.woff2` files in `src/assets/fonts/haffer/`) and holds the CSS reset.
- **Icons** come from `reicon-react`. League logos are SVGs in `src/assets/sidebar/`.
- **Sidebar navigation:** the page links (`/`, `/standings`, `/matches`, `/player-stats`, `/clubs`, `/about`) are `NavLink`s to routes that don't exist yet. League selection is separate. It's a button that calls `onSelectLeague` and doesn't change the URL.
- **League codes:** the `LeagueCode` type in `Sidebar.tsx` uses football-data.org's codes (`PL`, `PD`, `SA`, `BL1`, `FL1`), the same ones the database and API use. Pass them straight to `/api/leagues/:code/...`. Don't swap in friendlier codes like `LL` or `L1`, because the API will return 404 for them.

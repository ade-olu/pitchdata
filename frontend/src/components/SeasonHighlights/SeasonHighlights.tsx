import { useEffect, useState } from "react";
import HighlightCard from "../HighlightCard/HighlightCard";

import type { LeagueCode } from "../Sidebar/Sidebar";
import type {
  Match,
  PlayersResponse,
  Standing,
  StandingsResponse,
} from "../../types/api"; // Types for API responses

// Base URL for the Express API
const API_URL = "http://localhost:3001/api";

// Everything the highlight cards need, worked out from the standings, matches and players responses
type HighlightsData = {
  league: LeagueCode;
  season: number;
  matchesFinished: number;
  goalsScored: number;
  assists: number;
  cleanSheets: number;
  streakClub: Standing | undefined; // Club with the longest win streak (undefined if streaks haven't been calculated)
};

// Props for the SeasonHighlights component: the selected league and season start year (2025 = 2025/26)
type SeasonHighlightsProps = {
  league: LeagueCode;
  season: number;
};

// Fetches standings + matches + player totals for a league's season and turns them into HighlightsData
async function fetchHighlightsData(
  league: LeagueCode,
  season: number,
  signal: AbortSignal,
): Promise<HighlightsData> {
  // Run all three requests at the same time instead of one after the other
  const [standingsRes, matchesRes, playersRes] = await Promise.all([
    fetch(`${API_URL}/leagues/${league}/standings?season=${season}`, {
      signal,
    }),
    fetch(`${API_URL}/leagues/${league}/matches?season=${season}`, {
      signal,
    }),
    // limit=0 skips the player list, since only the league-wide totals are needed here
    fetch(`${API_URL}/leagues/${league}/players?season=${season}&limit=0`, {
      signal,
    }),
  ]);

  // Check if all responses were successful before proceeding
  if (!standingsRes.ok || !matchesRes.ok || !playersRes.ok) {
    throw new Error(`Could not load season highlights for ${league}`);
  }

  const { standings } = (await standingsRes.json()) as StandingsResponse;
  const matches = (await matchesRes.json()) as Match[];
  const { totals } = (await playersRes.json()) as PlayersResponse;

  // Only matches that were actually played count here (AWARDED scores aren't real goals)
  const finished = matches.filter((match) => match.status === "FINISHED");

  const goalsScored = finished.reduce(
    (total, match) => total + (match.homeGoals ?? 0) + (match.awayGoals ?? 0),
    0,
  );

  // Clean sheets are null until 05_calculate_aggregates.py has run
  const cleanSheets = standings.reduce(
    (total, club) => total + (club.cleanSheets ?? 0),
    0,
  );

  // Standings are in table order, so on a tie the higher-placed club wins
  const streakClub = standings.reduce<Standing | undefined>(
    (best, club) =>
      (club.longestWinStreak ?? 0) > (best?.longestWinStreak ?? 0)
        ? club
        : best,
    undefined,
  );

  return {
    league,
    season,
    matchesFinished: finished.length,
    goalsScored,
    assists: totals.assists, // Every player's assists, from Understat
    cleanSheets,
    streakClub,
  };
}

// Shows a whole number with thousands separators, e.g. 1043 -> "1,043"
function formatCount(value: number) {
  return value.toLocaleString("en-GB");
}

// Shows a per-match average to 2 decimal places (0 if no matches have been played yet)
function perMatch(total: number, matches: number) {
  return (matches > 0 ? total / matches : 0).toFixed(2);
}

// SeasonHighlights component that shows the row of 4 highlight cards for the selected season
export default function SeasonHighlights({
  league,
  season,
}: SeasonHighlightsProps) {
  const [data, setData] = useState<HighlightsData | null>(null);
  const [error, setError] = useState<{
    league: LeagueCode;
    season: number;
  } | null>(null);

  // Refetch whenever the selected league or season changes
  useEffect(() => {
    // Cancels the request if the selection changes before it finishes
    const controller = new AbortController();

    fetchHighlightsData(league, season, controller.signal)
      .then((highlights) => {
        setData(highlights);
        setError(null);
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") {
          setError({ league, season });
        }
      });

    return () => controller.abort();
  }, [league, season]);

  // Old data or errors from a previous selection don't count for the current one
  const hasError = error?.league === league && error.season === season;
  const isReady =
    !hasError && data?.league === league && data.season === season;

  // Loading and error states keep the cards in place with a dash, so the grid doesn't jump
  if (!isReady || !data) {
    const placeholder = hasError ? "Couldn't load" : "Loading…";

    return (
      <>
        {["Total Goals", "Total Assists", "Clean Sheets", "Best Win Streak"].map(
          (title) => (
            <HighlightCard
              key={title}
              title={title}
              value="–"
              description={placeholder}
            />
          ),
        )}
      </>
    );
  }

  const { matchesFinished, streakClub } = data;
  const streak = streakClub?.longestWinStreak ?? 0;

  // Returns a fragment so each card is a direct child of the app grid
  return (
    <>
      <HighlightCard
        title="Total Goals"
        value={formatCount(data.goalsScored)}
        description={`${perMatch(data.goalsScored, matchesFinished)} goals per match`}
      />
      <HighlightCard
        title="Total Assists"
        value={formatCount(data.assists)}
        description={`${perMatch(data.assists, matchesFinished)} assists per match`}
      />
      <HighlightCard
        title="Clean Sheets"
        value={formatCount(data.cleanSheets)}
        description={`${perMatch(data.cleanSheets, matchesFinished)} clean sheets per match`}
      />
      {/* Best win streak shows the club's crest and name instead of a number */}
      {streakClub && streak > 0 ? (
        <HighlightCard
          title="Best Win Streak"
          value={streakClub.shortName}
          description={`${streak} consecutive ${streak === 1 ? "win" : "wins"}`}
          club={{ name: streakClub.name, crestUrl: streakClub.crestUrl }}
        />
      ) : (
        <HighlightCard
          title="Best Win Streak"
          value="–"
          description="No wins yet"
        />
      )}
    </>
  );
}

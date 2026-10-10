import { useEffect, useState } from "react";
import "./HeroBanner.scss";

import type { LeagueCode } from "../Sidebar/Sidebar";
import type { Match, Standing, StandingsResponse } from "../../types/api"; // Types for API responses
import { getHeroImage } from "../../data/heroImages"; // Get the hero image for a given club and season
import { SEASON_STORIES } from "../../data/seasonStories"; // Hand-written stories for each season

// Base URL for the Express API
const API_URL = "http://localhost:3001/api";

// Season start year shown in the hero (2025 = 2025/26). The API only has one season for now.
const SEASON_YEAR = 2025;

// Formats a date like "16 Aug 2025"
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

// Everything the hero needs, worked out from the standings and matches responses
type HeroData = {
  league: LeagueCode;
  champion: Standing;
  runnerUp: Standing | undefined;
  clubCount: number;
  matchesPlayed: number;
  goalsScored: number;
  startDate: Date;
  endDate: Date;
};

// Props for the HeroBanner component, the league currently selected in the sidebar
type HeroBannerProps = {
  league: LeagueCode;
};

// Fetches standings + matches for a league and turns them into HeroData
async function fetchHeroData(
  league: LeagueCode,
  signal: AbortSignal,
): Promise<HeroData> {
  // Run both requests at the same time instead of one after the other
  const [standingsRes, matchesRes] = await Promise.all([
    fetch(`${API_URL}/leagues/${league}/standings`, { signal }),
    fetch(`${API_URL}/leagues/${league}/matches`, { signal }),
  ]);

  // Check if both responses were successful before proceeding
  if (!standingsRes.ok || !matchesRes.ok) {
    throw new Error(`Could not load season data for ${league}`);
  }

  const { standings, championClubId } =
    (await standingsRes.json()) as StandingsResponse;
  const matches = (await matchesRes.json()) as Match[];

  // Champion comes from the API; fall back to the top of the table if it's missing
  const champion =
    standings.find((club) => club.clubId === championClubId) ?? standings[0];
  const runnerUp = standings.find((club) => club.clubId !== champion.clubId);

  // Only count matches that were actually played
  const finished = matches.filter((match) => match.status === "FINISHED");
  const goalsScored = finished.reduce(
    (total, match) => total + (match.homeGoals ?? 0) + (match.awayGoals ?? 0),
    0,
  );

  // Match order isn't chronological, so take the earliest and latest kickoff times
  const times = finished.map((match) => new Date(match.utcDate).getTime());

  return {
    league,
    champion,
    runnerUp,
    clubCount: standings.length,
    matchesPlayed: finished.length,
    goalsScored,
    startDate: new Date(Math.min(...times)),
    endDate: new Date(Math.max(...times)),
  };
}

// HeroBanner component that shows the season summary and champion over a stadium photo
export default function HeroBanner({ league }: HeroBannerProps) {
  const [data, setData] = useState<HeroData | null>(null);
  const [error, setError] = useState<{
    league: LeagueCode;
    message: string;
  } | null>(null);

  // Refetch whenever the selected league changes
  useEffect(() => {
    // Cancels the request if the league changes before it finishes
    const controller = new AbortController();

    fetchHeroData(league, controller.signal)
      .then((hero) => {
        setData(hero);
        setError(null);
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") {
          setError({ league, message: err.message });
        }
      });

    return () => controller.abort();
  }, [league]);

  // Old data or errors from a previous league don't count for the current one
  const hasError = error?.league === league;
  const isLoading = !hasError && data?.league !== league;

  // Error state
  if (hasError) {
    return (
      <section className="hero-banner hero-banner--empty" role="alert">
        <p className="hero-banner__message">{error.message}</p>
      </section>
    );
  }

  // Loading state (keeps the same height so the page doesn't jump)
  if (isLoading || !data) {
    return (
      <section
        className="hero-banner hero-banner--empty"
        aria-busy="true"
        aria-label="Loading season summary"
      />
    );
  }

  const { champion, runnerUp } = data; // Extract the champion and runner-up from the hero data
  const photo = getHeroImage(champion.clubId, SEASON_YEAR); // Get the hero image for the champion's stadium
  const story = SEASON_STORIES[`${league}-${SEASON_YEAR}`]; // Get the hand-written story for the current season, if available

  // Generic headline for seasons that don't have a hand-written story yet
  const pointsGap = runnerUp ? champion.points - runnerUp.points : 0;
  const headline = story?.headline ?? `${champion.shortName} are champions.`;
  const summary =
    story?.summary ??
    `${champion.name} finished top with ${champion.points} points` +
      (runnerUp ? `, ${pointsGap} clear of ${runnerUp.name}.` : ".");

  // Key stats shown under the summary
  const metrics = [
    { label: "Matches Played", value: data.matchesPlayed },
    { label: "Goals Scored", value: data.goalsScored },
    { label: "Clubs Competed", value: data.clubCount },
  ];

  return (
    // Hero banner section for the current season, including background photo, headline, summary, and key metrics.
    <section className="hero-banner" aria-labelledby="hero-banner-title">
      {/* Background photo of the champion's stadium */}
      {photo.src && (
        <img
          className="hero-banner__image"
          src={photo.src}
          alt=""
          style={{ objectPosition: photo.position }}
        />
      )}

      {/* Dark gradient over the photo so the text stays readable */}
      <div className="hero-banner__inner">
        <div className="hero-banner__content">
          {/* Season date range pill */}
          <div className="hero-banner__pill">
            <time dateTime={data.startDate.toISOString()}>
              {dateFormat.format(data.startDate)}
            </time>
            {" – "}
            <time dateTime={data.endDate.toISOString()}>
              {dateFormat.format(data.endDate)}
            </time>
          </div>

          {/* Headline and summary */}
          <div className="hero-banner__headline">
            <h2 id="hero-banner-title" className="hero-banner__title">
              {headline}
            </h2>
            <p className="hero-banner__summary">{summary}</p>
          </div>

          {/* Season metrics (dt = label, dd = value; CSS shows the value first) */}
          <dl className="hero-banner__metrics">
            {metrics.map((metric) => (
              <div key={metric.label} className="hero-banner__metric">
                <dt className="hero-banner__metric-label">{metric.label}</dt>
                <dd className="hero-banner__metric-value">
                  {metric.value.toLocaleString("en-GB")}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Champion card in the bottom-right corner */}
        <div className="hero-banner__champion">
          <div className="hero-banner__champion-club">
            <img
              className="hero-banner__champion-crest"
              src={champion.crestUrl}
              alt={`${champion.shortName} crest`}
            />
            <div className="hero-banner__champion-text">
              <p className="hero-banner__champion-label">Champions</p>
              <p className="hero-banner__champion-name" title={champion.name}>
                {champion.shortName}
              </p>
            </div>
          </div>
          <p className="hero-banner__points">
            <span className="hero-banner__points-value">{champion.points}</span>
            <abbr className="hero-banner__points-unit" title="Points">
              Pts
            </abbr>
          </p>
        </div>
      </div>

      {/* Photo credit, only shown when the photo's license needs one */}
      {photo.credit && (
        <p className="hero-banner__credit">Photo: {photo.credit}</p>
      )}
    </section>
  );
}

import { useLayoutEffect, useRef } from "react";
import ClubCrest from "@/components/ui/ClubCrest/ClubCrest";
import {
  getTableZone,
  type TablePlaces,
  type TableZone,
} from "@/features/standings/data/tablePlaces";
import { getTableName } from "@/data/tableNames";
import type { Standing } from "@/types/api";
import "./StandingsTable.scss";

// One letter of a club's form: win, draw or loss
export type FormResult = "W" | "D" | "L";

// Columns shown on phones: short (PL, GD, PTS), full (every stat) or form
export type TableView = "short" | "full" | "form";

// Props for the StandingsTable component: the league table (in table order), each club's
// last results (oldest first, keyed by clubId), the season's European and relegation places, and an optional row limit
type StandingsTableProps = {
  standings: Standing[];
  form: Record<number, FormResult[]>;
  places?: TablePlaces;
  limit?: number; // Overview shows the top 5; leave out for the full table
  showGoals?: boolean; // Adds goals for and against (the Standings page)
  view?: TableView; // Phone columns; leave out to fit columns to the width
  animateOrder?: boolean; // Slides rows to their new place when the same clubs are re-ordered
};

// Legend labels, in the order they're shown under the table
// (modifier is the BEM class suffix for the row indicator and legend dot)
const ZONES: {
  key: TableZone;
  label: string;
  modifier: string;
}[] = [
  {
    key: "championsLeague",
    label: "Champions League",
    modifier: "champions-league",
  },
  { key: "europaLeague", label: "Europa League", modifier: "europa-league" },
  {
    key: "conferenceLeague",
    label: "Conference League Qualification",
    modifier: "conference-league",
  },
  {
    key: "relegationPlayoff",
    label: "Relegation Qualification",
    modifier: "relegation-playoff",
  },
  { key: "relegation", label: "Relegation", modifier: "relegation" },
];

const RELEGATION_ZONES: TableZone[] = ["relegationPlayoff", "relegation"];

const FORM_LABELS: Record<FormResult, string> = {
  W: "Win",
  D: "Draw",
  L: "Loss",
};

// Shows goal difference with a sign, e.g. +44, 0, -12
function formatGoalDifference(club: Standing) {
  const difference = club.goalsFor - club.goalsAgainst;
  return difference > 0 ? `+${difference}` : String(difference);
}

// League table: position, club, played, W/D/L, optional GF/GA, goal difference, points and form
export default function StandingsTable({
  standings,
  form,
  places,
  limit,
  showGoals = false,
  view,
  animateOrder = false,
}: StandingsTableProps) {
  const rows = limit === undefined ? standings : standings.slice(0, limit);

  // Each row's element and where it was last time, keyed by clubId
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());
  const previousTops = useRef(new Map<number, number>());

  // When the order changes (e.g. Overall -> Home), slide each row from its old
  // place to its new one (FLIP: measure, move, then animate back to zero)
  useLayoutEffect(() => {
    const tops = new Map<number, number>();
    rowRefs.current.forEach((row, clubId) => tops.set(clubId, row.offsetTop));
    const previous = previousTops.current;
    previousTops.current = tops;

    // Only when the same clubs are re-ordered, not on a new league or season
    const sameClubs =
      previous.size === tops.size &&
      [...tops.keys()].every((clubId) => previous.has(clubId));
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!animateOrder || !sameClubs || reduceMotion) return;

    tops.forEach((top, clubId) => {
      const shift = (previous.get(clubId) ?? top) - top;
      if (shift === 0) return;
      rowRefs.current
        .get(clubId)
        ?.animate(
          [{ transform: `translateY(${shift}px)` }, { transform: "none" }],
          { duration: 400, easing: "ease-in-out" },
        );
    });
  });

  const tableRef = useRef<HTMLTableElement>(null);
  const previousView = useRef(view);

  // Fades the table in when the phone columns change (Short / Full / Form)
  useLayoutEffect(() => {
    if (previousView.current === view) return;
    previousView.current = view;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    tableRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 200,
      easing: "ease-out",
    });
  }, [view]);

  // Position is null if the table hasn't been ranked; fall back to the row order
  const zoneOf = (club: Standing, index: number) => {
    const zone = getTableZone(places, club.position ?? index + 1);
    return ZONES.find(({ key }) => key === zone);
  };

  // The European competitions are always listed; the relegation
  // zones only when a shown row is in them, so the overview's top 5 doesn't list them
  const legend = ZONES.filter(
    ({ key }) =>
      !RELEGATION_ZONES.includes(key) ||
      rows.some((club, index) => zoneOf(club, index)?.key === key),
  );

  return (
    <div
      className={`standings-table${view ? ` standings-table--${view}` : ""}`}
    >
      {/* Scrolls sideways instead of squashing the columns on narrow screens */}
      <div className="standings-table__scroll">
        <table ref={tableRef} className="standings-table__table">
          <colgroup>
            <col className="standings-table__col-position" />
            <col />
            <col className="standings-table__col-stat" />
            {Array.from({ length: 3 }, (_, index) => (
              <col
                key={index}
                className="standings-table__col-stat standings-table__col-result"
              />
            ))}
            {showGoals && (
              <>
                <col className="standings-table__col-stat standings-table__col-goals" />
                <col className="standings-table__col-stat standings-table__col-goals" />
              </>
            )}
            <col className="standings-table__col-stat" />
            <col className="standings-table__col-stat standings-table__col-points" />
            <col className="standings-table__col-form" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="standings-table__position">
                #
              </th>
              <th scope="col" className="standings-table__club">
                Club
              </th>
              <th scope="col" className="standings-table__stat">
                <abbr title="Played">PL</abbr>
              </th>
              <th
                scope="col"
                className="standings-table__stat standings-table__result"
              >
                <abbr title="Won">W</abbr>
              </th>
              <th
                scope="col"
                className="standings-table__stat standings-table__result"
              >
                <abbr title="Drawn">D</abbr>
              </th>
              <th
                scope="col"
                className="standings-table__stat standings-table__result"
              >
                <abbr title="Lost">L</abbr>
              </th>
              {showGoals && (
                <>
                  <th
                    scope="col"
                    className="standings-table__stat standings-table__goals"
                  >
                    <abbr title="Goals for">GF</abbr>
                  </th>
                  <th
                    scope="col"
                    className="standings-table__stat standings-table__goals"
                  >
                    <abbr title="Goals against">GA</abbr>
                  </th>
                </>
              )}
              <th scope="col" className="standings-table__stat">
                <abbr title="Goal difference">GD</abbr>
              </th>
              <th
                scope="col"
                className="standings-table__stat standings-table__points"
              >
                <abbr title="Points">PTS</abbr>
              </th>
              <th scope="col" className="standings-table__form">
                {/* The Form view on phones has room for the longer label */}
                <span className="standings-table__form-label">Form</span>
                <span className="standings-table__form-label-long">
                  Last 5 matches
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((club, index) => {
              const position = club.position ?? index + 1;
              const zone = zoneOf(club, index);
              const results = form[club.clubId] ?? [];

              return (
                <tr
                  key={club.clubId}
                  ref={(row) => {
                    if (!row) return;
                    rowRefs.current.set(club.clubId, row);
                    return () => {
                      rowRefs.current.delete(club.clubId);
                    };
                  }}
                  className={
                    zone?.key === "relegation"
                      ? "standings-table__row--relegation"
                      : undefined
                  }
                >
                  <td
                    className={`standings-table__position${
                      zone ? ` standings-table__position--${zone.modifier}` : ""
                    }`}
                  >
                    {position}
                  </td>
                  <th scope="row" className="standings-table__club">
                    <span className="standings-table__club-inner">
                      <span className="standings-table__crest-slot">
                        <ClubCrest
                          src={club.crestUrl}
                          name={club.displayName}
                          className="standings-table__crest"
                        />
                      </span>
                      <span className="standings-table__club-name">
                        {club.displayName}
                      </span>
                      {/* Shorter name on phones, e.g. "Man United" */}
                      <span className="standings-table__club-name standings-table__club-name--short">
                        {getTableName(club.clubId, club.displayName)}
                      </span>
                    </span>
                  </th>
                  <td className="standings-table__stat">{club.gamesPlayed}</td>
                  <td className="standings-table__stat standings-table__result">
                    {club.wins}
                  </td>
                  <td className="standings-table__stat standings-table__result">
                    {club.draws}
                  </td>
                  <td className="standings-table__stat standings-table__result">
                    {club.losses}
                  </td>
                  {showGoals && (
                    <>
                      <td className="standings-table__stat standings-table__goals">
                        {club.goalsFor}
                      </td>
                      <td className="standings-table__stat standings-table__goals">
                        {club.goalsAgainst}
                      </td>
                    </>
                  )}
                  <td className="standings-table__stat">
                    {formatGoalDifference(club)}
                  </td>
                  <td className="standings-table__stat standings-table__points">
                    {club.points}
                  </td>
                  <td className="standings-table__form">
                    <ol
                      className="standings-table__form-list"
                      aria-label="Last 5 results, oldest first"
                    >
                      {results.map((result, resultIndex) => (
                        <li
                          key={resultIndex}
                          className={`standings-table__form-badge standings-table__form-badge--${FORM_LABELS[result].toLowerCase()}`}
                          title={FORM_LABELS[result]}
                        >
                          {result}
                        </li>
                      ))}
                    </ol>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Legend only when the season's places are known */}
      {places && (
        <ul className="standings-table__legend">
          {legend.map(({ key, label, modifier }) => (
            <li key={key} className="standings-table__legend-item">
              <span
                className={`standings-table__legend-dot standings-table__legend-dot--${modifier}`}
              />
              {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

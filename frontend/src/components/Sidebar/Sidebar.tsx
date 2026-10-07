import { NavLink } from "react-router-dom";
import type { ComponentType } from "react";
import "./Sidebar.scss";

// Sidebar icons
import logoIcon from "../../assets/logo.svg";
import { Grid as OverviewIcon } from "reicon-react";
import { Trophy as StandingsIcon } from "reicon-react";
import { CalendarDays as MatchesIcon } from "reicon-react";
import { UserCircle as PlayerStatsIcon } from "reicon-react";
import { Shield2 as ClubsIcon } from "reicon-react";
import { InfoCircle as AboutIcon } from "reicon-react";

// League logos
import premierLeagueLogo from "../../assets/sidebar/premier-league-logo.svg";
import laLigaLogo from "../../assets/sidebar/la-liga-logo.svg";
import serieALogo from "../../assets/sidebar/serie-a-logo.svg";
import bundesligaLogo from "../../assets/sidebar/bundesliga-logo.svg";
import ligue1Logo from "../../assets/sidebar/ligue-1-logo.svg";

// League codes (same as the ones used in the API) for the leagues in the sidebar
export type LeagueCode = "PL" | "LL" | "SA" | "BL1" | "L1";

// Props for the icon components, allowing for optional className to be passed in
type IconProps = {
  className?: string;
};

// Sidebar pages and their corresponding icons
const PAGES: { path: string; name: string; icon: ComponentType<IconProps> }[] =
  [
    { path: "/", name: "Overview", icon: OverviewIcon },
    { path: "/standings", name: "Standings", icon: StandingsIcon },
    { path: "/matches", name: "Matches", icon: MatchesIcon },
    { path: "/player-stats", name: "Player Stats", icon: PlayerStatsIcon },
    { path: "/clubs", name: "Clubs", icon: ClubsIcon },
    { path: "/about", name: "About", icon: AboutIcon },
  ];

// Sidebar leagues and their corresponding logos
const LEAGUES: { code: LeagueCode; name: string; logo: string }[] = [
  { code: "PL", name: "Premier League", logo: premierLeagueLogo },
  { code: "LL", name: "La Liga", logo: laLigaLogo },
  { code: "SA", name: "Serie A", logo: serieALogo },
  { code: "BL1", name: "Bundesliga", logo: bundesligaLogo },
  { code: "L1", name: "Ligue 1", logo: ligue1Logo },
];

// Props for the Sidebar component, including the selected league and a callback for selecting a league
type SidebarProps = {
  selectedLeague: LeagueCode;
  onSelectLeague: (league: LeagueCode) => void;
};

// Sidebar component that renders the sidebar navigation with pages and leagues
export default function Sidebar({
  selectedLeague,
  onSelectLeague,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <img className="sidebar__logo" src={logoIcon} alt="PitchData Logo" />
      </div>
      {/* Navigation */}
      <nav className="sidebar__nav">
        {/* Main Navigation */}
        <section className="sidebar__section">
          <ul className="sidebar__nav-list">
            {/* Render each page in the sidebar navigation */}
            {PAGES.map((page) => (
              <li key={page.path}>
                <NavLink
                  to={page.path}
                  end={page.path === "/"}
                  className={({ isActive }) =>
                    `sidebar__nav-item${isActive ? " sidebar__nav-item--active" : ""}`
                  }
                >
                  <page.icon className="sidebar__nav-icon" />
                  <span>{page.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </section>

        {/* League Navigation */}
        <section className="sidebar__section">
          <h5 className="sidebar__section-title">Leagues</h5>
          <ul className="sidebar__nav-list">
            {/* Render each league in the sidebar navigation */}
            {LEAGUES.map((league) => {
              const isSelected = selectedLeague === league.code;
              return (
                <li key={league.code}>
                  <button
                    type="button"
                    className={`sidebar__nav-item${isSelected ? " sidebar__nav-item--selected" : ""}`}
                    aria-pressed={isSelected}
                    onClick={() => onSelectLeague(league.code)}
                  >
                    <img
                      className="sidebar__nav-icon"
                      src={league.logo}
                      alt=""
                    />
                    <span>{league.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </nav>
    </aside>
  );
}

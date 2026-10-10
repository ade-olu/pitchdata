import { useState } from "react";
import Navbar from "./components/Navbar/Navbar";
import "./styles/App.scss";
import Sidebar, { type LeagueCode } from "./components/Sidebar/Sidebar";
import HeroBanner from "./components/HeroBanner/HeroBanner";
import SeasonHighlights from "./components/SeasonHighlights/SeasonHighlights";

// Season shown on first load, as a start year (2025 = 2025/26)
const LATEST_SEASON = 2025;

function App() {
  const [league, setLeague] = useState<LeagueCode>("PL"); // Default league is the Premier League
  const [season, setSeason] = useState(LATEST_SEASON); // Default season is the latest season

  return (
    <div className="app">
      {/* Sidebar section */}
      <Sidebar selectedLeague={league} onSelectLeague={setLeague} />
      {/* Main content section */}
      <main className="app__main">
        {/* Navbar section */}
        <Navbar
          selectedLeague={league}
          selectedSeason={season}
          onSelectSeason={setSeason}
        />
        <section className="app__content">
          {/* Hero banner section */}
          <HeroBanner league={league} season={season} />
          {/* Grid section for app content */}
          <section className="app__grid">
            {/* Season highlight cards */}
            <SeasonHighlights league={league} season={season} />
          </section>
        </section>
      </main>
    </div>
  );
}

export default App;

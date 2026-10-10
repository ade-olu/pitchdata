import { useState } from "react";
import Navbar from "./components/Navbar/Navbar";
import "./styles/App.scss";
import Sidebar, { type LeagueCode } from "./components/Sidebar/Sidebar";
import HeroBanner from "./components/HeroBanner/HeroBanner";

// Season shown on first load, as a start year (2025 = 2025/26)
const LATEST_SEASON = 2025;

function App() {
  const [league, setLeague] = useState<LeagueCode>("PL");
  const [season, setSeason] = useState(LATEST_SEASON);

  return (
    <div className="app">
      <Sidebar selectedLeague={league} onSelectLeague={setLeague} />
      <main className="app__main">
        <Navbar
          selectedLeague={league}
          selectedSeason={season}
          onSelectSeason={setSeason}
        />
        <section className="app__content">
          <HeroBanner league={league} season={season} />
        </section>
      </main>
    </div>
  );
}

export default App;

import { useState } from "react";
import "./styles/App.scss";
import Sidebar, { type LeagueCode } from "./components/Sidebar/Sidebar";
import HeroBanner from "./components/HeroBanner/HeroBanner";

// Season shown on first load, as a start year (2025 = 2025/26)
const LATEST_SEASON = 2025;

function App() {
  const [league, setLeague] = useState<LeagueCode>("PL");
  // TODO: add a season picker that calls setSeason
  const [season] = useState(LATEST_SEASON);

  return (
    <div className="app">
      <Sidebar selectedLeague={league} onSelectLeague={setLeague} />
      <main className="app__main">
        <HeroBanner league={league} season={season} />
      </main>
    </div>
  );
}

export default App;

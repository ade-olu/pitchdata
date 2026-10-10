import { useState } from "react";
import "./styles/App.scss";
import Sidebar, { type LeagueCode } from "./components/Sidebar/Sidebar";
import HeroBanner from "./components/HeroBanner/HeroBanner";

function App() {
  const [league, setLeague] = useState<LeagueCode>("PL");

  return (
    <div className="app">
      <Sidebar selectedLeague={league} onSelectLeague={setLeague} />
      <main className="app__main">
        <HeroBanner league={league} />
      </main>
    </div>
  );
}

export default App;

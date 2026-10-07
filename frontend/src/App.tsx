import { useState } from "react";
import "./styles/App.scss";
import Sidebar, { type LeagueCode } from "./components/Sidebar/Sidebar";

function App() {
  const [league, setLeague] = useState<LeagueCode>("PL");

  return (
    <div className="app">
      <Sidebar selectedLeague={league} onSelectLeague={setLeague} />
      <main className="app__main"></main>
    </div>
  );
}

export default App;

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { ChevronDown as ArrowDownIcon } from "reicon-react"; // Downward arrow icon for the navbar
import { Check as CheckIcon } from "reicon-react"; // Tick shown next to the selected season
import type { LeagueCode } from "../Sidebar/Sidebar";
import { LEAGUES } from "../Sidebar/Sidebar";
import type { League, Season } from "../../types/api";

import "./Navbar.scss";

// Base URL for the Express API
const API_URL = "http://localhost:3001/api";

// Props for the Navbar component: the selected league and season (start year, 2025 = 2025/26)
type NavbarProps = {
  selectedLeague: LeagueCode;
  selectedSeason: number;
  onSelectSeason: (season: number) => void;
};

// Shows a season as full years, e.g. 2025 -> "2025/2026"
function formatSeason(startYear: number) {
  return `${startYear}/${startYear + 1}`;
}

export default function Navbar({
  selectedLeague,
  selectedSeason,
  onSelectSeason,
}: NavbarProps) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  // Index of the option highlighted with the keyboard while the list is open
  const [activeIndex, setActiveIndex] = useState(0);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const league = LEAGUES.find((item) => item.code === selectedLeague);

  // Seasons for the selected league, newest first. Falls back to the selected season
  // on its own until the API responds (or if it fails), so the button always has a value
  const apiSeasons =
    leagues.find((item) => item.code === selectedLeague)?.seasons ?? [];
  const seasons: Season[] =
    apiSeasons.length > 0
      ? apiSeasons
      : [{ startYear: selectedSeason, label: formatSeason(selectedSeason) }];

  // Load the leagues and their seasons once
  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_URL}/leagues`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Could not load seasons");
        return res.json() as Promise<League[]>;
      })
      .then(setLeagues)
      .catch((err: Error) => {
        // Keep the fallback season; the dropdown still works with one option
        if (err.name !== "AbortError") console.error(err);
      });

    return () => controller.abort();
  }, []);

  // Close the list when clicking anywhere outside the dropdown
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  // Move focus into the list when it opens, so arrow keys work straight away
  useEffect(() => {
    if (isOpen) listRef.current?.focus();
  }, [isOpen]);

  function openList() {
    const selectedIndex = seasons.findIndex(
      (season) => season.startYear === selectedSeason,
    );
    setActiveIndex(Math.max(selectedIndex, 0));
    setIsOpen(true);
  }

  function closeList() {
    setIsOpen(false);
    buttonRef.current?.focus();
  }

  function selectSeason(startYear: number) {
    onSelectSeason(startYear);
    closeList();
  }

  // Open the list with the arrow keys as well as Enter/Space (which the button handles)
  function handleButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openList();
    }
  }

  // Keyboard support inside the open list (same keys as a native <select>)
  function handleListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const lastIndex = seasons.length - 1;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, lastIndex));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(lastIndex);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        selectSeason(seasons[activeIndex].startYear);
        break;
      case "Escape":
        event.preventDefault();
        closeList();
        break;
      case "Tab":
        // Let focus move on naturally, just close the list
        setIsOpen(false);
        break;
    }
  }

  return (
    // Navbar component for displaying the selected league and a dropdown for selecting the season
    <nav className="navbar">
      {/* Selected league section */}
      <div className="navbar__league">
        {league?.logoAlt && (
          <img src={league.logoAlt} alt="" className="navbar__league-logo" />
        )}
        <h2 className="navbar__league-name">
          {league?.name} {formatSeason(selectedSeason)}
        </h2>
      </div>

      {/* Dropdown for selecting the season */}
      <div className="navbar__dropdown-wrapper" ref={dropdownRef}>
        <button
          ref={buttonRef}
          type="button"
          className={`navbar__dropdown${isOpen ? " navbar__dropdown--open" : ""}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listId}
          onClick={() => (isOpen ? setIsOpen(false) : openList())}
          onKeyDown={handleButtonKeyDown}
        >
          <span className="navbar__dropdown-season">
            <span className="navbar__dropdown-label">Season</span>
            <span className="navbar__dropdown-value">
              {formatSeason(selectedSeason)}
            </span>
          </span>
          <ArrowDownIcon className="navbar__dropdown-icon" />
        </button>

        {/* Season options list, newest first */}
        {isOpen && (
          <ul
            ref={listRef}
            id={listId}
            className="navbar__dropdown-list"
            role="listbox"
            aria-label="Season"
            aria-activedescendant={`${listId}-${activeIndex}`}
            tabIndex={-1}
            onKeyDown={handleListKeyDown}
          >
            {seasons.map((season, index) => {
              const isSelected = season.startYear === selectedSeason;
              const isActive = index === activeIndex;

              return (
                <li
                  key={season.startYear}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  className={`navbar__dropdown-option${isActive ? " navbar__dropdown-option--active" : ""}${isSelected ? " navbar__dropdown-option--selected" : ""}`}
                  onPointerEnter={() => setActiveIndex(index)}
                  onClick={() => selectSeason(season.startYear)}
                >
                  {formatSeason(season.startYear)}
                  {isSelected && (
                    <CheckIcon className="navbar__dropdown-check" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </nav>
  );
}

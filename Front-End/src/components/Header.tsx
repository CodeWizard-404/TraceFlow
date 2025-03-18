// Header.jsx (Updated Component)
import { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { FaSun, FaMoon } from "react-icons/fa";
import logo from "../assets/Logo.png";
import "./CMP.css";

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  return (
    <header className={`header ${theme === "dark" ? "dark" : ""}`}>
      <div className="header-container">
        <img className="logo" src={logo} alt="LOGO" />
        <button 
          className="menu-toggle" 
          onClick={toggleMenu}
          aria-label="Toggle menu"
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? "✕" : "☰"}
        </button>
        <nav className={`header-nav ${isMenuOpen ? "open" : ""}`}>
          <a href="/timesheet" className="nav-link">Timesheets</a>
          <a href="/schedule" className="nav-link">Schedule</a>
          <a href="/about" className="nav-link">About</a>
          <button 
            className="theme-toggle-btn" 
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <FaMoon /> : <FaSun />}
          </button>
        </nav>
      </div>
    </header>
  );
}

export default Header;
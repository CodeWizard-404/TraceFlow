import { useState } from "react";
import { useTheme } from "../context/ThemeContext"; // Import useTheme from ThemeContext
import { FaSun, FaMoon } from "react-icons/fa"; // Icons for theme toggle
import logo from "../assets/Banner.png";
import "./CMP.css";

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme(); // Access theme and toggle function

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  return (
    <header className="header">
      <div className="header-container">
        <img className="logo" src={logo} alt="LOGO" />
        <button className="menu-toggle" onClick={toggleMenu}>
          {isMenuOpen ? "✕" : "☰"}
        </button>
        <nav className={`header-nav ${isMenuOpen ? "open" : ""}`}>
          <a href="/timesheet" className="nav-link">Timesheets</a>
          <a href="/schedule" className="nav-link">Schedule</a>
          <a href="/about" className="nav-link">About</a>
          {/* Theme Toggle Button */}
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {theme === "light" ? <FaMoon /> : <FaSun />}
            
          </button>
        </nav>
      </div>
    </header>
  );
}

export default Header;
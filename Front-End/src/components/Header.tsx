// Header.jsx
import { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { FaSun, FaMoon, FaSignOutAlt } from "react-icons/fa";
import logo from "../assets/Logo.png";
import "./CMP.css";

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
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
          <div className="button-group">
            <div className="icon-btn-wrapper">
              <button
                className="theme-toggle-btn"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              >
                {theme === "light" ? <FaMoon /> : <FaSun />}
                <span className="btn-text">Theme</span>
              </button>
            </div>
            {user && (
              <div className="icon-btn-wrapper">
                <button
                  className="logout-btn"
                  onClick={handleLogout}
                  aria-label="Log out"
                >
                  <FaSignOutAlt />
                  <span className="btn-text">Logout</span>
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

export default Header;
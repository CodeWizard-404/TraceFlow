import { useState } from "react";
import logo from "../assets/Logo.png";
import "./CMP.css";

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
        </nav>
      </div>
    </header>
  );
}

export default Header;
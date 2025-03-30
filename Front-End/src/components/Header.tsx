import { useState } from "react";
import { To, useNavigate } from "react-router-dom"; // Add useNavigate for programmatic navigation
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { FaSun, FaMoon, FaSignOutAlt } from "react-icons/fa";
import "./CMP.css";

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, userRoles, effectivePermissions, permissionsLoaded, logout } = useAuth();
  const navigate = useNavigate(); // For navigation on click

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

  // Define permissions and roles from .env (mirroring App.jsx)
  const PERMISSIONS = {
    ACCESS_SUPERVISOR_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_ACCESS_SUPERVISOR_TIMESHEETS,
    ACCESS_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOKS,
  };

  const ROLES = {
    ADMIN: import.meta.env.VITE_ROLES_ADMIN,
    SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
  };

  // Permission and role checks
  const hasPermission = (permission: string) =>
    permissionsLoaded && effectivePermissions?.some(p => p.name === permission);
  const hasRole = (role: string) =>
    permissionsLoaded && userRoles?.some(r => r.name === role);

  // Navigation items with conditions
  const navItems = [
    {
      path: "/admin",
      label: "Admin Dashboard",
      visible: () => hasRole(ROLES.ADMIN) || hasRole(ROLES.SUPER_ADMIN),
    },
    {
      path: "/timesheet",
      label: "Timesheets",
      visible: () => hasPermission(PERMISSIONS.ACCESS_SUPERVISOR_TIMESHEETS),
    },
    {
      path: "/receipt-books",
      label: "Receipt Books",
      visible: () => hasPermission(PERMISSIONS.ACCESS_RECEIPT_BOOKS),
    }
  ];

  const handleNavClick = (path: To) => {
    navigate(path);
    setIsMenuOpen(false); // Close menu on mobile after clicking
  };

  return (
    <header className={`header ${theme === "dark" ? "dark" : ""}`}>
      <div className="header-container">
        <img
          className="logo"
          src={theme === "dark" ? "../../public/Banner-wd.png" : "../../public/Banner-bl.png"}
          alt="LOGO"
          onClick={() => navigate("/")}
        />
        <button
          className="menu-toggle"
          onClick={toggleMenu}
          aria-label="Toggle menu"
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? "✕" : "☰"}
        </button>
        <nav className={`header-nav ${isMenuOpen ? "open" : ""}`}>
          {permissionsLoaded && user && navItems.map((item) =>
            item.visible() ? (
              <button
                key={item.path}
                className="nav-link"
                onClick={() => handleNavClick(item.path)}
              >
                {item.label}
              </button>
            ) : null
          )}
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
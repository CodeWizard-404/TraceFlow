import { useState } from "react";
import { To, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import { FaSun, FaMoon, FaSignOutAlt, FaGlobe } from "react-icons/fa";
import "./CMP.css";

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, userRoles, effectivePermissions, permissionsLoaded, logout } =
    useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const PERMISSIONS = {
    ACCESS_SUPERVISOR_TIMESHEETS: import.meta.env
      .VITE_PERMISSIONS_ACCESS_SUPERVISOR_TIMESHEETS,
    ACCESS_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOKS,
  };

  const ROLES = {
    ADMIN: import.meta.env.VITE_ROLES_ADMIN,
    SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
  };

  const hasPermission = (permission: string) =>
    permissionsLoaded &&
    effectivePermissions?.some((p) => p.name === permission);
  const hasRole = (role: string) =>
    permissionsLoaded && userRoles?.some((r) => r.name === role);

  const navItems = [
    {
      path: "/dashboard",
      label: t("navbar_dashboard"),
      visible: () => true,
    },
    {
      path: "/admin",
      label: t("navbar_admin"),
      visible: () => hasRole(ROLES.ADMIN) || hasRole(ROLES.SUPER_ADMIN),
    },
    {
      path: "/timesheet",
      label: t("navbar_timesheets"),
      visible: () => hasPermission(PERMISSIONS.ACCESS_SUPERVISOR_TIMESHEETS),
    },
    {
      path: "/receipt-books",
      label: t("navbar_receipt_books"),
      visible: () => hasPermission(PERMISSIONS.ACCESS_RECEIPT_BOOKS),
    },
    {
      path: "/profile",
      label: t("navbar_profile"),
      visible: () => true,
    },
  ];

  const handleNavClick = (path: To) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  return (
    <header className={`header ${theme === "dark" ? "dark" : ""}`}>
      <div className="header-container">
        <img
          className="logo"
          src={
            theme === "dark"
              ? "../../public/Banner-wd.png"
              : "../../public/Banner-bl.png"
          }
          alt={t("logo_alt")}
          onClick={() => navigate("/")}
        />
        <button
          className="menu-toggle"
          onClick={toggleMenu}
          aria-label={t("toggle_menu")}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? "✕" : "☰"}
        </button>
        <nav className={`header-nav ${isMenuOpen ? "open" : ""}`}>
          {permissionsLoaded &&
            user &&
            navItems.map((item) =>
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
                aria-label={t("toggle_theme", {
                  mode: theme === "light" ? "dark" : "light",
                })}
              >
                {theme === "light" ? <FaMoon /> : <FaSun />}
                <span className="btn-text">{t("theme")}</span>
              </button>
            </div>
            <div className="icon-btn-wrapper">
              <div className="lang-switcher-container">
                <span className="lang-icon">
                  <FaGlobe />
                </span>
                <select
                  className="lang-switcher"
                  value={i18n.language}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                  aria-label={t("select_language")}
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              </div>
            </div>
            {user && (
              <div className="icon-btn-wrapper">
                <button
                  className="logout-btn"
                  onClick={handleLogout}
                  aria-label={t("logout")}
                >
                  <FaSignOutAlt />
                  <span className="btn-text">{t("logout")}</span>
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

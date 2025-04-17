import { useState } from "react";
import { To, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import {
  FaSun,
  FaMoon,
  FaSignOutAlt,
  FaGlobe,
  FaBars,
  FaTimes,
} from "react-icons/fa";
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
      label: t("header.navbar.dashboard"),
      visible: () => true,
    },
    {
      path: "/admin",
      label: t("header.navbar.admin"),
      visible: () => hasRole(ROLES.ADMIN) || hasRole(ROLES.SUPER_ADMIN),
    },
    {
      path: "/timesheet",
      label: t("header.navbar.timesheets"),
      visible: () => hasPermission(PERMISSIONS.ACCESS_SUPERVISOR_TIMESHEETS),
    },
    {
      path: "/receipt-books",
      label: t("header.navbar.receiptBooks"),
      visible: () => hasPermission(PERMISSIONS.ACCESS_RECEIPT_BOOKS),
    },
    {
      path: "/profile",
      label: t("header.navbar.profile"),
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
          src={theme === "dark" ? "/Banner-wd.png" : "/Banner-bl.png"}
          alt={t("header.logoAlt")}
          onClick={() => navigate("/")}
        />
        <button
          className="menu-toggle"
          onClick={toggleMenu}
          aria-label={t("header.aria.menuToggle")}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <FaTimes /> : <FaBars />}
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
                  aria-label={t("header.aria.navLink", { label: item.label })}
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
                aria-label={t("header.aria.themeToggle", {
                  mode: t(
                    `header.${theme === "light" ? "darkMode" : "lightMode"}`
                  ),
                })}
              >
                {theme === "light" ? <FaMoon /> : <FaSun />}
                <span className="btn-text">{t("header.theme")}</span>
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
                  aria-label={t("header.selectLanguage")}
                >
                  <option value="en">English</option>
                  <option value="fr">Francais</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
            </div>
            {user && (
              <div className="icon-btn-wrapper">
                <button
                  className="logout-btn"
                  onClick={handleLogout}
                  aria-label={t("header.aria.logout")}
                >
                  <FaSignOutAlt />
                  <span className="btn-text">{t("header.logout")}</span>
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

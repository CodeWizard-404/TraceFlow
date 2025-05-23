import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useTranslation } from 'react-i18next';
import {
  FaSun,
  FaMoon,
  FaSignOutAlt,
  FaGlobe,
  FaBars,
  FaTimes,
  FaBell,
} from 'react-icons/fa';
import NotificationPanel from './ui/notificationPanel';
import { motion } from 'framer-motion';
import './CMP.css';

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, userRoles, effectivePermissions, permissionsLoaded, logout } = useAuth();
  const { unreadCount } = useNotification();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const PERMISSIONS = {
    ACCESS_SUPERVISOR_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_ACCESS_SUPERVISOR_TIMESHEETS,
    ACCESS_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOKS,
    ACCESS_RECEIPT_BOOKS_BY_HOLDER: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOKS_BY_HOLDER,
  };

  const ROLES = {
    ADMIN: import.meta.env.VITE_ROLES_ADMIN,
    SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
  };

  const hasPermission = (permission: string) =>
    permissionsLoaded && effectivePermissions?.some((p) => p.name === permission);
  const hasRole = (role: string) =>
    permissionsLoaded && userRoles?.some((r) => r.name === role);

  const navItems = [
    { path: "/dashboard", label: t("header.navbar.dashboard"), visible: () => true },
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
      visible: () =>
        hasPermission(PERMISSIONS.ACCESS_RECEIPT_BOOKS) || hasPermission(PERMISSIONS.ACCESS_RECEIPT_BOOKS_BY_HOLDER),
    },
    { path: "/profile", label: t("header.navbar.profile"), visible: () => true },
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
    setIsMenuOpen(false);
    setShowNotificationPanel(false);
  };

  // Close menu on outside click in mobile view
  useEffect(() => {
    const handleClickOutside = (event: { target: any; }) => {
      if (isMenuOpen && menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setShowNotificationPanel(false);
  }, [location]);

  return (
    <header className={`header ${theme === "dark" ? "dark" : ""}`}>
      <div className="header-container">
        <img
          className="logo"
          src={theme === "dark" ? "/Banner-wd.png" : "/Banner-bl.png"}
          alt={t("header.logoAlt")}
        />
        <div className="mobile-buttons">
          <motion.button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={t("header.aria.themeToggle", {
              mode: t(`header.${theme === "light" ? "darkMode" : "lightMode"}`),
            })}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {theme === "light" ? <FaMoon /> : <FaSun />}
            <span className="btn-text">{t("header.theme")}</span>
          </motion.button>
          {user && (
            <motion.button
              className="notification-btn"
              onClick={() => setShowNotificationPanel((prev) => !prev)}
              aria-label={t("header.aria.notifications", { count: unreadCount })}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FaBell />
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount}</span>
              )}
              <span className="btn-text">{t("header.notifications")}</span>
            </motion.button>
          )}
        </div>
        <button
          className="menu-toggle"
          onClick={toggleMenu}
          aria-label={t("header.aria.menuToggle")}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
        <nav className={`header-nav ${isMenuOpen ? "open" : ""}`} ref={menuRef}>
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
            <div className="icon-btn-wrapper desktop-only">
              <motion.button
                className="theme-toggle-btn"
                onClick={toggleTheme}
                aria-label={t("header.aria.themeToggle", {
                  mode: t(`header.${theme === "light" ? "darkMode" : "lightMode"}`),
                })}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {theme === "light" ? <FaMoon /> : <FaSun />}
                <span className="btn-text">{t("header.theme")}</span>
              </motion.button>
            </div>
            <div className="icon-btn-wrapper">
              <motion.button
                className="lang-toggle-btn"
                aria-label={t("header.aria.selectLanguage")}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FaGlobe />
                <span className="lang-options">
                  <span
                    className={`lang-option ${i18n.language === "en" ? "selected" : ""}`}
                    onClick={() => handleLanguageChange("en")}
                  >
                    EN
                  </span>
                  <span className="lang-separator">|</span>
                  <span
                    className={`lang-option ${i18n.language === "fr" ? "selected" : ""}`}
                    onClick={() => handleLanguageChange("fr")}
                  >
                    FR
                  </span>
                  <span className="lang-separator">|</span>
                  <span
                    className={`lang-option ${i18n.language === "ar" ? "selected" : ""}`}
                    onClick={() => handleLanguageChange("ar")}
                  >
                    AR
                  </span>
                </span>
              </motion.button>
            </div>
            {user && (
              <>
                <div className="icon-btn-wrapper desktop-only">
                  <motion.button
                    className="notification-btn"
                    onClick={() => setShowNotificationPanel((prev) => !prev)}
                    aria-label={t("header.aria.notifications", { count: unreadCount })}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FaBell />
                    {unreadCount > 0 && (
                      <span className="notification-badge">{unreadCount}</span>
                    )}
                    <span className="btn-text">{t("header.notifications")}</span>
                  </motion.button>
                </div>
                <div className="icon-btn-wrapper">
                  <motion.button
                    className="logout-btn"
                    onClick={handleLogout}
                    aria-label={t("header.aria.logout")}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FaSignOutAlt />
                    <span className="btn-text">{t("header.logout")}</span>
                  </motion.button>
                </div>
              </>
            )}
          </div>
        </nav>
        {showNotificationPanel && user && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="notification-panel-container"
          >
            <NotificationPanel
              className="notification-panel"
              onClose={() => setShowNotificationPanel(false)}
            />
          </motion.div>
        )}
      </div>
    </header>
  );
}

export default Header;
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useProfile } from '../pages/Auth/Profile/useProfile';
import { useTranslation } from 'react-i18next';
import {
  FaSun,
  FaMoon,
  FaSignOutAlt,
  FaGlobe,
  FaBars,
  FaTimes,
  FaBell,
  FaUser,
} from 'react-icons/fa';
import NotificationPanel from './ui/notificationPanel';
import { motion } from 'framer-motion';
import './CMP.css';

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, userRoles, effectivePermissions, permissionsLoaded, logout } = useAuth();
  const { profileData, profilePic } = useProfile();
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

  const handleProfileClick = () => {
    navigate('/profile');
    setShowProfilePanel(false);
    setShowNotificationPanel(false);
    setIsMenuOpen(false);
  };

  const PERMISSIONS = {
    ACCESS_SUPERVISOR_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_ACCESS_SUPERVISOR_TIMESHEETS,
    ACCESS_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOKS,
    ACCESS_RECEIPT_BOOKS_BY_HOLDER: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOKS_BY_HOLDER,
    GENERATE_REPORT: import.meta.env.VITE_PERMISSIONS_GENERATE_REPORT,
  };

  const ROLES = {
    REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
    PURCHASE_TEAM: import.meta.env.VITE_ROLES_PURCHASE_TEAM,
    SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
    DIRECTOR: import.meta.env.VITE_ROLES_DIRECTOR,
    SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
    ADMIN: import.meta.env.VITE_ROLES_ADMIN,
    STOCK_MANAGER: import.meta.env.VITE_ROLES_STOCK_MANAGER,
    HR: import.meta.env.VITE_ROLES_HR,
  };

  const hasPermission = (permission: string) =>
    permissionsLoaded && effectivePermissions?.some((p) => p.name === permission);
  const hasRole = (role: string) =>
    permissionsLoaded && userRoles?.some((r) => r.name === role);

  const roleDashboards = [
    { role: ROLES.REGIONAL_MANAGER, path: '/regional-dashboard', label: t('header.navbar.regionalDashboard') },
    { role: ROLES.PURCHASE_TEAM, path: '/stock-dashboard', label: t('header.navbar.purchaseDashboard') },
    { role: ROLES.DIRECTOR, path: '/director-dashboard', label: t('header.navbar.directorDashboard') },
    { role: ROLES.SUPERVISOR, path: '/supervisor-dashboard', label: t('header.navbar.supervisorDashboard') },
    { role: ROLES.ADMIN, path: '/admin-dashboard', label: t('header.navbar.adminDashboard') },
    { role: ROLES.STOCK_MANAGER, path: '/stock-dashboard', label: t('header.navbar.stockDashboard') },
    { role: ROLES.HR, path: '/hr-dashboard', label: t('header.navbar.hrDashboard') },
  ];

  const dashboardNavItems = permissionsLoaded && userRoles
    ? [
      ...userRoles
        .map((role) => roleDashboards.find((d) => d.role === role.name))
        .filter((item): item is NonNullable<typeof roleDashboards[0]> => !!item)
        .map((item) => ({
          path: item.path,
          label: item.label,
          visible: () => hasRole(item.role),
        })),
      ...(hasRole(ROLES.SUPER_ADMIN)
        ? [
          {
            path: '/admin-dashboard',
            label: t('header.navbar.adminDashboard'),
            visible: () => hasRole(ROLES.SUPER_ADMIN),
          },
          {
            path: '/hr-dashboard',
            label: t('header.navbar.hrDashboard'),
            visible: () => hasRole(ROLES.SUPER_ADMIN),
          },
        ]
        : []),
    ]
    : [{ path: '/dashboard', label: t('header.navbar.dashboard'), visible: () => true }];

  const navItems = [
    ...dashboardNavItems,
    {
      path: '/admin',
      label: t('header.navbar.admin'),
      visible: () => hasRole(ROLES.ADMIN) || hasRole(ROLES.SUPER_ADMIN),
    },
    {
      path: '/agents',
      label: t('header.navbar.agents'),
      visible: () => true,
    },
    {
      path: '/timesheet',
      label: t('header.navbar.timesheets'),
      visible: () => hasPermission(PERMISSIONS.ACCESS_SUPERVISOR_TIMESHEETS),
    },
    {
      path: '/receipt-books',
      label: t('header.navbar.receiptBooks'),
      visible: () =>
        hasPermission(PERMISSIONS.ACCESS_RECEIPT_BOOKS) || hasPermission(PERMISSIONS.ACCESS_RECEIPT_BOOKS_BY_HOLDER),
    },
    {
      path: '/reports',
      label: t('header.navbar.reports'),
      visible: () => hasPermission(PERMISSIONS.GENERATE_REPORT),
    },
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
    setIsMenuOpen(false);
    setShowNotificationPanel(false);
    setShowProfilePanel(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMenuOpen && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (showProfilePanel && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfilePanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen, showProfilePanel]);

  useEffect(() => {
    setIsMenuOpen(false);
    setShowNotificationPanel(false);
    setShowProfilePanel(false);
  }, [location]);

  return (
    <header className={`header ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="header-container">
        <img
          className="logo"
          src={theme === 'dark' ? '/Banner-wd.png' : '/Banner-bl.png'}
          alt={t('header.logoAlt')}
        />
        <div className="mobile-buttons">
          <motion.button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={t('header.aria.themeToggle', {
              mode: t(`header.${theme === 'light' ? 'darkMode' : 'lightMode'}`),
            })}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {theme === 'light' ? <FaMoon /> : <FaSun />}
            <span className="btn-text">{t('header.theme')}</span>
          </motion.button>
          {user && (
            <>
              <motion.button
                className="notification-btn"
                onClick={() => setShowNotificationPanel((prev) => !prev)}
                aria-label={t('header.aria.notifications', { count: unreadCount })}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FaBell />
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount}</span>
                )}
                <span className="btn-text">{t('header.notifications')}</span>
              </motion.button>
              <motion.button
                className="profile-btn"
                onClick={handleProfileClick}
                onMouseEnter={() => setShowProfilePanel(true)}
                onMouseLeave={() => setShowProfilePanel(false)}
                aria-label={t('header.aria.profile')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FaUser />
                <span className="btn-text">{t('header.profile')}</span>
              </motion.button>
            </>
          )}
        </div>
        <button
          className="menu-toggle"
          onClick={toggleMenu}
          aria-label={t('header.aria.menuToggle')}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
        <nav className={`header-nav ${isMenuOpen ? 'open' : ''}`} ref={menuRef}>
          {permissionsLoaded &&
            user &&
            navItems.map((item) =>
              item.visible() ? (
                <button
                  key={item.path}
                  className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.path)}
                  aria-label={t('header.aria.navLink', { label: item.label })}
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
                aria-label={t('header.aria.themeToggle', {
                  mode: t(`header.${theme === 'light' ? 'darkMode' : 'lightMode'}`),
                })}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {theme === 'light' ? <FaMoon /> : <FaSun />}
                <span className="btn-text">{t('header.theme')}</span>
              </motion.button>
            </div>
            <div className="icon-btn-wrapper">
              <motion.button
                className="lang-toggle-btn"
                aria-label={t('header.aria.selectLanguage')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <FaGlobe />
                <span className="lang-options">
                  <span
                    className={`lang-option ${i18n.language === 'en' ? 'selected' : ''}`}
                    onClick={() => handleLanguageChange('en')}
                  >
                    EN
                  </span>
                  <span className="lang-separator">|</span>
                  <span
                    className={`lang-option ${i18n.language === 'fr' ? 'selected' : ''}`}
                    onClick={() => handleLanguageChange('fr')}
                  >
                    FR
                  </span>
                  <span className="lang-separator">|</span>
                  <span
                    className={`lang-option ${i18n.language === 'ar' ? 'selected' : ''}`}
                    onClick={() => handleLanguageChange('ar')}
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
                    aria-label={t('header.aria.notifications', { count: unreadCount })}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FaBell />
                    {unreadCount > 0 && (
                      <span className="notification-badge">{unreadCount}</span>
                    )}
                    <span className="btn-text">{t('header.notifications')}</span>
                  </motion.button>
                </div>
                <div className="icon-btn-wrapper">
                  <motion.button
                    className="logout-btn"
                    onClick={handleLogout}
                    aria-label={t('header.aria.logout')}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FaSignOutAlt />
                    <span className="btn-text">{t('header.logout')}</span>
                  </motion.button>
                </div>
                <div className="icon-btn-wrapper desktop-only">
                  <motion.button
                    className="profile-btn"
                    onClick={handleProfileClick}
                    onMouseEnter={() => setShowProfilePanel(true)}
                    onMouseLeave={() => setShowProfilePanel(false)}
                    aria-label={t('header.aria.profile')}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FaUser />
                    <span className="btn-text">{t('header.profile')}</span>
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
        {showProfilePanel && user && profileData && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="profile-panel-container"
          >
            <div className="profile-panel">
              <div className="profile-panel-content">
                <div className="profile-panel-header">
                  <div className="profile-panel-pic-container">
                    {profilePic ? (
                      <img
                        src={profilePic}
                        alt={`${profileData.firstname} ${profileData.lastname}'s profile picture`}
                        className="profile-panel-pic"
                      />
                    ) : (
                      <FaUser className="profile-panel-pic-placeholder" />
                    )}
                  </div>
                  <div className="profile-panel-info">
                    <h3>
                      {profileData.firstname !== 'Not set' ? profileData.firstname : 'First Name Not Set'}{' '}
                      {profileData.lastname !== 'Not set' ? profileData.lastname : 'Last Name Not Set'}
                    </h3>
                    <div className="profile-panel-roles">
                      {userRoles && userRoles.length > 0 ? (
                        userRoles.map((role) => (
                          <span key={role.roleID} className="profile-panel-role">
                            {role.name}
                          </span>
                        ))
                      ) : (
                        <span>No roles assigned</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </header>
  );
}

export default Header;
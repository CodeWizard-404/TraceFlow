import React, { JSX, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import AuthProvider, { useAuth } from './context/AuthContext';
import { ErrorProvider, useError } from './context/ErrorContext';
import { useNotification } from './context/NotificationContext';
import Footer from './components/Footer';
import Header from './components/Header';
import ErrorManager from './components/ErrorManager';
import ToastContainer from './components/ui/ToastContainer';
import AccessDenied from './pages/Error/AccessDenied';
import './App.css';
import LoginPage from './pages/Auth/Login';
import ProfilePage from './pages/Auth/Profile/ProfilePage';
import AgentManagement from './pages/Dashboard/AgentManagement';
import Reports from './pages/Admin/Reports';

// Lazy load route components
const Timesheets = React.lazy(() => import('./pages/Timesheet/Timesheets'));
const TimesheetForm = React.lazy(() => import('./pages/Timesheet/TimesheetForm'));
const QRScan = React.lazy(() => import('./pages/visit/QRScan'));
const VisitDetailsView = React.lazy(() => import('./pages/visit/VisitView'));
const VisitValidation = React.lazy(() => import('./pages/visit/VisitValidation'));
const VisitEdit = React.lazy(() => import('./pages/visit/VisitEdit'));
const PageNotFound = React.lazy(() => import('./pages/Error/PageNotFound'));
const AdminDashboard = React.lazy(() => import('./pages/Admin/AdminDashboard'));
const ReceiptBooks = React.lazy(() => import('./pages/Receipt/ReceiptBooks'));
const TransferReceiptBook = React.lazy(() => import('./pages/Receipt/TransferReceiptBook'));
const ReceiptBookHistory = React.lazy(() => import('./pages/Receipt/ReceiptBookHistory'));
const Dashboard = React.lazy(() => import('./pages/Dashboard/Dashboard'));

// Static permissions and roles from .env
const PERMISSIONS = {
  ACCESS_SUPERVISOR_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_ACCESS_SUPERVISOR_TIMESHEETS,
  CREATE_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS,
  CREATE_SUPERVISOR_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS_FOR_SUPERVISOR,
  SCAN_VISITS: import.meta.env.VITE_PERMISSIONS_SCAN_VISITS,
  ACCESS_VISIT_DETAILS: import.meta.env.VITE_PERMISSIONS_ACCESS_VISIT_DETAILS,
  LOG_VISITS: import.meta.env.VITE_PERMISSIONS_LOG_VISITS,
  ACCESS_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOKS,
  ACCESS_RECEIPT_BOOK_HISTORY: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOK_HISTORY,
  TRANSFER_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_TRANSFER_RECEIPT_BOOKS,
  ACCESS_RECEIPT_BOOKS_BY_HOLDER: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOKS_BY_HOLDER,
  EDIT_VISIT_DETAILS: import.meta.env.VITE_PERMISSIONS_EDIT_VISIT,
  ACCESS_AGENTS_MAP: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_LOCATIONS,
  GENERATE_REPORT: import.meta.env.VITE_PERMISSIONS_GENERATE_REPORT,
  SCHEDULE_REPORT: import.meta.env.VITE_PERMISSIONS_SCHEDULE_REPORT,
  DOWNLOAD_REPORT: import.meta.env.VITE_PERMISSIONS_DOWNLOAD_REPORT,
};

const ROLES = {
  ADMIN: import.meta.env.VITE_ROLES_ADMIN,
  SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
};

// Permission-based ProtectedRoute component
interface ProtectedRouteProps {
  children: JSX.Element;
  requiredPermissions?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = React.memo(({ children, requiredPermissions = [] }) => {
  const { user, effectivePermissions, permissionsLoaded } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
  }

  if (!permissionsLoaded) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading permissions...</p>
      </div>
    );
  }

  if (requiredPermissions.length === 0) {
    return children;
  }

  const hasPermission = requiredPermissions.some((perm) =>
    effectivePermissions?.some((p) => p.name === perm)
  );
  return hasPermission ? children : <Navigate to="/access-denied" replace />;
});

// Role-based ProtectedRoute component
interface RoleProtectedRouteProps {
  children: JSX.Element;
  requiredRoles: string[];
}

const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = React.memo(({ children, requiredRoles }) => {
  const { user, userRoles, permissionsLoaded } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
  }

  if (!permissionsLoaded || !userRoles) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  const hasRequiredRole = userRoles.some((role) => requiredRoles.includes(role.name));
  return hasRequiredRole ? children : <Navigate to="/access-denied" replace />;
});

// Main content with routing
const AppContent: React.FC = React.memo(() => {
  const { theme } = useTheme();
  const location = useLocation();
  const { user, permissionsLoaded } = useAuth();
  const { setError } = useError();
  const { toasts, removeToast } = useNotification();
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './src/components/Google/Map.css';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, [location.pathname]);

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  // Timeout for loading screen
  useEffect(() => {
    if (user && !permissionsLoaded) {
      const timeout = setTimeout(() => {
        setLoadingTimeout(true);
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [user, permissionsLoaded]);

  // Listen for API errors from axios interceptors
  useEffect(() => {
    const handleApiError = (event: Event) => {
      const customEvent = event as CustomEvent<{ error: unknown; url: string }>;
      setError(customEvent.detail.error, true); // Persist errors
    };

    window.addEventListener('apiError', handleApiError);
    return () => {
      window.removeEventListener('apiError', handleApiError);
    };
  }, [setError]);

  if (user && !permissionsLoaded) {
    if (loadingTimeout) {
      return <Navigate to="/login" replace state={{ error: 'Failed to load application. Please log in again.' }} />;
    }
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading application...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
      <Header />
      <main>
        {location.pathname !== '/login' && <ErrorManager />}
        {location.state?.error && (
          <div className="error-message" style={{ textAlign: 'center', margin: '10px 0', color: '#ff4444' }}>
            {location.state.error}
          </div>
        )}
        <Suspense fallback={<div className="loading-container"><div className="spinner"></div><p>Loading...</p></div>}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/access-denied" element={<AccessDenied />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/agents" element={
              <ProtectedRoute requiredPermissions={[PERMISSIONS.ACCESS_AGENTS_MAP]}>
                <AgentManagement />
              </ProtectedRoute>
            }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <RoleProtectedRoute requiredRoles={[ROLES.ADMIN, ROLES.SUPER_ADMIN]}>
                  <AdminDashboard />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="/timesheet"
              element={
                <ProtectedRoute requiredPermissions={[PERMISSIONS.ACCESS_SUPERVISOR_TIMESHEETS]}>
                  <Timesheets />
                </ProtectedRoute>
              }
            />
            <Route
              path="/timesheet-form"
              element={
                <ProtectedRoute requiredPermissions={[PERMISSIONS.CREATE_TIMESHEETS, PERMISSIONS.CREATE_SUPERVISOR_TIMESHEETS]}>
                  <TimesheetForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/qr-scan"
              element={
                <ProtectedRoute requiredPermissions={[PERMISSIONS.SCAN_VISITS]}>
                  <QRScan />
                </ProtectedRoute>
              }
            />
            <Route
              path="/visit/:idVisit"
              element={
                <ProtectedRoute requiredPermissions={[PERMISSIONS.ACCESS_VISIT_DETAILS]}>
                  <VisitDetailsView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/visit/edit/:idVisit"
              element={
                <ProtectedRoute requiredPermissions={[PERMISSIONS.EDIT_VISIT_DETAILS]}>
                  <VisitEdit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/visit/:idVisit/validate-checklist"
              element={
                <ProtectedRoute requiredPermissions={[PERMISSIONS.LOG_VISITS]}>
                  <VisitValidation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/receipt-books"
              element={
                <ProtectedRoute requiredPermissions={[PERMISSIONS.ACCESS_RECEIPT_BOOKS, PERMISSIONS.ACCESS_RECEIPT_BOOKS_BY_HOLDER]}>
                  <ReceiptBooks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/receipt-book/:bookID/history"
              element={
                <ProtectedRoute requiredPermissions={[PERMISSIONS.ACCESS_RECEIPT_BOOK_HISTORY]}>
                  <ReceiptBookHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transfer-receipt-books"
              element={
                <ProtectedRoute requiredPermissions={[PERMISSIONS.TRANSFER_RECEIPT_BOOKS]}>
                  <TransferReceiptBook />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute requiredPermissions={['generate_report']}>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/logout"
              element={<Navigate to="/login" replace state={{ logout: true }} />}
            />
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
});

// Main App with providers
const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ErrorProvider>
          <AppContent />
        </ErrorProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;

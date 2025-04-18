import React, { JSX, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { useAuth } from "./context/AuthContext";
import AuthProvider from "./context/AuthContext";
import { ErrorProvider } from "./context/ErrorContext";
import Timesheets from "./pages/Timesheet/Timesheets";
import TimesheetForm from "./pages/Timesheet/TimesheetForm";
import QRScan from "./pages/visit/QRScan";
import VisitDetails from "./pages/visit/VisitDetails";
import VisitValidation from "./pages/visit/VisitValidation";
import PageNotFound from "./pages/Error/PageNotFound";
import Footer from "./components/Footer";
import Header from "./components/Header";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import ReceiptBooks from "./pages/Receipt/ReceiptBooks";
import TransferReceiptBook from "./pages/Receipt/TransferReceiptBook";
import ReceiptBookHistory from "./pages/Receipt/ReceiptBookHistory";
import ErrorDisplay from "./pages/Error/ErrorDisplay";
import AccessDenied from "./pages/Error/AccessDenied";
import "./App.css";
import LoginPage from "./pages/Auth/Login";
import ProfilePage from "./pages/Auth/ProfilePage";
//import AuthCallback from "./components/AuthCallback";

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
};

const ROLES = {
  ADMIN: import.meta.env.VITE_ROLES_ADMIN,
  SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
};

// Permission-based ProtectedRoute component
interface ProtectedRouteProps {
  children: JSX.Element;
  requiredPermissions: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermissions,
}) => {
  const { user, effectivePermissions, permissionsLoaded } = useAuth();
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: window.location.pathname }}
      />
    );
  }
  if (!permissionsLoaded) {
    return (
      <div className="permissions-loading">
        <div className="spinner"></div>
        <div>Loading permissions...</div>
      </div>
    );
  }
  const hasPermission = requiredPermissions.some((perm) =>
    effectivePermissions?.some((p) => p.name === perm)
  );
  return hasPermission ? children : <Navigate to="/access-denied" replace />;
};

// Role-based ProtectedRoute component
interface RoleProtectedRouteProps {
  children: JSX.Element;
  requiredRoles: string[];
}

const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({
  children,
  requiredRoles,
}) => {
  const { user, userRoles, permissionsLoaded } = useAuth();
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: window.location.pathname }}
      />
    );
  }
  if (!permissionsLoaded || !userRoles) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  const hasRequiredRole = userRoles.some((role) =>
    requiredRoles.includes(role.name)
  );
  return hasRequiredRole ? children : <Navigate to="/access-denied" replace />;
};

// Main content with routing
const AppContent: React.FC = () => {
  const { theme } = useTheme();
  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  return (
    <div className="app-container">
      <Header />
      <main>
        {location.pathname !== "/login" && <ErrorDisplay />}
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/access-denied" element={<AccessDenied />} />
          {/* <Route path="/api/auth/callback" element={<AuthCallback />} /> */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route
            path="/admin"
            element={
              <RoleProtectedRoute
                requiredRoles={[ROLES.ADMIN, ROLES.SUPER_ADMIN]}
              >
                <AdminDashboard />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="/timesheet"
            element={
              <ProtectedRoute
                requiredPermissions={[PERMISSIONS.ACCESS_SUPERVISOR_TIMESHEETS]}
              >
                <Timesheets />
              </ProtectedRoute>
            }
          />
          <Route
            path="/timesheet-form"
            element={
              <ProtectedRoute
                requiredPermissions={[PERMISSIONS.CREATE_TIMESHEETS, PERMISSIONS.CREATE_SUPERVISOR_TIMESHEETS]}
              >
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
              <ProtectedRoute
                requiredPermissions={[PERMISSIONS.ACCESS_VISIT_DETAILS]}
              >
                <VisitDetails />
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
              <ProtectedRoute
                requiredPermissions={[PERMISSIONS.ACCESS_RECEIPT_BOOKS]}
              >
                <ReceiptBooks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/receipt-book/:bookID/history"
            element={
              <ProtectedRoute
                requiredPermissions={[PERMISSIONS.ACCESS_RECEIPT_BOOK_HISTORY]}
              >
                <ReceiptBookHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transfer-receipt-books"
            element={
              <ProtectedRoute
                requiredPermissions={[PERMISSIONS.TRANSFER_RECEIPT_BOOKS]}
              >
                <TransferReceiptBook />
              </ProtectedRoute>
            }
          />
          <Route path="/logout" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

// Main App with providers
const App: React.FC = () => (
  <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <ThemeProvider>
      <AuthProvider>
        <ErrorProvider>
          <AppContent />
        </ErrorProvider>
      </AuthProvider>
    </ThemeProvider>
  </Router>
);

export default App;
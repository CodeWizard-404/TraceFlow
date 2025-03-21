import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ErrorProvider } from "./context/ErrorContext";
import Timesheets from "./pages/timesheet/Timesheets";
import TimesheetForm from "./pages/timesheet/TimesheetForm";
import QRScan from "./pages/visit/QRScan";
import VisitDetails from "./pages/visit/VisitDetails";
import VisitValidation from "./pages/visit/VisitValidation";
import PageNotFound from "./pages/PageNotFound";
import VisitValidationDetail from "./pages/timesheet/TimesheetValidationDetail";
import Footer from "./components/Footer";
import Header from "./components/Header";
import TimesheetValidation from "./pages/timesheet/TimesheetValidation";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import LoginPage from "./pages/auth/Login";
import "./App.css";
import ErrorDisplay from "./pages/ErrorDisplay";
import AccessDenied from "./pages/AccessDenied";

// ProtectedRoute component
interface ProtectedRouteProps {
    children: JSX.Element;
    requiredPermissions: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredPermissions }) => {
    const { user, token, effectivePermissions, permissionsLoaded } = useAuth();

    if (!user || !token) {
        return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
    }

    if (!permissionsLoaded) {
        return <div>Loading permissions...</div>; // Wait for permissions to load
    }

    const hasPermission = requiredPermissions.some((perm) =>
        effectivePermissions?.some((p) => p.name === perm)
    );

    return hasPermission ? children : <Navigate to="/access-denied" replace />;
};

// AppContent component
const AppContent: React.FC = () => {
    const { theme } = useTheme();

    useEffect(() => {
        document.body.className = theme;
    }, [theme]);

    return (
        <div className="app-container">
            <Header />
            <main>
                <ErrorDisplay />
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/access-denied" element={<AccessDenied />} />
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute requiredPermissions={["create_users"]}>
                                <AdminDashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/timesheet"
                        element={
                            <ProtectedRoute requiredPermissions={["access_timesheets"]}>
                                <Timesheets />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/timesheet-form"
                        element={
                            <ProtectedRoute requiredPermissions={["create_timesheets"]}>
                                <TimesheetForm />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/timesheet-validation"
                        element={
                            <ProtectedRoute requiredPermissions={["validate_timesheets"]}>
                                <TimesheetValidation />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/timesheet-validation/visit/:visitId"
                        element={
                            <ProtectedRoute requiredPermissions={["validate_timesheets"]}>
                                <VisitValidationDetail />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/qr-scan"
                        element={
                            <ProtectedRoute requiredPermissions={["log_visits"]}>
                                <QRScan />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/visit/:idVisit"
                        element={
                            <ProtectedRoute requiredPermissions={["access_visit_details"]}>
                                <VisitDetails />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/visit/:idVisit/validate-checklist"
                        element={
                            <ProtectedRoute requiredPermissions={["validate_visits"]}>
                                <VisitValidation />
                            </ProtectedRoute>
                        }
                    />
                    <Route path="*" element={<PageNotFound />} />
                </Routes>
            </main>
            <Footer />
        </div>
    );
};

// Main App component
const App: React.FC = () => {
    return (
        <Router>
            <ThemeProvider>
                <AuthProvider>
                    <ErrorProvider>
                        <AppContent />
                    </ErrorProvider>
                </AuthProvider>
            </ThemeProvider>
        </Router>
    );
};

export default App;
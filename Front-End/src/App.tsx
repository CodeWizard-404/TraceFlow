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
import PageNotFound from "./pages/Error/PageNotFound";
import Footer from "./components/Footer";
import Header from "./components/Header";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import LoginPage from "./pages/Auth/Login";
import "./App.css";
import ErrorDisplay from "./pages/Error/ErrorDisplay";
import AccessDenied from "./pages/Error/AccessDenied";
import ReceiptBooks from "./pages/Reciept/ReceiptBooks";

import TransferReceiptBook from "./pages/Reciept/TransferReceiptBook";
import StubCollection from "./pages/Reciept/StubCollection";
import ArchivedReceiptBooks from "./pages/Reciept/ArchivedReceiptBooks";


// Permission-based ProtectedRoute component
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
        return <div>Loading permissions...</div>;
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

const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({ children, requiredRoles }) => {
    const { user, token, userRoles, permissionsLoaded } = useAuth();

    if (!user || !token) {
        return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
    }

    if (!permissionsLoaded || !userRoles) {
        return <div>Loading permissions...</div>;
    }

    const hasRequiredRole = userRoles.some((role) => 
        requiredRoles.includes(role.name)
    );

    return hasRequiredRole ? children : <Navigate to="/access-denied" replace />;
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
                            <RoleProtectedRoute requiredRoles={["Admin", "Super Admin"]}>
                                <AdminDashboard />
                            </RoleProtectedRoute>
                        }
                    />
                    <Route
                        path="/timesheet"
                        element={
                            <ProtectedRoute requiredPermissions={["access_Supervisor_timesheets"]}>
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
                        path="/qr-scan"
                        element={
                            <ProtectedRoute requiredPermissions={["scan_visits"]}>
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
                            <ProtectedRoute requiredPermissions={["log_visits"]}>
                                <VisitValidation />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/receipt-books"
                        element={
                            <ProtectedRoute requiredPermissions={["access_receipt_books"]}>
                                <ReceiptBooks />
                            </ProtectedRoute>
                        }
                        />


                    <Route
                        path="/receipt-book/:bookID/transfer"
                        element={
                            <ProtectedRoute requiredPermissions={["transfer_receipt_books"]}>
                                <TransferReceiptBook />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                    path="/receipt-book/:bookID/stub-collection"
                    element={
                        <ProtectedRoute requiredPermissions={["collect_receipt_stubs"]}>
                        <StubCollection />
                        </ProtectedRoute>
                    }
                    />
                    <Route
                    path="/receipt-books/archived"
                    element={
                        <ProtectedRoute requiredPermissions={["archive_receipt_stubs"]}>
                        <ArchivedReceiptBooks />
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
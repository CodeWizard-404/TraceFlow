import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider, useTheme } from "../Front-End/src/context/ThemeContext";
import { AuthProvider, useAuth } from "../Front-End/src/context/AuthContext";
import Timesheets from "../Front-End/src/pages/timesheet/Timesheets";
import TimesheetForm from "../Front-End/src/pages/timesheet/TimesheetForm";
import QRScan from "../Front-End/src/pages/visit/QRScan";
import VisitDetails from "../Front-End/src/pages/visit/VisitDetails";
import VisitValidation from "../Front-End/src/pages/visit/VisitValidation";
import PageNotFound from "../Front-End/src/pages/PageNotFound";
import VisitValidationDetail from "../Front-End/src/pages/timesheet/TimesheetValidationDetail";
import Footer from "../Front-End/src/components/Footer";
import Header from "../Front-End/src/components/Header";
import TimesheetValidation from "../Front-End/src/pages/timesheet/TimesheetValidation";
import AdminDashboard from "../Front-End/src/pages/Admin/AdminDashboard";
import LoginPage from "../Front-End/src/pages/auth/Login";
import "./App.css";

// Callback component to handle Keycloak redirect
const Callback: React.FC = () => {
    const location = useLocation();
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated && user) {
            const userRoles = user.roles || [];
            if (userRoles.some((role) => role.name === "Super Admin")) {
                navigate("/admin");
            } else if (userRoles.some((role) => role.name === "Manager")) {
                navigate("/manager-dashboard");
            } else if (userRoles.some((role) => role.name === "Supervisor")) {
                navigate("/timesheet");
            } else {
                navigate("/dashboard");
            }
        }
    }, [isAuthenticated, user, navigate]);

    return <div>Redirecting...</div>;
};

const AppContent: React.FC = () => {
    const { theme } = useTheme();

    useEffect(() => {
        document.body.className = theme;
    }, [theme]);

    return (
        <div className="app-container">
            <Header />
            <main>
                <Routes>
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/callback" element={<Callback />} /> {/* Add callback route */}
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/timesheet" element={<Timesheets />} />
                    <Route path="/timesheet-form" element={<TimesheetForm />} />
                    <Route path="/timesheet-validation" element={<TimesheetValidation />} />
                    <Route path="/timesheet-validation/visit/:visitId" element={<VisitValidationDetail />} />
                    <Route path="/qr-scan" element={<QRScan />} />
                    <Route path="/visit/:idVisit" element={<VisitDetails />} />
                    <Route path="/visit/:idVisit/validate-checklist" element={<VisitValidation />} />
                    <Route path="*" element={<PageNotFound />} />
                </Routes>
            </main>
            <Footer />
        </div>
    );
};

const App: React.FC = () => {
    return (
        <Router>
            <ThemeProvider>
                <AuthProvider>
                    <AppContent />
                </AuthProvider>
            </ThemeProvider>
        </Router>
    );
};

export default App;
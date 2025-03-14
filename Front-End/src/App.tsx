// src/App.tsx
import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext"; // Add AuthProvider
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

import "./App.css";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import LoginPage from "./pages/auth/Login";

const AppContent: React.FC = () => {
  const { theme } = useTheme();

  useEffect(() => {
    document.body.className = theme; // Apply 'light' or 'dark' to body
  }, [theme]);

  return (
    <div className="app-container">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} /> {/* Default to login */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/timesheet" element={<Timesheets />} />
          <Route path="/timesheet-form" element={<TimesheetForm />} />
          <Route
            path="/timesheet-validation"
            element={<TimesheetValidation />}
          />
          <Route
            path="/timesheet-validation/visit/:visitId"
            element={<VisitValidationDetail />}
          />
          <Route path="/qr-scan" element={<QRScan />} />
          <Route path="/visit/:idVisit" element={<VisitDetails />} />
          <Route
            path="/visit/:idVisit/validate-checklist"
            element={<VisitValidation />}
          />
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
        <AuthProvider> {/* Wrap with AuthProvider */}
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
};

export default App;

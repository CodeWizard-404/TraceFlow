// src/App.tsx
import "./App.css";
import Footer from "./components/Footer";
import Header from "./components/Header";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import PageNotFound from "./pages/PageNotFound";
import Timesheets from "./pages/timesheet/Timesheets";
import TimesheetForm from "./pages/timesheet/TimesheetForm";
import QRScan from "./pages/visit/QRScan";
import VisitDetails from "./pages/visit/VisitDetails";
import VisitValidation from "./pages/visit/VisitValidation";

const App: React.FC = () => {
  return (
    <Router>
      <div className="app-container">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/timesheet" replace />} />
            <Route path="/timesheet" element={<Timesheets />} />
            <Route path="/timesheet-form" element={<TimesheetForm />} />
            <Route path="/visit/:idVisit" element={<VisitDetails />} />
            <Route path="/qr-scan" element={<QRScan />} />
            <Route path="/visit/:idVisit/validate-checklist" element={<VisitValidation />} />
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
};

export default App;
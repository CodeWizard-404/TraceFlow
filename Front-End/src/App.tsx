import "./App.css";
import Footer from "./components/Footer";
import Header from "./components/Header";
//import QRScan from "./pages/visit/QRScan";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
//import Reason from "./pages/Reason";
//import Checklist from "./pages/Checklist";
import PageNotFound from "./pages/PageNotFound";
//import VisitValidation from "./pages/VisitValidation";
//import VisitForm from "./pages/VisitForm";
import Timesheets from "./pages/timesheet/Timesheets";

const App: React.FC = () => {
  return (
    <Router>
      <div className="app-container">
        <Header />
        <main>
          <Routes>
            {/* Redirect root to /timesheet */}
            <Route path="/" element={<Navigate to="/timesheet" replace />} />

            {/* Visit-related routes with dynamic visit ID */}
            {/* <Route path="/visit/:idVisit" element={<QRScan />} />
            <Route path="/visit/:idVisit/reason" element={<Reason />} />
            <Route path="/visit/:idVisit/checklist" element={<Checklist />} /> */}

            {/* Timesheet route */}
            <Route path="/timesheet" element={<Timesheets />} />

            {/* Visit form and validation routes */}
            {/* <Route path="/visit-form" element={<VisitForm />} />
            <Route path="/validate-visit" element={<VisitValidation />} /> */}

            {/* Catch-all route for 404 */}
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>

    </Router>
  );
};

export default App;
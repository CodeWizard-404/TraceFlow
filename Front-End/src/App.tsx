import "./App.css";
import Footer from "./components/Footer";
import Header from "./components/Header";
import QRScan from "./pages/QRScan";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Reason from "./pages/Reason";
import Checklist from "./pages/Checklist";
import Timesheets from "./pages/Timesheets";
import PageNotFound from "./pages/PageNotFound";
import VisitForm from "./pages/visitForm";

function App() {
  return (
    <>
      <Header />
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/visit/idVisit" replace />} />
          <Route path="/visit/idVisit" element={<QRScan />} />
          <Route path="/visit/idVisit/reason" element={<Reason />} />
          <Route path="/visit/idVisit/checklist" element={<Checklist />} />
          <Route path="/timesheet" element={<Timesheets />} />
          <Route path="/visitForm" element={<VisitForm />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Router>
      <Footer />
    </>
  );
}

export default App;

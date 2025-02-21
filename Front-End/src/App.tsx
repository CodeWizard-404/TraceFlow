import "./App.css";
import Footer from "./components/Footer";
import Header from "./components/Header";
import QRScan from "./components/QRScan";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Reason from "./components/Reason";

function App() {
  return (
    <>
      <Header />
      <Router>
        <Routes>
          <Route path="/visit/idVisit" element={<QRScan />} />
          <Route path="/visit/idVisit/reason" element={<Reason />} />
        </Routes>
      </Router>
      <Footer />
    </>
  );
}

export default App;

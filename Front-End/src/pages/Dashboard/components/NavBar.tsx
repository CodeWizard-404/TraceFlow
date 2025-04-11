import React from "react";
import "../Entry.css";

const Sidebar: React.FC = () => {
  return (
    <div className="w-64 text-black h-screen p-4">
      <h2 className="text-2xl font-bold mb-6">Manager Dashboard</h2>
      <nav className="navbar navbar-expand-lg navbar-light">
        <div className="collapse navbar-collapse" id="navbarNavAltMarkup">
          <div className="navbar-nav">
            <button className="navbar-btn">Monitoring</button>
            <button className="navbar-btn">Reporting</button>
            <button className="navbar-btn">Help</button>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Sidebar;

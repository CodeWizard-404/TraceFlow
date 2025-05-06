import React from "react";
import "../Entry.css";

const Sidebar: React.FC = () => {
  return (
    <nav className="navbar navbar-expand-lg navbar-light">
      <div className="collapse navbar-collapse" id="navbarNavAltMarkup">
        <div className="navbar-nav">
          <button className="navbar-btn">Monitoring</button>
          <button className="navbar-btn">Reporting</button>
          <button className="navbar-btn">Help</button>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;

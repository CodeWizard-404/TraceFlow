import React from "react";

const Sidebar: React.FC = () => {
  return (
    <div className="w-64 bg-gray-800 text-white h-screen p-4">
      <h2 className="text-2xl font-bold mb-6">Manager Dashboard</h2>
      <ul>
        <li className="mb-4">
          <a href="#" className="hover:text-gray-300">
            Overview
          </a>
        </li>
        <li className="mb-4">
          <a href="#" className="hover:text-gray-300">
            Team
          </a>
        </li>
        <li className="mb-4">
          <a href="#" className="hover:text-gray-300">
            Tasks
          </a>
        </li>
        <li className="mb-4">
          <a href="#" className="hover:text-gray-300">
            Reports
          </a>
        </li>
        <li className="mb-4">
          <a href="#" className="hover:text-gray-300">
            Settings
          </a>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;

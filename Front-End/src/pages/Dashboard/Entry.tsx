import React from "react";
import Sidebar from "./components/Sidebar";
import StatsCard from "./components/StatsCard";
import TaskList from "./components/TaskList";

const Entry: React.FC = () => {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <main className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Stats Cards */}
          <StatsCard title="Team Performance" value="85%" color="bg-blue-500" />
          <StatsCard title="Pending Tasks" value="12" color="bg-yellow-500" />
          <StatsCard title="Revenue" value="$45,000" color="bg-green-500" />

          {/* Task List */}
          <div className="col-span-full">
            <TaskList />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Entry;

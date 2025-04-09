import React from "react";

interface StatsCardProps {
  title: string;
  value: string;
  color: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, color }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow flex items-center">
      <div className={`w-12 h-12 ${color} rounded-full mr-4`}></div>
      <div>
        <h3 className="text-gray-600">{title}</h3>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
};

export default StatsCard;

import React from "react";

interface Task {
  id: number;
  title: string;
  status: "Pending" | "Completed";
}

const TaskList: React.FC = () => {
  const tasks: Task[] = [
    { id: 1, title: "Review Q1 Report", status: "Pending" },
    { id: 2, title: "Team Meeting", status: "Completed" },
    { id: 3, title: "Budget Approval", status: "Pending" },
  ];

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">Tasks</h2>
      <ul>
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex justify-between py-2 border-b last:border-b-0"
          >
            <span>{task.title}</span>
            <span
              className={`${
                task.status === "Pending" ? "text-yellow-500" : "text-green-500"
              }`}
            >
              {task.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TaskList;

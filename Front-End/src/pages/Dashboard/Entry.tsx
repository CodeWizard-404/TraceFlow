import React, { useEffect, useMemo, useState } from "react";
import Navbar from "./components/NavBar";
import Timesheet from "../../models/Timesheet";
import User from "../../models/User";
import Visit from "../../models/Visit";
import Notification from "../../models/Notification";
import TimesheetStatus from "../../models/Enum/TimesheetStatus";
import VisitStatus from "../../models/Enum/VisitStatus";
import { Pie } from "react-chartjs-2";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import "./Entry.css";
import { useTheme } from "../../context/ThemeContext";
import { FaSun } from "react-icons/fa";

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

const Entry: React.FC = () => {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Simulate fetching data
  useEffect(() => {
    const mockTimesheets: Timesheet[] = [
      {
        timesheetID: "T1",
        weekNumber: 14,
        year: 2025,
        status: TimesheetStatus.PENDING,
        supervisorID: "S1",
      },
      {
        timesheetID: "T2",
        weekNumber: 14,
        year: 2025,
        status: TimesheetStatus.VALIDATED,
        supervisorID: "S2",
      },
      {
        timesheetID: "T3",
        weekNumber: 14,
        year: 2025,
        status: TimesheetStatus.PENDING,
        supervisorID: "S1",
      },
    ];
    const mockUsers: User[] = [
      {
        userID: "S1",
        firstname: "Sofien",
        lastname: "Laghouanem",
        phone: "",
        email: "",
        wallet: "",
      },
      {
        userID: "S2",
        firstname: "Ghaith",
        lastname: "Othmani",
        phone: "",
        email: "",
        wallet: "",
      },
    ];
    const mockVisits: Visit[] = [
      {
        visitID: "V1",
        date: "2025-04-09",
        time: "10:00",
        status: VisitStatus.VALIDATED,
        agentID: "A1",
        timesheetID: "T1",
      },
      {
        visitID: "V2",
        date: "2025-04-09",
        time: "11:00",
        status: VisitStatus.PENDING,
        agentID: "A2",
        timesheetID: "T2",
      },
    ];
    setTimesheets(mockTimesheets);
    setUsers(mockUsers);
    setVisits(mockVisits);

    // Simulate WebSocket (unchanged)
    const ws = new WebSocket("ws://your-websocket-server");
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "timesheet")
        setTimesheets((prev) => [...prev, data.payload]);
      if (data.type === "visit") setVisits((prev) => [...prev, data.payload]);
      if (data.type === "notification")
        setNotifications((prev) => [...prev, data.payload]);
    };
    return () => ws.close();
  }, []);

  // Prepare data for pie charts
  const timesheetStatusData = {
    labels: ["Pending", "Validated"],
    datasets: [
      {
        data: [
          timesheets.filter((t) => t.status === TimesheetStatus.PENDING).length,
          timesheets.filter((t) => t.status === TimesheetStatus.VALIDATED)
            .length,
        ],
        backgroundColor: ["#FF6384", "#36A2EB"],
        hoverBackgroundColor: ["#FF6384", "#36A2EB"],
      },
    ],
  };

  const visitStatusData = {
    labels: ["Validated", "Pending"],
    datasets: [
      {
        data: [
          visits.filter((v) => v.status === VisitStatus.VALIDATED).length,
          visits.filter((v) => v.status === VisitStatus.PENDING).length,
        ],
        backgroundColor: ["#FFCE56", "#4BC0C0"],
        hoverBackgroundColor: ["#FFCE56", "#4BC0C0"],
      },
    ],
  };

  const supervisorTimesheetData = {
    labels: users.map((u) => `${u.firstname} ${u.lastname}`),
    datasets: [
      {
        data: users.map(
          (u) => timesheets.filter((t) => t.supervisorID === u.userID).length
        ),
        backgroundColor: ["#FF9F40", "#9966FF"],
        hoverBackgroundColor: ["#FF9F40", "#9966FF"],
      },
    ],
  };
  const { theme } = useTheme(); // Use theme from ThemeContext

  // Apply theme to body
  useEffect(() => {
    document.body.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: theme === "dark" ? "#EEEEEE" : "#111111", // Light gray in dark mode, dark gray in light mode
        },
      },
    },
  };

  // Map configuration
  const mapContainerStyle = {
    width: "100%",
    height: "100%", // Fills available space
  };

  const center = {
    lat: 36.7538, // Algiers
    lng: 3.0588,
  };

  // Filter visits for today
  const today = "2025-04-11"; // Hardcoded for demo; use new Date() in production
  const todayVisits = useMemo(
    () => visits.filter((visit) => visit.date === today),
    [visits]
  );

  return (
    <div className="flex h-screen bg-gray-100 dashboard-manager">
      <Navbar />
      <div className="flex-1 flex flex-col">
        <main className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="parent">
            <div className="charts-card">
              <div>
                <FaSun />
                <span className="card-title">Charts</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-around",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ width: "30%", height: "200px" }}>
                  <h5 className="charts-title">Timesheet Status</h5>
                  <Pie data={timesheetStatusData} options={chartOptions} />
                </div>
                <div style={{ width: "30%", height: "200px" }}>
                  <h5 className="charts-title">Visit Status</h5>
                  <Pie data={visitStatusData} options={chartOptions} />
                </div>
                <div style={{ width: "30%", height: "200px" }}>
                  <h5 className="charts-title">Timesheets per Supervisor</h5>
                  <Pie data={supervisorTimesheetData} options={chartOptions} />
                </div>
              </div>
            </div>
            {/* Map */}
            <div className="maps-card">
              <h2 className="">Agents Visits Today</h2>
              <div className="maps-card__container">
                <LoadScript googleMapsApiKey={""}>
                  <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={center}
                    zoom={12}
                    options={{
                      streetViewControl: false,
                      mapTypeControl: false,
                    }}
                  >
                    {todayVisits.length > 0 ? (
                      todayVisits.map((visit) => (
                        <Marker
                          key={visit.visitID}
                          position={{ lat: 36.7538, lng: 3.0588 }}
                          title={`Visit ${visit.visitID} at ${visit.time}`}
                          icon={{
                            url:
                              visit.status === VisitStatus.VALIDATED
                                ? "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                                : "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
                          }}
                        />
                      ))
                    ) : (
                      <div className="map-placeholder">No visits today</div>
                    )}
                  </GoogleMap>
                </LoadScript>
              </div>
            </div>
            <div className="div4">unfinished visits</div>
            <div className="div8">Emails</div>
            <div className="stats-card1">
              <h6 className="stats-card1__title">Supervisors Count</h6>
              <p className="stats-card1__value" aria-live="polite">
                {524}
              </p>
            </div>
            <div className="stats-card2">
              <h6 className="stats-card2__title">Active Supervisors</h6>
              <p className="stats-card2__value" aria-live="polite">
                {102}
              </p>
            </div>
            <div className="div11">To Do List</div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Entry;

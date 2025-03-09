import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Timesheets.css";
import Timesheet from "../../models/Timesheet";
import { getTimesheetsBySupervisor } from "../../apis/timesheetAPI"; 
import Visit from "../../models/Visit";
import { FaClock, FaMapMarkerAlt } from "react-icons/fa";

type ViewMode = "year" | "month" | "week" | "day";

// Main component for displaying timesheets in various views (Year, Month, Week, Day)
const Timesheets: React.FC = () => {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentWeek, setCurrentWeek] = useState<number>(0);
  const [currentDay, setCurrentDay] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("lastViewMode") as ViewMode) || "year";
  });
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  const supervisorID = "user_001"; // Replace with desired supervisor ID

  // Fetch timesheets when the year changes
  useEffect(() => {
    const fetchTimesheets = async () => {
      try {
        setLoading(true);
        const data = await getTimesheetsBySupervisor(supervisorID);
        setTimesheets(data.filter((ts) => ts.year === currentYear));
      } catch (error) {
        console.error("Failed to fetch timesheets:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTimesheets();
    updateCurrentWeekAndDay();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentYear]);

  // Persist view mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("lastViewMode", viewMode);
  }, [viewMode]);

  // Update current week and day, ensuring day is a weekday (Monday-Friday)
  const updateCurrentWeekAndDay = () => {
    const today = new Date();
    const firstDayOfYear = new Date(currentYear, 0, 1);
    const pastDays = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNum = Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);
    setCurrentWeek(weekNum);
    setCurrentDay(today.getDay() === 0 || today.getDay() === 6 ? new Date(today.setDate(today.getDate() - (today.getDay() || 7) + 1)) : today);
  };

  // Generate array of weekdays (Monday-Friday) for a given week
  const getWeekDays = (year: number, weekNumber: number): Date[] => {
    const janFirst = new Date(year, 0, 1);
    const dayOfWeek = janFirst.getDay();
    const daysToFirstMonday = (dayOfWeek === 0 ? 1 : 8 - dayOfWeek) % 7;
    const firstMonday = new Date(janFirst);
    firstMonday.setDate(janFirst.getDate() + daysToFirstMonday);
    
    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
    
    return Array.from({ length: 5 }, (_, i) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      day.setHours(0, 0, 0, 0);
      return day;
    });
  };

  // Utility to sort visits by time (e.g., "09:00" < "14:00")
  const sortVisitsByTime = (visits: Visit[]): Visit[] => {
    return [...visits].sort((a, b) => a.time.localeCompare(b.time));
  };

  // Data generation functions for each view
  const generateYearData = () => {
    return Array.from({ length: 12 }, (_, month) => {
      const weeks = Array.from({ length: 5 }, (_, i) => {
        const weekNumber = month * 4 + i + 1;
        const timesheet = timesheets.find((ts) => ts.weekNumber === weekNumber);
        return {
          weekNumber,
          days: getWeekDays(currentYear, weekNumber),
          visits: timesheet?.Visits || [],
          status: timesheet?.status || "Not Scheduled",
        };
      });
      return { month, weeks };
    });
  };

  const generateMonthData = () => {
    const weeks = Array.from({ length: 5 }, (_, i) => {
      const weekNumber = currentMonth * 4 + i + 1;
      const timesheet = timesheets.find((ts) => ts.weekNumber === weekNumber);
      return {
        weekNumber,
        days: getWeekDays(currentYear, weekNumber),
        visits: timesheet?.Visits || [],
        status: timesheet?.status || "Not Scheduled",
      };
    });
    return weeks;
  };

  const generateWeekData = () => {
    const timesheet = timesheets.find((ts) => ts.weekNumber === currentWeek);
    return {
      weekNumber: currentWeek,
      days: getWeekDays(currentYear, currentWeek),
      visits: timesheet?.Visits || [],
      status: timesheet?.status || "Not Scheduled",
    };
  };

  const generateDayData = () => {
    if (!currentDay) return [];
    const dateStr = currentDay.toISOString().split("T")[0];
    const visits = timesheets
      .flatMap((ts) => ts.Visits || [])
      .filter((visit) => visit.date === dateStr);
    return sortVisitsByTime(visits);
  };

  // Scroll to the current period based on view mode
  const scrollToCurrent = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    updateCurrentWeekAndDay();
    setTimeout(() => {
      const id =
        viewMode === "year"
          ? `month-${today.getMonth()}`
          : viewMode === "month"
          ? `week-${currentWeek}`
          : viewMode === "week"
          ? `week-${currentWeek}`
          : `day-${today.toISOString().split("T")[0]}`;
      const element = document.getElementById(id);
      if (element) element.scrollIntoView({ behavior: "smooth" });
    }, 0);
  };

  if (loading) return <div className="loading">Loading Timesheets...</div>;

  return (
    <div className="timesheets-container">
      {/* Header with view toggle, year navigation, and action buttons */}
      <header className="timesheets-header">
        <div className="view-toggle">
          {["year", "month", "week", "day"].map((mode) => (
            <button
              key={mode}
              className={`toggle-btn ${viewMode === mode ? "active" : ""}`}
              onClick={() => setViewMode(mode as ViewMode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        <div className="year-navigation">
          <button className="nav-btn" onClick={() => setCurrentYear((prev) => prev - 1)}>
            <span>←</span>
          </button>
          <h1>{currentYear}</h1>
          <button className="nav-btn" onClick={() => setCurrentYear((prev) => prev + 1)}>
            <span>→</span>
          </button>
        </div>
        <div className="action-buttons">
          <button className="create-btn" onClick={() => navigate("/timesheet-form", { state: { year: currentYear } })}>
            Schedule Visit
          </button>
          <button className="current-btn" onClick={scrollToCurrent}>
            Current {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}
          </button>
        </div>
      </header>

      {/* Year View: Displays all months with their weeks */}
      {viewMode === "year" && (
        <section className="year-view">
          {generateYearData().map(({ month, weeks }) => (
            <div className="month-card" key={month} id={`month-${month}`}>
              <h2>{new Date(currentYear, month).toLocaleString("default", { month: "long" })}</h2>
              <div className="weeks-grid">
                {weeks.map((week) => (
                  <div
                    className="week-tile"
                    key={week.weekNumber}
                    onClick={() => {
                      setCurrentWeek(week.weekNumber);
                      setViewMode("week");
                    }}
                  >
                    <span className="week-number">Week {week.weekNumber} :</span> 
                    <span className="week-range">
                      {week.days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} -{" "}
                      {week.days[4].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} /
                    </span> 
                    <span className="visit-count">{week.visits.length} Visits</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Month View: Displays weeks of the selected month */}
      {viewMode === "month" && (
        <section className="month-view">
          <div className="month-header">
            <button className="nav-btn" onClick={() => setCurrentMonth((prev) => (prev - 1 + 12) % 12)}>
              <span>←</span>
            </button>
            <h2>{new Date(currentYear, currentMonth).toLocaleString("default", { month: "long" })}</h2>
            <button className="nav-btn" onClick={() => setCurrentMonth((prev) => (prev + 1) % 12)}>
              <span>→</span>
            </button>
          </div>
          <div className="weeks-grid">
            {generateMonthData().map((week) => (
              <div
                className="week-card"
                key={week.weekNumber}
                id={`week-${week.weekNumber}`}
                onClick={() => {
                  setCurrentWeek(week.weekNumber);
                  setViewMode("week");
                }}
              >
                <h3>Week {week.weekNumber}</h3>
                <p className="week-range">
                  {week.days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} -{" "}
                  {week.days[4].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </p>
                <p className="week-info">{week.visits.length} Visits - Status: {week.status}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Week View: Displays days with their respective visits */}
      {viewMode === "week" && (
        <section className="week-view">
          <div className="week-header">
            <button className="nav-btn" onClick={() => setCurrentWeek((prev) => Math.max(1, prev - 1))}>
              <span>←</span>
            </button>
            <h2>Week {currentWeek}</h2>
            <button className="nav-btn" onClick={() => setCurrentWeek((prev) => Math.min(52, prev + 1))}>
              <span>→</span>
            </button>
          </div>
          <div className="week-details">
            {(() => {
              const weekData = generateWeekData();
              return (
                <>
                  <p className="week-range">
                    {weekData.days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} -{" "}
                    {weekData.days[4].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                  <p className="week-status">Status: {weekData.status}</p>
                  <div className="days-grid">
                    {weekData.days.map((day) => {
                      const dayStr = day.toISOString().split("T")[0];
                      const dayVisits = sortVisitsByTime(
                        weekData.visits.filter((v) => {
                          const visitDate = new Date(v.date);
                          visitDate.setHours(0, 0, 0, 0);
                          return visitDate.toISOString().split("T")[0] === dayStr;
                        })
                      );
                      return (
                        <div className="day-column" key={dayStr}>
                          <div
                            className="day-tile"
                            onClick={() => {
                              setCurrentDay(day);
                              setViewMode("day");
                            }}
                          >
                            <span className="day-name">
                              {day.toLocaleDateString("en-GB", { weekday: "short" })}
                            </span>
                            <span className="day-date">{day.getDate()}</span>
                            <span className="visit-count"> 
                              {dayVisits.length > 0 ? `/ ${dayVisits.length} Visits` : ""}
                            </span>
                          </div>
                          <div className="visits-list">
                            {dayVisits.length > 0 ? (
                              dayVisits.map((visit) => (
                                <div
                                  key={visit.visitID}
                                  className="visit-card"
                                  onClick={() => navigate(`/visit/${visit.visitID}`)}
                                >
                                  <div className="visit-header">
                                    {visit.time && (
                                      <span className="visit-time">
                                        <FaClock /> {visit.time.split(":").slice(0, 2).join(":")}
                                      </span>
                                    )}
                                    <span className={`visit-status status-${visit.status.toLowerCase()}`}>
                                      {visit.status}
                                    </span>
                                  </div>
                                  <p className="visit-location">
                                    <FaMapMarkerAlt /> {visit.location}
                                  </p>
                                  {/* Display reasons if they exist */}
                                  {visit.Reasons && visit.Reasons.length > 0 && (
                                    <p className="visit-reasons">
                                      Reasons: {visit.Reasons.map((reason) => reason.item).join(", ")}
                                    </p>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="no-visits">No Visits Scheduled</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </section>
      )}

      {/* Day View: Displays visits for the selected day */}
      {viewMode === "day" && (
        <section className="day-view">
          <div className="day-header">
            <button
              className="nav-btn"
              onClick={() => currentDay && setCurrentDay(new Date(currentDay.setDate(currentDay.getDate() - 1)))}
            >
              <span>←</span>
            </button>
            {/* Updated day view header format */}
            <h2>
              {currentDay?.toLocaleDateString("en-GB", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
              }).replace(/(\w+)\s(\d+)\/(\d+)/, "$1 $2/$3")}
            </h2>
            <button
              className="nav-btn"
              onClick={() => currentDay && setCurrentDay(new Date(currentDay.setDate(currentDay.getDate() + 1)))}
            >
              <span>→</span>
            </button>
          </div>
          <div className="visits-list">
            {generateDayData().length > 0 ? (
              generateDayData().map((visit) => (
                <div
                  key={visit.visitID}
                  className="visit-card"
                  onClick={() => navigate(`/visit/${visit.visitID}`)}
                >
                  <div className="visit-header">
                    {/* Show time only if not null, format to HH:MM */}
                    {visit.time && (
                      <span className="visit-time">
                        <FaClock /> {visit.time.split(":").slice(0, 2).join(":")}
                      </span>
                    )}
                    <span className={`visit-status status-${visit.status.toLowerCase()}`}>
                      {visit.status}
                    </span>
                  </div>
                  <p className="visit-location">
                    <FaMapMarkerAlt /> {visit.location || "Location TBD"}
                  </p>
                  {/* Display reasons if they exist */}
                  {visit.Reasons && visit.Reasons.length > 0 && (
                    <p className="visit-reasons">
                      Reasons: {visit.Reasons.map((reason) => reason.item).join(", ")}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="no-visits">No Visits Scheduled</div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default Timesheets;
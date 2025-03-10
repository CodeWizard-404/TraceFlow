/* eslint-disable react-hooks/exhaustive-deps */
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
        setTimesheets(data.filter((ts) => ts.year === currentYear || (ts.year === currentYear - 1 && ts.weekNumber >= 52)));
      } catch (error) {
        console.error("Failed to fetch timesheets:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTimesheets();
    updateCurrentWeekAndDay();
  }, [currentYear]);

  // Persist view mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("lastViewMode", viewMode);
  }, [viewMode]);

  // Utility to get ISO week number for a date
  const getWeekNumber = (date: Date): number => {
    const year = date.getFullYear();
    const jan1 = new Date(year, 0, 1);
    const firstFridayOffset = (5 - jan1.getDay() + 7) % 7;
    const firstMonday = new Date(year, 0, 1 + firstFridayOffset - 4);
  
    const diffMs = date.getTime() - firstMonday.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const weekNum = Math.floor(diffDays / 7) + 1;
  
    // Check if the week belongs to the next year
    const nextJan1 = new Date(year + 1, 0, 1);
    const nextFirstFridayOffset = (5 - nextJan1.getDay() + 7) % 7;
    const nextFirstMonday = new Date(year + 1, 0, 1 + nextFirstFridayOffset - 4);
    if (date >= nextFirstMonday) {
      return getWeekNumber(date); // Recalculate for next year (this could be optimized)
    }
  
    return weekNum > 0 && weekNum <= getWeeksInYear(year) ? weekNum : 1; // Clamp to valid range
  };
  // Get total ISO weeks in a year
  const getWeeksInYear = (year: number): number => {
    const jan1 = new Date(year, 0, 1);
    const firstFridayOffset = (5 - jan1.getDay() + 7) % 7;
    const firstMonday = new Date(year, 0, 1 + firstFridayOffset - 4); // Monday of Week 1
  
    const nextJan1 = new Date(year + 1, 0, 1);
    const nextFirstFridayOffset = (5 - nextJan1.getDay() + 7) % 7;
    const nextFirstMonday = new Date(year + 1, 0, 1 + nextFirstFridayOffset - 4); // Monday of Week 1 of next year
  
    const daysInYear = (nextFirstMonday.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24);
    return Math.floor(daysInYear / 7);
  };

  // Update current week and day, ensuring day is a weekday (Monday-Friday)
  const updateCurrentWeekAndDay = () => {
    const today = new Date();
    const weekNum = getWeekNumber(today); // Now using getWeekNumber
    setCurrentWeek(weekNum);
    setCurrentDay(
      today.getDay() === 0 || today.getDay() === 6
        ? new Date(today.setDate(today.getDate() - (today.getDay() || 7) + 1))
        : today
    );
  };
  // Generate array of weekdays (Monday-Friday) for a given week
  const getWeekDays = (year: number, weekNumber: number): Date[] => {
    const jan1 = new Date(year, 0, 1);
    const firstFridayOffset = (5 - jan1.getDay() + 7) % 7; // Days from Jan 1 to first Friday (5 = Friday)
    const firstFriday = new Date(year, 0, 1 + firstFridayOffset); // First Friday in January
    const firstMonday = new Date(firstFriday);
    firstMonday.setDate(firstFriday.getDate() - 4); // Monday of the week containing the first Friday
  
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
    const weeksInYear = getWeeksInYear(currentYear);
    const months: { month: number; weeks: { weekNumber: number; days: Date[]; visits: Visit[]; status: string }[] }[] = Array.from({ length: 12 }, (_, m) => ({ month: m, weeks: [] }));
  
    for (let week = 1; week <= weeksInYear; week++) {
      const days = getWeekDays(currentYear, week);
      let assignedMonth: number;
  
      // Special case: Week 1 always belongs to January (month 0)
      if (week === 1) {
        assignedMonth = 0; // January
      } else {
        // For other weeks, use the dominant month based on day count
        const monthCounts = days.reduce((acc, day) => {
          const month = day.getMonth();
          acc[month] = (acc[month] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);
        assignedMonth = Number(
          Object.entries(monthCounts).reduce((a, b) => (b[1] > a[1] ? b : a))[0]
        );
      }
  
      const timesheet = timesheets.find((ts) => ts.weekNumber === week && ts.year === currentYear);
      months[assignedMonth].weeks.push({
        weekNumber: week,
        days,
        visits: timesheet?.Visits || [],
        status: timesheet?.status || "Not Scheduled",
      });
    }
    return months;
  };
  const generateMonthData = () => {
    const weeksInYear = getWeeksInYear(currentYear);
    const weeks: { weekNumber: number; days: Date[]; visits: Visit[]; status: string }[] = [];
  
    for (let week = 1; week <= weeksInYear; week++) {
      const days = getWeekDays(currentYear, week);
      const hasDaysInMonth = days.some((day) => day.getMonth() === currentMonth && day.getFullYear() === currentYear);
      if (hasDaysInMonth) {
        const timesheet = timesheets.find((ts) => ts.weekNumber === week && ts.year === currentYear);
        weeks.push({
          weekNumber: week,
          days,
          visits: timesheet?.Visits || [],
          status: timesheet?.status || "Not Scheduled",
        });
      }
    }
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
          <button
              className="nav-btn"
              onClick={() => setCurrentWeek((prev) => Math.max(1, prev - 1))}
            >
              <span>←</span>
            </button>
            <h2>Week {currentWeek}</h2>
            <button
              className="nav-btn"
              onClick={() => setCurrentWeek((prev) => Math.min(getWeeksInYear(currentYear), prev + 1))}
            >
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
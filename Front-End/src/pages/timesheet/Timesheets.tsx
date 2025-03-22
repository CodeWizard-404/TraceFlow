/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./Timesheets.css";
import Timesheet from "../../models/Timesheet";
import { getTimesheetsBySupervisor, getAllTimesheets, validateTimesheet } from "../../apis/timesheetAPI";
import Visit from "../../models/Visit";
import { FaClock, FaMapMarkerAlt, FaRegUser } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import User from "../../models/User";
import { getAllUsers, getSupervisorsByUser } from "../../apis/userAPI";

type ViewMode = "year" | "month" | "week" | "day";

interface VisitWithSupervisor extends Visit {
  supervisorID?: string;
}

const Timesheets: React.FC = () => {
  const { user, token, effectivePermissions, permissionsLoaded } = useAuth();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [filteredTimesheets, setFilteredTimesheets] = useState<Timesheet[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentWeek, setCurrentWeek] = useState<number>(0);
  const [currentDay, setCurrentDay] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => 
    (localStorage.getItem("lastViewMode") as ViewMode) || "year"
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [supervisorFilter, setSupervisorFilter] = useState<string>(() => 
    localStorage.getItem("supervisorFilter") || "all"
  );
  const [supervisorSearch, setSupervisorSearch] = useState<string>(""); // New search state
  const navigate = useNavigate();

  const supervisorID = user?.userID;

  // Permission Checks
  const canAccessTimesheetDetails = useMemo(() => 
    effectivePermissions?.some(p => p.name === "access_timesheet_details"), [effectivePermissions]
  );
  const canCreateTimesheets = useMemo(() => 
    effectivePermissions?.some(p => p.name === "create_timesheets"), [effectivePermissions]
  );
  const canAccessSupervisorTimesheets = useMemo(() => 
    effectivePermissions?.some(p => p.name === "access_Supervisor_timesheets"), [effectivePermissions]
  );
  const canValidateTimesheets = useMemo(() => 
    effectivePermissions?.some(p => p.name === "validate_timesheets"), [effectivePermissions]
  );
  const canAccessTimesheets = useMemo(() => 
    effectivePermissions?.some(p => p.name === "access_timesheets"), [effectivePermissions]
  );
  const canReadUsers = useMemo(() => 
    effectivePermissions?.some(p => p.name === "read_users"), [effectivePermissions]
  );
  const canReadSupervisors = useMemo(() => 
    effectivePermissions?.some(p => p.name === "read_supervisors"), [effectivePermissions]
  );

  // Fetch Timesheets
  const fetchTimesheets = async () => {
    try {
      setLoading(true);
      let data: Timesheet[] = [];
      if (canAccessTimesheets) {
        data = await getAllTimesheets(token!);
      } else if (canReadSupervisors) {
        const supervisors = await getSupervisorsByUser(supervisorID!, token!);
        const supervisorTimesheetsPromises = supervisors.map(supervisor => 
          getTimesheetsBySupervisor(supervisor.userID, token!)
        );
        data = (await Promise.all(supervisorTimesheetsPromises)).flat();
      } 
      else if (canAccessSupervisorTimesheets) {
        data = await getTimesheetsBySupervisor(supervisorID!, token!);
      }
    
      setTimesheets(data.filter((ts) => 
        ts.year === currentYear || (ts.year === currentYear - 1 && ts.weekNumber >= 52)
      ));
    } catch (error) {
      console.error("Failed to fetch timesheets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permissionsLoaded || !supervisorID || !token) return;
    fetchTimesheets();
    updateCurrentWeekAndDay();
  }, [currentYear, supervisorID, token, permissionsLoaded, canReadSupervisors, canAccessSupervisorTimesheets, canAccessTimesheets]);

  // Fetch Users for Supervisor Names and Filter
  useEffect(() => {
    if (!token || !permissionsLoaded || (!canReadUsers && !canReadSupervisors)) return;

    const fetchUsers = async () => {
      try {
        let userData: User[] = [];
        if (canReadUsers) {
          userData = await getAllUsers(token);
        } else if (canReadSupervisors && supervisorID) {
          userData = await getSupervisorsByUser(supervisorID, token);
        }
        setUsers(userData);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      }
    };
    fetchUsers();
  }, [token, permissionsLoaded, canReadUsers, canReadSupervisors, supervisorID]);

  // Filter Timesheets
  useEffect(() => {
    if (canAccessTimesheets || canReadSupervisors) {
      setFilteredTimesheets(
        supervisorFilter === "all"
          ? timesheets
          : timesheets.filter((ts) => ts.supervisorID === supervisorFilter)
      );
    } else {
      setFilteredTimesheets(timesheets);
    }
  }, [timesheets, supervisorFilter, canAccessTimesheets, canReadSupervisors]);

  // Save filter to localStorage
  useEffect(() => {
    localStorage.setItem("supervisorFilter", supervisorFilter);
    localStorage.setItem("lastViewMode", viewMode);
  }, [supervisorFilter, viewMode]);

  // Utility Functions 
  const getWeekNumber = (date: Date): number => {
    const year = date.getFullYear();
    const jan1 = new Date(year, 0, 1);
    const firstFridayOffset = (5 - jan1.getDay() + 7) % 7;
    const firstMonday = new Date(year, 0, 1 + firstFridayOffset - 4);
    const diffMs = date.getTime() - firstMonday.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const weekNum = Math.floor(diffDays / 7) + 1;
    const nextJan1 = new Date(year + 1, 0, 1);
    const nextFirstFridayOffset = (5 - nextJan1.getDay() + 7) % 7;
    const nextFirstMonday = new Date(year + 1, 0, 1 + nextFirstFridayOffset - 4);
    if (date >= nextFirstMonday) return getWeekNumber(date);
    return weekNum > 0 && weekNum <= getWeeksInYear(year) ? weekNum : 1;
  };

  const getWeeksInYear = (year: number): number => {
    const jan1 = new Date(year, 0, 1);
    const firstFridayOffset = (5 - jan1.getDay() + 7) % 7;
    const firstMonday = new Date(year, 0, 1 + firstFridayOffset - 4);
    const nextJan1 = new Date(year + 1, 0, 1);
    const nextFirstFridayOffset = (5 - nextJan1.getDay() + 7) % 7;
    const nextFirstMonday = new Date(year + 1, 0, 1 + nextFirstFridayOffset - 4);
    const daysInYear = (nextFirstMonday.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24);
    return Math.floor(daysInYear / 7);
  };

  const updateCurrentWeekAndDay = () => {
    const today = new Date();
    const weekNum = getWeekNumber(today);
    setCurrentWeek(weekNum);
    setCurrentDay(today.getDay() === 0 || today.getDay() === 6
      ? new Date(today.setDate(today.getDate() - (today.getDay() || 7) + 1))
      : today
    );
  };

  const getWeekDays = (year: number, weekNumber: number): Date[] => {
    const jan1 = new Date(year, 0, 1);
    const firstFridayOffset = (5 - jan1.getDay() + 7) % 7;
    const firstFriday = new Date(year, 0, 1 + firstFridayOffset);
    const firstMonday = new Date(firstFriday);
    firstMonday.setDate(firstFriday.getDate() - 4);
    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
    return Array.from({ length: 5 }, (_, i) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      day.setHours(0, 0, 0, 0);
      return day;
    });
  };

  const sortVisitsByTime = (visits: VisitWithSupervisor[]): VisitWithSupervisor[] => {
    return [...visits].sort((a, b) => a.time.localeCompare(b.time));
  };

  // Data Generation
  const generateYearData = () => {
    const weeksInYear = getWeeksInYear(currentYear);
    const months: { month: number; weeks: { weekNumber: number; days: Date[]; visits: VisitWithSupervisor[]; status: string; supervisorCount: number }[] }[] = 
      Array.from({ length: 12 }, (_, m) => ({ month: m, weeks: [] }));
  
    for (let week = 1; week <= weeksInYear; week++) {
      const days = getWeekDays(currentYear, week);
      let assignedMonth: number;
      if (week === 1) {
        assignedMonth = 0;
      } else {
        const monthCounts = days.reduce((acc, day) => {
          const month = day.getMonth();
          acc[month] = (acc[month] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);
        assignedMonth = Number(Object.entries(monthCounts).reduce((a, b) => (b[1] > a[1] ? b : a))[0]);
      }
  
      const matchingTimesheets = filteredTimesheets.filter((ts) => ts.weekNumber === week && ts.year === currentYear);
      const allVisits: VisitWithSupervisor[] = matchingTimesheets.flatMap((ts) =>
        (ts.Visits || []).map((visit) => ({ ...visit, supervisorID: ts.supervisorID }))
      );
      const status = matchingTimesheets.length > 0 ? matchingTimesheets[0].status : "Not Scheduled";
      const supervisorCount = new Set(matchingTimesheets.map(ts => ts.supervisorID)).size;
  
      months[assignedMonth].weeks.push({
        weekNumber: week,
        days,
        visits: allVisits,
        status,
        supervisorCount,
      });
    }
    return months;
  };
  
  const generateMonthData = () => {
    const weeksInYear = getWeeksInYear(currentYear);
    const weeks: { weekNumber: number; days: Date[]; visits: VisitWithSupervisor[]; status: string; supervisorCount: number }[] = [];
  
    for (let week = 1; week <= weeksInYear; week++) {
      const days = getWeekDays(currentYear, week);
      const hasDaysInMonth = days.some((day) => day.getMonth() === currentMonth && day.getFullYear() === currentYear);
      if (hasDaysInMonth) {
        const matchingTimesheets = filteredTimesheets.filter((ts) => ts.weekNumber === week && ts.year === currentYear);
        const allVisits: VisitWithSupervisor[] = matchingTimesheets.flatMap((ts) =>
          (ts.Visits || []).map((visit) => ({ ...visit, supervisorID: ts.supervisorID }))
        );
        const status = matchingTimesheets.length > 0 ? matchingTimesheets[0].status : "Not Scheduled";
        const supervisorCount = new Set(matchingTimesheets.map(ts => ts.supervisorID)).size;
  
        weeks.push({
          weekNumber: week,
          days,
          visits: allVisits,
          status,
          supervisorCount,
        });
      }
    }
    return weeks;
  };

  const generateWeekData = () => {
    const matchingTimesheets = filteredTimesheets.filter((ts) => ts.weekNumber === currentWeek);
    const allVisits: VisitWithSupervisor[] = matchingTimesheets.flatMap((ts) =>
      (ts.Visits || []).map((visit) => ({ ...visit, supervisorID: ts.supervisorID }))
    );
    const status = matchingTimesheets.length > 0 ? matchingTimesheets[0].status : "Not Scheduled";
    const supervisorID = matchingTimesheets.length > 0 ? matchingTimesheets[0].supervisorID : undefined;
    const supervisorCount = new Set(matchingTimesheets.map(ts => ts.supervisorID)).size;
    return {
      weekNumber: currentWeek,
      days: getWeekDays(currentYear, currentWeek),
      visits: allVisits,
      status,
      supervisorID,
      supervisorCount,
    };
  };

  const generateDayData = () => {
    if (!currentDay) return [];
    const dateStr = currentDay.toISOString().split("T")[0];
    const visits: VisitWithSupervisor[] = filteredTimesheets
      .flatMap((ts) => (ts.Visits || []).map((visit) => ({ ...visit, supervisorID: ts.supervisorID })))
      .filter((visit) => visit.date.split("T")[0] === dateStr);
    return sortVisitsByTime(visits);
  };

  const scrollToCurrent = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    updateCurrentWeekAndDay();
    setTimeout(() => {
      const id = viewMode === "year"
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

  const handleValidateTimesheet = async (timesheetID: string) => {
    if (!canValidateTimesheets) return;
    try {
      const timesheet = filteredTimesheets.find((ts) => ts.timesheetID === timesheetID);
      if (!timesheet) return;
      const visitIDs = timesheet.Visits ? timesheet.Visits.map((v) => v.visitID) : [];
      await validateTimesheet(timesheetID, { visitIDs, status: "validated" }, token!);
      // Refresh the entire timesheet list instead of local update
      await fetchTimesheets();
    } catch (error) {
      console.error("Failed to validate timesheet:", error);
    }
  };

  // Filter supervisors based on search
  const filteredSupervisors = useMemo(() => {
    if (!supervisorSearch) return users;
    const searchLower = supervisorSearch.toLowerCase();
    return users.filter(user => 
      `${user.firstname} ${user.lastname}`.toLowerCase().includes(searchLower) ||
      (user.phone && user.phone.toLowerCase().includes(searchLower))
    );
  }, [users, supervisorSearch]);

  // Early Returns
  if (!permissionsLoaded) return <div className="loading">Loading permissions...</div>;
  if (!canAccessSupervisorTimesheets) {
    return <div className="access-denied">Access Denied: You lack permission to view timesheets.</div>;
  }
  if (loading) return <div className="loading">Loading Timesheets...</div>;

  return (
<div className="timesheets-container">
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
      {canCreateTimesheets && (
        <button
          className="create-btn"
          onClick={() => navigate("/timesheet-form", { state: { year: currentYear } })}
        >
          Schedule Visit
        </button>
      )}
      <button className="current-btn" onClick={scrollToCurrent}>
        Current {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}
      </button>
    </div>
  </header>

  {(canReadUsers || canReadSupervisors) && (
    <div className="filter-bubble">
      <button className="filter-toggle-btn">Filter Supervisors</button>
      <div className="filter-panel">
        <div className="supervisor-filter-container">
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={supervisorSearch}
            onChange={(e) => setSupervisorSearch(e.target.value)}
            className="supervisor-search"
          />
          <select
            className="supervisor-filter"
            value={supervisorFilter}
            onChange={(e) => setSupervisorFilter(e.target.value)}
          >
            <option value="all">All Supervisors</option>
            {filteredSupervisors.map((supervisor) => (
              <option key={supervisor.userID} value={supervisor.userID}>
                {supervisor.firstname} {supervisor.lastname} {supervisor.phone ? `(${supervisor.phone})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )}


      {/* Rest of the component remains unchanged */}
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
                    onClick={canAccessTimesheetDetails ? () => {
                      setCurrentWeek(week.weekNumber);
                      setViewMode("week");
                    } : undefined}
                  >
                    <span className="week-number">Week {week.weekNumber} :</span>
                    <span className="week-range">
                      {week.days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} -{" "}
                      {week.days[4].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} /
                    </span>
                    <span className="visit-count">{week.visits.length} Visits</span>
                    {canReadSupervisors && (
                      <span className="week-info">
                        Supervisors: {week.supervisorCount}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

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
                onClick={canAccessTimesheetDetails ? () => {
                  setCurrentWeek(week.weekNumber);
                  setViewMode("week");
                } : undefined}
              >
                <h3>Week {week.weekNumber}</h3>
                <p className="week-range">
                  {week.days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} -{" "}
                  {week.days[4].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </p>
                <p className="week-info">
                  {week.visits.length} Visits {!canReadSupervisors && `- Status: ${week.status}`}
                  {canReadSupervisors && ` - Supervisors: ${week.supervisorCount}`}                
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

{viewMode === "week" && (
  <section className="week-view">
    <div className="week-header">
      <button className="nav-btn" onClick={() => setCurrentWeek((prev) => Math.max(1, prev - 1))}>
        <span>←</span>
      </button>
      <h2>Week {currentWeek}</h2>
      <button className="nav-btn" onClick={() => setCurrentWeek((prev) => Math.min(getWeeksInYear(currentYear), prev + 1))}>
        <span>→</span>
      </button>
    </div>
    <div className="week-details">
      {(() => {
        const weekData = generateWeekData();
        return (
          <>
            <div className="week-details-header">
              <div className="week-details-info">
                <p className="week-range">
                  {weekData.days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} -{" "}
                  {weekData.days[4].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </p>
                <p className="week-status">
                  Status: {weekData.status}
                  {canReadSupervisors && weekData.supervisorID && ` - Supervisor: ${users.find(u => u.userID === weekData.supervisorID)?.firstname || "Unknown"} ${users.find(u => u.userID === weekData.supervisorID)?.lastname || ""}`}
                </p>
              </div>
              {canValidateTimesheets && weekData.status !== "Validated" && (
                <button
                  className="validate-timesheet-btn nav-btn"
                  onClick={() => handleValidateTimesheet(filteredTimesheets.find((ts) => ts.weekNumber === currentWeek)?.timesheetID || "")}
                >
                  Validate Entire Timesheet
                </button>
              )}
            </div>
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
                      onClick={canAccessTimesheetDetails ? () => {
                        setCurrentDay(day);
                        setViewMode("day");
                      } : undefined}
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
                            onClick={() => navigate(`/visit/${visit.visitID}`) }
                          >
                            { canReadSupervisors && visit.supervisorID && (
                              <p className="visit-supervisor">
                                <FaRegUser /> {users.find(u => u.userID === visit.supervisorID)?.firstname } {users.find(u => u.userID === visit.supervisorID)?.lastname}
                              </p>
                            )}
                            <hr />
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
                              <FaMapMarkerAlt /> {visit.location || "Location TBD"}
                            </p>
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

      {viewMode === "day" && (
        <section className="day-view">
          <div className="day-header">
            <button className="nav-btn" onClick={() => currentDay && setCurrentDay(new Date(currentDay.setDate(currentDay.getDate() - 1)))}>
              <span>←</span>
            </button>
            <h2>
              {currentDay?.toLocaleDateString("en-GB", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
              }).replace(/(\w+)\s(\d+)\/(\d+)/, "$1 $2/$3")}
            </h2>
            <button className="nav-btn" onClick={() => currentDay && setCurrentDay(new Date(currentDay.setDate(currentDay.getDate() + 1)))}>
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
                  {canReadSupervisors  && visit.supervisorID && (
                    <p className="visit-supervisor">
                      <FaRegUser /> {users.find(u => u.userID === visit.supervisorID)?.firstname || "Unknown"} {users.find(u => u.userID === visit.supervisorID)?.lastname || ""}
                    </p>
                  )}
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
                    <FaMapMarkerAlt /> {visit.location || "Location TBD"}
                  </p>
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
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./Timesheets.css";
import Timesheet from "../../models/Timesheet";
import Visit from "../../models/Visit";
import User from "../../models/User";
import { useAuth } from "../../context/AuthContext";
import { getTimesheetsBySupervisor, getAllTimesheets, validateTimesheet } from "../../apis/timesheetAPI";
import { getAllUsers, getSupervisorsByUser } from "../../apis/userAPI";
import { FaClock, FaMapMarkerAlt, FaRegUser } from "react-icons/fa";
import TimesheetStatus from "../../models/Enum/TimesheetStatus";


const PERMISSIONS = {
  ACCESS_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_ACCESS_TIMESHEETS,
  ACCESS_SUPERVISOR_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_ACCESS_SUPERVISOR_TIMESHEETS,

  ACCESS_TIMESHEET_DETAILS: import.meta.env.VITE_PERMISSIONS_ACCESS_TIMESHEET_DETAILS,

  CREATE_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS,
  CREATE_SUPERVISOR_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS_FOR_SUPERVISOR,
  VALIDATE_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_VALIDATE_TIMESHEETS,

  READ_USERS: import.meta.env.VITE_PERMISSIONS_READ_USERS,
  READ_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS,

  ACCESS_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOKS,
};

const ROLES = {
  SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
  SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
};

// Types
type ViewMode = "year" | "month" | "week" | "day";

interface VisitWithSupervisor extends Visit {
  supervisorID?: string;
}


// Main Component
const Timesheets: React.FC = () => {
  // Hooks
  const navigate = useNavigate();
  const { user, token, userRoles, effectivePermissions, permissionsLoaded } = useAuth();
  const supervisorID = user?.userID;

  // State
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [filteredTimesheets, setFilteredTimesheets] = useState<Timesheet[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentWeek, setCurrentWeek] = useState<number>(0);
  const [currentDay, setCurrentDay] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem("lastViewMode") as ViewMode) || "year");
  const [loading, setLoading] = useState<boolean>(true);
  const [supervisorFilter, setSupervisorFilter] = useState<string>(() => localStorage.getItem("supervisorFilter") || "all");
  const [supervisorSearch, setSupervisorSearch] = useState<string>("");

  // Permission Checks (Centralized)
  const userPermissions = useMemo(() => ({
    canAccessTimesheets: effectivePermissions?.some(p => p.name === PERMISSIONS.ACCESS_TIMESHEETS),
    canAccessSupervisorTimesheets: effectivePermissions?.some(p => p.name === PERMISSIONS.ACCESS_SUPERVISOR_TIMESHEETS),

    canAccessTimesheetDetails: effectivePermissions?.some(p => p.name === PERMISSIONS.ACCESS_TIMESHEET_DETAILS),

    canCreateTimesheets: effectivePermissions?.some(p => p.name === PERMISSIONS.CREATE_TIMESHEETS),
    canCreateSupervisorTimesheets: effectivePermissions?.some(p => p.name === PERMISSIONS.CREATE_SUPERVISOR_TIMESHEETS),

    canValidateTimesheets: effectivePermissions?.some(p => p.name === PERMISSIONS.VALIDATE_TIMESHEETS),

    canReadUsers: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_USERS),
    canReadSupervisors: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_SUPERVISORS),
    canAccessReceiptBooks: effectivePermissions?.some(p => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOKS),
  }), [effectivePermissions]);

  // Role Checks
  const isSuperAdmin = useMemo(() => userRoles?.some(role => role.name === ROLES.SUPER_ADMIN), [userRoles]);

  // Fetch Timesheets
  const fetchTimesheets = async () => {
    try {
      setLoading(true);
      let data: Timesheet[] = [];

      if (userPermissions.canAccessTimesheets) {
        data = await getAllTimesheets(token!);
      } else if (userPermissions.canReadSupervisors) {
        const supervisors = await getSupervisorsByUser(supervisorID!, token!);
        const supervisorTimesheetsPromises = supervisors.map(supervisor =>
          getTimesheetsBySupervisor(supervisor.userID, token!)
        );
        data = (await Promise.all(supervisorTimesheetsPromises)).flat();
      } else if (userPermissions.canAccessSupervisorTimesheets) {
        data = await getTimesheetsBySupervisor(supervisorID!, token!);
      }

      setTimesheets(data.filter(ts => ts.year === currentYear || (ts.year === currentYear - 1 && ts.weekNumber >= 52)));
    } catch (error) {
      console.error("Failed to fetch timesheets:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Users (Supervisors)
  const fetchUsers = async () => {
    try {
      let userData: User[] = [];
      if (isSuperAdmin) {
        userData = (await getAllUsers(token!)).filter(user =>
          user.Roles?.some(role => role.name.toLowerCase() === ROLES.SUPERVISOR.toLowerCase())
        );
      } else if (userPermissions.canReadSupervisors && supervisorID) {
        userData = (await getSupervisorsByUser(supervisorID, token!));
      }
      setUsers(userData);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  // Effects
  useEffect(() => {
    if (!permissionsLoaded || !supervisorID || !token) return;
    fetchTimesheets();
    updateCurrentWeekAndDay();
  }, [currentYear, supervisorID, token, permissionsLoaded, userPermissions]);

  useEffect(() => {
    if (!token || !permissionsLoaded || (!userPermissions.canReadUsers && !userPermissions.canReadSupervisors)) return;
    fetchUsers();
  }, [token, permissionsLoaded, userPermissions, supervisorID, isSuperAdmin]);

  useEffect(() => {
    if (userPermissions.canAccessTimesheets || userPermissions.canReadSupervisors) {
      setFilteredTimesheets(supervisorFilter === "all" ? timesheets : timesheets.filter(ts => ts.supervisorID === supervisorFilter));
    } else {
      setFilteredTimesheets(timesheets);
    }
  }, [timesheets, supervisorFilter, userPermissions]);

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
    return date >= nextFirstMonday ? getWeekNumber(date) : (weekNum > 0 && weekNum <= getWeeksInYear(year) ? weekNum : 1);
  };

  const getWeeksInYear = (year: number): number => {
    const jan1 = new Date(year, 0, 1);
    const firstFridayOffset = (5 - jan1.getDay() + 7) % 7;
    const firstMonday = new Date(year, 0, 1 + firstFridayOffset - 4);
    const nextJan1 = new Date(year + 1, 0, 1);
    const nextFirstFridayOffset = (5 - nextJan1.getDay() + 7) % 7;
    const nextFirstMonday = new Date(year + 1, 0, 1 + nextFirstFridayOffset - 4);
    return Math.floor((nextFirstMonday.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24) / 7);
  };

  const updateCurrentWeekAndDay = () => {
    const today = new Date();
    setCurrentWeek(getWeekNumber(today));
    setCurrentDay(today.getDay() === 0 || today.getDay() === 6 ? new Date(today.setDate(today.getDate() - (today.getDay() || 7) + 1)) : today);
  };

  const getWeekDays = (year: number, weekNumber: number): Date[] =>
    Array.from({ length: 5 }, (_, i) => {
      const jan1 = new Date(year, 0, 1);
      const firstFridayOffset = (5 - jan1.getDay() + 7) % 7;
      const firstMonday = new Date(year, 0, 1 + firstFridayOffset - 4);
      const weekStart = new Date(firstMonday);
      weekStart.setDate(firstMonday.getDate() + (weekNumber - 1) * 7 + i);
      weekStart.setHours(0, 0, 0, 0);
      return weekStart;
    });

  const sortVisitsByTime = (visits: VisitWithSupervisor[]): VisitWithSupervisor[] => [...visits].sort((a, b) => a.time.localeCompare(b.time));

  // Data Generation Functions
  const generateYearData = () => {
    const weeksInYear = getWeeksInYear(currentYear);
    const months = Array.from({ length: 12 }, (_, m) => ({ month: m, weeks: [] })) as {
      month: number;
      weeks: { weekNumber: number; days: Date[]; visits: VisitWithSupervisor[]; status: string; supervisorCount: number }[];
    }[];

    for (let week = 1; week <= weeksInYear; week++) {
      const days = getWeekDays(currentYear, week);
      const assignedMonth = week === 1 ? 0 : Number(Object.entries(days.reduce((acc, day) => {
        const month = day.getMonth();
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {} as Record<number, number>)).reduce((a, b) => (b[1] > a[1] ? b : a))[0]);

      const matchingTimesheets = filteredTimesheets.filter(ts => ts.weekNumber === week && ts.year === currentYear);
      const allVisits = matchingTimesheets.flatMap(ts => (ts.Visits || []).map(visit => ({ ...visit, supervisorID: ts.supervisorID })));
      months[assignedMonth].weeks.push({
        weekNumber: week,
        days,
        visits: allVisits,
        status: matchingTimesheets[0]?.status || "Not Scheduled",
        supervisorCount: new Set(matchingTimesheets.map(ts => ts.supervisorID)).size,
      });
    }
    return months;
  };

  const generateMonthData = () => {
    const weeksInYear = getWeeksInYear(currentYear);
    return Array.from({ length: weeksInYear }, (_, week) => week + 1).reduce((weeks, week) => {
      const days = getWeekDays(currentYear, week);
      if (!days.some(day => day.getMonth() === currentMonth && day.getFullYear() === currentYear)) return weeks;

      const matchingTimesheets = filteredTimesheets.filter(ts => ts.weekNumber === week && ts.year === currentYear);
      return weeks.concat({
        weekNumber: week,
        days,
        visits: matchingTimesheets.flatMap(ts => (ts.Visits || []).map(visit => ({ ...visit, supervisorID: ts.supervisorID }))),
        status: matchingTimesheets[0]?.status || "Not Scheduled",
        supervisorCount: new Set(matchingTimesheets.map(ts => ts.supervisorID)).size,
      });
    }, [] as { weekNumber: number; days: Date[]; visits: VisitWithSupervisor[]; status: string; supervisorCount: number }[]);
  };

  const generateWeekData = () => {
    const matchingTimesheets = filteredTimesheets.filter(ts => ts.weekNumber === currentWeek);
    const weekDays = getWeekDays(currentYear, currentWeek);
    return {
      weekNumber: currentWeek,
      days: weekDays,
      visits: matchingTimesheets.flatMap(ts =>
        (ts.Visits || []).map(visit => ({
          ...visit,
          supervisorID: ts.supervisorID,
          date: new Date(new Date(visit.date).getTime() - (24 * 60 * 60 * 1000)).toISOString()
        }))
      ),
      status: matchingTimesheets[0]?.status || "Not Scheduled",
      supervisorID: matchingTimesheets[0]?.supervisorID,
      supervisorCount: new Set(matchingTimesheets.map(ts => ts.supervisorID)).size,
    };
  };

  const generateDayData = () => {
    if (!currentDay) return [];
    const dateStr = currentDay.toISOString().split("T")[0];
    return sortVisitsByTime(
      filteredTimesheets
        .flatMap(ts => (ts.Visits || []).map(visit => ({ ...visit, supervisorID: ts.supervisorID })))
        .filter(visit => visit.date.split("T")[0] === dateStr)
    );
  };

  // Handlers
  const scrollToCurrent = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    updateCurrentWeekAndDay();
    setTimeout(() => {
      const id = viewMode === "year" ? `month-${today.getMonth()}` : viewMode === "month" || viewMode === "week" ? `week-${currentWeek}` : `day-${today.toISOString().split("T")[0]}`;
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  };

  const handleValidateTimesheet = async (timesheetID: string) => {
    if (!userPermissions.canValidateTimesheets) return;
    try {
      const timesheet = filteredTimesheets.find(ts => ts.timesheetID === timesheetID);
      if (!timesheet) return;
      await validateTimesheet(timesheetID, { visitIDs: timesheet.Visits?.map(v => v.visitID) || [], status: "validated" }, token!);
      await fetchTimesheets();
    } catch (error) {
      console.error("Failed to validate timesheet:", error);
    }
  };

  // Memoized Filtered Supervisors
  const filteredSupervisors = useMemo(() =>
    supervisorSearch
      ? users.filter(user => `${user.firstname} ${user.lastname}`.toLowerCase().includes(supervisorSearch.toLowerCase()) || (user.phone?.toLowerCase().includes(supervisorSearch.toLowerCase())))
      : users,
    [users, supervisorSearch]
  );

  // Early Returns
  if (!token) {
    navigate("/access-denied");
    return null;
  }
  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading Timesheet...</p>
      </div>
    );
  }

  // Render
  return (
    <div className="timesheets-container">
      <header className="timesheets-header">
        <div className="view-toggle">
          {["year", "month", "week", "day"].map(mode => (
            <button key={mode} className={`toggle-btn ${viewMode === mode ? "active" : ""}`} onClick={() => setViewMode(mode as ViewMode)}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        <div className="year-navigation">
          <button className="nav-btn" onClick={() => setCurrentYear(prev => prev - 1)}><span>←</span></button>
          <h1>{currentYear}</h1>
          <button className="nav-btn" onClick={() => setCurrentYear(prev => prev + 1)}><span>→</span></button>
        </div>
        <div className="action-buttons">
          {(userPermissions.canCreateTimesheets || userPermissions.canCreateSupervisorTimesheets) && (

            <button className="create-btn" onClick={() => navigate("/timesheet-form", { state: { year: currentYear } })}>
              Schedule Visit
            </button>
          )}
          {userPermissions.canAccessReceiptBooks && (
            <button className="receipt-books-btn" onClick={() => navigate("/receipt-books")}>
              Receipt Books
            </button>
          )}
          <button className="current-btn" onClick={scrollToCurrent}>
            Current {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}
          </button>
        </div>
      </header>

      {(isSuperAdmin || userPermissions.canReadSupervisors) && (
        <div className="filter-bubble">
          <button className="filter-toggle-btn">Filter Supervisors</button>
          <div className="filter-panel">
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={supervisorSearch}
              onChange={e => setSupervisorSearch(e.target.value)}
              className="supervisor-search"
            />
            <select className="supervisor-filter" value={supervisorFilter} onChange={e => setSupervisorFilter(e.target.value)}>
              <option value="all">All Supervisors</option>
              {filteredSupervisors.map(supervisor => (
                <option key={supervisor.userID} value={supervisor.userID}>
                  {supervisor.firstname} {supervisor.lastname} {supervisor.phone ? `(${supervisor.phone})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {viewMode === "year" && (
        <section className="year-view">
          {generateYearData().map(({ month, weeks }) => (
            <div className="month-card" key={month} id={`month-${month}`}>
              <h2>{new Date(currentYear, month).toLocaleString("default", { month: "long" })}</h2>
              <div className="weeks-grid">
                {weeks.map(week => (
                  <div
                    className="week-tile"
                    key={week.weekNumber}
                    onClick={userPermissions.canAccessTimesheetDetails ? () => { setCurrentWeek(week.weekNumber); setViewMode("week"); } : undefined}
                  >
                    <span className="week-number">Week {week.weekNumber} :</span>
                    <span className="week-range">
                      {week.days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} -{" "}
                      {week.days[4].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} /
                    </span>
                    <span className="visit-count">{week.visits.length} Visits</span>
                    {userPermissions.canReadSupervisors && <span className="week-info">Supervisors: {week.supervisorCount}</span>}
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
            <button className="nav-btn" onClick={() => setCurrentMonth(prev => (prev - 1 + 12) % 12)}><span>←</span></button>
            <h2>{new Date(currentYear, currentMonth).toLocaleString("default", { month: "long" })}</h2>
            <button className="nav-btn" onClick={() => setCurrentMonth(prev => (prev + 1) % 12)}><span>→</span></button>
          </div>
          <div className="weeks-grid">
            {generateMonthData().map(week => (
              <div
                className="week-card"
                key={week.weekNumber}
                id={`week-${week.weekNumber}`}
                onClick={userPermissions.canAccessTimesheetDetails ? () => { setCurrentWeek(week.weekNumber); setViewMode("week"); } : undefined}
              >
                <h3>Week {week.weekNumber}</h3>
                <p className="week-range">
                  {week.days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} -{" "}
                  {week.days[4].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </p>
                <p className="week-info">
                  {week.visits.length} Visits {!userPermissions.canReadSupervisors && `- Status: ${week.status}`}
                  {userPermissions.canReadSupervisors && ` - Supervisors: ${week.supervisorCount}`}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {viewMode === "week" && (
        <section className="week-view">
          <div className="week-header">
            <button className="nav-btn" onClick={() => setCurrentWeek(prev => Math.max(1, prev - 1))}><span>←</span></button>
            <h2>Week {currentWeek}</h2>
            <button className="nav-btn" onClick={() => setCurrentWeek(prev => Math.min(getWeeksInYear(currentYear), prev + 1))}><span>→</span></button>
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
                        {userPermissions.canReadSupervisors && weekData.supervisorID && ` - Supervisor: ${users.find(u => u.userID === weekData.supervisorID)?.firstname || "Unknown"} ${users.find(u => u.userID === weekData.supervisorID)?.lastname || ""}`}
                      </p>
                    </div>
                    {userPermissions.canValidateTimesheets && weekData.status !== TimesheetStatus.VALIDATED && (
                      <button
                        className="validate-timesheet-btn nav-btn"
                        onClick={() => handleValidateTimesheet(filteredTimesheets.find(ts => ts.weekNumber === currentWeek)?.timesheetID || "")}
                      >
                        Validate Entire Timesheet
                      </button>
                    )}
                  </div>
                  <div className="days-grid">
                    {weekData.days.map(day => {
                      const dayStr = day.toISOString().split("T")[0];
                      const dayVisits = sortVisitsByTime(weekData.visits.filter(v => new Date(v.date).toISOString().split("T")[0] === dayStr));
                      return (
                        <div className="day-column" key={dayStr}>
                          <div
                            className="day-tile"
                            onClick={userPermissions.canAccessTimesheetDetails ? () => { setCurrentDay(day); setViewMode("day"); } : undefined}
                          >
                            <span className="day-name">{day.toLocaleDateString("en-GB", { weekday: "short" })}</span>
                            <span className="day-date">{day.getDate()}</span>
                            <span className="visit-count">{dayVisits.length > 0 ? `/ ${dayVisits.length} Visits` : ""}</span>
                          </div>
                          <div className="visits-list">
                            {dayVisits.length > 0 ? dayVisits.map(visit => (
                              <div key={visit.visitID} className="visit-card" onClick={() => navigate(`/visit/${visit.visitID}`)}>
                                {userPermissions.canReadSupervisors && visit.supervisorID && (
                                  <p className="visit-supervisor">
                                    <FaRegUser /> {users.find(u => u.userID === visit.supervisorID)?.firstname} {users.find(u => u.userID === visit.supervisorID)?.lastname}
                                  </p>
                                )}
                                <hr className="hr" />
                                <div className="visit-header">
                                  {visit.time && <span className="visit-time"><FaClock /> {visit.time.split(":").slice(0, 2).join(":")}</span>}
                                  <span className={`visit-status status-${visit.status.toLowerCase()}`}>{visit.status}</span>
                                </div>
                                <p className="visit-location"><FaMapMarkerAlt /> {visit.location || "Location TBD"}</p>
                                {visit.Reasons!.length > 0 && (
                                  <p className="visit-reasons">Reasons: {visit.Reasons!.map(reason => reason.item).join(", ")}</p>
                                )}
                              </div>
                            )) : <div className="no-visits">No Visits Scheduled</div>}
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
            <button className="nav-btn" onClick={() => currentDay && setCurrentDay(new Date(currentDay.setDate(currentDay.getDate() - 1)))}><span>←</span></button>
            <h2>{currentDay?.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(/(\w+)\s(\d+)\/(\d+)/, "$1 $2/$3")}</h2>
            <button className="nav-btn" onClick={() => currentDay && setCurrentDay(new Date(currentDay.setDate(currentDay.getDate() + 1)))}><span>→</span></button>
          </div>
          <div className="visits-list">
            {generateDayData().length > 0 ? generateDayData().map(visit => (
              <div key={visit.visitID} className="visit-card" onClick={() => navigate(`/visit/${visit.visitID}`)}>
                {userPermissions.canReadSupervisors && visit.supervisorID && (
                  <p className="visit-supervisor">
                    <FaRegUser /> {users.find(u => u.userID === visit.supervisorID)?.firstname || "Unknown"} {users.find(u => u.userID === visit.supervisorID)?.lastname || ""}
                  </p>
                )}
                <div className="visit-header">
                  {visit.time && <span className="visit-time"><FaClock /> {visit.time.split(":").slice(0, 2).join(":")}</span>}
                  <span className={`visit-status status-${visit.status.toLowerCase()}`}>{visit.status}</span>
                </div>
                <p className="visit-location"><FaMapMarkerAlt /> {visit.location || "Location TBD"}</p>
                {visit.Reasons!.length > 0 && (
                  <p className="visit-reasons">Reasons: {visit.Reasons!.map(reason => reason.item).join(", ")}</p>
                )}
              </div>
            )) : <div className="no-visits">No Visits Scheduled</div>}
          </div>
        </section>
      )}
    </div>
  );
};

export default Timesheets;
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./Timesheets.css";
import Timesheet from "../../models/Timesheet";
import Visit from "../../models/Visit";
import User from "../../models/User";
import { useAuth } from "../../context/AuthContext";
import {
  getTimesheetsBySupervisor,
  getAllTimesheets,
  validateTimesheet,
} from "../../apis/timesheetAPI";
import { getAllUsers, getSupervisorsByUser } from "../../apis/userAPI";
import { FaClock, FaMapMarkerAlt, FaRegUser } from "react-icons/fa";
import TimesheetStatus from "../../models/Enum/TimesheetStatus";
import { useTranslation } from "react-i18next";

const PERMISSIONS = {
  ACCESS_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_ACCESS_TIMESHEETS,
  ACCESS_SUPERVISOR_TIMESHEETS: import.meta.env
    .VITE_PERMISSIONS_ACCESS_SUPERVISOR_TIMESHEETS,
  ACCESS_TIMESHEET_DETAILS: import.meta.env
    .VITE_PERMISSIONS_ACCESS_TIMESHEET_DETAILS,
  CREATE_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS,
  CREATE_SUPERVISOR_TIMESHEETS: import.meta.env
    .VITE_PERMISSIONS_CREATE_TIMESHEETS_FOR_SUPERVISOR,
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
  const { user, userRoles, effectivePermissions, permissionsLoaded } =
    useAuth();
  const supervisorID = user?.userID;
  const { t } = useTranslation();

  // State
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [filteredTimesheets, setFilteredTimesheets] = useState<Timesheet[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentWeek, setCurrentWeek] = useState<number>(0);
  const [currentDay, setCurrentDay] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem("lastViewMode") as ViewMode) || "year"
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [supervisorFilter, setSupervisorFilter] = useState<string>(
    () => localStorage.getItem("supervisorFilter") || "all"
  );
  const [supervisorSearch, setSupervisorSearch] = useState<string>("");

  // Permission Checks (Centralized)
  const userPermissions = useMemo(
    () => ({
      canAccessTimesheets: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.ACCESS_TIMESHEETS
      ),
      canAccessSupervisorTimesheets: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.ACCESS_SUPERVISOR_TIMESHEETS
      ),
      canAccessTimesheetDetails: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.ACCESS_TIMESHEET_DETAILS
      ),
      canCreateTimesheets: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.CREATE_TIMESHEETS
      ),
      canCreateSupervisorTimesheets: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.CREATE_SUPERVISOR_TIMESHEETS
      ),
      canValidateTimesheets: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.VALIDATE_TIMESHEETS
      ),
      canReadUsers: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.READ_USERS
      ),
      canReadSupervisors: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.READ_SUPERVISORS
      ),
      canAccessReceiptBooks: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOKS
      ),
    }),
    [effectivePermissions]
  );

  // Role Checks
  const isSuperAdmin = useMemo(
    () => userRoles?.some((role) => role.name === ROLES.SUPER_ADMIN),
    [userRoles]
  );

  // Fetch Timesheets
  const fetchTimesheets = async () => {
    try {
      setLoading(true);
      let data: Timesheet[] = [];

      if (userPermissions.canAccessTimesheets) {
        data = await getAllTimesheets();
      } else if (userPermissions.canReadSupervisors) {
        const supervisors = await getSupervisorsByUser(supervisorID!);
        const supervisorTimesheetsPromises = supervisors.map((supervisor) =>
          getTimesheetsBySupervisor(supervisor.userID)
        );
        data = (await Promise.all(supervisorTimesheetsPromises)).flat();
      } else if (userPermissions.canAccessSupervisorTimesheets) {
        data = await getTimesheetsBySupervisor(supervisorID!);
      }

      setTimesheets(
        data.filter(
          (ts) =>
            ts.year === currentYear ||
            (ts.year === currentYear - 1 && ts.weekNumber >= 52)
        )
      );
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
        userData = (await getAllUsers()).filter((user) =>
          user.Roles?.some(
            (role) => role.name.toLowerCase() === ROLES.SUPERVISOR.toLowerCase()
          )
        );
      } else if (userPermissions.canReadSupervisors && supervisorID) {
        userData = await getSupervisorsByUser(supervisorID);
      }
      setUsers(userData);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  // Effects
  useEffect(() => {
    if (!permissionsLoaded || !supervisorID) return;
    fetchTimesheets();
    updateCurrentWeekAndDay();
  }, [currentYear, supervisorID, permissionsLoaded, userPermissions]);

  useEffect(() => {
    if (
      !permissionsLoaded ||
      (!userPermissions.canReadUsers && !userPermissions.canReadSupervisors)
    )
      return;
    fetchUsers();
  }, [permissionsLoaded, userPermissions, supervisorID, isSuperAdmin]);

  useEffect(() => {
    if (
      userPermissions.canAccessTimesheets ||
      userPermissions.canReadSupervisors
    ) {
      setFilteredTimesheets(
        supervisorFilter === "all"
          ? timesheets
          : timesheets.filter((ts) => ts.supervisorID === supervisorFilter)
      );
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
    const nextFirstMonday = new Date(
      year + 1,
      0,
      1 + nextFirstFridayOffset - 4
    );
    return date >= nextFirstMonday
      ? getWeekNumber(date)
      : weekNum > 0 && weekNum <= getWeeksInYear(year)
      ? weekNum
      : 1;
  };

  const getWeeksInYear = (year: number): number => {
    const jan1 = new Date(year, 0, 1);
    const firstFridayOffset = (5 - jan1.getDay() + 7) % 7;
    const firstMonday = new Date(year, 0, 1 + firstFridayOffset - 4);
    const nextJan1 = new Date(year + 1, 0, 1);
    const nextFirstFridayOffset = (5 - nextJan1.getDay() + 7) % 7;
    const nextFirstMonday = new Date(
      year + 1,
      0,
      1 + nextFirstFridayOffset - 4
    );
    return Math.floor(
      (nextFirstMonday.getTime() - firstMonday.getTime()) /
        (1000 * 60 * 60 * 24) /
        7
    );
  };

  const updateCurrentWeekAndDay = () => {
    const today = new Date();
    setCurrentWeek(getWeekNumber(today));
    setCurrentDay(today);
  };

  const getWeekDays = (year: number, weekNumber: number): Date[] =>
    Array.from({ length: 7 }, (_, i) => {
      const jan1 = new Date(year, 0, 1);
      const firstFridayOffset = (5 - jan1.getDay() + 7) % 7;
      const firstMonday = new Date(year, 0, 1 + firstFridayOffset - 4);
      const weekStart = new Date(firstMonday);
      weekStart.setDate(firstMonday.getDate() + (weekNumber - 1) * 7 + i);
      weekStart.setHours(0, 0, 0, 0);
      return weekStart;
    });

  const sortVisitsByTime = (
    visits: VisitWithSupervisor[]
  ): VisitWithSupervisor[] =>
    [...visits].sort((a, b) => a.time.localeCompare(b.time));

  // Data Generation Functions
  const generateYearData = () => {
    const weeksInYear = getWeeksInYear(currentYear);
    const months = Array.from({ length: 12 }, (_, m) => ({
      month: m,
      weeks: [],
    })) as {
      month: number;
      weeks: {
        weekNumber: number;
        days: Date[];
        visits: VisitWithSupervisor[];
        status: string;
        supervisorCount: number;
      }[];
    }[];

    for (let week = 1; week <= weeksInYear; week++) {
      const days = getWeekDays(currentYear, week);
      const assignedMonth =
        week === 1
          ? 0
          : Number(
              Object.entries(
                days.reduce((acc, day) => {
                  const month = day.getMonth();
                  acc[month] = (acc[month] || 0) + 1;
                  return acc;
                }, {} as Record<number, number>)
              ).reduce((a, b) => (b[1] > a[1] ? b : a))[0]
            );

      const matchingTimesheets = filteredTimesheets.filter(
        (ts) => ts.weekNumber === week && ts.year === currentYear
      );
      const allVisits = matchingTimesheets.flatMap((ts) =>
        (ts.Visits || []).map((visit) => ({
          ...visit,
          supervisorID: ts.supervisorID,
        }))
      );
      months[assignedMonth].weeks.push({
        weekNumber: week,
        days,
        visits: allVisits,
        status: matchingTimesheets[0]?.status || "Not Scheduled",
        supervisorCount: new Set(
          matchingTimesheets.map((ts) => ts.supervisorID)
        ).size,
      });
    }
    return months;
  };

  const generateMonthData = () => {
    const weeksInYear = getWeeksInYear(currentYear);
    return Array.from({ length: weeksInYear }, (_, week) => week + 1).reduce(
      (weeks, week) => {
        const days = getWeekDays(currentYear, week);
        if (
          !days.some(
            (day) =>
              day.getMonth() === currentMonth &&
              day.getFullYear() === currentYear
          )
        )
          return weeks;

        const matchingTimesheets = filteredTimesheets.filter(
          (ts) => ts.weekNumber === week && ts.year === currentYear
        );
        return weeks.concat({
          weekNumber: week,
          days,
          visits: matchingTimesheets.flatMap((ts) =>
            (ts.Visits || []).map((visit) => ({
              ...visit,
              supervisorID: ts.supervisorID,
            }))
          ),
          status: matchingTimesheets[0]?.status || "Not Scheduled",
          supervisorCount: new Set(
            matchingTimesheets.map((ts) => ts.supervisorID)
          ).size,
        });
      },
      [] as {
        weekNumber: number;
        days: Date[];
        visits: VisitWithSupervisor[];
        status: string;
        supervisorCount: number;
      }[]
    );
  };

  const generateWeekData = () => {
    const matchingTimesheets = filteredTimesheets.filter(
      (ts) => ts.weekNumber === currentWeek
    );
    const weekDays = getWeekDays(currentYear, currentWeek);
    return {
      weekNumber: currentWeek,
      days: weekDays,
      visits: matchingTimesheets.flatMap((ts) =>
        (ts.Visits || []).map((visit) => ({
          ...visit,
          supervisorID: ts.supervisorID,
        }))
      ),
      status: matchingTimesheets[0]?.status || "Not Scheduled",
      supervisorID: matchingTimesheets[0]?.supervisorID,
      supervisorCount: new Set(matchingTimesheets.map((ts) => ts.supervisorID))
        .size,
    };
  };

  const generateDayData = () => {
    if (!currentDay) return [];
    const dateStr = currentDay.toISOString().split("T")[0];
    return sortVisitsByTime(
      filteredTimesheets
        .flatMap((ts) =>
          (ts.Visits || []).map((visit) => ({
            ...visit,
            supervisorID: ts.supervisorID,
          }))
        )
        .filter((visit) => visit.date.split("T")[0] === dateStr)
    );
  };

  // Handlers
  const scrollToCurrent = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    updateCurrentWeekAndDay();
    setTimeout(() => {
      const id =
        viewMode === "year"
          ? `month-${today.getMonth()}`
          : viewMode === "month" || viewMode === "week"
          ? `week-${currentWeek}`
          : `day-${today.toISOString().split("T")[0]}`;
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  };

  const handleValidateTimesheet = async (timesheetID: string) => {
    if (!userPermissions.canValidateTimesheets) return;
    try {
      const timesheet = filteredTimesheets.find(
        (ts) => ts.timesheetID === timesheetID
      );
      if (!timesheet) return;
      await validateTimesheet(timesheetID, {
        visitIDs: timesheet.Visits?.map((v) => v.visitID) || [],
        status: "validated",
      });
      await fetchTimesheets();
    } catch (error) {
      console.error("Failed to validate timesheet:", error);
    }
  };

  // Memoized Filtered Supervisors
  const filteredSupervisors = useMemo(
    () =>
      supervisorSearch
        ? users.filter(
            (user) =>
              `${user.firstname} ${user.lastname}`
                .toLowerCase()
                .includes(supervisorSearch.toLowerCase()) ||
              user.phone?.toLowerCase().includes(supervisorSearch.toLowerCase())
          )
        : users,
    [users, supervisorSearch]
  );

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>{t("timesheets.loading")}</p>
      </div>
    );
  }

  // Render
  return (
    <div className="timesheets-container">
      <header className="timesheets-header">
        <div className="view-toggle">
          {["year", "month", "week", "day"].map((mode) => (
            <button
              key={mode}
              className={`toggle-btn ${viewMode === mode ? "active" : ""}`}
              onClick={() => setViewMode(mode as ViewMode)}
              aria-label={t(`timesheets.viewModes.${mode}`)}
            >
              {t(`timesheets.viewModes.${mode}`)}
            </button>
          ))}
        </div>
        <div className="year-navigation">
          <button
            className="nav-btn"
            onClick={() => setCurrentYear((prev) => prev - 1)}
            aria-label={t("timesheets.navigation.previousYear")}
          >
            <span>←</span>
          </button>
          <h1>{currentYear}</h1>
          <button
            className="nav-btn"
            onClick={() => setCurrentYear((prev) => prev + 1)}
            aria-label={t("timesheets.navigation.nextYear")}
          >
            <span>→</span>
          </button>
        </div>
        <div className="action-buttons">
          {(userPermissions.canCreateTimesheets ||
            userPermissions.canCreateSupervisorTimesheets) && (
            <button
              className="create-btn"
              onClick={() =>
                navigate("/timesheet-form", { state: { year: currentYear } })
              }
              aria-label={t("timesheets.actions.scheduleVisit")}
            >
              {t("timesheets.actions.scheduleVisit")}
            </button>
          )}
          {userPermissions.canAccessReceiptBooks && (
            <button
              className="receipt-books-btn"
              onClick={() => navigate("/receipt-books")}
              aria-label={t("timesheets.actions.viewReceiptBooks")}
            >
              {t("timesheets.actions.viewReceiptBooks")}
            </button>
          )}
          <button
            className="current-btn"
            onClick={scrollToCurrent}
            aria-label={t("timesheets.actions.scrollToCurrent")}
          >
            {t("timesheets.actions.current", {
              view: t(`timesheets.viewModes.${viewMode}`),
            })}
          </button>
        </div>
      </header>

      {(isSuperAdmin || userPermissions.canReadSupervisors) && (
        <div className="filter-bubble">
          <button
            className="filter-toggle-btn"
            aria-label={t("timesheets.actions.filterSupervisors")}
          >
            {t("timesheets.actions.filterSupervisors")}
          </button>
          <div className="filter-panel">
            <input
              type="text"
              placeholder={t("timesheets.filter.searchPlaceholder")}
              value={supervisorSearch}
              onChange={(e) => setSupervisorSearch(e.target.value)}
              className="supervisor-search"
              aria-label={t("timesheets.filter.searchPlaceholder")}
            />
            <select
              className="supervisor-filter"
              value={supervisorFilter}
              onChange={(e) => setSupervisorFilter(e.target.value)}
              aria-label={t("timesheets.filter.supervisorSelect")}
            >
              <option value="all">
                {t("timesheets.filter.allSupervisors")}
              </option>
              {filteredSupervisors.map((supervisor) => (
                <option key={supervisor.userID} value={supervisor.userID}>
                  {supervisor.firstname} {supervisor.lastname}{" "}
                  {supervisor.phone ? `(${supervisor.phone})` : ""}
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
              <h2>
                {new Date(currentYear, month).toLocaleString("default", {
                  month: "long",
                })}
              </h2>
              <div className="weeks-grid">
                {weeks.map((week) => (
                  <div
                    className="week-tile"
                    key={week.weekNumber}
                    onClick={
                      userPermissions.canAccessTimesheetDetails
                        ? () => {
                            setCurrentWeek(week.weekNumber);
                            setViewMode("week");
                          }
                        : undefined
                    }
                    role="button"
                    tabIndex={
                      userPermissions.canAccessTimesheetDetails ? 0 : -1
                    }
                    onKeyDown={(e) =>
                      userPermissions.canAccessTimesheetDetails &&
                      e.key === "Enter" &&
                      (setCurrentWeek(week.weekNumber), setViewMode("week"))
                    }
                    aria-label={t("timesheets.yearView.weekTile", {
                      weekNumber: week.weekNumber,
                    })}
                  >
                    <span className="week-number">
                      {t("timesheets.yearView.week")} {week.weekNumber} :
                    </span>
                    <span className="week-range">
                      {week.days[0].toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      -{" "}
                      {week.days[6].toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      /
                    </span>
                    <span className="visit-count">
                      {week.visits.length} {t("timesheets.yearView.visits")}
                    </span>
                    {userPermissions.canReadSupervisors && (
                      <span className="week-info">
                        <br />
                        {t("timesheets.yearView.supervisors", {
                          count: week.supervisorCount,
                        })}
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
            <button
              className="nav-btn"
              onClick={() => setCurrentMonth((prev) => (prev - 1 + 12) % 12)}
              aria-label={t("timesheets.navigation.previousMonth")}
            >
              <span>←</span>
            </button>
            <h2>
              {new Date(currentYear, currentMonth).toLocaleString("default", {
                month: "long",
              })}
            </h2>
            <button
              className="nav-btn"
              onClick={() => setCurrentMonth((prev) => (prev + 1) % 12)}
              aria-label={t("timesheets.navigation.nextMonth")}
            >
              <span>→</span>
            </button>
          </div>
          <div className="weeks-grid">
            {generateMonthData().map((week) => (
              <div
                className="week-card"
                key={week.weekNumber}
                id={`week-${week.weekNumber}`}
                onClick={
                  userPermissions.canAccessTimesheetDetails
                    ? () => {
                        setCurrentWeek(week.weekNumber);
                        setViewMode("week");
                      }
                    : undefined
                }
                role="button"
                tabIndex={userPermissions.canAccessTimesheetDetails ? 0 : -1}
                onKeyDown={(e) =>
                  userPermissions.canAccessTimesheetDetails &&
                  e.key === "Enter" &&
                  (setCurrentWeek(week.weekNumber), setViewMode("week"))
                }
                aria-label={t("timesheets.monthView.weekCard", {
                  weekNumber: week.weekNumber,
                })}
              >
                <h3>
                  {t("timesheets.monthView.week")} {week.weekNumber}
                </h3>
                <p className="week-range">
                  {week.days[0].toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  -{" "}
                  {week.days[6].toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
                <p className="week-info">
                  {week.visits.length} {t("timesheets.monthView.visits")}{" "}
                  {!userPermissions.canReadSupervisors &&
                    `- ${t("timesheets.monthView.status")}: ${week.status}`}
                  {userPermissions.canReadSupervisors &&
                    ` - ${t("timesheets.monthView.supervisors", {
                      count: week.supervisorCount,
                    })}`}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {viewMode === "week" && (
        <section className="week-view">
          <div className="week-header">
            <button
              className="nav-btn"
              onClick={() => setCurrentWeek((prev) => Math.max(1, prev - 1))}
              aria-label={t("timesheets.navigation.previousWeek")}
            >
              <span>←</span>
            </button>
            <h2>
              {t("timesheets.weekView.week")} {currentWeek}
            </h2>
            <button
              className="nav-btn"
              onClick={() =>
                setCurrentWeek((prev) =>
                  Math.min(getWeeksInYear(currentYear), prev + 1)
                )
              }
              aria-label={t("timesheets.navigation.nextWeek")}
            >
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
                        {weekData.days[0].toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        -{" "}
                        {weekData.days[6].toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                      <p className="week-status">
                        {t("timesheets.weekView.status")}: {weekData.status}
                        {userPermissions.canReadSupervisors &&
                          weekData.supervisorID &&
                          ` - ${t("timesheets.weekView.supervisor")}: ${
                            users.find(
                              (u) => u.userID === weekData.supervisorID
                            )?.firstname || "Unknown"
                          } ${
                            users.find(
                              (u) => u.userID === weekData.supervisorID
                            )?.lastname || ""
                          }`}
                      </p>
                    </div>
                    {userPermissions.canValidateTimesheets &&
                      weekData.status !== TimesheetStatus.VALIDATED && (
                        <button
                          className="validate-timesheet-btn nav-btn"
                          onClick={() =>
                            handleValidateTimesheet(
                              filteredTimesheets.find(
                                (ts) => ts.weekNumber === currentWeek
                              )?.timesheetID || ""
                            )
                          }
                          aria-label={t("timesheets.actions.validateTimesheet")}
                        >
                          {t("timesheets.actions.validateTimesheet")}
                        </button>
                      )}
                  </div>
                  <div className="days-grid">
                    {weekData.days.map((day) => {
                      const dayStr = `${day.getFullYear()}-${String(
                        day.getMonth() + 1
                      ).padStart(2, "0")}-${String(day.getDate()).padStart(
                        2,
                        "0"
                      )}`;
                      const dayVisits = sortVisitsByTime(
                        weekData.visits.filter((v) => {
                          const visitDate = new Date(v.date);
                          const visitDateStr = `${visitDate.getFullYear()}-${String(
                            visitDate.getMonth() + 1
                          ).padStart(2, "0")}-${String(
                            visitDate.getDate()
                          ).padStart(2, "0")}`;
                          return visitDateStr === dayStr;
                        })
                      );
                      return (
                        <div className="day-column" key={dayStr}>
                          <div
                            className="day-tile"
                            onClick={
                              userPermissions.canAccessTimesheetDetails
                                ? () => {
                                    setCurrentDay(day);
                                    setViewMode("day");
                                  }
                                : undefined
                            }
                            role="button"
                            tabIndex={
                              userPermissions.canAccessTimesheetDetails ? 0 : -1
                            }
                            onKeyDown={(e) =>
                              userPermissions.canAccessTimesheetDetails &&
                              e.key === "Enter" &&
                              (setCurrentDay(day), setViewMode("day"))
                            }
                            aria-label={t("timesheets.weekView.dayTile", {
                              day: day.toLocaleDateString("en-GB", {
                                weekday: "short",
                              }),
                              date: day.getDate(),
                            })}
                          >
                            <span className="day-name">
                              {day.toLocaleDateString("en-GB", {
                                weekday: "short",
                              })}
                            </span>
                            <span className="day-date">{day.getDate()}</span>
                            <span className="visit-count">
                              {dayVisits.length > 0
                                ? `/ ${dayVisits.length} ${t(
                                    "timesheets.weekView.visits"
                                  )}`
                                : ""}
                            </span>
                          </div>
                          <div className="visits-list">
                            {dayVisits.length > 0 ? (
                              dayVisits.map((visit) => (
                                <div
                                  key={visit.visitID}
                                  className="visit-card"
                                  onClick={() =>
                                    navigate(`/visit/${visit.visitID}`)
                                  }
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) =>
                                    e.key === "Enter" &&
                                    navigate(`/visit/${visit.visitID}`)
                                  }
                                  aria-label={t(
                                    "timesheets.weekView.visitCard",
                                    {
                                      time: visit.time
                                        .split(":")
                                        .slice(0, 2)
                                        .join(":"),
                                      location:
                                        visit.location || "Location TBD",
                                    }
                                  )}
                                >
                                  {userPermissions.canReadSupervisors &&
                                    visit.supervisorID && (
                                      <p className="visit-supervisor">
                                        <FaRegUser />{" "}
                                        {
                                          users.find(
                                            (u) =>
                                              u.userID === visit.supervisorID
                                          )?.firstname
                                        }{" "}
                                        {
                                          users.find(
                                            (u) =>
                                              u.userID === visit.supervisorID
                                          )?.lastname
                                        }
                                      </p>
                                    )}
                                  <hr className="hr" />
                                  <div className="visit-header">
                                    {visit.time && (
                                      <span className="visit-time">
                                        <FaClock />{" "}
                                        {visit.time
                                          .split(":")
                                          .slice(0, 2)
                                          .join(":")}
                                      </span>
                                    )}
                                    <span
                                      className={`visit-status status-${visit.status.toLowerCase()}`}
                                    >
                                      {visit.status}
                                    </span>
                                  </div>
                                  <p className="visit-location">
                                    <FaMapMarkerAlt />{" "}
                                    {visit.location ||
                                      t("timesheets.locationTBD")}
                                  </p>
                                  {visit.Reasons!.length > 0 && (
                                    <p className="visit-reasons">
                                      {t("timesheets.reasons")}:{" "}
                                      {visit
                                        .Reasons!.map((reason) => reason.item)
                                        .join(", ")}
                                    </p>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="no-visits">
                                {t("timesheets.dayView.noVisits")}
                              </div>
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
            <button
              className="nav-btn"
              onClick={() =>
                currentDay &&
                setCurrentDay(
                  new Date(currentDay.setDate(currentDay.getDate() - 1))
                )
              }
              aria-label={t("timesheets.navigation.previousDay")}
            >
              <span>←</span>
            </button>
            <h2>
              {currentDay
                ?.toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                })
                .replace(/(\w+)\s(\d+)\/(\d+)/, "$1 $2/$3")}
            </h2>
            <button
              className="nav-btn"
              onClick={() =>
                currentDay &&
                setCurrentDay(
                  new Date(currentDay.setDate(currentDay.getDate() + 1))
                )
              }
              aria-label={t("timesheets.navigation.nextDay")}
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
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) =>
                    e.key === "Enter" && navigate(`/visit/${visit.visitID}`)
                  }
                  aria-label={t("timesheets.dayView.visitCard", {
                    time: visit.time.split(":").slice(0, 2).join(":"),
                    location: visit.location || "Location TBD",
                  })}
                >
                  {userPermissions.canReadSupervisors && visit.supervisorID && (
                    <p className="visit-supervisor">
                      <FaRegUser />{" "}
                      {users.find((u) => u.userID === visit.supervisorID)
                        ?.firstname || t("timesheets.unknown")}{" "}
                      {users.find((u) => u.userID === visit.supervisorID)
                        ?.lastname || ""}
                    </p>
                  )}
                  <div className="visit-header">
                    {visit.time && (
                      <span className="visit-time">
                        <FaClock />{" "}
                        {visit.time.split(":").slice(0, 2).join(":")}
                      </span>
                    )}
                    <span
                      className={`visit-status status-${visit.status.toLowerCase()}`}
                    >
                      {visit.status}
                    </span>
                  </div>
                  <p className="visit-location">
                    <FaMapMarkerAlt />{" "}
                    {visit.location || t("timesheets.locationTBD")}
                  </p>
                  {visit.Reasons!.length > 0 && (
                    <p className="visit-reasons">
                      {t("timesheets.reasons")}:{" "}
                      {visit.Reasons!.map((reason) => reason.item).join(", ")}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="no-visits">
                {t("timesheets.dayView.noVisits")}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default Timesheets;

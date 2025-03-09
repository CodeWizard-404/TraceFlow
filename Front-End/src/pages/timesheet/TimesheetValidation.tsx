// src/pages/timesheet/TimesheetValidation.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./TimesheetValidation.css";
import Timesheet from "../../models/Timesheet";
import Visit from "../../models/Visit";
import { FaClock, FaMapMarkerAlt } from "react-icons/fa";
import { getAllTimesheets, validateTimesheet } from "../../apis/timesheetAPI";
import TimesheetStatus from "../../models/Enum/TimesheetStatus";

type ViewMode = "year" | "month" | "week" | "day";

const TimesheetValidation: React.FC = () => {
    const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
    const [filteredTimesheets, setFilteredTimesheets] = useState<Timesheet[]>([]);
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentWeek, setCurrentWeek] = useState<number>(0);
    const [currentDay, setCurrentDay] = useState<Date | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("year");
    const [loading, setLoading] = useState<boolean>(true);
    const [supervisorFilter, setSupervisorFilter] = useState<string>("all");
    const navigate = useNavigate();

    // Fetch timesheets
    useEffect(() => {
        const fetchTimesheets = async () => {
            try {
                setLoading(true);
                const data = await getAllTimesheets();
                setTimesheets(data.filter((ts) => ts.year === currentYear));
            } catch (error) {
                console.error("Failed to fetch timesheets:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTimesheets();
        updateCurrentWeekAndDay();
    }, [currentYear]);

    // Filter timesheets based on supervisor
    useEffect(() => {
        if (supervisorFilter === "all") {
            setFilteredTimesheets(timesheets);
        } else {
            setFilteredTimesheets(timesheets.filter((ts) => ts.supervisorID === supervisorFilter));
        }
    }, [timesheets, supervisorFilter]);

    // Update current week and day
    const updateCurrentWeekAndDay = () => {
        const today = new Date();
        const firstDayOfYear = new Date(currentYear, 0, 1);
        const pastDays = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
        const weekNum = Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);
        setCurrentWeek(weekNum);
        setCurrentDay(today.getDay() === 0 || today.getDay() === 6 ? new Date(today.setDate(today.getDate() - (today.getDay() || 7) + 1)) : today);
    };

    // Get unique supervisors for filter
    const getSupervisors = () => {
        const supervisors = Array.from(new Set(timesheets.map((ts) => ts.supervisorID)));
        return ["all", ...supervisors];
    };

    // Generate weekdays for a week
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

    const sortVisitsByTime = (visits: Visit[]): Visit[] => {
        return [...visits].sort((a, b) => a.time.localeCompare(b.time));
    };

    // Data generation functions
    const generateYearData = () => {
        return Array.from({ length: 12 }, (_, month) => {
            const weeks = Array.from({ length: 5 }, (_, i) => {
                const weekNumber = month * 4 + i + 1;
                const timesheet = filteredTimesheets.find((ts) => ts.weekNumber === weekNumber);
                return {
                    weekNumber,
                    days: getWeekDays(currentYear, weekNumber),
                    visits: timesheet?.Visits || [],
                    status: timesheet?.status || "Not Scheduled",
                    supervisorID: timesheet?.supervisorID,
                };
            });
            return { month, weeks };
        });
    };

    const generateMonthData = () => {
        const weeks = Array.from({ length: 5 }, (_, i) => {
            const weekNumber = currentMonth * 4 + i + 1;
            const timesheet = filteredTimesheets.find((ts) => ts.weekNumber === weekNumber);
            return {
                weekNumber,
                days: getWeekDays(currentYear, weekNumber),
                visits: timesheet?.Visits || [],
                status: timesheet?.status || "Not Scheduled",
                supervisorID: timesheet?.supervisorID,
            };
        });
        return weeks;
    };

    const generateWeekData = () => {
        const timesheet = filteredTimesheets.find((ts) => ts.weekNumber === currentWeek);
        return {
            weekNumber: currentWeek,
            days: getWeekDays(currentYear, currentWeek),
            visits: timesheet?.Visits || [],
            status: timesheet?.status || "Not Scheduled",
            supervisorID: timesheet?.supervisorID,
        };
    };

    const generateDayData = () => {
        if (!currentDay) return [];
        const dateStr = currentDay.toISOString().split("T")[0];
        const visits = filteredTimesheets
            .flatMap((ts) => ts.Visits || [])
            .filter((visit) => visit.date === dateStr);
        return sortVisitsByTime(visits);
    };

    // Scroll to current period
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

    // Validate entire timesheet
    const handleValidateTimesheet = async (timesheetID: string) => {
        try {
            const timesheet = filteredTimesheets.find((ts) => ts.timesheetID === timesheetID);
            if (!timesheet) return;
            const visitIDs = timesheet.Visits ? timesheet.Visits.map((v) => v.visitID) : [];
            await validateTimesheet(timesheetID, { visitIDs, status: "validated" });
            setTimesheets((prev) =>
                prev.map((ts) => (ts.timesheetID === timesheetID ? { ...ts, status: "Validated" as TimesheetStatus } : ts))
            );
        } catch (error) {
            console.error("Failed to validate timesheet:", error);
        }
    };

    if (loading) return <div className="loading">Loading Timesheets...</div>;

    return (
        <div className="timesheet-validation-container">
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
                    <select
                        className="supervisor-filter"
                        value={supervisorFilter}
                        onChange={(e) => setSupervisorFilter(e.target.value)}
                    >
                        {getSupervisors().map((supervisor) => (
                            <option key={supervisor} value={supervisor}>
                                {supervisor === "all" ? "All Supervisors" : `Supervisor ${supervisor}`}
                            </option>
                        ))}
                    </select>
                    <button className="current-btn" onClick={scrollToCurrent}>
                        Current {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}
                    </button>
                </div>
            </header>

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
                                        {week.supervisorID && (
                                            <span className="supervisor-id">Supervisor: {week.supervisorID}</span>
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
                                <p className="week-info">
                                    {week.visits.length} Visits - Status: {week.status}
                                    {week.supervisorID && ` - Supervisor: ${week.supervisorID}`}
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
                                    <p className="week-status">
                                        Status: {weekData.status}
                                        {weekData.supervisorID && ` - Supervisor: ${weekData.supervisorID}`}
                                    </p>
                                    {weekData.status !== "validated" && (
                                        <button
                                            className="validate-timesheet-btn"
                                            onClick={() => handleValidateTimesheet(filteredTimesheets.find((ts) => ts.weekNumber === currentWeek)?.timesheetID || "")}
                                        >
                                            Validate Entire Timesheet
                                        </button>
                                    )}
                                    <div className="days-grid">
                                        {weekData.days.map((day) => {
                                            const dayStr = day.toISOString().split("T")[0];
                                            const dayVisits = sortVisitsByTime(
                                                weekData.visits.filter((v) => v.date === dayStr)
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
                                                                    onClick={() => navigate(`/timesheet-validation/visit/${visit.visitID}`)}
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
                        <button
                            className="nav-btn"
                            onClick={() => currentDay && setCurrentDay(new Date(currentDay.setDate(currentDay.getDate() - 1)))}
                        >
                            <span>←</span>
                        </button>
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
                                    onClick={() => navigate(`/timesheet-validation/visit/${visit.visitID}`)}
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

export default TimesheetValidation;
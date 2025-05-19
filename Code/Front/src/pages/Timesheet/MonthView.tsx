import React, { useMemo, useCallback } from "react";
import Timesheet from "../../models/Timesheet";
import Visit from "../../models/Visit";
import VisitStatus from "../../models/Enum/VisitStatus";

interface VisitWithSupervisor extends Visit {
    supervisorID?: string;
    status: VisitStatus;
}

interface MonthViewProps {
    monthData: Timesheet[];
    currentYear: number;
    currentMonth: number;
    setCurrentMonth: (month: number) => void;
    setCurrentWeek: (week: number) => void;
    setViewMode: (mode: "year" | "month" | "week" | "day") => void;
    userPermissions: {
        canAccessTimesheetDetails: boolean;
    };
    t: (key: string, options?: any) => string;
    isSupervisor: boolean;
}

const MonthView: React.FC<MonthViewProps> = React.memo(
    ({ monthData, currentYear, currentMonth, setCurrentMonth, setCurrentWeek, setViewMode, userPermissions, t, isSupervisor }) => {
        const getWeeksInYear = useCallback((year: number): number => {
            const jan1 = new Date(year, 0, 1);
            const firstFridayOffset = (5 - jan1.getDay() + 7) % 7;
            const firstMonday = new Date(year, 0, 1 + firstFridayOffset - 4);
            const nextJan1 = new Date(year + 1, 0, 1);
            const nextFirstFridayOffset = (5 - nextJan1.getDay() + 7) % 7;
            const nextFirstMonday = new Date(year + 1, 0, 1 + nextFirstFridayOffset - 4);
            return Math.floor((nextFirstMonday.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24) / 7);
        }, []);

        const getWeekDays = useCallback((year: number, weekNumber: number): Date[] =>
            Array.from({ length: 7 }, (_, i) => {
                const jan1 = new Date(year, 0, 1);
                const firstFridayOffset = (5 - jan1.getDay() + 7) % 7;
                const firstMonday = new Date(year, 0, 1 + firstFridayOffset - 4);
                const weekStart = new Date(firstMonday);
                weekStart.setDate(firstMonday.getDate() + (weekNumber - 1) * 7 + i);
                weekStart.setHours(0, 0, 0, 0);
                return weekStart;
            }), []);

        const generateMonthData = useMemo(() => {
            const weeksInYear = getWeeksInYear(currentYear);
            return Array.from({ length: weeksInYear }, (_, week) => week + 1).reduce(
                (weeks, week) => {
                    const days = getWeekDays(currentYear, week);
                    if (!days.some(day => day.getMonth() === currentMonth && day.getFullYear() === currentYear)) {
                        return weeks;
                    }

                    const matchingTimesheets = monthData.filter(ts => ts.weekNumber === week && ts.year === currentYear);
                    return weeks.concat({
                        weekNumber: week,
                        days,
                        visits: matchingTimesheets.flatMap(ts =>
                            (ts.Visits || []).map(visit => ({
                                ...visit,
                                supervisorID: ts.supervisorID,
                                status: visit.status || VisitStatus.PENDING,
                            }))
                        ),
                        status: matchingTimesheets[0]?.status || "Not Scheduled",
                        supervisorCount: new Set(matchingTimesheets.map(ts => ts.supervisorID)).size,
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
        }, [monthData, currentYear, currentMonth, getWeeksInYear, getWeekDays]);

        const handlePreviousMonth = () => {
            setCurrentMonth((currentMonth - 1 + 12) % 12);
        };

        const handleNextMonth = () => {
            setCurrentMonth((currentMonth + 1) % 12);
        };

        return (
            <section className="month-view">
                <div className="month-header">
                    <button
                        className="nav-btn"
                        onClick={handlePreviousMonth}
                        aria-label={t("timesheets.navigation.previousMonth")}
                    >
                        <span>←</span>
                    </button>
                    <h2>
                        {new Date(currentYear, currentMonth).toLocaleString("default", { month: "long" })}
                    </h2>
                    <button
                        className="nav-btn"
                        onClick={handleNextMonth}
                        aria-label={t("timesheets.navigation.nextMonth")}
                    >
                        <span>→</span>
                    </button>
                </div>
                <div className="weeks-grid">
                    {generateMonthData.map(week => (
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
                            onKeyDown={e =>
                                userPermissions.canAccessTimesheetDetails &&
                                e.key === "Enter" &&
                                (setCurrentWeek(week.weekNumber), setViewMode("week"))
                            }
                            aria-label={t("timesheets.monthView.weekCard", { weekNumber: week.weekNumber })}
                        >
                            <h3>{t("timesheets.monthView.week")} {week.weekNumber}</h3>
                            <p className="week-range">
                                {week.days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} -{" "}
                                {week.days[6].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </p>
                            <p className="week-info">
                                {week.visits.length} {t("timesheets.monthView.visits")}
                                {isSupervisor && `- ${t("timesheets.monthView.status")}: ${week.status}`}
                                {!isSupervisor &&
                                    ` - ${t("timesheets.monthView.supervisors", { count: week.supervisorCount })}`}
                            </p>
                        </div>
                    ))}
                </div>
            </section>
        );
    },
    (prevProps, nextProps) =>
        prevProps.currentYear === nextProps.currentYear &&
        prevProps.currentMonth === nextProps.currentMonth &&
        prevProps.monthData === nextProps.monthData &&
        prevProps.userPermissions.canAccessTimesheetDetails === nextProps.userPermissions.canAccessTimesheetDetails &&
        prevProps.isSupervisor === nextProps.isSupervisor
);

export default MonthView;
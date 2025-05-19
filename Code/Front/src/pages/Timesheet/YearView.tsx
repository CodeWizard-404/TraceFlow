import React, { useMemo, useCallback } from "react";
import Timesheet from "../../models/Timesheet";
import Visit from "../../models/Visit";
import VisitStatus from "../../models/Enum/VisitStatus";

interface VisitWithSupervisor extends Visit {
    supervisorID?: string;
    status: VisitStatus;
}

interface YearViewProps {
    yearData: Timesheet[];
    currentYear: number;
    setCurrentWeek: (week: number) => void;
    setViewMode: (mode: "year" | "month" | "week" | "day") => void;
    userPermissions: {
        canAccessTimesheetDetails: boolean;
    };
    t: (key: string, options?: any) => string;
    isSupervisor: boolean;
}

const YearView: React.FC<YearViewProps> = React.memo(
    ({ yearData, currentYear, setCurrentWeek, setViewMode, userPermissions, t, isSupervisor }) => {
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

        const generateYearData = useMemo(() => {
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

                const matchingTimesheets = yearData.filter(ts => ts.weekNumber === week && ts.year === currentYear);
                const allVisits = matchingTimesheets.flatMap(ts =>
                    (ts.Visits || []).map(visit => ({
                        ...visit,
                        supervisorID: ts.supervisorID,
                        status: visit.status || VisitStatus.PENDING,
                    }))
                );
                months[assignedMonth].weeks.push({
                    weekNumber: week,
                    days,
                    visits: allVisits,
                    status: matchingTimesheets[0]?.status || "Not Scheduled",
                    supervisorCount: new Set(matchingTimesheets.map(ts => ts.supervisorID)).size,
                });
            }
            return months;
        }, [yearData, currentYear, getWeeksInYear, getWeekDays]);

        return (
            <section className="year-view">
                {generateYearData.map(({ month, weeks }) => (
                    <div className="month-card" key={month} id={`month-${month}`}>
                        <h2>
                            {new Date(currentYear, month).toLocaleString("default", { month: "long" })}
                        </h2>
                        <div className="weeks-grid">
                            {weeks.map(week => (
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
                                    tabIndex={userPermissions.canAccessTimesheetDetails ? 0 : -1}
                                    onKeyDown={e =>
                                        userPermissions.canAccessTimesheetDetails &&
                                        e.key === "Enter" &&
                                        (setCurrentWeek(week.weekNumber), setViewMode("week"))
                                    }
                                    aria-label={t("timesheets.yearView.weekTile", { weekNumber: week.weekNumber })}
                                >
                                    <span className="week-number">
                                        {t("timesheets.yearView.week")} {week.weekNumber} :
                                    </span>
                                    <span className="week-range">
                                        {week.days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} -{" "}
                                        {week.days[6].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} /
                                    </span>
                                    <span className="visit-count">
                                        {week.visits.length} {t("timesheets.yearView.visits")}
                                    </span>
                                    {!isSupervisor && (
                                        <span className="week-info">
                                            <br />
                                            {t("timesheets.yearView.supervisors")}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </section>
        );
    },
    (prevProps, nextProps) =>
        prevProps.currentYear === nextProps.currentYear &&
        prevProps.yearData === nextProps.yearData &&
        prevProps.userPermissions.canAccessTimesheetDetails === nextProps.userPermissions.canAccessTimesheetDetails &&
        prevProps.isSupervisor === nextProps.isSupervisor
);

export default YearView;
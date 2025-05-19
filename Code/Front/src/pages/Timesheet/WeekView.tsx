import React, { useMemo, useCallback } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import Timesheet from "../../models/Timesheet";
import Visit from "../../models/Visit";
import { VisitReason } from "../../models/Reason";
import User from "../../models/User";
import VisitStatus from "../../models/Enum/VisitStatus";
import { updateVisit } from "../../apis/visitAPI";
import CalendarSyncButton from "../../components/Google/CalendarSyncButton";
import DayColumn from "./DayColumn";

interface VisitWithSupervisor extends Visit {
    supervisorID?: string;
    status: VisitStatus;
}

interface GeneratedVisit {
    startTime: string;
    location: string;
    latitude: number | null;
    longitude: number | null;
    reasons: Array<{ id: string; item: string }>;
    checklists: Array<{ id: string; item: string }>;
    agentID: string | null;
    date: string;
    status: VisitStatus.GENERATED;
    selected?: boolean;
}

interface WeekViewProps {
    weekData: Timesheet[];
    currentWeek: number;
    setCurrentWeek: (week: number) => void;
    currentYear: number;
    filteredTimesheets: Timesheet[];
    generatedVisits: GeneratedVisit[];
    handleOpenSuggestionsModal: () => void;
    handleValidateTimesheet: (timesheetID: string) => Promise<void>;
    toggleSelectAllVisits: () => void;
    handleCancelSuggestions: () => void;
    handleSaveSuggestions: () => Promise<void>;
    loading: boolean;
    users: User[];
    isSupervisor: boolean;
    userPermissions: {
        canAccessTimesheetDetails: boolean;
        canValidateTimesheets: boolean;
        canCreateTimesheets: boolean;
        canCreateSupervisorTimesheets: boolean;
    };
    visitReasons: Record<string, VisitReason[]>;
    locationCache: Record<string, string | undefined>;
    navigate: (path: string) => void;
    toggleVisitSelection: (visitId: string, isGenerated: boolean) => void;
    isSuperAdmin: boolean;
    isRegionalManager: boolean;
    isDirector: boolean;
    t: (key: string, options?: any) => string;
}

const WeekView: React.FC<WeekViewProps> = React.memo(
    ({
        weekData,
        currentWeek,
        setCurrentWeek,
        currentYear,
        filteredTimesheets,
        generatedVisits,
        handleOpenSuggestionsModal,
        handleValidateTimesheet,
        toggleSelectAllVisits,
        handleCancelSuggestions,
        handleSaveSuggestions,
        loading,
        users,
        isSupervisor,
        userPermissions,
        visitReasons,
        locationCache,
        navigate,
        toggleVisitSelection,
        isSuperAdmin,
        isRegionalManager,
        isDirector,
        t,
    }) => {
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

        const sortVisitsByTime = useCallback(
            (visits: (VisitWithSupervisor | GeneratedVisit)[]): (VisitWithSupervisor | GeneratedVisit)[] =>
                [...visits].sort((a, b) => {
                    const timeA = "time" in a ? a.time : a.startTime;
                    const timeB = "time" in b ? b.time : b.startTime;
                    return timeA.localeCompare(timeB);
                }),
            []
        );

        const handleDropVisit = useCallback(
            async (
                item: { visitId: string; originalDate: string; time: string; isGenerated: boolean },
                targetDate: string
            ) => {
                if (item.originalDate === targetDate) return;
                try {
                    if (item.isGenerated) {
                        generatedVisits.forEach(visit => {
                            if (`${visit.agentID}-${visit.date}-${visit.startTime}` === item.visitId) {
                                visit.date = targetDate.split("-").reverse().join("/");
                                visit.status = isSupervisor ? VisitStatus.GENERATED : visit.status;
                            }
                        });
                    } else {
                        await updateVisit(item.visitId, {
                            date: targetDate,
                            time: item.time,
                            status: isSupervisor ? VisitStatus.PENDING : undefined,
                        });
                        // Fetch timesheets is handled in Timesheets component
                    }
                } catch (error) {
                    console.error("Failed to update visit date:", error);
                    // Error handling is managed in Timesheets component
                }
            },
            [generatedVisits, isSupervisor]
        );

        const generateWeekData = useMemo(() => {
            const matchingTimesheets = weekData.filter(ts => ts.weekNumber === currentWeek);
            const weekDays = getWeekDays(currentYear, currentWeek);
            const savedVisits = matchingTimesheets.flatMap(ts =>
                (ts.Visits || []).map(visit => ({
                    ...visit,
                    supervisorID: ts.supervisorID,
                    status: visit.status || VisitStatus.PENDING,
                }))
            );
            const allVisits = [
                ...savedVisits,
                ...generatedVisits.filter(v => {
                    const dateParts = v.date.split("/").map(Number);
                    const [d, m, y] = dateParts;
                    const visitDate = new Date(y, m - 1, d);
                    return weekDays.some(day => day.toISOString().split("T")[0] === visitDate.toISOString().split("T")[0]);
                }),
            ];
            return {
                weekNumber: currentWeek,
                days: weekDays,
                visits: allVisits,
                status: matchingTimesheets[0]?.status || "Not Scheduled",
                supervisorID: matchingTimesheets[0]?.supervisorID,
                supervisorCount: new Set(matchingTimesheets.map(ts => ts.supervisorID)).size,
            };
        }, [weekData, generatedVisits, currentYear, currentWeek, getWeekDays]);

        return (
            <DndProvider backend={HTML5Backend}>
                <section className="week-view">
                    <div className="week-header">
                        {isSupervisor && filteredTimesheets[0]?.timesheetID && (
                            <CalendarSyncButton timesheetId={filteredTimesheets[0].timesheetID} isSupervisor={isSupervisor} />
                        )}
                        <div className="week-header-middle">
                            <button
                                className="nav-btn"
                                onClick={() => setCurrentWeek(currentWeek - 1)}
                                disabled={currentWeek === 1}
                                aria-label={t("timesheets.navigation.previousWeek")}
                            >
                                <span>←</span>
                            </button>
                            <h2>{t("timesheets.weekView.week")} {generateWeekData.weekNumber}</h2>
                            <button
                                className="nav-btn"
                                onClick={() => setCurrentWeek(currentWeek + 1)}
                                disabled={currentWeek === getWeeksInYear(currentYear)}
                                aria-label={t("timesheets.navigation.nextWeek")}
                            >
                                <span>→</span>
                            </button>
                        </div>
                        {isSupervisor && (
                            <button
                                className="create-btn"
                                onClick={handleOpenSuggestionsModal}
                                aria-label={t("timesheets.actions.generateSuggestions")}
                            >
                                {t("timesheets.actions.generateSuggestions")}
                            </button>
                        )}
                    </div>
                    <div className="week-details">
                        <div className="week-details-header">
                            <div className="week-details-info">
                                <p className="week-range">
                                    {generateWeekData.days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} -{" "}
                                    {generateWeekData.days[6].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                </p>
                                <p className="week-status">
                                    {t("timesheets.weekView.status")}: {generateWeekData.status}
                                </p>
                            </div>
                            {generateWeekData.supervisorID && userPermissions.canValidateTimesheets && (
                                <button
                                    className="create-btn"
                                    onClick={() => handleValidateTimesheet(generateWeekData.supervisorID!)}
                                    aria-label={t("timesheets.actions.validate")}
                                >
                                    {t("timesheets.actions.validate")}
                                </button>
                            )}
                            {isSupervisor && generatedVisits.length > 0 && (
                                <>
                                    <button
                                        className="select-all-btn"
                                        onClick={toggleSelectAllVisits}
                                        aria-label={t("timesheets.actions.toggleSelectAll")}
                                    >
                                        {generatedVisits.every(visit => visit.selected)
                                            ? t("timesheets.actions.deselectAll")
                                            : t("timesheets.actions.selectAll")}
                                    </button>
                                    <button
                                        className="cancel-btn"
                                        onClick={handleCancelSuggestions}
                                        aria-label={t("timesheets.actions.cancelSuggestions")}
                                    >
                                        {t("timesheets.actions.cancelSuggestions")}
                                    </button>
                                    {(userPermissions.canCreateTimesheets || userPermissions.canCreateSupervisorTimesheets) && (
                                        <button
                                            className="create-btn"
                                            onClick={handleSaveSuggestions}
                                            disabled={loading}
                                            aria-label={t("timesheets.actions.saveSuggestions")}
                                        >
                                            {loading ? t("timesheets.actions.saving") : t("timesheets.actions.saveSuggestions")}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="days-grid">
                            {generateWeekData.days.map(day => (
                                <DayColumn
                                    key={day.toISOString()}
                                    day={day}
                                    visits={generateWeekData.visits}
                                    handleDropVisit={handleDropVisit}
                                    sortVisitsByTime={sortVisitsByTime}
                                    t={t}
                                    users={users}
                                    isSupervisor={isSupervisor}
                                    weekData={generateWeekData}
                                    userPermissions={userPermissions}
                                    visitReasons={visitReasons}
                                    locationCache={locationCache}
                                    navigate={navigate}
                                    toggleVisitSelection={toggleVisitSelection}
                                    isSuperAdmin={isSuperAdmin}
                                    isRegionalManager={isRegionalManager}
                                    isDirector={isDirector}
                                />
                            ))}
                        </div>
                    </div>
                </section>
            </DndProvider>
        );
    },
    (prevProps, nextProps) =>
        prevProps.currentWeek === nextProps.currentWeek &&
        prevProps.currentYear === nextProps.currentYear &&
        prevProps.weekData === nextProps.weekData &&
        prevProps.filteredTimesheets === nextProps.filteredTimesheets &&
        prevProps.generatedVisits === nextProps.generatedVisits &&
        prevProps.loading === nextProps.loading &&
        prevProps.users === nextProps.users &&
        prevProps.isSupervisor === nextProps.isSupervisor &&
        prevProps.userPermissions.canAccessTimesheetDetails === nextProps.userPermissions.canAccessTimesheetDetails &&
        prevProps.userPermissions.canValidateTimesheets === nextProps.userPermissions.canValidateTimesheets &&
        prevProps.userPermissions.canCreateTimesheets === nextProps.userPermissions.canCreateTimesheets &&
        prevProps.userPermissions.canCreateSupervisorTimesheets === nextProps.userPermissions.canCreateSupervisorTimesheets &&
        prevProps.visitReasons === nextProps.visitReasons &&
        prevProps.locationCache === nextProps.locationCache &&
        prevProps.isSuperAdmin === nextProps.isSuperAdmin &&
        prevProps.isRegionalManager === nextProps.isRegionalManager &&
        prevProps.isDirector === nextProps.isDirector
);

export default WeekView;
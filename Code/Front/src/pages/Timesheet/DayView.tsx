import React, { useMemo, useCallback } from "react";
import Timesheet from "../../models/Timesheet";
import Visit from "../../models/Visit";
import { VisitReason } from "../../models/Reason";
import User from "../../models/User";
import VisitStatus from "../../models/Enum/VisitStatus";
import VisitCard from "./VisitCard";

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

interface DayViewProps {
    dayData: Timesheet[];
    currentDay: Date | null;
    setCurrentDay: (day: Date | null) => void;
    users: User[];
    isSupervisor: boolean;
    weekData: Timesheet[];
    userPermissions: {
        canAccessTimesheetDetails: boolean;
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
    generatedVisits: GeneratedVisit[];
}

const DayView: React.FC<DayViewProps> = React.memo(
    ({
        dayData,
        currentDay,
        setCurrentDay,
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
        generatedVisits,
    }) => {
        const sortVisitsByTime = useCallback(
            (visits: (VisitWithSupervisor | GeneratedVisit)[]): (VisitWithSupervisor | GeneratedVisit)[] =>
                [...visits].sort((a, b) => {
                    const timeA = "time" in a ? a.time : a.startTime;
                    const timeB = "time" in b ? b.time : b.startTime;
                    return timeA.localeCompare(timeB);
                }),
            []
        );

        const isCoordinates = useCallback((str: string): boolean => /^\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*$/.test(str), []);

        const formatTime = useCallback((timeStr: string): string => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const period = hours >= 12 ? 'PM' : 'AM';
            const formattedHours = hours % 12 || 12;
            return `${formattedHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
        }, []);

        const generateDayData = useMemo(() => {
            if (!currentDay) return [];
            const dateStr = currentDay.toISOString().split("T")[0];
            return sortVisitsByTime(
                [
                    ...dayData.flatMap(ts =>
                        (ts.Visits || []).map(visit => ({
                            ...visit,
                            supervisorID: ts.supervisorID,
                            status: visit.status || VisitStatus.PENDING,
                        }))
                    ),
                    ...generatedVisits,
                ].filter(visit => {
                    const visitDate = "time" in visit ? visit.date : visit.date;
                    const normalizedVisitDate = visitDate.includes("/")
                        ? visitDate.split("/").reverse().join("-")
                        : visitDate;
                    return normalizedVisitDate.split("T")[0] === dateStr;
                })
            );
        }, [dayData, generatedVisits, currentDay, sortVisitsByTime]);

        return (
            <section className="day-view">
                <div className="day-header">
                    <button
                        className="nav-btn"
                        onClick={() =>
                            setCurrentDay(
                                currentDay
                                    ? new Date(currentDay.setDate(currentDay.getDate() - 1))
                                    : null
                            )
                        }
                        aria-label={t("timesheets.navigation.previousDay")}
                    >
                        <span>←</span>
                    </button>
                    <h2>
                        {currentDay?.toLocaleDateString("en-GB", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                        })}
                    </h2>
                    <button
                        className="nav-btn"
                        onClick={() =>
                            setCurrentDay(
                                currentDay
                                    ? new Date(currentDay.setDate(currentDay.getDate() + 1))
                                    : null
                            )
                        }
                        aria-label={t("timesheets.navigation.nextDay")}
                    >
                        <span>→</span>
                    </button>
                </div>
                <div className="visits-list">
                    {generateDayData.length > 0 ? (
                        generateDayData.map(visit => (
                            <VisitCard
                                key={"visitID" in visit ? visit.visitID : `${visit.agentID}-${visit.date}-${visit.startTime}`}
                                visit={visit}
                                t={t}
                                users={users}
                                isSupervisor={isSupervisor}
                                weekData={{ supervisorID: "supervisorID" in visit ? visit.supervisorID : undefined }}
                                userPermissions={userPermissions}
                                visitReasons={visitReasons}
                                locationCache={locationCache}
                                navigate={navigate}
                                formatTime={formatTime}
                                isCoordinates={isCoordinates}
                                toggleVisitSelection={toggleVisitSelection}
                                isSuperAdmin={isSuperAdmin}
                                isRegionalManager={isRegionalManager}
                                isDirector={isDirector}
                            />
                        ))
                    ) : (
                        <div className="no-visits">{t("timesheets.dayView.noVisits")}</div>
                    )}
                </div>
            </section>
        );
    },
    (prevProps, nextProps) =>
        prevProps.currentDay?.getTime() === nextProps.currentDay?.getTime() &&
        prevProps.dayData === nextProps.dayData &&
        prevProps.generatedVisits === nextProps.generatedVisits &&
        prevProps.users === nextProps.users &&
        prevProps.isSupervisor === nextProps.isSupervisor &&
        prevProps.weekData === nextProps.weekData &&
        prevProps.userPermissions.canAccessTimesheetDetails === nextProps.userPermissions.canAccessTimesheetDetails &&
        prevProps.userPermissions.canCreateTimesheets === nextProps.userPermissions.canCreateTimesheets &&
        prevProps.userPermissions.canCreateSupervisorTimesheets === nextProps.userPermissions.canCreateSupervisorTimesheets &&
        prevProps.visitReasons === nextProps.visitReasons &&
        prevProps.locationCache === nextProps.locationCache &&
        prevProps.isSuperAdmin === nextProps.isSuperAdmin &&
        prevProps.isRegionalManager === nextProps.isRegionalManager &&
        prevProps.isDirector === nextProps.isDirector
);

export default DayView;
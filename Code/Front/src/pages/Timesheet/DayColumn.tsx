import React, { useEffect, useRef } from "react";
import { useDrop } from "react-dnd";
import VisitCard from "./VisitCard";
import Visit from "../../models/Visit";
import { VisitReason } from "../../models/Reason";
import User from "../../models/User";
import VisitStatus from "../../models/Enum/VisitStatus";

const ItemTypes = {
    VISIT: "visit",
};

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

interface DayColumnProps {
    day: Date;
    visits: (VisitWithSupervisor | GeneratedVisit)[];
    handleDropVisit: (item: { visitId: string; originalDate: string; time: string; isGenerated: boolean }, targetDate: string) => void;
    sortVisitsByTime: (visits: (VisitWithSupervisor | GeneratedVisit)[]) => (VisitWithSupervisor | GeneratedVisit)[];
    t: (key: string, options?: any) => string;
    users: User[];
    isSupervisor: boolean;
    weekData: { supervisorID?: string };
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
}

const DayColumn: React.FC<DayColumnProps> = React.memo(
    ({
        day,
        visits,
        handleDropVisit,
        sortVisitsByTime,
        t,
        users,
        isSupervisor,
        weekData,
        userPermissions,
        visitReasons,
        locationCache,
        navigate,
        toggleVisitSelection,
        isSuperAdmin,
        isRegionalManager,
        isDirector,
    }) => {
        const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const isPastDate = new Date(dayStr) < new Date(todayStr);

        const dayVisits = sortVisitsByTime(
            visits.filter(v => {
                const visitDate = "time" in v ? v.date : v.date;
                const normalizedVisitDate = visitDate.includes("/") ? visitDate.split("/").reverse().join("-") : visitDate;
                return normalizedVisitDate.split("T")[0] === dayStr;
            })
        );

        const dayRef = useRef<HTMLDivElement>(null);
        const [{ isOver }, drop] = useDrop(
            () => ({
                accept: ItemTypes.VISIT,
                canDrop: () => !isPastDate,
                drop: (item: { visitId: string; originalDate: string; time: string; isGenerated: boolean }) => {
                    handleDropVisit(item, dayStr);
                },
                collect: monitor => ({
                    isOver: !!monitor.isOver(),
                }),
            }),
            [dayStr, handleDropVisit, isPastDate]
        );

        useEffect(() => {
            drop(dayRef);
        }, [drop]);

        const formatTime = (timeStr: string): string => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const period = hours >= 12 ? 'PM' : 'AM';
            const formattedHours = hours % 12 || 12;
            return `${formattedHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
        };

        const isCoordinates = (str: string): boolean => /^\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*$/.test(str);

        return (
            <div ref={dayRef} className={`day-column ${isOver ? 'drag-over' : ''} ${isPastDate ? 'past-date' : ''}`} key={dayStr}>
                <div className="day-tile">
                    <span className="day-name">{day.toLocaleDateString("en-GB", { weekday: "short" })}</span>
                    <span className="day-date">{day.getDate()}</span>
                    <span className="visit-count">
                        {dayVisits.length > 0 ? `/ ${dayVisits.length} ${t("timesheets.weekView.visits")}` : ""}
                    </span>
                </div>
                <div className="visits-list">
                    {dayVisits.length > 0 ? (
                        dayVisits.map(visit => (
                            <VisitCard
                                key={"visitID" in visit ? visit.visitID : `${visit.agentID}-${visit.date}-${visit.startTime}`}
                                visit={visit}
                                t={t}
                                users={users}
                                isSupervisor={isSupervisor}
                                weekData={weekData}
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
            </div>
        );
    },
    (prevProps, nextProps) =>
        prevProps.day.getTime() === nextProps.day.getTime() &&
        prevProps.visits === nextProps.visits &&
        prevProps.userPermissions.canAccessTimesheetDetails === nextProps.userPermissions.canAccessTimesheetDetails &&
        prevProps.userPermissions.canCreateTimesheets === nextProps.userPermissions.canCreateTimesheets &&
        prevProps.userPermissions.canCreateSupervisorTimesheets === nextProps.userPermissions.canCreateSupervisorTimesheets &&
        prevProps.users === nextProps.users &&
        prevProps.isSupervisor === nextProps.isSupervisor &&
        prevProps.weekData.supervisorID === nextProps.weekData.supervisorID &&
        prevProps.visitReasons === nextProps.visitReasons &&
        prevProps.locationCache === nextProps.locationCache &&
        prevProps.isSuperAdmin === nextProps.isSuperAdmin &&
        prevProps.isRegionalManager === nextProps.isRegionalManager &&
        prevProps.isDirector === nextProps.isDirector
);

export default DayColumn;
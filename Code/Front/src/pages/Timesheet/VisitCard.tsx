import React, { useEffect, useState, useRef } from "react";
import { useDrag } from "react-dnd";
import Visit from "../../models/Visit";
import { VisitReason } from "../../models/Reason";
import User from "../../models/User";
import VisitStatus from "../../models/Enum/VisitStatus";
import { FaClock, FaMapMarkerAlt, FaRegUser } from "react-icons/fa";
import { getUserById } from "../../apis/userAPI";
import { getAgentById } from "../../apis/agentAPI";

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

interface VisitCardProps {
    visit: VisitWithSupervisor | GeneratedVisit;
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
    formatTime: (timeStr: string) => string;
    isCoordinates: (str: string) => boolean;
    toggleVisitSelection: (visitId: string, isGenerated: boolean) => void;
    isSuperAdmin: boolean;
    isRegionalManager: boolean;
    isDirector: boolean;
}

const VisitCard: React.FC<VisitCardProps> = React.memo(
    ({
        visit,
        t,
        isSupervisor,
        weekData,
        userPermissions,
        visitReasons,
        locationCache,
        navigate,
        formatTime,
        isCoordinates,
        toggleVisitSelection,
        isSuperAdmin,
        isRegionalManager,
        isDirector,
    }) => {
        const visitId = "visitID" in visit ? visit.visitID : `${visit.agentID}-${visit.date}-${visit.startTime}`;
        const isVisited = visit.status === VisitStatus.VISITED;
        const isGenerated = !("visitID" in visit);
        const isSelected = isGenerated && (visit as GeneratedVisit).selected;
        const visitRef = useRef<HTMLDivElement>(null);
        const [{ isDragging }, drag] = useDrag(
            () => ({
                type: ItemTypes.VISIT,
                item: {
                    visitId,
                    originalDate: "time" in visit ? visit.date : visit.date,
                    time: "time" in visit ? visit.time : visit.startTime,
                    isGenerated,
                },
                collect: monitor => ({
                    isDragging: !!monitor.isDragging(),
                }),
                canDrag: () => (userPermissions.canCreateTimesheets || userPermissions.canCreateSupervisorTimesheets) && !isVisited,
            }),
            [visitId, visit, userPermissions.canCreateTimesheets, userPermissions.canCreateSupervisorTimesheets, isVisited]
        );

        useEffect(() => {
            if ((userPermissions.canCreateTimesheets || userPermissions.canCreateSupervisorTimesheets) && !isVisited) {
                drag(visitRef);
            }
        }, [drag, userPermissions.canCreateTimesheets, userPermissions.canCreateSupervisorTimesheets, isVisited]);

        const [agentName, setAgentName] = useState<string>("");
        const [supervisorName, setSupervisorName] = useState<string>("");

        useEffect(() => {
            const fetchNames = async () => {
                if (isSupervisor && visit.agentID) {
                    try {
                        const agent = await getAgentById(visit.agentID);
                        setAgentName(`${agent?.name || 'Unknown'} ${agent?.lastname || ''}`);
                    } catch (error) {
                        console.error('Failed to fetch agent name:', error);
                    }
                }
                if ((isSuperAdmin || isRegionalManager || isDirector) && ("supervisorID" in visit ? visit.supervisorID : weekData.supervisorID)) {
                    try {
                        const supervisor = await getUserById("supervisorID" in visit ? visit.supervisorID! : weekData.supervisorID!);
                        setSupervisorName(`${supervisor?.firstname || 'Unknown'} ${supervisor?.lastname || ''}`);
                    } catch (error) {
                        console.error('Failed to fetch supervisor name:', error);
                    }
                }
            };
            fetchNames();
        }, [visit, isSupervisor, isSuperAdmin, isRegionalManager, isDirector, weekData.supervisorID]);

        let displayLocation = t("visitDetails.whenWhere.na");
        if (visit.agentID) {
            displayLocation = locationCache[`agent:${visit.agentID}`] || t("visitDetails.whenWhere.na");
        } else if (visit.location) {
            if (isCoordinates(visit.location)) {
                displayLocation = locationCache[`coords:${visit.location}`] || t("visitDetails.whenWhere.na");
            } else {
                displayLocation = locationCache[`direct:${visit.location}`] || visit.location;
            }
        }

        return (
            <div
                ref={visitRef}
                className={`visit-card ${isVisited ? 'visited' : ''} ${isSelected ? 'selected' : ''}`}
                style={{ opacity: isDragging ? 0.5 : 1 }}
                onClick={
                    userPermissions.canAccessTimesheetDetails && "visitID" in visit
                        ? () => navigate(`/visit/${visit.visitID}`)
                        : undefined
                }
                role="button"
                tabIndex={userPermissions.canAccessTimesheetDetails && "visitID" in visit ? 0 : -1}
                onKeyDown={e =>
                    userPermissions.canAccessTimesheetDetails &&
                    "visitID" in visit &&
                    e.key === "Enter" &&
                    navigate(`/visit/${visit.visitID}`)
                }
                aria-label={t("timesheets.weekView.visitCard", {
                    time: "time" in visit ? visit.time : visit.startTime,
                })}
            >
                {isGenerated && (
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleVisitSelection(visitId, isGenerated)}
                        className="visit-selection-checkbox"
                        aria-label={t("timesheets.selectVisit")}
                    />
                )}
                {(isSupervisor && agentName) && (
                    <p className="visit-agent">
                        <FaRegUser /> {agentName}
                    </p>
                )}
                {((isSuperAdmin || isRegionalManager || isDirector) && supervisorName) && (
                    <p className="visit-supervisor">
                        <FaRegUser /> {supervisorName}
                    </p>
                )}
                <hr className="hr" />
                <div className="visit-header">
                    <span className="visit-time">
                        <FaClock /> {formatTime("time" in visit ? visit.time : visit.startTime)}
                    </span>
                    <span className={`visit-status status-${visit.status.toLowerCase()}`}>
                        {visit.status}
                    </span>
                </div>
                <p className="visit-location">
                    <FaMapMarkerAlt /> {displayLocation}
                </p>
                {"time" in visit ? (
                    visitReasons[visit.visitID] && visitReasons[visit.visitID].length > 0 && (
                        <p className="visit-reasons">
                            {visitReasons[visit.visitID].map(r => r.item).join(", ")}
                        </p>
                    )
                ) : (
                    visit.reasons.length > 0 && (
                        <p className="visit-reasons">
                            {visit.reasons.map(r => r.item).join(", ")}
                        </p>
                    )
                )}
            </div>
        );
    },
    (prevProps, nextProps) =>
        prevProps.visit === nextProps.visit &&
        prevProps.users === nextProps.users &&
        prevProps.isSupervisor === nextProps.isSupervisor &&
        prevProps.weekData.supervisorID === nextProps.weekData.supervisorID &&
        prevProps.userPermissions.canAccessTimesheetDetails === nextProps.userPermissions.canAccessTimesheetDetails &&
        prevProps.userPermissions.canCreateTimesheets === nextProps.userPermissions.canCreateTimesheets &&
        prevProps.userPermissions.canCreateSupervisorTimesheets === nextProps.userPermissions.canCreateSupervisorTimesheets &&
        prevProps.visitReasons === nextProps.visitReasons &&
        prevProps.locationCache === nextProps.locationCache &&
        prevProps.isSuperAdmin === nextProps.isSuperAdmin &&
        prevProps.isRegionalManager === nextProps.isRegionalManager &&
        prevProps.isDirector === nextProps.isDirector
);

export default VisitCard;
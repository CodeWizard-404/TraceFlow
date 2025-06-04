/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { debounce } from "lodash";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import "./Timesheets.css";
import Timesheet from "../../models/Timesheet";
import Visit from "../../models/Visit";
import { VisitReason } from "../../models/Reason";
import User from "../../models/User";
import { useAuth } from "../../context/AuthContext";
import {
    getTimesheetsBySupervisor,
    getAllTimesheets,
    validateTimesheet,
    createTimesheet,
    SuggestTimesheetResponse,
} from "../../apis/timesheetAPI";
import { getUsersByRole, getSupervisorsByUser, fetchUserProfile } from "../../apis/userAPI";
import { updateVisit } from '../../apis/visitAPI';
import { FaClock, FaMapMarkerAlt, FaRegUser, FaFilter } from "react-icons/fa";
import TimesheetStatus from "../../models/Enum/TimesheetStatus";
import VisitStatus from "../../models/Enum/VisitStatus";
import { useTranslation } from "react-i18next";
import CalendarSyncButton from "../../components/Google/CalendarSyncButton";
import TimesheetSuggestionsModal from "../Timesheet/TimesheetSuggestionsModal";
import { io } from "socket.io-client";
import MapComponent from '../../components/Google/MapComponent';

const PERMISSIONS = {
    ACCESS_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_ACCESS_TIMESHEETS,
    ACCESS_SUPERVISOR_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_ACCESS_SUPERVISOR_TIMESHEETS,
    ACCESS_TIMESHEET_DETAILS: import.meta.env.VITE_PERMISSIONS_ACCESS_TIMESHEET_DETAILS,
    CREATE_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS,
    CREATE_SUPERVISOR_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS_FOR_SUPERVISOR,
    VALIDATE_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_VALIDATE_TIMESHEETS,
    READ_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS,
};

const ROLES = {
    SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
    SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
    REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
    DIRECTOR: import.meta.env.VITE_ROLES_DIRECTOR,
};

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const ItemTypes = {
    VISIT: 'visit',
};

type ViewMode = "year" | "month" | "week" | "day";

interface VisitWithSupervisor extends Visit {
    supervisorID?: string;
    status: VisitStatus;
}

interface GeneratedVisit {
    visitID: string;
    date: string; // Format: "YYYY-MM-DD"
    time: string; // Format: "HH:MM"
    location: string;
    latitude: number | null;
    longitude: number | null;
    reasons: Array<{ reasonID: string; item: string }>;
    checklists: Array<{ checklistID: string; item: string }>;
    agentID: string | null;
    status: VisitStatus.GENERATED;
    selected?: boolean;
    timesheetID: string;
    photos: string[];
    comment: string | null;
    calendarEventId: string | null;
    Agent: {
        agentID: string;
        name: string;
        lastname: string;
        email: string;
        phone: string;
        location: string; // Use 'location' instead of 'address'
        latitude: number | null;
        longitude: number | null;
        supervisorID: string;
        delegationID: string | null;
        Delegation: { delegationID: string; name: string } | null;
    } | null;
}


interface CustomMapModalProps {
    isOpen: boolean;
    onClose: () => void;
    visits: {
        visitID: string;
        latitude: number;
        longitude: number;
        location: string;
        time: string;
        reasons: string;
        agentName: string;
    }[];
    userLocation: { lat: number; lng: number } | null;
}

const CustomMapModal: React.FC<CustomMapModalProps> = ({
    isOpen,
    onClose,
    visits,
    userLocation,
}) => {
    if (!isOpen) return null;

    return (
        <div className="custom-map-modal-overlay">
            <div className="custom-map-modal">
                <button
                    className="custom-map-modal-close"
                    onClick={onClose}
                    aria-label="Close map modal"
                >
                    ×
                </button>
                <div className="custom-map-modal-content">
                    <MapComponent
                        visits={visits}
                        userLocation={userLocation}
                        isTimesheetModal={true}
                    />
                </div>
            </div>
        </div>
    );
};


const TimesheetsSkeleton: React.FC = () => (
    <div className="timesheets-container">
        <header className="timesheets-header">
            <div className="view-toggle">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div
                        key={i}
                        className="custom-skeleton pulsing"
                        style={{ width: "80px", height: "40px", marginRight: "8px" }}
                    />
                ))}
            </div>
            <div className="year-navigation">
                <div
                    className="custom-skeleton pulsing"
                    style={{ width: "40px", height: "40px" }}
                />
                <div
                    className="custom-skeleton pulsing"
                    style={{ width: "100px", height: "40px" }}
                />
                <div
                    className="custom-skeleton pulsing"
                    style={{ width: "40px", height: "40px" }}
                />
                <div
                    className="custom-skeleton pulsing"
                    style={{ width: "40px", height: "40px" }}
                />
            </div>
            <div className="action-buttons">
                <div
                    className="custom-skeleton pulsing"
                    style={{ width: "120px", height: "40px", marginRight: "8px" }}
                />
                <div
                    className="custom-skeleton pulsing"
                    style={{ width: "120px", height: "40px" }}
                />
            </div>
        </header>
        <section className="year-view">
            {Array.from({ length: 12 }).map((_, i) => (
                <div className="month-card" key={i}>
                    <div
                        className="custom-skeleton pulsing"
                        style={{ width: "150px", height: "24px", marginBottom: "16px" }}
                    />
                    <div className="weeks-grid">
                        {Array.from({ length: 4 }).map((_, j) => (
                            <div className="week-tile" key={j}>
                                <div
                                    className="custom-skeleton pulsing"
                                    style={{ width: "100%", height: "80px" }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </section>
    </div>
);

interface DayColumnProps {
    day: Date;
    visits: (VisitWithSupervisor | GeneratedVisit)[];
    handleDropVisit: (item: { visitId: string; originalDate: string; time: string; isGenerated: boolean }, targetDate: string) => void;
    sortVisitsByTime: (visits: (VisitWithSupervisor | GeneratedVisit)[]) => (VisitWithSupervisor | GeneratedVisit)[];
    t: (key: string, options?: any) => string;
    users: User[];
    isSupervisor: boolean;
    weekData: { User: User };
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

const DayColumn: React.FC<DayColumnProps> = ({
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

    const dayVisits = sortVisitsByTime(visits.filter((v) => v.date === dayStr));

    const dayRef = useRef<HTMLDivElement>(null);
    const [{ isOver }, drop] = useDrop(() => ({
        accept: ItemTypes.VISIT,
        canDrop: () => !isPastDate,
        drop: (item: { visitId: string; originalDate: string; time: string; isGenerated: boolean }) => {
            console.log('Dropped visit:', item, 'to date:', dayStr);
            handleDropVisit(item, dayStr);
        },
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
        }),
    }), [dayStr, handleDropVisit, isPastDate]);

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
        <div
            ref={dayRef}
            className={`day-column ${isOver ? 'drag-over' : ''} ${isPastDate ? 'past-date' : ''}`}
            key={dayStr}
        >
            <div className="day-tile">
                <span className="day-name">
                    {day.toLocaleDateString("en-GB", { weekday: "short" })}
                </span>
                <span className="day-date">{day.getDate()}</span>
                <span className="visit-count">
                    {dayVisits.length > 0 ? `/ ${dayVisits.length} ${t("timesheets.weekView.visits")}` : ""}
                </span>
            </div>
            <div className="visits-list">
                {dayVisits.length > 0 ? (
                    dayVisits.map((visit) => (
                        <VisitCard
                            key={'visitID' in visit ? visit.visitID : (visit as GeneratedVisit).visitID}
                            visit={visit}
                            t={t}
                            users={users}
                            isSupervisor={isSupervisor}
                            weekData={{ User: weekData.User ?? ({} as User) }}
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
                    <div className="no-visits">
                        {t("timesheets.dayView.noVisits")}
                    </div>
                )}
            </div>
        </div>
    );
};


interface VisitCardProps {
    visit: VisitWithSupervisor | GeneratedVisit;
    t: (key: string, options?: any) => string;
    users: User[];
    isSupervisor: boolean;
    weekData: { User: User };
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

const VisitCard: React.FC<VisitCardProps> = ({
    visit,
    t,
    users,
    isSupervisor,
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
    const visitId = 'visitID' in visit
        ? visit.visitID
        : ((visit as GeneratedVisit).agentID && (visit as GeneratedVisit).date && (visit as GeneratedVisit).time
            ? `${(visit as GeneratedVisit).visitID}` // Use visitID directly for generated visits
            : '');
    const isVisited = visit.status === VisitStatus.VISITED;
    const isGenerated = 'selected' in visit;
    const isSelected = isGenerated && (visit as GeneratedVisit).selected;
    const visitRef = useRef<HTMLDivElement>(null);
    const [{ isDragging }, drag] = useDrag(() => ({
        type: ItemTypes.VISIT,
        item: {
            visitId,
            originalDate: visit.date, // Use full date as stored
            time: visit.time,
            isGenerated,
        },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
        canDrag: () => (userPermissions.canCreateTimesheets || userPermissions.canCreateSupervisorTimesheets) && !isVisited,
    }), [visitId, visit.date, visit.time, isGenerated, userPermissions, isVisited]);

    useEffect(() => {
        drag(visitRef);
    }, [drag]);

    // Compute agent name
    const agentName = 'Agent' in visit && visit.Agent
        ? `${visit.Agent.name} ${visit.Agent.lastname}`
        : '';

    // Compute supervisor name
    const supervisor = 'supervisorID' in visit && visit.supervisorID
        ? users.find((u) => u.userID === visit.supervisorID)
        : null;
    const supervisorName = supervisor
        ? `${supervisor.firstname} ${supervisor.lastname}`
        : '';

    let displayLocation = '';
    if (
        visit.agentID &&
        "Agent" in visit &&
        visit.Agent &&
        "address" in visit.Agent &&
        typeof (visit.Agent as { address?: string }).address === "string"
    ) {
        displayLocation = (visit.Agent as { address: string }).address;
    } else if (visit.location) {
        displayLocation = isCoordinates(visit.location)
            ? locationCache[`coords:${visit.location}`] || ''
            : visit.location;
    }

    const displayReasons = isGenerated
        ? (visit as GeneratedVisit).reasons
        : visitReasons[visitId] || ('Reasons' in visit ? visit.Reasons : []);

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        console.log('Checkbox change for visitId:', visitId);
        toggleVisitSelection(visitId, isGenerated);
    };

    return (
        <div
            ref={visitRef}
            className={`visit-card ${isVisited ? 'visited' : ''} ${isSelected ? 'selected' : ''}`}
            style={{ opacity: isDragging ? 0.5 : 1 }}
            onClick={
                !isGenerated && userPermissions.canAccessTimesheetDetails && 'visitID' in visit
                    ? () => navigate(`/visit/${visit.visitID}`)
                    : undefined
            }
            role={!isGenerated && userPermissions.canAccessTimesheetDetails && 'visitID' in visit ? "button" : undefined}
            tabIndex={!isGenerated && userPermissions.canAccessTimesheetDetails && 'visitID' in visit ? 0 : -1}
            onKeyDown={(e) =>
                !isGenerated &&
                userPermissions.canAccessTimesheetDetails &&
                'visitID' in visit &&
                e.key === 'Enter' &&
                navigate(`/visit/${visit.visitID}`)
            }
            aria-label={t('timesheets.weekView.visitCard', { time: visit.time })}
        >
            {isGenerated && (
                <input
                    type="checkbox"
                    checked={!!isSelected}
                    onChange={handleCheckboxChange}
                    className="visit-selection-checkbox"
                    aria-label={t('timesheets.selectVisit')}
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
                    <FaClock /> {formatTime(visit.time)}
                </span>
                <span className={`visit-status status-${visit.status.toLowerCase()}`}>
                    {visit.status}
                </span>
            </div>
            <p className="visit-location">
                <FaMapMarkerAlt /> {displayLocation}
            </p>
            {displayReasons.length > 0 && (
                <p className="visit-reasons">
                    {displayReasons.map((r: { reasonID: string; item: string }) => r.item).join(', ')}
                </p>
            )}
        </div>
    );
};





const Timesheets: React.FC = React.memo(() => {
    const navigate = useNavigate();
    const { user, userRoles, effectivePermissions, permissionsLoaded } = useAuth();
    const supervisorID = user?.userID;
    const { t } = useTranslation();

    const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
    const [filteredTimesheets, setFilteredTimesheets] = useState<Timesheet[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [generatedVisits, setGeneratedVisits] = useState<GeneratedVisit[]>([]);
    const [visitReasons, setVisitReasons] = useState<Record<string, VisitReason[]>>({});
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
    const [visitStatusFilter, setVisitStatusFilter] = useState<string>("all");
    const [visitReasonSearch, setVisitReasonSearch] = useState<string>("");
    const [supervisorSearch, setSupervisorSearch] = useState<string>("");
    const [isFilterVisible, setIsFilterVisible] = useState<boolean>(false);
    const [isSuggestionsModalOpen, setIsSuggestionsModalOpen] = useState<boolean>(false);
    const [, setError] = useState<string | null>(null);
    const [locationCache, setLocationCache] = useState<Record<string, string | undefined>>({});
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
    const [supervisorSearchInput, setSupervisorSearchInput] = useState<string>("");
    const [visitReasonSearchInput, setVisitReasonSearchInput] = useState<string>("");
    const [hasCalendarAccess, setHasCalendarAccess] = useState<boolean>(false);
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    const userPermissions = useMemo(
        () => ({
            canAccessTimesheets: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.ACCESS_TIMESHEETS
            ) ?? false,
            canAccessSupervisorTimesheets: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.ACCESS_SUPERVISOR_TIMESHEETS
            ) ?? false,
            canAccessTimesheetDetails: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.ACCESS_TIMESHEET_DETAILS
            ) ?? false,
            canCreateTimesheets: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.CREATE_TIMESHEETS
            ) ?? false,
            canCreateSupervisorTimesheets: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.CREATE_SUPERVISOR_TIMESHEETS
            ) ?? false,
            canValidateTimesheets: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.VALIDATE_TIMESHEETS
            ) ?? false,
            canReadSupervisors: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.READ_SUPERVISORS
            ) ?? false,
        }),
        [effectivePermissions]
    );

    const isSuperAdmin = useMemo(
        () => userRoles?.some((role) => role.name === ROLES.SUPER_ADMIN),
        [userRoles]
    );

    const isRegionalManager = useMemo(
        () => userRoles?.some((role) => role.name === ROLES.REGIONAL_MANAGER),
        [userRoles]
    );

    const isDirector = useMemo(
        () => userRoles?.some((role) => role.name === ROLES.DIRECTOR),
        [userRoles]
    );

    const isSupervisor = useMemo(
        () => userRoles?.some((role) => role.name === ROLES.SUPERVISOR),
        [userRoles]
    );

    const debouncedSetSupervisorSearch = useMemo(
        () => debounce((value: string) => {
            console.log('Supervisor search updated:', value);
            setSupervisorSearch(value);
        }, 300),
        []
    );

    const debouncedSetVisitReasonSearch = useMemo(
        () => debounce((value: string) => {
            console.log('Visit reason search updated:', value);
            setVisitReasonSearch(value);
        }, 300),
        []
    );

    const fetchTimesheets = useCallback(async () => {
        try {
            setLoading(true);
            let data: Timesheet[] = [];

            if (userPermissions.canAccessTimesheets) {
                data = await getAllTimesheets();
            } else if (isRegionalManager || isDirector) {
                const supervisors = await getSupervisorsByUser(supervisorID!);
                const supervisorTimesheetsPromises = supervisors.map((supervisor) =>
                    getTimesheetsBySupervisor(supervisor.userID)
                );
                data = (await Promise.all(supervisorTimesheetsPromises)).flat();
            } else if (userPermissions.canAccessSupervisorTimesheets) {
                data = await getTimesheetsBySupervisor(supervisorID!);
            }

            const filteredTimesheets = data.filter(
                (ts) =>
                    ts.year === currentYear ||
                    (ts.year === currentYear - 1 && ts.weekNumber >= 52)
            );

            const newVisitReasons: Record<string, VisitReason[]> = {};
            filteredTimesheets.forEach((ts) => {
                (ts.Visits || []).forEach((visit) => {
                    if (visit.visitID && visit.Reasons) {
                        newVisitReasons[visit.visitID] = visit.Reasons.map((reason) => ({
                            reasonID: reason.reasonID,
                            item: reason.item,
                        }));
                    }
                });
            });

            console.log('Fetched timesheets:', filteredTimesheets.length);
            setTimesheets(filteredTimesheets);
            setVisitReasons(newVisitReasons);
        } catch (error) {
            console.error("Failed to fetch timesheets:", error);
            setError(t("timesheets.errors.fetchTimesheets"));
        } finally {
            setLoading(false);
        }
    }, [
        userPermissions.canAccessTimesheets,
        userPermissions.canAccessSupervisorTimesheets,
        isRegionalManager,
        isDirector,
        supervisorID,
        currentYear,
        t,
    ]);

    const fetchUsers = useCallback(async () => {
        try {
            let userData: User[] = [];
            if (isSuperAdmin) {
                userData = await getUsersByRole(ROLES.SUPERVISOR);
            } else if (userPermissions.canReadSupervisors && supervisorID) {
                userData = await getSupervisorsByUser(supervisorID);
            }
            console.log('Fetched users:', userData.length);
            setUsers(userData);
        } catch (error) {
            console.error("Failed to fetch users:", error);
            setError(t("timesheets.errors.fetchUsers"));
        }
    }, [isSuperAdmin, userPermissions.canReadSupervisors, supervisorID, t]);

    useEffect(() => {
        if (!user?.userID) return;
        const socket = io(SOCKET_URL, {
            auth: { token: localStorage.getItem('accessToken') }
        });

        socket.on('connect', () => {
            socket.emit('join', user.userID);
        });

        socket.on('calendar:update', () => {
            fetchTimesheets();
        });

        return () => {
            socket.disconnect();
        };
    }, [user, fetchTimesheets]);

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                event.preventDefault();
                event.returnValue = t("timesheets.warnings.unsavedChanges");
                return t("timesheets.warnings.unsavedChanges");
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges, t]);

    useEffect(() => {
        const fetchUserCalendarAccess = async () => {
            try {
                const response = await fetchUserProfile();
                setHasCalendarAccess(response.hasCalendarAccess || false);
            } catch (err) {
                console.error('Failed to fetch calendar access:', err);
            }
        };
        if (user?.userID) fetchUserCalendarAccess();
    }, [user]);

    useEffect(() => {
        if (navigator.geolocation && !userLocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
                }
            );
        }
    }, [userLocation]);


    const getWeekNumber = useCallback((date: Date): number => {
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
    }, []);

    const getWeeksInYear = useCallback((year: number): number => {
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
    }, []);

    const updateCurrentWeekAndDay = useCallback(() => {
        const today = new Date();
        setCurrentWeek(getWeekNumber(today));
        setCurrentDay(today);
    }, [getWeekNumber]);

    const getWeekDays = useCallback(
        (year: number, weekNumber: number): Date[] =>
            Array.from({ length: 7 }, (_, i) => {
                const jan1 = new Date(year, 0, 1);
                const firstFridayOffset = (5 - jan1.getDay() + 7) % 7;
                const firstMonday = new Date(year, 0, 1 + firstFridayOffset - 4);
                const weekStart = new Date(firstMonday);
                weekStart.setDate(firstMonday.getDate() + (weekNumber - 1) * 7 + i);
                weekStart.setHours(0, 0, 0, 0);
                return weekStart;
            }),
        []
    );

    const sortVisitsByTime = useCallback(
        (visits: (VisitWithSupervisor | GeneratedVisit)[]): (VisitWithSupervisor | GeneratedVisit)[] =>
            [...visits].sort((a, b) => a.time.localeCompare(b.time)),
        []
    );

    const isCoordinates = (str: string): boolean => /^\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*$/.test(str);

    const formatTime = (timeStr: string): string => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12;
        return `${formattedHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const todayVisits = useMemo(() => {
        const allVisits = timesheets.flatMap(ts => ts.Visits || []);
        return allVisits.filter(v => v.date.split("T")[0] === todayStr);
    }, [timesheets]);

    useEffect(() => {
        const fetchLocations = async () => {
            const allVisits = [...timesheets.flatMap(ts => ts.Visits || []), ...generatedVisits];
            const newLocationCache = { ...locationCache };

            for (const visit of allVisits) {
                const key = visit.location ? `coords:${visit.location}` : `agent:${visit.agentID}`;
                if (!newLocationCache[key]) {
                    newLocationCache[key] =
                        "Agent" in visit &&
                            visit.Agent &&
                            typeof visit.Agent === "object" &&
                            "address" in visit.Agent &&
                            typeof (visit.Agent as { address?: string }).address === "string"
                            ? (visit.Agent as { address: string }).address
                            : visit.location || '';
                }
            }

            setLocationCache(newLocationCache);
        };

        if (timesheets.length > 0 || generatedVisits.length > 0) {
            fetchLocations();
        }
    }, [timesheets, generatedVisits, t]);

    const filteredSupervisors = useMemo(
        () => {
            const result = supervisorSearch
                ? users.filter(
                    (user) =>
                        `${user.firstname} ${user.lastname}`
                            .toLowerCase()
                            .includes(supervisorSearch.toLowerCase()) ||
                        (user.phone &&
                            user.phone.toLowerCase().includes(supervisorSearch.toLowerCase())) ||
                        user.userID.toLowerCase().includes(supervisorSearch.toLowerCase())
                )
                : users;
            console.log('Filtered supervisors:', result.length);
            return result;
        },
        [users, supervisorSearch]
    );

    const handleSuggestionsGenerated = useCallback((suggestions: SuggestTimesheetResponse) => {
        const visits: GeneratedVisit[] = suggestions.map(suggestion => ({
            visitID: suggestion.visitID,
            date: suggestion.date, // YYYY-MM-DD
            time: suggestion.time, // HH:MM
            location: suggestion.location,
            latitude: null, // Backend does not provide coordinates in suggestions
            longitude: null,
            reasons: Array.isArray(suggestion.Reasons) ? suggestion.Reasons.map(r => ({ reasonID: r.reasonID, item: r.item })) : [],
            checklists: Array.isArray(suggestion.Checklists) ? suggestion.Checklists.map(c => ({ checklistID: c.checklistID, item: c.item })) : [],
            agentID: suggestion.agentID,
            status: VisitStatus.GENERATED,
            selected: true,
            timesheetID: suggestion.timesheetID,
            photos: suggestion.photos || [],
            comment: suggestion.comment || null,
            calendarEventId: suggestion.calendarEventId || null,
            Agent: suggestion.Agent || null,
        }));
        setGeneratedVisits(visits);
        setIsSuggestionsModalOpen(false);
        setHasUnsavedChanges(true);
    }, []);

    const handleCancelSuggestions = useCallback(() => {
        setGeneratedVisits([]);
        setError(null);
        setHasUnsavedChanges(false);
    }, []);






    const toggleVisitSelection = useCallback((visitId: string, isGenerated: boolean) => {
        if (isGenerated) {
            setGeneratedVisits(prev => {
                const updatedVisits = prev.map((visit: GeneratedVisit) => {
                    if (visit.visitID === visitId) {
                        return { ...visit, selected: !visit.selected };
                    }
                    return visit;
                });
                console.log('Toggled visit selection:', visitId, updatedVisits);
                return [...updatedVisits]; // Force re-render
            });
            setHasUnsavedChanges(true);
        }
    }, []);







    const toggleSelectAllVisits = useCallback(() => {
        setGeneratedVisits(prev => {
            const allSelected = prev.every(visit => visit.selected);
            return prev.map(visit => ({ ...visit, selected: !allSelected }));
        });
        setHasUnsavedChanges(true);
    }, []);

    const handleSaveSuggestions = useCallback(async () => {
        if (!supervisorID || !generatedVisits.length) return;
        setLoading(true);
        setError(null);
        try {
            const selectedVisits = generatedVisits.filter(visit => visit.selected);
            if (selectedVisits.length === 0) {
                setGeneratedVisits([]);
                setHasUnsavedChanges(false);
                setLoading(false);
                return;
            }

            for (const visit of selectedVisits) {
                const weekNumber = getWeekNumber(new Date(visit.date));
                await createTimesheet({
                    weekNumber,
                    year: currentYear,
                    supervisorID,
                    visits: [{
                        date: visit.date,
                        time: `${visit.time}:00`,
                        agentID: visit.agentID,
                        location: visit.location,
                        reasons: visit.reasons.map(r => ({ id: r.reasonID, item: r.item })),
                        checklists: visit.checklists.map(c => ({ id: c.checklistID, item: c.item })),
                        status: userPermissions.canValidateTimesheets || userPermissions.canCreateSupervisorTimesheets ? "validated" : "pending",
                    }],
                    status: userPermissions.canValidateTimesheets || userPermissions.canCreateSupervisorTimesheets ? "validated" : "pending",
                });
            }

            setGeneratedVisits([]);
            setHasUnsavedChanges(false);
            await fetchTimesheets();
        } catch (err: any) {
            console.error("Error saving suggestions:", err);
            setError(err.message || t("timesheetForm.errors.createFailed"));
        } finally {
            setLoading(false);
        }
    }, [supervisorID, generatedVisits, currentYear, fetchTimesheets, t, userPermissions, getWeekNumber]);

    const generateYearData = useCallback(() => {
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
                    status: visit.status || VisitStatus.PENDING,
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
    }, [filteredTimesheets, currentYear, getWeeksInYear, getWeekDays]);

    const generateMonthData = useCallback(() => {
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
                            status: visit.status || VisitStatus.PENDING,
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
    }, [
        filteredTimesheets,
        currentYear,
        currentMonth,
        getWeeksInYear,
        getWeekDays,
    ]);

    const generateWeekData = useCallback(() => {
        const matchingTimesheets = filteredTimesheets.filter(
            (ts) => ts.weekNumber === currentWeek
        );
        const weekDays = getWeekDays(currentYear, currentWeek);
        const savedVisits = matchingTimesheets.flatMap((ts) =>
            (ts.Visits || []).map((visit) => ({
                ...visit,
                supervisorID: ts.supervisorID,
                status: visit.status || VisitStatus.PENDING,
            }))
        );
        const supervisorIds = supervisorSearch
            ? filteredSupervisors.map(s => s.userID)
            : undefined;
        const allVisits = [...savedVisits, ...generatedVisits].filter((visit) => {
            const statusMatch = visitStatusFilter === "all" ? true : visit.status === visitStatusFilter;
            const reasonMatch = visitReasonSearch
                ? ("reasons" in visit
                    ? visit.reasons.some((reason) =>
                        reason.item.toLowerCase().includes(visitReasonSearch.toLowerCase())
                    )
                    : visitReasons[visit.visitID]?.some((reason) =>
                        reason.item.toLowerCase().includes(visitReasonSearch.toLowerCase())
                    ))
                : true;
            const supervisorMatch = supervisorIds
                ? "supervisorID" in visit && supervisorIds.includes(visit.supervisorID!)
                : true;
            return statusMatch && reasonMatch && supervisorMatch;
        });
        console.log('Filtered visits for week view (supervisor):', allVisits.length);
        return {
            weekNumber: currentWeek,
            days: weekDays,
            visits: allVisits,
            status: matchingTimesheets[0]?.status || "Not Scheduled",
            timesheetID: matchingTimesheets[0]?.timesheetID,
            supervisorID: matchingTimesheets[0]?.supervisorID || supervisorID,
            User: matchingTimesheets[0]?.User,
            supervisorCount: new Set(matchingTimesheets.map((ts) => ts.supervisorID)).size,
        };
    }, [
        filteredTimesheets,
        generatedVisits, // Ensure re-renders when generatedVisits changes
        currentYear,
        currentWeek,
        getWeekDays,
        supervisorID,
        visitStatusFilter,
        visitReasonSearch,
        visitReasons,
        supervisorSearch,
        filteredSupervisors
    ]);

    const generateDayData = useCallback(() => {
        if (!currentDay) return [];
        const dateStr = currentDay.toISOString().split("T")[0];
        const supervisorIds = supervisorSearch
            ? filteredSupervisors.map(s => s.userID)
            : undefined;
        const filteredVisits = sortVisitsByTime(
            [
                ...filteredTimesheets
                    .flatMap((ts) =>
                        (ts.Visits || []).map((visit) => ({
                            ...visit,
                            supervisorID: ts.supervisorID,
                            status: visit.status || VisitStatus.PENDING,
                        }))
                    ),
                ...generatedVisits
            ].filter((visit) => {
                const statusMatch = visitStatusFilter === "all" ? true : visit.status === visitStatusFilter;
                const reasonMatch = visitReasonSearch
                    ? ("reasons" in visit
                        ? visit.reasons.some((reason) =>
                            reason.item.toLowerCase().includes(visitReasonSearch.toLowerCase())
                        )
                        : visitReasons[visit.visitID]?.some((reason) =>
                            reason.item.toLowerCase().includes(visitReasonSearch.toLowerCase())
                        ))
                    : true;
                const supervisorMatch = supervisorIds
                    ? "supervisorID" in visit && supervisorIds.includes(visit.supervisorID!)
                    : true;
                return visit.date.split("T")[0] === dateStr && statusMatch && reasonMatch && supervisorMatch;
            })
        );
        console.log('Filtered visits for day view (supervisor):', filteredVisits.length);
        return filteredVisits;
    }, [
        filteredTimesheets,
        generatedVisits,
        currentDay,
        sortVisitsByTime,
        visitStatusFilter,
        visitReasonSearch,
        visitReasons,
        supervisorSearch,
        filteredSupervisors
    ]);

    const scrollToCurrent = useCallback(() => {
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
    }, [viewMode, currentWeek, updateCurrentWeekAndDay]);

    const yearData = useMemo(() => generateYearData(), [generateYearData]);
    const monthData = useMemo(() => generateMonthData(), [generateMonthData]);
    const weekData = useMemo(() => generateWeekData(), [generateWeekData]);
    const dayData = useMemo(() => generateDayData(), [generateDayData]);

    const handleValidateTimesheet = useCallback(
        async () => {
            if (!userPermissions.canValidateTimesheets || !weekData.timesheetID) {
                console.log('Validation skipped: No permissions or timesheetID');
                return;
            }
            try {
                // Get visible visits with Pending status
                const pendingVisitIds = weekData.visits
                    .filter((visit) =>
                        "visitID" in visit &&
                        visit.status === VisitStatus.PENDING
                    )
                    .map((visit) => (visit as VisitWithSupervisor).visitID);

                console.log('Pending visit IDs for validation:', pendingVisitIds);

                if (pendingVisitIds.length === 0) {
                    setError(t("timesheets.errors.noPendingVisits"));
                    return;
                }

                // Show confirmation dialog
                const confirmMessage = t("timesheets.confirmValidate", {
                    count: pendingVisitIds.length,
                });
                if (!window.confirm(confirmMessage)) {
                    console.log('Validation cancelled by user');
                    return;
                }

                // Call API to validate
                await validateTimesheet(weekData.timesheetID, {
                    visitIDs: pendingVisitIds,
                    status: "validated",
                });
                console.log('Timesheet validated successfully:', weekData.timesheetID);

                // Refresh timesheets
                await fetchTimesheets();
            } catch (error) {
                console.error("Failed to validate timesheet:", error);
                setError(t("timesheets.errors.validateTimesheet"));
            }
        },
        [userPermissions.canValidateTimesheets, weekData, fetchTimesheets, t]
    );

    const handleOpenSuggestionsModal = useCallback(() => {
        setIsSuggestionsModalOpen(true);
    }, []);

    const handleCloseSuggestionsModal = useCallback(() => {
        setIsSuggestionsModalOpen(false);
    }, []);

    const handleDropVisit = useCallback(
        async (
            item: { visitId: string; originalDate: string; time: string; isGenerated: boolean },
            targetDate: string
        ) => {
            if (item.originalDate === targetDate) return;

            try {
                if (item.isGenerated) {
                    setGeneratedVisits((prev) => {
                        const updatedVisits = prev.map((visit: GeneratedVisit) => {
                            if (visit.visitID === item.visitId) {
                                return { ...visit, date: targetDate };
                            }
                            return visit;
                        });
                        console.log('Updated generated visits after drop:', updatedVisits);
                        return [...updatedVisits]; // Force re-render
                    });
                    setHasUnsavedChanges(true);
                } else {
                    await updateVisit(item.visitId, {
                        date: targetDate,
                        time: item.time,
                        status: isSupervisor ? VisitStatus.PENDING : undefined,
                    });
                    await fetchTimesheets();
                }
            } catch (error) {
                console.error('Failed to update visit date:', error);
                setError(t('timesheets.errors.updateVisit'));
            }
        },
        [fetchTimesheets, t, isSupervisor]
    );



    useEffect(() => {
        if (!permissionsLoaded || !supervisorID) return;
        fetchTimesheets();
        updateCurrentWeekAndDay();
    }, [
        fetchTimesheets,
        updateCurrentWeekAndDay,
        permissionsLoaded,
        supervisorID,
    ]);

    useEffect(() => {
        if (
            !permissionsLoaded ||
            (!userPermissions.canReadSupervisors && isSupervisor)
        )
            return;
        fetchUsers();
    }, [fetchUsers, permissionsLoaded, userPermissions]);

    useEffect(() => {
        if (userPermissions.canAccessTimesheets || !isSupervisor) {
            const supervisorIds = supervisorSearch
                ? filteredSupervisors.map(s => s.userID)
                : undefined;
            const filtered = timesheets.filter((ts) => {
                const supervisorMatch = supervisorIds
                    ? supervisorIds.includes(ts.supervisorID)
                    : supervisorFilter === "all" || ts.supervisorID === supervisorFilter;
                const reasonMatch = visitReasonSearch
                    ? (ts.Visits || []).some((visit) =>
                        (visit.Reasons || []).some((reason) =>
                            reason.item
                                .toLowerCase()
                                .includes(visitReasonSearch.toLowerCase())
                        )
                    )
                    : true;
                return supervisorMatch && reasonMatch;
            });
            console.log('Filtered timesheets by supervisor/reason:', filtered.length);
            setFilteredTimesheets(filtered);
        } else {
            const filtered = timesheets.filter((ts) =>
                visitReasonSearch
                    ? (ts.Visits || []).some((visit) =>
                        (visit.Reasons || []).some((reason) =>
                            reason.item
                                .toLowerCase()
                                .includes(visitReasonSearch.toLowerCase())
                        )
                    )
                    : true
            );
            console.log('Filtered timesheets by reason (supervisor):', filtered.length);
            setFilteredTimesheets(filtered);
        }
    }, [
        timesheets,
        supervisorFilter,
        supervisorSearch,
        filteredSupervisors,
        visitReasonSearch,
        userPermissions,
        isSupervisor,
    ]);

    useEffect(() => {
        localStorage.setItem("supervisorFilter", supervisorFilter);
        localStorage.setItem("lastViewMode", viewMode);
    }, [supervisorFilter, viewMode]);



    if (loading || !permissionsLoaded) {
        return <TimesheetsSkeleton />;
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
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
                    {(viewMode === "week" || viewMode === "day") && (
                        <>
                            {(isSuperAdmin || isRegionalManager || isDirector || isSupervisor) && (
                                <button
                                    className={`toggle-btn-5 toggle-btn ${isFilterVisible ? "active" : ""}`}
                                    onClick={() => setIsFilterVisible(!isFilterVisible)}
                                    aria-label={t("timesheets.filter.toggle")}
                                >
                                    <FaFilter /> {t("timesheets.filter.toggle")}
                                </button>
                            )}
                        </>
                    )}
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

                {(viewMode === "week" || viewMode === "day") && isFilterVisible && (
                    <div className="filter-controls">
                        {isSupervisor ? (
                            <>
                                <select
                                    className="filter-select visit-status-filter"
                                    value={visitStatusFilter}
                                    onChange={(e) => {
                                        console.log('Visit status filter changed:', e.target.value);
                                        setVisitStatusFilter(e.target.value);
                                    }}
                                    aria-label={t("timesheets.filter.visitStatusSelect")}
                                >
                                    <option value="all">{t("timesheets.filter.allStatuses")}</option>
                                    {Object.values(VisitStatus).map((status) => (
                                        <option key={status} value={status}>
                                            {status}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    placeholder={t("timesheets.filter.reasonPlaceholder")}
                                    value={visitReasonSearchInput}
                                    onChange={(e) => {
                                        setVisitReasonSearchInput(e.target.value);
                                        debouncedSetVisitReasonSearch(e.target.value);
                                    }}
                                    className="filter-input visit-reason-search"
                                    aria-label={t("timesheets.filter.reasonPlaceholder")}
                                />
                            </>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    placeholder={t("timesheets.filter.searchPlaceholder")}
                                    value={supervisorSearchInput}
                                    onChange={(e) => {
                                        setSupervisorSearchInput(e.target.value);
                                        debouncedSetSupervisorSearch(e.target.value);
                                    }}
                                    className="filter-input supervisor-search"
                                    aria-label={t("timesheets.filter.searchPlaceholder")}
                                />
                                <select
                                    className="filter-select supervisor-filter"
                                    value={supervisorFilter}
                                    onChange={(e) => {
                                        console.log('Supervisor filter changed:', e.target.value);
                                        setSupervisorFilter(e.target.value);
                                    }}
                                    aria-label={t("timesheets.filter.supervisorSelect")}
                                >
                                    <option value="all">{t("timesheets.filter.allSupervisors")}</option>
                                    {filteredSupervisors.map((supervisor) => (
                                        <option key={supervisor.userID} value={supervisor.userID}>
                                            {supervisor.firstname} {supervisor.lastname}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    className="filter-select visit-status-filter"
                                    value={visitStatusFilter}
                                    onChange={(e) => {
                                        console.log('Visit status filter changed:', e.target.value);
                                        setVisitStatusFilter(e.target.value);
                                    }}
                                    aria-label={t("timesheets.filter.visitStatusSelect")}
                                >
                                    <option value="all">{t("timesheets.filter.allStatuses")}</option>
                                    {Object.values(VisitStatus).map((status) => (
                                        <option key={status} value={status}>
                                            {status}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    placeholder={t("timesheets.filter.reasonPlaceholder")}
                                    value={visitReasonSearchInput}
                                    onChange={(e) => {
                                        setVisitReasonSearchInput(e.target.value);
                                        debouncedSetVisitReasonSearch(e.target.value);
                                    }}
                                    className="filter-input visit-reason-search"
                                    aria-label={t("timesheets.filter.reasonPlaceholder")}
                                />
                            </>
                        )}
                    </div>
                )}
                {viewMode === "year" && (
                    <section className="year-view">
                        {yearData.map(({ month, weeks }) => (
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
                                            {!isSupervisor && (
                                                <span className="week-info week-range">
                                                    <br />
                                                    {t("timesheets.yearView.supervisors")}: {week.supervisorCount}
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
                            {monthData.map((week) => (
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
                                        {week.visits.length} {t("timesheets.monthView.visits")}
                                        {isSupervisor &&
                                            `- ${t("timesheets.monthView.status")}: ${week.status}`}
                                        {!isSupervisor &&
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
                            {isSupervisor && filteredTimesheets[0]?.timesheetID && (
                                <CalendarSyncButton
                                    timesheetId={filteredTimesheets[0].timesheetID}
                                    isSupervisor={!!isSupervisor}
                                    hasCalendarAccess={hasCalendarAccess}
                                />
                            )}
                            <div className="week-header-middle">
                                <button
                                    className="nav-btn"
                                    onClick={() => setCurrentWeek((prev) => prev - 1)}
                                    disabled={currentWeek === 1}
                                    aria-label={t("timesheets.navigation.previousWeek")}
                                >
                                    <span>←</span>
                                </button>
                                <h2>
                                    {t("timesheets.weekView.week")} {weekData.weekNumber}
                                </h2>
                                <button
                                    className="nav-btn"
                                    onClick={() => setCurrentWeek((prev) => prev + 1)}
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
                                    </p>
                                </div>
                                {weekData.timesheetID &&
                                    userPermissions.canValidateTimesheets && (
                                        <button
                                            className="create-btn"
                                            onClick={handleValidateTimesheet}
                                            aria-label={t("timesheets.actions.validate")}
                                        >
                                            {t("timesheets.actions.validate")}
                                        </button>
                                    )}
                                {isSupervisor && generatedVisits.length > 0 && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
                                        {(userPermissions.canCreateTimesheets ||
                                            userPermissions.canCreateSupervisorTimesheets) && (
                                                <button
                                                    className="create-btn"
                                                    onClick={handleSaveSuggestions}
                                                    disabled={loading}
                                                    aria-label={t("timesheets.actions.saveSuggestions")}
                                                >
                                                    {loading
                                                        ? t("timesheets.actions.saving")
                                                        : t("timesheets.actions.saveSuggestions")}
                                                </button>
                                            )}
                                    </div>
                                )}
                            </div>
                            <div className="days-grid">
                                {weekData.days.map((day) => (
                                    <DayColumn
                                        key={day.toISOString()}
                                        day={day}
                                        visits={weekData.visits}
                                        handleDropVisit={handleDropVisit}
                                        sortVisitsByTime={sortVisitsByTime}
                                        t={t}
                                        users={users}
                                        isSupervisor={!!isSupervisor}
                                        weekData={{ User: weekData.User ?? ({} as User) }}
                                        userPermissions={userPermissions}
                                        visitReasons={visitReasons}
                                        locationCache={locationCache}
                                        navigate={navigate}
                                        toggleVisitSelection={toggleVisitSelection}
                                        isSuperAdmin={!!isSuperAdmin}
                                        isRegionalManager={!!isRegionalManager}
                                        isDirector={!!isDirector}
                                    />
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {viewMode === "day" && (
                    <section className="day-view">
                        {(
                            <button
                                className="nav-btn"
                                onClick={() => setIsMapModalOpen(true)}
                                aria-label={t("timesheets.actions.viewDayOnMap")}
                            >
                                {t("timesheets.actions.viewDayOnMap")}
                            </button>
                        )}
                        <div className="day-header">

                            {/* Existing navigation buttons */}
                            <button
                                className="nav-btn"
                                onClick={() =>
                                    setCurrentDay(
                                        new Date(currentDay!.setDate(currentDay!.getDate() - 1))
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
                                        new Date(currentDay!.setDate(currentDay!.getDate() + 1))
                                    )
                                }
                                aria-label={t("timesheets.navigation.nextDay")}
                            >
                                <span>→</span>
                            </button>
                        </div>
                        <div className="visits-list">
                            {dayData.length > 0 ? (
                                dayData.map((visit: VisitWithSupervisor | GeneratedVisit) => (
                                    <VisitCard
                                        key={
                                            'visitID' in visit
                                                ? visit.visitID
                                                : ('agentID' in visit && 'date' in visit && 'time' in visit
                                                    ? `${(visit as GeneratedVisit).agentID}-${(visit as GeneratedVisit).date}-${(visit as GeneratedVisit).time}`
                                                    : '')
                                        }
                                        visit={visit}
                                        t={t}
                                        users={users}
                                        isSupervisor={!!isSupervisor}
                                        weekData={{ User: weekData.User ?? ({} as User) }}
                                        userPermissions={userPermissions}
                                        visitReasons={visitReasons}
                                        locationCache={locationCache}
                                        navigate={navigate}
                                        formatTime={formatTime}
                                        isCoordinates={isCoordinates}
                                        toggleVisitSelection={toggleVisitSelection}
                                        isSuperAdmin={!!isSuperAdmin}
                                        isRegionalManager={!!isRegionalManager}
                                        isDirector={!!isDirector}
                                    />
                                ))
                            ) : (
                                <div className="no-visits">{t("timesheets.dayView.noVisits")}</div>
                            )}
                        </div>
                    </section>
                )}
            </div>
            <TimesheetSuggestionsModal
                isOpen={isSuggestionsModalOpen}
                onClose={handleCloseSuggestionsModal}
                weekNumber={currentWeek}
                year={currentYear}
                onSuggestionsGenerated={handleSuggestionsGenerated}
            />
            {isMapModalOpen && (
                <CustomMapModal
                    isOpen={isMapModalOpen}
                    onClose={() => setIsMapModalOpen(false)}
                    visits={dayData
                        .filter(
                            (v) =>
                                !('selected' in v) &&
                                v.status === "validated" &&
                                v.Agent?.latitude != null &&
                                v.Agent?.longitude != null &&
                                v.location !== undefined &&
                                v.location !== null
                        )
                        .map((v) => ({
                            visitID: v.visitID,
                            latitude: v.Agent?.latitude!,
                            longitude: v.Agent?.longitude!,
                            location: v.location as string,
                            time: v.time,
                            reasons: visitReasons[v.visitID]?.map((r) => r.item).join(', ') || '',
                            agentName: v.Agent ? `${v.Agent.name} ${v.Agent.lastname}` : '',
                        }))}
                    userLocation={userLocation}
                />
            )}
        </motion.div>

    );
});

const WrappedTimesheets = () => (
    <DndProvider backend={HTML5Backend}>
        <Timesheets />
    </DndProvider>
);

export default WrappedTimesheets;
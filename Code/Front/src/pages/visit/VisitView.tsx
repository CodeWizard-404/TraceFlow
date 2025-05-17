/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    FaCalendar,
    FaClock,
    FaMapMarkerAlt,
    FaUser,
    FaPhone,
    FaListUl,
    FaCheckCircle,
    FaArrowLeft,
    FaCircle,
    FaEdit,
    FaTrash,
    FaCamera,
    FaComment,
    FaTimes,
    FaCalendarCheck,
} from "react-icons/fa";
import { TbCalendarTime } from "react-icons/tb";
import { BsPersonLinesFill } from "react-icons/bs";
import { FaUserTimes } from "react-icons/fa";
import "./VisitDetails.css";
import { useAuth } from "../../context/AuthContext";
import VisitStatus from "../../models/Enum/VisitStatus";
import Visit from "../../models/Visit";
import Agent from "../../models/Agent";
import User from "../../models/User";
import { Checklist } from "../../models/Checklist";
import { Reason } from "../../models/Reason";
import Region from "../../models/Region";
import Governorate from "../../models/Governorate";
import Delegation from "../../models/Delegation";
import { getAgentById } from "../../apis/agentAPI";
import {
    getSupervisorsByRegionalManager,
    getRegionalManagerBySupervisor,
    getAllUsers,
} from "../../apis/userAPI";
import { getAllChecklists } from "../../apis/checklistAPI";
import { getAllReasons } from "../../apis/reasonAPI";
import { validateTimesheet } from "../../apis/timesheetAPI";
import { getVisitById, deleteVisit } from "../../apis/visitAPI";
import {
    getAllRegions,
    getAllGovernorates,
    getAllDelegations,
    getRegionsByUser
} from "../../apis/locationApi";
import { useTranslation } from "react-i18next";
import CalendarSyncButton from "../../components/Google/CalendarSyncButton";
import { io } from 'socket.io-client';

const BASE_URL = import.meta.env.VITE_BASE_URL;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const PERMISSIONS = {
    ACCESS_VISIT_DETAILS: import.meta.env.VITE_PERMISSIONS_ACCESS_VISIT_DETAILS,
    LOG_VISITS: import.meta.env.VITE_PERMISSIONS_LOG_VISITS,
    VALIDATE_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_VALIDATE_TIMESHEETS,
    EDIT_TIMESHEETS_FOR_SUPERVISOR: import.meta.env.VITE_PERMISSIONS_EDIT_VISIT,
    DELETE_TIMESHEETS_FOR_SUPERVISOR: import.meta.env.VITE_PERMISSIONS_DELETE_VISIT,
    READ_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS,
    READ_AGENTS_BY_LOCATION: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_DELEGATION,
    READ_REASON_ITEMS: import.meta.env.VITE_PERMISSIONS_READ_REASON_ITEMS,
    READ_CHECKLISTS_ITEMS: import.meta.env.VITE_PERMISSIONS_READ_CHECKLISTS_ITEMS,
} as const;

const ROLES = {
    SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
    SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
    REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
    DIRECTOR: import.meta.env.VITE_ROLES_DIRECTOR,
};

const VisitDetailsView: React.FC = () => {
    const { t } = useTranslation();
    const { idVisit } = useParams<{ idVisit: string }>();
    const navigate = useNavigate();
    const { user, effectivePermissions, permissionsLoaded } = useAuth();

    const [visit, setVisit] = useState<Visit | null>(null);
    const [agent, setAgent] = useState<Agent | null>(null);
    const [, setRegions] = useState<Region[]>([]);
    const [, setGovernorates] = useState<Governorate[]>([]);
    const [, setDelegations] = useState<Delegation[]>([]);
    const [, setReasons] = useState<Reason[]>([]);
    const [, setChecklists] = useState<Checklist[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [, setRegionalManagers] = useState<User[]>([]);
    const [, setSupervisors] = useState<User[]>([]);

    const userPermissions = useMemo(
        () => ({
            canAccessVisitDetails: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.ACCESS_VISIT_DETAILS
            ),
            canLogVisits: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.LOG_VISITS
            ),
            canValidateTimesheets: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.VALIDATE_TIMESHEETS
            ),
            canEditTimesheets: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.EDIT_TIMESHEETS_FOR_SUPERVISOR
            ),
            canDeleteTimesheets: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.DELETE_TIMESHEETS_FOR_SUPERVISOR
            ),
            canReadSupervisors: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.READ_SUPERVISORS
            ),
            canReadAgentsByLocation: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.READ_AGENTS_BY_LOCATION
            ),
            canReadReasons: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.READ_REASON_ITEMS
            ),
            canReadChecklists: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.READ_CHECKLISTS_ITEMS
            ),
        }),
        [effectivePermissions]
    );

    const isSuperAdmin = useMemo(
        () => user?.Roles?.some((role) => role.name === ROLES.SUPER_ADMIN),
        [user]
    );
    const isRegionalManager = useMemo(
        () => user?.Roles?.some((role) => role.name === ROLES.REGIONAL_MANAGER),
        [user]
    );
    const isSupervisor = useMemo(
        () => user?.Roles?.some((role) => role.name === ROLES.SUPERVISOR),
        [user]
    );
    const isDirector = useMemo(
        () => user?.Roles?.some((role) => role.name === ROLES.DIRECTOR),
        [user]
    );

    const fetchVisitData = useCallback(async () => {
        if (!idVisit || !userPermissions.canAccessVisitDetails) {
            navigate("/access-denied");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const visitData = await getVisitById(idVisit);
            setVisit(visitData);

            const agentData = visitData.agentID
                ? await getAgentById(visitData.agentID)
                : null;
            setAgent(agentData);

            const promises: [
                Promise<Region[]>,
                Promise<Governorate[]>,
                Promise<Delegation[]>,
                Promise<Reason[]>,
                Promise<Checklist[]>,
                Promise<User[]>,
                Promise<User[]>
            ] = [
                    userPermissions.canReadAgentsByLocation
                        ? isSupervisor
                            ? getRegionalManagerBySupervisor(user!.userID).then((rms) =>
                                rms.length > 0 ? getRegionsByUser(rms[0].userID) : []
                            )
                            : isRegionalManager
                                ? getRegionsByUser(user!.userID)
                                : getAllRegions()
                        : Promise.resolve([]),
                    getAllGovernorates(),
                    getAllDelegations(),
                    userPermissions.canReadReasons
                        ? getAllReasons()
                        : Promise.resolve([]),
                    userPermissions.canReadChecklists
                        ? getAllChecklists()
                        : Promise.resolve([]),
                    userPermissions.canReadSupervisors &&
                        (isSuperAdmin || isDirector || isRegionalManager)
                        ? isRegionalManager
                            ? getSupervisorsByRegionalManager(user!.userID)
                            : getAllUsers().then((users) =>
                                users.filter((u) =>
                                    u.Roles?.some(
                                        (role) => role.name.toLowerCase() === ROLES.SUPERVISOR.toLowerCase()
                                    )
                                )
                            )
                        : Promise.resolve([]),
                    (isSuperAdmin || isDirector)
                        ? getAllUsers().then((users) =>
                            users.filter((u) =>
                                u.Roles?.some(
                                    (role) => role.name.toLowerCase() === ROLES.REGIONAL_MANAGER.toLowerCase()
                                )
                            )
                        )
                        : Promise.resolve([]),
                ];

            const [
                regionsData,
                governoratesData,
                delegationsData,
                reasonsData,
                checklistsData,
                supervisorsData,
                regionalManagersData,
            ] = await Promise.all(promises);

            setRegions(regionsData);
            setGovernorates(governoratesData);
            setDelegations(delegationsData);
            setReasons(reasonsData);
            setChecklists(checklistsData);
            setSupervisors(supervisorsData);
            setRegionalManagers(regionalManagersData);
        } catch (err: unknown) {
            const errorMessage =
                err instanceof Error ? err.message : t("visitDetails.error.fetchFailed");
            setError(errorMessage);
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [idVisit, userPermissions, permissionsLoaded, navigate, user, t]);

    useEffect(() => {
        if (permissionsLoaded) fetchVisitData();
    }, [fetchVisitData, permissionsLoaded]);

    useEffect(() => {
        if (!user?.userID || !idVisit) return;
        const socket = io(SOCKET_URL, {
            auth: { token: localStorage.getItem('accessToken') }
        });

        socket.on('connect', () => {
            socket.emit('join', user.userID);
        });

        socket.on('calendar:update', (data: { visitId: string; calendarEventId?: string; action: 'created' | 'updated' | 'deleted' }) => {
            if (data.visitId === idVisit) {
                setVisit((prev) => prev ? { ...prev, calendarEventId: data.action === 'deleted' ? undefined : data.calendarEventId } : prev);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [user, idVisit]);

    const handleLogVisit = () => {
        if (visit && userPermissions.canLogVisits) {
            navigate("/qr-scan", { state: { visit } });
        }
    };

    const handleValidate = async () => {
        if (!visit || !visit.timesheetID || !userPermissions.canValidateTimesheets)
            return;
        try {
            await validateTimesheet(visit.timesheetID, {
                visitIDs: [visit.visitID],
                status: "validated",
            });
            setVisit((prev) =>
                prev ? { ...prev, status: VisitStatus.VALIDATED } : null
            );
        } catch (err: unknown) {
            const errorMessage =
                err instanceof Error ? err.message : t("visitDetails.error.validateFailed");
            setError(errorMessage);
        }
    };

    const handleReject = async () => {
        if (!visit || !visit.timesheetID || !userPermissions.canValidateTimesheets)
            return;
        try {
            await validateTimesheet(visit.timesheetID, {
                visitIDs: [visit.visitID],
                status: "rejected",
            });
            setVisit((prev) =>
                prev ? { ...prev, status: VisitStatus.REJECTED } : null
            );
        } catch (err: unknown) {
            const errorMessage =
                err instanceof Error ? err.message : t("visitDetails.error.rejectFailed");
            setError(errorMessage);
        }
    };

    const handleEditToggle = () => {
        navigate(`/visit/edit/${idVisit}`);
    };

    const handleDelete = async () => {
        if (
            !visit ||
            !userPermissions.canDeleteTimesheets ||
            !window.confirm(t("visitDetails.confirmDelete"))
        )
            return;
        try {
            await deleteVisit(visit.visitID);
            navigate("/timesheet");
        } catch (err: unknown) {
            const errorMessage =
                err instanceof Error ? err.message : t("visitDetails.error.deleteFailed");
            setError(errorMessage);
        }
    };

    const handleImageClick = (photo: string) =>
        setSelectedImage(`${BASE_URL}${photo}`);
    const handleCloseFullscreen = () => setSelectedImage(null);

    const photosCount =
        t("visitDetails.photos.count", { count: visit?.photos?.length || 0 }) ||
        `(${visit?.photos?.length || 0} photos)`;

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>{t("visitDetails.loading")}</p>
            </div>
        );
    }
    if (error || !visit) {
        return (
            <div className="visit-details-container">
                <div className="visit-details-error-card">
                    <h2>{t("visitDetails.error.title")}</h2>
                    <p>{error || t("visitDetails.error.notFound")}</p>
                    <button
                        className="visit-details-back-btn"
                        onClick={() => navigate("/timesheet")}
                        aria-label={t("visitDetails.aria.backButton")}
                    >
                        <FaArrowLeft /> {t("visitDetails.actions.back")}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="visit-details-container">
            <header className="visit-details-header">
                <h1>
                    <FaListUl /> {t("visitDetails.title")} -{" "}
                    {visit.status.toLowerCase()}
                    <span
                        className={`status-dot status-${visit.status.toLowerCase()}`}
                    ></span>
                    {visit.duration !== null && (
                        <div className="duration-clock">
                            <svg className="clock-circle" viewBox="0 0 36 36">
                                <circle className="clock-base" cx="18" cy="18" r="16" />
                                <circle
                                    className="clock-progress"
                                    cx="18"
                                    cy="18"
                                    r="16"
                                    strokeDasharray={`${Math.min(
                                        (visit.duration! / 60) * 100,
                                        100
                                    )} 100`}
                                />
                            </svg>
                            <span className="duration-text">
                                {visit.duration}m
                            </span>
                        </div>
                    )}
                </h1>
            </header>

            <section className="visit-details-section">
                <div className="visit-details-actions-top">
                    {userPermissions.canEditTimesheets && (
                        <button
                            className="visit-details-edit-btn"
                            onClick={handleEditToggle}
                            aria-label={t("visitDetails.aria.editButton")}
                        >
                            <FaEdit /> {t("visitDetails.actions.edit")}
                        </button>
                    )}
                    {userPermissions.canDeleteTimesheets && (
                        <button
                            className="visit-details-delete-btn"
                            onClick={handleDelete}
                            aria-label={t("visitDetails.aria.deleteButton")}
                        >
                            <FaTrash /> {t("visitDetails.actions.delete")}
                        </button>
                    )}
                </div>
                <div className="visit-details-grid">
                    <div className="visit-details-card">
                        <h2>
                            <TbCalendarTime /> {t("visitDetails.whenWhere.title")}
                        </h2>
                        <div className="card-content">
                            <p>
                                <FaCalendar />{" "}
                                {new Date(visit.date).toLocaleDateString("en-GB")}
                            </p>
                            <p>
                                <FaClock /> {visit.time.split(":").slice(0, 2).join(":")}
                            </p>
                            <p>
                                <FaMapMarkerAlt />{" "}
                                {visit.location || t("visitDetails.whenWhere.na")}
                            </p>
                            {visit.calendarEventId ? (
                                <p>
                                    <FaCalendarCheck /> Synced to Google Calendar
                                </p>
                            ) : (
                                <CalendarSyncButton
                                    visitId={visit.visitID}
                                    isSupervisor={!!isSupervisor}
                                    hasCalendarEvent={!!visit.calendarEventId}
                                />
                            )}
                        </div>
                    </div>

                    <div className="visit-details-card">
                        <h2>
                            <FaUser /> {t("visitDetails.agent.title")}
                        </h2>
                        <div className="card-content">
                            {agent ? (
                                <>
                                    <p>
                                        <BsPersonLinesFill /> {agent.name} {agent.lastname}
                                    </p>
                                    <p>
                                        <FaPhone /> {agent.phone || t("visitDetails.agent.na")}
                                    </p>
                                </>
                            ) : (
                                <p className="no-data">
                                    <FaUserTimes />
                                    {t("visitDetails.agent.recruitmentVisit")}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="visit-details-card">
                        <h2>
                            <FaListUl /> {t("visitDetails.reasons.title")}
                        </h2>
                        <div className="card-content">
                            {visit.Reasons?.length ? (
                                <ul>
                                    {visit.Reasons.map((reason, index) => (
                                        <li key={index}>{reason.item || reason.reasonID}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="no-data">
                                    {t("visitDetails.reasons.noData")}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="visit-details-card">
                        <h2>
                            <FaCheckCircle /> {t("visitDetails.checklist.title")}
                        </h2>
                        <div className="card-content">
                            {visit.Checklists?.length ? (
                                <ul className="checklist">
                                    {visit.Checklists.map((checklist, index) => (
                                        <li key={index}>
                                            {checklist.VisitChecklist?.checked ? (
                                                <FaCheckCircle className="check-icon checked" />
                                            ) : (
                                                <FaCircle className="check-icon" />
                                            )}
                                            {checklist.item || checklist.checklistID}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="no-data">
                                    {t("visitDetails.checklist.noData")}
                                </p>
                            )}
                        </div>
                    </div>

                    {visit.photos?.length ? (
                        <div className="visit-details-card photos-section">
                            <h2>
                                <FaCamera /> {t("visitDetails.photos.title")} {photosCount}
                            </h2>
                            <div className="card-content photo-gallery">
                                {visit.photos.map((photo, index) => (
                                    <div key={index} className="photo-container">
                                        <img
                                            src={`${BASE_URL}${photo}`}
                                            alt={
                                                t("visitDetails.photos.alt", {
                                                    index: index + 1,
                                                }) || `Photo ${index + 1}`
                                            }
                                            className="photo-preview"
                                            onClick={() => handleImageClick(photo)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {visit.comment && (
                        <div className="visit-details-card">
                            <h2>
                                <FaComment /> {t("visitDetails.comment.title")}
                            </h2>
                            <div className="card-content">
                                <p>{visit.comment}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="visit-details-actions">
                    <button
                        className="visit-details-back-btn"
                        onClick={() => navigate("/timesheet")}
                        aria-label={t("visitDetails.aria.backButton")}
                    >
                        <FaArrowLeft /> {t("visitDetails.actions.back")}
                    </button>
                    {userPermissions.canLogVisits && (
                        <button
                            className="visit-details-log-btn"
                            onClick={handleLogVisit}
                            disabled={visit.status !== VisitStatus.VALIDATED}
                            aria-label={t("visitDetails.aria.logVisitButton")}
                        >
                            {t("visitDetails.actions.logVisit")}
                        </button>
                    )}
                    {userPermissions.canValidateTimesheets && (
                        <div className="visit-details-log-btn2">
                            <button
                                className="validate-visit-btn"
                                onClick={handleValidate}
                                disabled={visit.status !== VisitStatus.PENDING}
                                aria-label={t("visitDetails.aria.validateButton")}
                            >
                                {t("visitDetails.actions.validate")}
                            </button>
                            <button
                                className="reject-visit-btn"
                                onClick={handleReject}
                                disabled={visit.status !== VisitStatus.PENDING}
                                aria-label={t("visitDetails.aria.rejectButton")}
                            >
                                {t("visitDetails.actions.reject")}
                            </button>
                        </div>
                    )}
                </div>

                {selectedImage && (
                    <div
                        className="fullscreen-image-overlay"
                        onClick={handleCloseFullscreen}
                    >
                        <img
                            src={selectedImage}
                            alt={t("visitDetails.fullscreenAlt")}
                            className="fullscreen-image"
                        />
                        <button
                            className="fullscreen-close-btn"
                            onClick={handleCloseFullscreen}
                            aria-label={t("visitDetails.aria.closeFullscreen")}
                        >
                            <FaTimes />
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
};

export default VisitDetailsView;
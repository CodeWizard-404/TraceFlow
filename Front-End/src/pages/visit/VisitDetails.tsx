import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    FaCalendar, FaClock, FaMapMarkerAlt, FaUser,
    FaPhone, FaListUl, FaCheckCircle, FaArrowLeft,
    FaCircle
} from "react-icons/fa";
import "./VisitDetails.css";
import { getAgentById } from "../../apis/agentAPI";
import { getVisitById } from "../../apis/visitAPI";
import { validateTimesheet } from "../../apis/timesheetAPI";
import Visit from "../../models/Visit";
import Agent from "../../models/Agent";
import { useAuth } from "../../context/AuthContext";
import VisitStatus from "../../models/Enum/VisitStatus";

const PERMISSIONS = {
    ACCESS_VISIT_DETAILS: import.meta.env.VITE_PERMISSIONS_ACCESS_VISIT_DETAILS,
    LOG_VISITS: import.meta.env.VITE_PERMISSIONS_LOG_VISITS,
    VALIDATE_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_VALIDATE_TIMESHEETS,
};

// Main Component
const VisitDetails: React.FC = () => {
    // Hooks
    const { idVisit } = useParams<{ idVisit: string }>(); // Visit ID from URL parameters
    const navigate = useNavigate();
    const { token, effectivePermissions, permissionsLoaded } = useAuth();

    // State
    const [visit, setVisit] = useState<Visit | null>(null); // Details of the selected visit
    const [agent, setAgent] = useState<Agent | null>(null); // Agent assigned to the visit
    const [loading, setLoading] = useState<boolean>(true); // Loading state for async operations
    const [error, setError] = useState<string | null>(null); // Error message if data fetch fails

    // Permission Checks (Centralized)
    const userPermissions = useMemo(() => ({
        canAccessVisitDetails: effectivePermissions?.some(p => p.name === PERMISSIONS.ACCESS_VISIT_DETAILS),
        canLogVisits: effectivePermissions?.some(p => p.name === PERMISSIONS.LOG_VISITS),
        canValidateTimesheets: effectivePermissions?.some(p => p.name === PERMISSIONS.VALIDATE_TIMESHEETS),
    }), [effectivePermissions]);

    // Fetch Visit Details
    useEffect(() => {
        const fetchVisitDetails = async () => {
            if (!idVisit) {
                setError("No visit ID provided.");
                setLoading(false);
                return;
            }

            if (!token || !userPermissions.canAccessVisitDetails) {
                navigate("/access-denied");
                setLoading(false);
                return null;               
            }

            try {
                setLoading(true);
                const visitData = await getVisitById(idVisit, token);
                setVisit(visitData);

                if (visitData.agentID) {
                    const agentData = await getAgentById(visitData.agentID, token);
                    setAgent(agentData);
                }
            } catch (err) {
                setError("Failed to load visit details.");
                console.error("Fetch visit details error:", err);
            } finally {
                setLoading(false);
            }
        };

        if (permissionsLoaded) {
            fetchVisitDetails();
        }
    }, [idVisit, token, userPermissions.canAccessVisitDetails, permissionsLoaded, navigate]);

    // Handlers
    const handleLogVisit = () => {
        // Navigate to QR scan page to log the visit if permitted
        if (visit && userPermissions.canLogVisits) {
            navigate("/qr-scan", { state: { visit } });
        }
    };

    const handleValidate = async () => {
        // Validate the visit and update its status
        if (!visit || !visit.timesheetID || !userPermissions.canValidateTimesheets) return;
        try {
            await validateTimesheet(visit.timesheetID, { visitIDs: [visit.visitID], status: "validated" }, token!);
            setVisit(prev => prev ? { ...prev, status: VisitStatus.VALIDATED } : null);
        } catch (err) {
            setError("Failed to validate visit.");
            console.error("Validate visit error:", err);
        }
    };

    const handleReject = async () => {
        // Reject the visit and update its status
        if (!visit || !visit.timesheetID || !userPermissions.canValidateTimesheets) return;
        try {
            await validateTimesheet(visit.timesheetID, { visitIDs: [visit.visitID], status: "rejected" }, token!);
            setVisit(prev => prev ? { ...prev, status: VisitStatus.REJECTED } : null);
        } catch (err) {
            setError("Failed to reject visit.");
            console.error("Reject visit error:", err);
        }
    };

    // Early Returns for Loading and Error States
    if (!permissionsLoaded) return (
        <div className="visit-details-loading">
            Loading permissions...
        </div>
    );

    if (loading) return (
        <div className="visit-details-loading">
            <div className="spinner"></div>
        </div>
    );

    if (error || !visit) {
        return (
            <div className="visit-details-container">
                <div className="visit-details-error-card">
                    <h2>Oops!</h2>
                    <p>{error || "Visit not found."}</p>
                    <button
                        className="visit-details-back-btn"
                        onClick={() => navigate("/timesheet")}
                    >
                        <FaArrowLeft /> Back
                    </button>
                </div>
            </div>
        );
    }

    // Render
    return (
        <div className="visit-details-container">
            {/* Header Section */}
            <div className="visit-details-hero">
                <h1>
                    <FaListUl /> Visit {visit.status}
                    <span className={`status-dot status-${visit.status}`}></span>
                    {visit.duration !== null && (
                        <div className="duration-clock">
                            <svg className="clock-circle" viewBox="0 0 36 36">
                                <circle className="clock-base" cx="18" cy="18" r="16" />
                                <circle
                                    className="clock-progress"
                                    cx="18"
                                    cy="18"
                                    r="16"
                                    strokeDasharray={`${Math.min(visit.duration! / 60 * 100, 100)} 100`}
                                />
                            </svg>
                            <span className="duration-text">{visit.duration}m</span>
                        </div>
                    )}
                </h1>
            </div>

            {/* Details Grid */}
            <div className="visit-details-grid">
                {/* When & Where Card */}
                <div className="visit-details-card">
                    <h2><FaCalendar /> When & Where</h2>
                    <div className="card-content">
                        <p><FaCalendar /> {new Date(visit.date).toLocaleDateString("en-GB")}</p>
                        <p><FaClock /> {visit.time.split(":").slice(0, 2).join(":")}</p>
                        <p><FaMapMarkerAlt /> {visit.location || "N/A"}</p>
                    </div>
                </div>

                {/* Agent Card */}
                <div className="visit-details-card">
                    <h2><FaUser /> Agent</h2>
                    <div className="card-content">
                        {agent ? (
                            <>
                                <p><FaUser /> {agent.name} {agent.lastname}</p>
                                <p><FaPhone /> {agent.phone || "N/A"}</p>
                            </>
                        ) : (
                            <p className="no-data">No agent assigned</p>
                        )}
                    </div>
                </div>

                {/* Reasons Card */}
                <div className="visit-details-card">
                    <h2><FaListUl /> Reasons</h2>
                    <div className="card-content">
                        {visit.Reasons && visit.Reasons.length > 0 ? (
                            <ul>
                                {visit.Reasons.map((reason, index) => (
                                    <li key={index}>{reason.item || reason.reasonID}</li>
                                ))}
                            </ul>
                        ) : (
                            <p className="no-data">No reasons listed</p>
                        )}
                    </div>
                </div>

                {/* Checklist Card */}
                <div className="visit-details-card">
                    <h2><FaCheckCircle /> Checklist</h2>
                    <div className="card-content">
                        {visit.Checklists && visit.Checklists.length > 0 ? (
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
                            <p className="no-data">No checklist items</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="visit-details-actions">
                {userPermissions.canLogVisits && (
                    <button 
                        className="visit-details-log-btn" 
                        onClick={handleLogVisit}
                        disabled={visit.status === VisitStatus.PENDING || visit.status === VisitStatus.VISITED || visit.status === VisitStatus.REJECTED}
                    >
                        Log Visit
                    </button>
                )}
                {userPermissions.canValidateTimesheets && (
                    <div className="visit-details-log-btn2">
                        <button 
                            className="validate-visit-btn" 
                            onClick={handleValidate} 
                            disabled={
                                visit.status === VisitStatus.VALIDATED ||
                                visit.status === VisitStatus.VISITED
                            }
                        >
                            Validate
                        </button>
                        <button 
                            className="reject-visit-btn" 
                            onClick={handleReject} 
                            disabled={
                                visit.status === VisitStatus.REJECTED ||
                                visit.status === VisitStatus.VISITED
                            }
                        >
                            Reject
                        </button>
                    </div>
                )}
                <button
                    className="visit-details-back-btn"
                    onClick={() => navigate("/timesheet")}
                >
                    <FaArrowLeft /> Back
                </button>
            </div>
        </div>
    );
};

export default VisitDetails;
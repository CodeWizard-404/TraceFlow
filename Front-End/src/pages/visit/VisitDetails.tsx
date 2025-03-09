// src/pages/visit/VisitDetails.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    FaCalendar, FaClock, FaMapMarkerAlt, FaUser,
    FaPhone, FaListUl, FaCheckCircle, FaArrowLeft,
    FaCircle
} from "react-icons/fa";
import "./VisitDetails.css";
import { getAgentById } from "../../apis/agentAPI";
import { getVisitById } from "../../apis/visitAPI";
import Visit from "../../models/Visit";
import Agent from "../../models/Agent";

const VisitDetails: React.FC = () => {
    const { idVisit } = useParams<{ idVisit: string }>();
    const navigate = useNavigate();
    const [visit, setVisit] = useState<Visit | null>(null);
    const [agent, setAgent] = useState<Agent | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchVisitDetails = async () => {
            if (!idVisit) {
                setError("No visit ID provided.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const visitData = await getVisitById(idVisit);
                setVisit(visitData);

                if (visitData.agentID) {
                    const agentData = await getAgentById(visitData.agentID);
                    setAgent(agentData);
                }
            } catch (err) {
                setError("Failed to load visit details.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchVisitDetails();
    }, [idVisit]);

    const handleLogVisit = () => {
        if (visit) {
            navigate("/qr-scan", { state: { visit } });
        }
    };

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

    return (
        <div className="visit-details-container">
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

            <div className="visit-details-grid">
                <div className="visit-details-card">
                    <h2><FaCalendar /> When & Where</h2>
                    <div className="card-content">
                        <p><FaCalendar /> {new Date(visit.date).toLocaleDateString("en-GB")}</p>
                        <p><FaClock /> {visit.time.split(":").slice(0, 2).join(":")}</p>
                        <p><FaMapMarkerAlt /> {visit.location || "N/A"}</p>
                    </div>
                </div>

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

            <div className="visit-details-actions">
                <button className="visit-details-log-btn" onClick={handleLogVisit}>
                    Log Visit
                </button>
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
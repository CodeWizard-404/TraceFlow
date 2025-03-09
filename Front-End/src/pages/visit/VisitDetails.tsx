// src/pages/visit/VisitDetails.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

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

    if (loading) return <div className="visit-details-loading">Loading...</div>;
    if (error || !visit) {
        return (
            <div className="visit-details-container">
                <header className="visit-details-header">
                    <h1>Visit Details</h1>
                </header>
                <section className="visit-details-card">
                    <div className="visit-details-error">{error || "Visit not found."}</div>
                    <button
                        className="visit-details-back-btn"
                        onClick={() => navigate("/timesheet")}
                    >
                        Back to Timesheets
                    </button>
                </section>
            </div>
        );
    }

    return (
        <div className="visit-details-container">
            <header className="visit-details-header">
                <h1>Visit Details</h1>
            </header>
            <section className="visit-details-card">
                <div className="visit-details-info">
                    <h2 className="visit-details-title">Visit Information</h2>
                    <p>
                        <strong>Date:</strong>{" "}
                        {new Date(visit.date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                        })}
                    </p>
                    <p>
                        <strong>Time:</strong> {visit.time.split(":").slice(0, 2).join(":")}
                    </p>
                    <p>
                        <strong>Location:</strong> {visit.location || "Not specified"}
                    </p>
                    <p>
                        <strong>Status:</strong>{" "}
                        <span className={`visit-details-status-${visit.status.toLowerCase()}`}>
                            {visit.status}
                        </span>
                    </p>
                </div>

                <div className="visit-details-agent-info">
                    <h2 className="visit-details-section-title">Agent Information</h2>
                    {agent ? (
                        <>
                            <p>
                                <strong>Name:</strong> {agent.name} {agent.lastname}
                            </p>
                            <p>
                                <strong>Phone:</strong> {agent.phone || "Not provided"}
                            </p>
                            <p>
                                <strong>Email:</strong> {agent.email || "Not provided"}
                            </p>
                        </>
                    ) : (
                        <p>No agent information available.</p>
                    )}
                </div>

                <div className="visit-details-reasons-list">
                    <h2 className="visit-details-section-title">Reasons</h2>
                    {visit.Reasons && visit.Reasons.length > 0 ? (
                        <ul>
                            {visit.Reasons.map((reason, index) => (
                                <li key={index}>{reason.item || reason.reasonID}</li>
                            ))}
                        </ul>
                    ) : (
                        <p>No reasons specified.</p>
                    )}
                </div>

                <div className="visit-details-checklist-list">
                    <h2 className="visit-details-section-title">Checklist Items</h2>
                    {visit.Checklists && visit.Checklists.length > 0 ? (
                        <ul>
                            {visit.Checklists.map((checklist, index) => (
                                <li key={index}>{checklist.item || checklist.checklistID}</li>
                            ))}
                        </ul>
                    ) : (
                        <p>No checklist items specified.</p>
                    )}
                </div>

                <div className="visit-details-actions">
                    <button className="visit-details-log-btn" onClick={handleLogVisit}>
                        Log Visit
                    </button>
                    <button
                        className="visit-details-back-btn"
                        onClick={() => navigate("/timesheet")}
                    >
                        Back to Timesheets
                    </button>
                </div>
            </section>
        </div>
    );
};

export default VisitDetails;
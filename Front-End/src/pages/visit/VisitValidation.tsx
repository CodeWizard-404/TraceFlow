import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaUser, FaPhone, FaListUl, FaCheckCircle, FaArrowLeft } from "react-icons/fa";

import "./VisitValidation.css";
import Agent from "../../models/Agent";
import { getAgentById } from "../../apis/agentAPI";
import { getVisitById, logVisitDetails } from "../../apis/visitAPI";
import Visit from "../../models/Visit";

const VisitValidation: React.FC = () => {
    const { idVisit } = useParams<{ idVisit: string }>();
    const navigate = useNavigate();
    const [visit, setVisit] = useState<Visit | null>(null);
    const [agent, setAgent] = useState<Agent | null>(null);
    const [checklist, setChecklist] = useState<Array<{ id: string; item: string; checked: boolean }>>([]);
    const [entryTime, setEntryTime] = useState<number | null>(null); // Track entry time
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchVisitData = async () => {
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

                // Map checklists to state with checked status
                const initialChecklist = visitData.Checklists?.map((cl) => ({
                    id: cl.checklistID,
                    item: cl.item,
                    checked: cl.VisitChecklist?.checked || false,
                })) || [];
                setChecklist(initialChecklist);

                // Record entry time when page loads
                setEntryTime(Date.now());
            } catch (err) {
                setError("Failed to load visit or agent data.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchVisitData();
    }, [idVisit]);

    const handleChecklistChange = (checklistId: string) => {
        setChecklist((prev) =>
            prev.map((item) =>
                item.id === checklistId ? { ...item, checked: !item.checked } : item
            )
        );
    };

    const handleValidate = async () => {
        if (!visit || !idVisit || !entryTime) return;

        setLoading(true);
        setError(null);

        try {
            // Calculate duration in minutes
            const currentTime = Date.now();
            const durationMs = currentTime - entryTime;
            const durationMinutes = Math.floor(durationMs / (1000 * 60)); // Convert ms to minutes

            const checklistUpdates = checklist.map((item) => ({
                checklistID: item.id,
                checked: item.checked,
            }));

            const updatedVisitData = {
                duration: durationMinutes, // Duration in minutes since page entry
                checklistUpdates,
                status: "validated", // Update status to "validated"
            };

            await logVisitDetails(idVisit, updatedVisitData);
            navigate("/timesheet");
        } catch (err) {
            setError("Failed to validate visit.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading">Loading...</div>;
    if (error || !visit) return (
        <div className="visit-validation-container">
            <div className="error">{error || "Visit not found."}</div>
            <button className="back-btn" onClick={() => navigate("/timesheet")}>
                <FaArrowLeft /> Back to Timesheets
            </button>
        </div>
    );

    return (
        <div className="visit-validation-container">
            <header className="form-header">
                <h1>Validate Visit & Checklist</h1>
            </header>
            <section className="form-card">
                {/* Visit Details */}
                <div className="details-section">
                    <h2>Visit Details</h2>
                    <div className="detail-item">
                        <span><FaUser /> Agent:</span>
                        <p>{agent ? `${agent.name} ${agent.lastname}` : "N/A"}</p>
                    </div>
                    <div className="detail-item">
                        <span><FaPhone /> Phone:</span>
                        <p>{agent?.phone || "N/A"}</p>
                    </div>
                    <div className="detail-item">
                        <span>Date:</span>
                        <p>{new Date(visit.date).toLocaleDateString("en-GB")}</p>
                    </div>
                    <div className="detail-item">
                        <span>Time:</span>
                        <p>{visit.time.split(":").slice(0, 2).join(":")}</p>
                    </div>
                    <div className="detail-item">
                        <span>Location:</span>
                        <p>{visit.location || "N/A"}</p>
                    </div>
                </div>

                {/* Reasons */}
                <div className="reasons-section">
                    <h2><FaListUl /> Reasons</h2>
                    {visit.Reasons && visit.Reasons.length > 0 ? (
                        <ul>
                            {visit.Reasons.map((reason, index) => (
                                <li key={index}>{reason.item}</li>
                            ))}
                        </ul>
                    ) : (
                        <p>No reasons specified.</p>
                    )}
                </div>

                {/* Checklist */}
                <div className="checklist-section">
                    <h2><FaCheckCircle /> Checklist</h2>
                    {checklist.length > 0 ? (
                        <ul className="checklist">
                            {checklist.map((item) => (
                                <li key={item.id}>
                                    <input
                                        type="checkbox"
                                        checked={item.checked}
                                        onChange={() => handleChecklistChange(item.id)}
                                    />
                                    <span>{item.item}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>No checklist items available.</p>
                    )}
                </div>

                {/* Actions */}
                <div className="form-actions">
                    <button
                        className="submit-btn"
                        onClick={handleValidate}
                        disabled={loading || checklist.every((item) => !item.checked)}
                    >
                        {loading ? "Validating..." : "Validate Visit"}
                    </button>
                    <button className="back-btn" onClick={() => navigate("/timesheet")}>
                        <FaArrowLeft /> Back
                    </button>
                </div>
            </section>
        </div>
    );
};

export default VisitValidation;
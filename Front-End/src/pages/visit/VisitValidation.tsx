import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaUser, FaPhone, FaListUl, FaCheckCircle, FaArrowLeft, FaCheck } from "react-icons/fa";

import "./VisitValidation.css";
import { getAgentById } from "../../apis/agentAPI";
import { getVisitById, logVisitDetails } from "../../apis/visitAPI";
import Visit from "../../models/Visit";
import Agent from "../../models/Agent";


const VisitValidation: React.FC = () => {
    const { idVisit } = useParams<{ idVisit: string }>();
    const navigate = useNavigate();
    const [visit, setVisit] = useState<Visit | null>(null);
    const [agent, setAgent] = useState<Agent | null>(null);
    const [checklist, setChecklist] = useState<Array<{ id: string; item: string; checked: boolean }>>([]);
    const [entryTime, setEntryTime] = useState<number | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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

                const initialChecklist = visitData.Checklists?.map((cl) => ({
                    id: cl.checklistID,
                    item: cl.item,
                    checked: cl.VisitChecklist?.checked || false,
                })) || [];
                setChecklist(initialChecklist);

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

        setIsSubmitting(true);
        setError(null);

        try {
            const currentTime = Date.now();
            const durationMs = currentTime - entryTime;
            const durationMinutes = Math.floor(durationMs / (1000 * 60));

            const checklistUpdates = checklist.map((item) => ({
                checklistID: item.id,
                checked: item.checked,
            }));

            const updatedVisitData = {
                duration: durationMinutes,
                checklistUpdates,
                status: "validated",
            };

            await logVisitDetails(idVisit, updatedVisitData);
            await new Promise((resolve) => setTimeout(resolve, 500)); // Brief delay for animation
            navigate("/timesheet");
        } catch (err) {
            setError("Failed to validate visit.");
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const completedItems = checklist.filter((item) => item.checked).length;
    const totalItems = checklist.length;

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
            <header className="visit-header-0">
                <h1>
                    Validate Visit
                    <span className={`status-dot status-${visit.status}`}></span>
                </h1>
                <p>Complete the checklist and validate the visit.</p>
            </header>
            <section className="visit-card">
                {/* Visit Details */}
                <div className="details-section">
                    <h2>Visit Details</h2>
                    <div className="detail-item">
                        <span><FaUser /> Agent</span>
                        <p>{agent ? `${agent.name} ${agent.lastname}` : "N/A"}</p>
                    </div>
                    <div className="detail-item">
                        <span><FaPhone /> Phone</span>
                        <p>{agent?.phone || "N/A"}</p>
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
                        <p className="no-data">No reasons specified.</p>
                    )}
                </div>

                {/* Checklist */}
                <div className="checklist-section">
                    <h2><FaCheckCircle /> Checklist ({completedItems}/{totalItems})</h2>
                    {checklist.length > 0 ? (
                        <>
                            <ul className="checklist">
                                {checklist.map((item) => (
                                    <li key={item.id} className={item.checked ? "checked" : ""}>
                                        <label className="custom-checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={item.checked}
                                                onChange={() => handleChecklistChange(item.id)}
                                                className="custom-checkbox-input"
                                            />
                                            <span className="custom-checkbox">
                                                <FaCheck className="check-icon" />
                                            </span>
                                            <span className="checklist-text">{item.item}</span>
                                        </label>
                                    </li>
                                ))}
                            </ul>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${(completedItems / totalItems) * 100}%` }}
                                ></div>
                            </div>
                        </>
                    ) : (
                        <p className="no-data">No checklist items available.</p>
                    )}
                </div>

                {/* Actions */}
                <div className="visit-actions">
                    <button
                        className={`validate-btn ${isSubmitting ? "submitting" : ""}`}
                        onClick={handleValidate}
                        disabled={isSubmitting || checklist.every((item) => !item.checked)}
                    >
                        <FaCheck /> {isSubmitting ? "Validating..." : "Validate Visit"}
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
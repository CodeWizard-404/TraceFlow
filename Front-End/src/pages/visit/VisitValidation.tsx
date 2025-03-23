import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaUser, FaPhone, FaListUl, FaCheckCircle, FaArrowLeft, FaCheck } from "react-icons/fa";
import "./VisitValidation.css";
import { getAgentById } from "../../apis/agentAPI";
import { getVisitById, logVisitDetails } from "../../apis/visitAPI";
import Visit from "../../models/Visit";
import Agent from "../../models/Agent";
import { useAuth } from "../../context/AuthContext";

const VisitValidation: React.FC = () => {
    const { idVisit } = useParams<{ idVisit: string }>();
    const { token, effectivePermissions, permissionsLoaded } = useAuth();
    const navigate = useNavigate();
    const [visit, setVisit] = useState<Visit | null>(null);
    const [agent, setAgent] = useState<Agent | null>(null);
    const [checklist, setChecklist] = useState<Array<{ id: string; item: string; checked: boolean }>>([]);
    const [entryTime, setEntryTime] = useState<number | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const canLogVisits = useMemo(
        () => effectivePermissions?.some((p) => p.name === "log_visits"),
        [effectivePermissions]
    );

    useEffect(() => {
        const fetchVisitData = async () => {
            if (!idVisit || !token) {
                setError("Missing visit ID or authentication token.");
                setLoading(false);
                return;
            }

            if (!permissionsLoaded) return;

            if (!canLogVisits) {
                setError("Access Denied: You lack permission to log visits.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const visitData = await getVisitById(idVisit, token);
                setVisit(visitData);

                if (visitData.agentID) {
                    const agentData = await getAgentById(visitData.agentID, token);
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
    }, [idVisit, token, canLogVisits, permissionsLoaded]);

    const handleChecklistChange = (checklistId: string) => {
        setChecklist((prev) =>
            prev.map((item) => (item.id === checklistId ? { ...item, checked: !item.checked } : item))
        );
    };

    const handleValidate = async () => {
        if (!visit || !idVisit || !entryTime || !canLogVisits) {
            setError("Access Denied: Insufficient permissions to validate.");
            return;
        }

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
                checklistUpdates
            };

            await logVisitDetails(idVisit, updatedVisitData, token!);
            await new Promise((resolve) => setTimeout(resolve, 500));
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

    if (!permissionsLoaded) return <div className="visit-validation-container">Loading permissions...</div>;

    if (loading) return <div className="loading">Loading...</div>;
    if (error || !visit || !canLogVisits) return (
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

                <div className="checklist-section">
                    <h2><FaCheckCircle /> Checklist ({completedItems}/{totalItems})</h2>
                    {checklist.length > 0 ? (
                        <>
                            <ul className="checklist">
                                {checklist.map((item) => {
                                    const isTransferItem = item.item.toLowerCase() === "transfer a receipt book";
                                    const isStubCollectionItem = item.item.toLowerCase() === "collect receipt stub";

                                    if (isTransferItem) {
                                        return (
                                            <li key={item.id} className={item.checked ? "checked" : ""}>
                                                <label className="custom-checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.checked}
                                                        onChange={() => {
                                                            handleChecklistChange(item.id);
                                                            if (!item.checked) {
                                                                navigate("/transfer-receipt-books", {
                                                                    state: { 
                                                                        agentID: visit?.agentID, 
                                                                        forceAgent: true,
                                                                        transferType: "Agent"
                                                                    }
                                                                });
                                                            }
                                                        }}
                                                        className="custom-checkbox-input"
                                                    />
                                                    <span className="custom-checkbox">
                                                        <FaCheck className="check-icon" />
                                                    </span>
                                                    <span className="checklist-text">{item.item}</span>
                                                </label>
                                            </li>
                                        );
                                    } else if (isStubCollectionItem) {
                                        return (
                                            <li key={item.id} className={item.checked ? "checked" : ""}>
                                                <label className="custom-checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.checked}
                                                        onChange={() => {
                                                            handleChecklistChange(item.id);
                                                            if (!item.checked) {
                                                                navigate("/transfer-receipt-books", {
                                                                    state: { 
                                                                        agentID: visit?.agentID, 
                                                                        forceAgent: true,
                                                                        transferType: "Stub Collection"
                                                                    }
                                                                });
                                                            }
                                                        }}
                                                        className="custom-checkbox-input"
                                                    />
                                                    <span className="custom-checkbox">
                                                        <FaCheck className="check-icon" />
                                                    </span>
                                                    <span className="checklist-text">{item.item}</span>
                                                </label>
                                            </li>
                                        );
                                    } else {
                                        return (
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
                                        );
                                    }
                                })}
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
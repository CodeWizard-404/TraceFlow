import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaUser, FaPhone, FaListUl, FaCheckCircle, FaArrowLeft, FaCheck } from "react-icons/fa";
import "./VisitValidation.css";
import { getAgentById } from "../../apis/agentAPI";
import { getVisitById, logVisitDetails } from "../../apis/visitAPI";
import Visit from "../../models/Visit";
import Agent from "../../models/Agent";
import { useAuth } from "../../context/AuthContext";

const PERMISSIONS = {
    LOG_VISITS: import.meta.env.VITE_PERMISSIONS_LOG_VISITS,
};


// Main Component
const VisitValidation: React.FC = () => {
    // Hooks
    const { idVisit } = useParams<{ idVisit: string }>(); // Visit ID from URL parameters
    const navigate = useNavigate();
    const { token, effectivePermissions, permissionsLoaded } = useAuth();

    // State
    const [visit, setVisit] = useState<Visit | null>(null); // Details of the selected visit
    const [agent, setAgent] = useState<Agent | null>(null); // Agent assigned to the visit
    const [checklist, setChecklist] = useState<Array<{ id: string; item: string; checked: boolean }>>([]); // Checklist items with checked status
    const [entryTime, setEntryTime] = useState<number | null>(null); // Timestamp when the page was loaded
    const [loading, setLoading] = useState<boolean>(true); // Loading state for async operations
    const [error, setError] = useState<string | null>(null); // Error message if data fetch fails
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false); // Submission state for validation

    // Permission Checks 
    const userPermissions = useMemo(() => ({
        canLogVisits: effectivePermissions?.some(p => p.name === PERMISSIONS.LOG_VISITS),
    }), [effectivePermissions]);
    
    // Fetch Visit Data
    useEffect(() => {
        const fetchVisitData = async () => {
            if (!idVisit || !token) {
                setError("Missing visit ID or authentication token.");
                setLoading(false);
                return;
            }

            if (!permissionsLoaded) return;

            try {
                setLoading(true);
                const visitData = await getVisitById(idVisit, token);
                setVisit(visitData);

                if (visitData.agentID) {
                    const agentData = await getAgentById(visitData.agentID, token);
                    setAgent(agentData);
                }

                // Initialize checklist from visit data
                const initialChecklist = visitData.Checklists?.map((cl) => ({
                    id: cl.checklistID,
                    item: cl.item,
                    checked: cl.VisitChecklist?.checked || false,
                })) || [];
                setChecklist(initialChecklist);

                setEntryTime(Date.now());
            } catch (err) {
                setError("Failed to load visit or agent data.");
                console.error("Fetch visit data error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchVisitData();
    }, [idVisit, token, userPermissions.canLogVisits, permissionsLoaded]);

    // Handlers
    const handleChecklistChange = (checklistId: string) => {
        // Toggle the checked status of a checklist item
        setChecklist((prev) =>
            prev.map((item) => (item.id === checklistId ? { ...item, checked: !item.checked } : item))
        );
    };

    const handleValidate = async () => {
        // Validate the visit by logging details and updating duration/checklist
        if (!visit || !idVisit || !entryTime || !userPermissions.canLogVisits) {
            navigate("/access-denied");
            return null;
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
            await new Promise((resolve) => setTimeout(resolve, 500)); // Brief delay for UX
            navigate("/timesheet");
        } catch (err) {
            setError("Failed to validate visit.");
            console.error("Validate visit error:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Memoized Checklist Stats
    const completedItems = useMemo(() => checklist.filter((item) => item.checked).length, [checklist]);
    const totalItems = checklist.length;

    // Early Returns for Loading and Error States
    if (!permissionsLoaded) return <div className="visit-validation-container">Loading permissions...</div>;

    if (loading) return <div className="loading">Loading...</div>;

    if (error || !visit || !userPermissions.canLogVisits) return (
        <div className="visit-validation-container">
            <div className="error">{error || "Visit not found."}</div>
            <button className="back-btn" onClick={() => navigate("/timesheet")}>
                <FaArrowLeft /> Back to Timesheets
            </button>
        </div>
    );

    // Render
    return (
        <div className="visit-validation-container">
            {/* Header Section */}
            <header className="visit-header-0">
                <h1>
                    Validate Visit
                    <span className={`status-dot status-${visit.status}`}></span>
                </h1>
                <p>Complete the checklist and validate the visit.</p>
            </header>

            <section className="visit-card">
                {/* Visit Details Section */}
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

                {/* Reasons Section */}
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

                {/* Checklist Section */}
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

                {/* Action Buttons */}
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
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaCalendar, FaClock, FaMapMarkerAlt, FaUser, FaPhone, FaListUl, FaCheckCircle } from "react-icons/fa";
import "./TimesheetValidationDetail.css";
import Visit from "../../models/Visit";
import Agent from "../../models/Agent";
import { getAgentById } from "../../apis/agentAPI";
import { validateTimesheet } from "../../apis/timesheetAPI";
import { getVisitById } from "../../apis/visitAPI";

const VisitValidationDetail: React.FC = () => {
    const { visitId } = useParams<{ visitId: string }>();
    const navigate = useNavigate();
    const [visit, setVisit] = useState<Visit | null>(null);
    const [agent, setAgent] = useState<Agent | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchVisitDetails = async () => {
            if (!visitId) {
                setError("No visit ID provided.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const visitData = await getVisitById(visitId);
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
    }, [visitId]);

    const handleValidate = async () => {
        if (!visit || !visit.timesheetID) return;
        try {
            await validateTimesheet(visit.timesheetID, { visitIDs: [visit.visitID], status: "validated" });
            navigate("/timesheet-validation");
        } catch (err) {
            setError("Failed to validate visit.");
            console.error(err);
        }
    };

    const handleReject = async () => {
        if (!visit || !visit.timesheetID) return;
        try {
            await validateTimesheet(visit.timesheetID, { visitIDs: [visit.visitID], status: "rejected" });
            navigate("/timesheet-validation");
        } catch (err) {
            setError("Failed to reject visit.");
            console.error(err);
        }
    };

    if (loading) return <div className="loading">Loading...</div>;
    if (error || !visit) return <div className="error">{error || "Visit not found."}</div>;

    return (
        <div className="visit-validation-detail-container">
            <header className="visit-header">
                <h1>Visit Details</h1>
                <p>Review and validate or reject this visit.</p>
            </header>
            <section className="visit-card">
                <div className="detail-section">
                    <h2><FaCalendar /> When & Where</h2>
                    <p><FaCalendar /> {new Date(visit.date).toLocaleDateString("en-GB")}</p>
                    <p><FaClock /> {visit.time.split(":").slice(0, 2).join(":")}</p>
                    <p><FaMapMarkerAlt /> {visit.location || "N/A"}</p>
                </div>
                <div className="detail-section">
                    <h2><FaUser /> Agent</h2>
                    {agent ? (
                        <>
                            <p><FaUser /> {agent.name} {agent.lastname}</p>
                            <p><FaPhone /> {agent.phone || "N/A"}</p>
                        </>
                    ) : (
                        <p>No agent assigned</p>
                    )}
                </div>
                <div className="detail-section">
                    <h2><FaListUl /> Reasons</h2>
                    {visit.Reasons && visit.Reasons.length > 0 ? (
                        <ul>
                            {visit.Reasons.map((reason, index) => (
                                <li key={index}>{reason.item}</li>
                            ))}
                        </ul>
                    ) : (
                        <p>No reasons listed</p>
                    )}
                </div>
                <div className="detail-section">
                    <h2><FaCheckCircle /> Checklist</h2>
                    {visit.Checklists && visit.Checklists.length > 0 ? (
                        <ul>
                            {visit.Checklists.map((checklist, index) => (
                                <li key={index}>
                                    {checklist.VisitChecklist?.checked ? "✔" : "✘"} {checklist.item}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>No checklist items</p>
                    )}
                </div>
                <div className="actions">
                    <button className="validate-btn" onClick={handleValidate} disabled={visit.status === "validated"}>
                        Validate
                    </button>
                    <button className="reject-btn" onClick={handleReject} disabled={visit.status === "rejected"}>
                        Reject
                    </button>
                    <button className="back-btn" onClick={() => navigate("/timesheet-validation")}>
                        Back
                    </button>
                </div>
            </section>
        </div>
    );
};

export default VisitValidationDetail;
import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FaEdit, FaTrash } from "react-icons/fa";
import { useError } from "../../../context/ErrorContext";
import { getAgentById, deleteAgent } from "../../../apis/agentAPI";
import Agent from "../../../models/Agent";
import { Button } from "../../../components/ui/button";
import "../AdminDashboard.css";

interface AgentViewProps {
    selectedAgent: Agent | null;
    setSelectedAgent: React.Dispatch<React.SetStateAction<Agent | null>>;
    agents: Agent[];
    setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
    view: string;
    setView: (view: string) => void;
}

const AgentViewSkeleton: React.FC = () => (
    <div className="details-card skeleton">
        <div className="card-header">
            <div className="custom-skeleton" style={{ width: "200px", height: "24px" }} />
            <div className="user-actions">
                <div className="custom-skeleton" style={{ width: "80px", height: "32px" }} />
                <div className="custom-skeleton" style={{ width: "80px", height: "32px" }} />
            </div>
        </div>
        <hr />
        <div className="form-section">
            <div className="custom-skeleton" style={{ width: "150px", height: "20px", marginBottom: "10px" }} />
            <div className="info-grid">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="custom-skeleton" style={{ width: "100%", height: "16px" }} />
                ))}
            </div>
        </div>
    </div>
);

const AgentView: React.FC<AgentViewProps> = ({
    selectedAgent,
    setSelectedAgent,
    agents,
    setAgents,
    view,
    setView,
}) => {
    const { t } = useTranslation();
    const { setError: setGlobalError } = useError();
    const [loading, setLoading] = useState(true);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const formatPhoneDisplay = useCallback((rawValue: string): string => {
        const digits = rawValue.replace(/[^\d]/g, "");
        let formatted = "";
        if (digits.length > 0) formatted += digits.slice(0, 2);
        if (digits.length > 2) formatted += " " + digits.slice(2, 5);
        if (digits.length > 5) formatted += " " + digits.slice(5, 8);
        return formatted;
    }, []);

    const formatDate = (date: string | Date): string => {
        const options: Intl.DateTimeFormatOptions = {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        };
        return new Date(date).toLocaleString(undefined, options);
    };

    useEffect(() => {
        const loadAgentData = async () => {
            if (!selectedAgent?.agentID) {
                setLoading(false);
                return;
            }
            try {
                setLoading(true);
                const agentData = await getAgentById(selectedAgent.agentID);
                if (JSON.stringify(agentData) !== JSON.stringify(selectedAgent)) {
                    setSelectedAgent(agentData);
                }
            } catch (error) {
                setGlobalError(
                    error instanceof Error ? error.message : "Failed to load agent data."
                );
            } finally {
                setLoading(false);
            }
        };
        loadAgentData();
    }, [selectedAgent?.agentID, setSelectedAgent, setGlobalError]);

    const handleEditAgent = useCallback(() => {
        setView("edit-agent");
    }, [setView]);

    const handleDeleteAgent = useCallback(async () => {
        if (!selectedAgent) return;
        try {
            await deleteAgent(selectedAgent.agentID);
            setAgents(agents.filter((a) => a.agentID !== selectedAgent.agentID));
            setSelectedAgent(null);
            setView("agents");
            setGlobalError(t("adminDashboard.agents.deleteSuccess"));
        } catch (error) {
            setGlobalError(
                error instanceof Error ? error.message : "Failed to delete agent."
            );
        }
    }, [selectedAgent, agents, setAgents, setSelectedAgent, setView, setGlobalError, t]);

    if (view !== "agent-details" || !selectedAgent) {
        return null;
    }

    if (loading) {
        return <AgentViewSkeleton />;
    }

    return (
        <div className="details-card">
            <div className="card-header">
                <h2>{t("adminDashboard.agents.viewAgent")}</h2>
                <div className="user-actions">
                    <Button className="edit-button" onClick={handleEditAgent}>
                        <FaEdit /> {t("adminDashboard.actions.edit")}
                    </Button>
                    <Button
                        className="delete-button"
                        onClick={() => setShowDeleteConfirm(true)}
                    >
                        <FaTrash /> {t("adminDashboard.actions.delete")}
                    </Button>
                </div>
            </div>
            <hr />
            <div className="u-profile-panel">
                <div className="u-profile-body">
                    <div className="u-profile-header">
                        <div className="u-profile-image-placeholder">
                            {selectedAgent.name[0]}
                            {selectedAgent.lastname[0]}
                        </div>
                        <div className="u-profile-identity">
                            <span className="u-profile-name">
                                {selectedAgent.name} {selectedAgent.lastname}
                            </span>
                            <span className="u-profile-id">ID: {selectedAgent.agentID}</span>
                        </div>
                    </div>
                    <div className="u-profile-info">
                        <div className="u-info-row">
                            <span className="u-info-label">{t("adminDashboard.agents.email")}</span>
                            <span className="u-info-value">{selectedAgent.email}</span>
                        </div>
                        <div className="u-info-row">
                            <span className="u-info-label">{t("adminDashboard.agents.phone")}</span>
                            <span className="u-info-value">
                                {`+216 ${formatPhoneDisplay(selectedAgent.phone || "N/A")}`}
                            </span>
                        </div>
                        <div className="u-info-row">
                            <span className="u-info-label">{t("adminDashboard.agents.supervisor")}</span>
                            <span className="u-info-value">
                                {selectedAgent.Supervisor
                                    ? `${selectedAgent.Supervisor.firstname} ${selectedAgent.Supervisor.lastname}`
                                    : "-"}
                            </span>
                        </div>
                        <div className="u-info-row">
                            <span className="u-info-label">{t("adminDashboard.agents.location")}</span>
                            <span className="u-info-value">
                                {selectedAgent.Delegation
                                    ? `${selectedAgent.Delegation.name}, ${selectedAgent.Delegation.Governorate?.name}`
                                    : "-"}
                            </span>
                        </div>
                        <div className="u-info-row">
                            <span className="u-info-label">{t("adminDashboard.agents.date")}</span>
                            <span className="u-info-value">
                                {selectedAgent.updatedAt ? formatDate(selectedAgent.updatedAt) : "-"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            {showDeleteConfirm && (
                <div className="reset-confirm-popup">
                    <p>
                        {t("adminDashboard.agents.deleteConfirm", {
                            name: `${selectedAgent.name} ${selectedAgent.lastname}`,
                        })}
                    </p>
                    <div className="reset-confirm-actions">
                        <Button className="action-button" onClick={handleDeleteAgent}>
                            {t("adminDashboard.actions.confirm")}
                        </Button>
                        <Button
                            className="cancel-button"
                            onClick={() => setShowDeleteConfirm(false)}
                        >
                            {t("adminDashboard.actions.cancel")}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(AgentView);
import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FaEdit, FaTrash } from "react-icons/fa";
import { useError } from "../../../context/ErrorContext";
import { getAgentById, deleteAgent } from "../../../apis/agentAPI";
import Agent from "../../../models/Agent";
import { ViewMode } from "../adminTypes";
import { Button } from "../../../components/ui/button";

interface AgentViewProps {
    selectedAgent: Agent | null;
    setSelectedAgent: React.Dispatch<React.SetStateAction<Agent | null>>;
    agents: Agent[];
    setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
    view: ViewMode;
    setView: (view: ViewMode) => void;
}

const AgentViewSkeleton: React.FC = () => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-1/3" />
            <div className="flex gap-2">
                <div className="h-10 bg-gray-200 dark:bg-gray-600 rounded w-20" />
                <div className="h-10 bg-gray-200 dark:bg-gray-600 rounded w-20" />
            </div>
        </div>
        <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full" />
            ))}
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {t("adminDashboard.agents.viewAgent")}
                </h2>
                <div className="flex gap-2">
                    <Button
                        onClick={handleEditAgent}
                        className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600"
                    >
                        <FaEdit className="mr-2" /> {t("adminDashboard.actions.edit")}
                    </Button>
                    <Button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-500 dark:hover:bg-red-600"
                    >
                        <FaTrash className="mr-2" /> {t("adminDashboard.actions.delete")}
                    </Button>
                </div>
            </div>
            <div className="space-y-4">
                <div className="flex justify-between border-b border-gray-200 dark:border-gray-600 pb-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                        {t("adminDashboard.agents.name")}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                        {selectedAgent.name} {selectedAgent.lastname}
                    </span>
                </div>
                <div className="flex justify-between border-b border-gray-200 dark:border-gray-600 pb-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                        {t("adminDashboard.agents.email")}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">{selectedAgent.email}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 dark:border-gray-600 pb-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                        {t("adminDashboard.agents.phone")}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">+216 {selectedAgent.phone}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 dark:border-gray-600 pb-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                        {t("adminDashboard.agents.supervisor")}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                        {selectedAgent.Supervisor
                            ? `${selectedAgent.Supervisor.firstname} ${selectedAgent.Supervisor.lastname}`
                            : "-"}
                    </span>
                </div>
                <div className="flex justify-between border-b border-gray-200 dark:border-gray-600 pb-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                        {t("adminDashboard.agents.location")}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                        {selectedAgent.Delegation
                            ? `${selectedAgent.Delegation.name}, ${selectedAgent.Delegation.Governorate?.name}`
                            : "-"}
                    </span>
                </div>
                <div className="flex justify-between border-b border-gray-200 dark:border-gray-600 pb-2">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                        {t("adminDashboard.agents.date")}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                        {selectedAgent.updatedAt ? formatDate(selectedAgent.updatedAt) : "-"}
                    </span>
                </div>
            </div>
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
                        <p className="text-gray-900 dark:text-gray-100 mb-4">
                            {t("adminDashboard.agents.deleteConfirm", {
                                name: `${selectedAgent.name} ${selectedAgent.lastname}`,
                            })}
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button
                                onClick={handleDeleteAgent}
                                className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-500 dark:hover:bg-red-600"
                            >
                                {t("adminDashboard.actions.confirm")}
                            </Button>
                            <Button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="border-gray-300 dark:border-gray-600 dark:text-gray-100"
                                variant="outline"
                            >
                                {t("adminDashboard.actions.cancel")}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(AgentView);
import React, { useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FaEdit, FaTrash, FaSort } from "react-icons/fa";
import Agent from "../../../models/Agent";
import { SortField, SortOrder } from "../adminTypes";
import "../AdminDashboard.css";
import { deleteAgent } from "../../../apis/agentAPI";

// Utility function to format dates
const formatDate = (date: string | Date): string => {
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    };
    return new Date(date).toLocaleString(undefined, options);
};

interface AgentsListProps {
    agents: Agent[];
    setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
    view: string;
    setSelectedAgent: (agent: Agent | null) => void;
    setError: (error: string | null) => void;
    searchQuery: string;
    sortField: SortField;
    setSortField: React.Dispatch<React.SetStateAction<SortField>>;
    sortOrder: SortOrder;
    setSortOrder: React.Dispatch<React.SetStateAction<SortOrder>>;
    currentPage: number;
    setCurrentPage: (page: number) => void;
    itemsPerPage: number;
    governorateFilter: string;
    delegationFilter: string;
}

const AgentsList: React.FC<AgentsListProps> = ({
    agents,
    setAgents,
    view,
    setSelectedAgent,
    setError,
    searchQuery,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    governorateFilter,
    delegationFilter,
}) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [confirmation, setConfirmation] = useState<{
        isOpen: boolean;
        message: string;
        onConfirm: () => void;
        onCancel: () => void;
    } | null>(null);

    const filteredAgents = useMemo(() => {
        let result = [...agents];
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                (agent) =>
                    (agent.name?.toLowerCase().includes(query) || false) ||
                    (agent.lastname?.toLowerCase().includes(query) || false) ||
                    (agent.email?.toLowerCase().includes(query) || false) ||
                    (agent.phone?.includes(query) || false) ||
                    (agent.Supervisor?.firstname?.toLowerCase().includes(query) || false) ||
                    (agent.Supervisor?.lastname?.toLowerCase().includes(query) || false) ||
                    (agent.Delegation?.name?.toLowerCase().includes(query) || false) ||
                    (agent.Delegation?.Governorate?.name?.toLowerCase().includes(query) || false)
            );
        }
        if (governorateFilter && governorateFilter !== "all") {
            result = result.filter(
                (agent) => agent.Delegation?.Governorate?.name === governorateFilter
            );
        }
        if (delegationFilter && delegationFilter !== "all") {
            result = result.filter(
                (agent) => agent.Delegation?.name === delegationFilter
            );
        }
        return result;
    }, [agents, searchQuery, governorateFilter, delegationFilter]);

    const sortedAgents = useMemo(() => {
        return [...filteredAgents].sort((a, b) => {
            let aValue: string | Date = "";
            let bValue: string | Date = "";
            switch (sortField) {
                case "supervisor":
                    aValue = `${a.Supervisor?.firstname || ""} ${a.Supervisor?.lastname || ""}`;
                    bValue = `${b.Supervisor?.firstname || ""} ${b.Supervisor?.lastname || ""}`;
                    break;
                case "location":
                    aValue = `${a.Delegation?.name || ""}, ${a.Delegation?.Governorate?.name || ""}`;
                    bValue = `${b.Delegation?.name || ""}, ${b.Delegation?.Governorate?.name || ""}`;
                    break;
                case "date":
                    aValue = a.updatedAt ? new Date(a.updatedAt) : new Date(0);
                    bValue = b.updatedAt ? new Date(b.updatedAt) : new Date(0);
                    return sortOrder === "asc"
                        ? aValue.getTime() - bValue.getTime()
                        : bValue.getTime() - aValue.getTime();
                default:
                    aValue = (a[sortField as keyof Agent] as string) || "";
                    bValue = (b[sortField as keyof Agent] as string) || "";
            }
            return sortOrder === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        });
    }, [filteredAgents, sortField, sortOrder]);

    const paginatedAgents = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedAgents.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedAgents, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(sortedAgents.length / itemsPerPage);

    const handleDeleteAgent = useCallback(
        async (agentID: string) => {
            try {
                setLoading(true);
                await deleteAgent(agentID);
                setAgents((prev) => prev.filter((agent) => agent.agentID !== agentID));
                setError(t("adminDashboard.agents.deleteSuccess"));
            } catch (err) {
                setError(t("adminDashboard.error.deleteFailed"));
            } finally {
                setLoading(false);
                setConfirmation(null);
            }
        },
        [setAgents, setError, t]
    );

    const showDeleteConfirmation = useCallback(
        (agent: Agent) => {
            setConfirmation({
                isOpen: true,
                message: t("adminDashboard.agents.deleteConfirm", {
                    name: `${agent.name} ${agent.lastname}`,
                }),
                onConfirm: () => handleDeleteAgent(agent.agentID),
                onCancel: () => setConfirmation(null),
            });
        },
        [handleDeleteAgent, t]
    );

    const ConfirmationModal: React.FC<{
        message: string;
        onConfirm: () => void;
        onCancel: () => void;
    }> = ({ message, onConfirm, onCancel }) => {
        return (
            <motion.div
                className="confirmation-modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <div className="confirmation-modal">
                    <p>{message}</p>
                    <div className="confirmation-actions">
                        <button className="confirm-button" onClick={onConfirm}>
                            {t("adminDashboard.actions.confirm")}
                        </button>
                        <button className="cancel-button" onClick={onCancel}>
                            {t("adminDashboard.actions.cancel")}
                        </button>
                    </div>
                </div>
            </motion.div>
        );
    };

    if (view !== "agents") return null;

    return (
        <div className="agents-list">
            {confirmation && (
                <ConfirmationModal
                    message={confirmation.message}
                    onConfirm={confirmation.onConfirm}
                    onCancel={confirmation.onCancel}
                />
            )}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="table-card"
            >
                <h2>{t("adminDashboard.agents.title")}</h2>
                {loading ? (
                    <div className="loading-spinner">{t("adminDashboard.loading")}</div>
                ) : (
                    <>
                        <div className="table-container">
                            <div className="table-head">
                                <div className="table-row agent-row">
                                    <div className="table-cell sortable">
                                        {t("adminDashboard.agents.name")}
                                        <FaSort
                                            className="sort-icon"
                                            onClick={() => {
                                                setSortField("lastname");
                                                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                                            }}
                                        />
                                    </div>
                                    <div className="table-cell sortable">
                                        {t("adminDashboard.agents.email")}
                                        <FaSort
                                            className="sort-icon"
                                            onClick={() => {
                                                setSortField("email");
                                                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                                            }}
                                        />
                                    </div>
                                    <div className="table-cell sortable">
                                        {t("adminDashboard.agents.phone")}
                                        <FaSort
                                            className="sort-icon"
                                            onClick={() => {
                                                setSortField("phone");
                                                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                                            }}
                                        />
                                    </div>
                                    <div className="table-cell sortable">
                                        {t("adminDashboard.agents.supervisor")}
                                        <FaSort
                                            className="sort-icon"
                                            onClick={() => {
                                                setSortField("supervisor");
                                                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                                            }}
                                        />
                                    </div>
                                    <div className="table-cell sortable">
                                        {t("adminDashboard.agents.location")}
                                        <FaSort
                                            className="sort-icon"
                                            onClick={() => {
                                                setSortField("location");
                                                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                                            }}
                                        />
                                    </div>
                                    <div className="table-cell sortable">
                                        {t("adminDashboard.agents.date")}
                                        <FaSort
                                            className="sort-icon"
                                            onClick={() => {
                                                setSortField("date");
                                                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                                            }}
                                        />
                                    </div>
                                    <div className="table-cell">{t("adminDashboard.agents.actions")}</div>
                                </div>
                            </div>
                            <div className="table-body">
                                {paginatedAgents.length > 0 ? (
                                    paginatedAgents.map((agent) => (
                                        <div key={agent.agentID} className="table-row agent-row hover-effect">
                                            <div className="table-cell">{agent.lastname || "-"} {agent.name || "-"}</div>
                                            <div className="table-cell">{agent.email || "-"}</div>
                                            <div className="table-cell">{agent.phone || "-"}</div>
                                            <div className="table-cell">
                                                {agent.Supervisor
                                                    ? `${agent.Supervisor.firstname} ${agent.Supervisor.lastname}`
                                                    : "-"}
                                            </div>
                                            <div className="table-cell">
                                                {agent.Delegation
                                                    ? `${agent.Delegation.name}, ${agent.Delegation.Governorate.name}`
                                                    : "-"}
                                            </div>
                                            <div>
                                                {agent.updatedAt && (
                                                    <div className="table-cell">{formatDate(agent.updatedAt)}</div>
                                                )}
                                            </div>
                                            <div className="table-cell actions">
                                                <motion.button
                                                    className="edit-button"
                                                    onClick={() => setSelectedAgent(agent)}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    title={t("adminDashboard.actions.edit")}
                                                    aria-label={t("adminDashboard.actions.edit")}
                                                >
                                                    <FaEdit aria-hidden="true" />
                                                </motion.button>
                                                <motion.button
                                                    className="delete-button"
                                                    onClick={() => showDeleteConfirmation(agent)}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    title={t("adminDashboard.actions.delete")}
                                                    aria-label={t("adminDashboard.actions.delete")}
                                                >
                                                    <FaTrash aria-hidden="true" />
                                                </motion.button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="table-row">
                                        <div className="table-cell">{t("adminDashboard.agents.noAgents")}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                        {totalPages > 1 && (
                            <div className="pagination">
                                <button
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                    aria-label={t("adminDashboard.actions.firstPage")}
                                >
                                    {t("adminDashboard.actions.first")}
                                </button>
                                <button
                                    onClick={() => setCurrentPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    aria-label={t("adminDashboard.actions.previousPage")}
                                >
                                    {t("adminDashboard.actions.previous")}
                                </button>
                                <span>
                                    {t("agents.pagination.pageInfo", { currentPage, totalPages })}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    aria-label={t("adminDashboard.actions.nextPage")}
                                >
                                    {t("adminDashboard.actions.next")}
                                </button>
                                <button
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    aria-label={t("adminDashboard.actions.lastPage")}
                                >
                                    {t("adminDashboard.actions.last")}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </motion.div>
        </div>
    );
};

export default AgentsList;
import React, { useMemo, useEffect, useCallback, useState } from "react";
import { FaEye, FaTrash } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { debounce } from "lodash";
import NotificationRule from "../../models/NotificationRule";
import { ViewMode } from "../adminTypes";
import { updateNotificationRule, deleteNotificationRule } from "../../../apis/notificationAPI";
import "../AdminDashboard.css";

interface NotificationRulesListProps {
    rules: NotificationRule[];
    setRules: React.Dispatch<React.SetStateAction<NotificationRule[]>>;
    view: ViewMode;
    setView: React.Dispatch<React.SetStateAction<ViewMode>>;
    setSelectedRule: React.Dispatch<React.SetStateAction<NotificationRule | null>>;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
    searchQuery: string;
    currentPage: number;
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    itemsPerPage: number;
}

const SKELETON_DELAY = 500;
const SKELETON_ITEMS = 6;

const tileVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

const NotificationRulesList: React.FC<NotificationRulesListProps> = React.memo(
    ({
        rules,
        setRules,
        setView,
        setSelectedRule,
        setError,
        searchQuery,
        currentPage,
        setCurrentPage,
        itemsPerPage,
        view
    }) => {
        const [internalSearchQuery, setInternalSearchQuery] = useState(searchQuery);
        const [loading, setLoading] = useState(true);

        const debouncedSetSearchQuery = useCallback(
            debounce((value: string) => setInternalSearchQuery(value), 300),
            []
        );

        useEffect(() => {
            debouncedSetSearchQuery(searchQuery);
            return () => debouncedSetSearchQuery.cancel();
        }, [searchQuery, debouncedSetSearchQuery]);

        useEffect(() => {
            const timer = setTimeout(() => setLoading(false), SKELETON_DELAY);
            return () => clearTimeout(timer);
        }, []);

        const filteredRules = useMemo(() => {
            return rules.filter(
                (rule) =>
                    rule.event.toLowerCase().includes(internalSearchQuery.toLowerCase()) ||
                    rule.type.toLowerCase().includes(internalSearchQuery.toLowerCase()) ||
                    rule.messageTemplate.toLowerCase().includes(internalSearchQuery.toLowerCase())
            );
        }, [rules, internalSearchQuery]);

        const totalPages = Math.max(1, Math.ceil(filteredRules.length / itemsPerPage));
        const paginatedRules = useMemo(() => {
            const start = (currentPage - 1) * itemsPerPage;
            return filteredRules.slice(start, start + itemsPerPage);
        }, [filteredRules, currentPage, itemsPerPage]);

        useEffect(() => {
            if (currentPage > totalPages) {
                setCurrentPage(totalPages);
            }
        }, [totalPages, currentPage, setCurrentPage]);

        const handleViewRule = useCallback(
            (rule: NotificationRule) => {
                setSelectedRule(rule);
                setView("notification-rule-details");
            },
            [setSelectedRule, setView]
        );

        const handleToggleEnabled = useCallback(
            async (rule: NotificationRule) => {
                try {
                    const updatedRule = await updateNotificationRule(rule.ruleID, {
                        ...rule,
                        enabled: !rule.enabled,
                    });
                    setRules((prev) =>
                        prev.map((r) => (r.ruleID === updatedRule.ruleID ? updatedRule : r))
                    );
                    setError(`Rule ${updatedRule.enabled ? "enabled" : "disabled"} successfully`);
                } catch (err: unknown) {
                    console.error("Failed to update rule:", err);
                    setError("Failed to update rule");
                }
            },
            [setRules, setError]
        );

        const handleDeleteRule = useCallback(
            async (ruleID: string) => {
                if (!window.confirm("Are you sure you want to delete this notification rule?")) return;
                try {
                    await deleteNotificationRule(ruleID);
                    setRules((prev) => prev.filter((r) => r.ruleID !== ruleID));
                    setError("Notification rule deleted successfully");
                } catch (err: unknown) {
                    console.error("Failed to delete notification rule:", err);
                    setError("Failed to delete notification rule");
                }
            },
            [setRules, setError]
        );

        const renderSkeleton = () => (
            <div className="rules-grid">
                {Array.from({ length: SKELETON_ITEMS }).map((_, i) => (
                    <motion.div
                        key={i}
                        className="permission-card"
                        variants={tileVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: i * 0.1 }}
                    >
                        <div className="custom-skeleton pulsing" style={{ width: "100%", height: "20px", marginBottom: "8px" }} />
                        <div className="custom-skeleton pulsing" style={{ width: "60%", height: "16px", marginBottom: "8px" }} />
                        <div className="custom-skeleton pulsing" style={{ width: "80%", height: "16px" }} />
                    </motion.div>
                ))}
            </div>
        );

        if (view !== "notifications") return null;

        return (
            <div className="table-card">
                <h2>Notification Rules</h2>
                {loading && renderSkeleton()}
                {!loading && (
                    <>
                        <div className="rules-grid">
                            <AnimatePresence>
                                {paginatedRules.length > 0 ? (
                                    paginatedRules.map((rule) => (
                                        <motion.div
                                            key={rule.ruleID}
                                            className="permission-card"
                                            variants={tileVariants}
                                            initial="hidden"
                                            animate="visible"
                                            exit="exit"
                                            whileHover={{ scale: 1.02 }}
                                            onClick={() => handleViewRule(rule)}
                                        >
                                            <h4>{rule.event}</h4>
                                            <p>Type: {rule.type}</p>
                                            <div className="rule-toggle-container">
                                                <label className="rule-toggle">
                                                    <input
                                                        type="checkbox"
                                                        checked={rule.enabled}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            handleToggleEnabled(rule);
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                    <span>{rule.enabled ? "Enabled" : "Disabled"}</span>
                                                </label>
                                                <div className="rule-actions">
                                                    <motion.button
                                                        className="action-button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleViewRule(rule);
                                                        }}
                                                        whileHover={{ scale: 1.1 }}
                                                        whileTap={{ scale: 0.9 }}
                                                        aria-label="View Rule"
                                                    >
                                                        <FaEye />
                                                    </motion.button>
                                                    <motion.button
                                                        className="action-button delete-button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteRule(rule.ruleID);
                                                        }}
                                                        whileHover={{ scale: 1.1 }}
                                                        whileTap={{ scale: 0.9 }}
                                                        aria-label="Delete Rule"
                                                    >
                                                        <FaTrash />
                                                    </motion.button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                ) : (
                                    <motion.div
                                        className="no-items"
                                        variants={tileVariants}
                                        initial="hidden"
                                        animate="visible"
                                    >
                                        No notification rules found
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        {totalPages > 1 && (
                            <div className="pagination">
                                <motion.button
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    aria-label="Previous Page"
                                >
                                    Previous
                                </motion.button>
                                <span>
                                    Page {currentPage} of {totalPages}
                                </span>
                                <motion.button
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    aria-label="Next Page"
                                >
                                    Next
                                </motion.button>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    }
);

export default NotificationRulesList;

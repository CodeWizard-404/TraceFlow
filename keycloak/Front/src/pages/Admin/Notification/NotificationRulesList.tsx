import React, { useMemo, useEffect, useCallback, useState } from 'react';
import { FaTrash, FaEdit, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { debounce } from 'lodash';
import NotificationRule from '../../../models/NotificationRule';
import { updateNotificationRule, deleteNotificationRule, getNotificationRules } from '../../../apis/notificationAPI';
import { ViewMode } from '../adminTypes';
import '../AdminDashboard.css';

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
    typeFilter: string;
    channelFilter: string;
    statusFilter: string;
    sortField: string;
    sortOrder: string;
}

const SKELETON_DELAY = 500;
const SKELETON_ITEMS = 6;

const rowVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

const detailsVariants = {
    hidden: { height: 0, opacity: 0 },
    visible: { height: 'auto', opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
    exit: { height: 0, opacity: 0, transition: { duration: 0.2 } },
};

const sectionVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
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
        view,
        typeFilter,
        channelFilter,
        statusFilter,
        sortField,
        sortOrder,
    }) => {
        const [internalSearchQuery, setInternalSearchQuery] = useState(searchQuery);
        const [loading, setLoading] = useState(true);
        const [expandedRows, setExpandedRows] = useState<string[]>([]);
        const [expandedTypes, setExpandedTypes] = useState<string[]>([]);
        const [, setNotificationTypes] = useState<string[]>([]);

        useEffect(() => {
            const fetchTypes = async () => {
                try {
                    const rulesData = await getNotificationRules();
                    const types = [...new Set(rulesData.map((rule) => rule.type.toLowerCase()))].filter(
                        (type): type is string => !!type
                    );
                    setNotificationTypes(['all', ...types]);
                    setExpandedTypes(['all', ...types]); // Expand all types by default
                } catch (err) {
                    console.error('Failed to fetch notification types:', err);
                    setNotificationTypes(['all', 'general']);
                    setExpandedTypes(['all', 'general']);
                }
            };
            fetchTypes();
            const timer = setTimeout(() => setLoading(false), SKELETON_DELAY);
            return () => clearTimeout(timer);
        }, []);

        const debouncedSetSearchQuery = useCallback(
            debounce((value: string) => setInternalSearchQuery(value), 300),
            []
        );

        useEffect(() => {
            debouncedSetSearchQuery(searchQuery);
            return () => debouncedSetSearchQuery.cancel();
        }, [searchQuery, debouncedSetSearchQuery]);

        const filteredRules = useMemo(() => {
            let filtered = rules.filter(
                (rule) =>
                    rule.event.toLowerCase().includes(internalSearchQuery.toLowerCase()) ||
                    rule.type.toLowerCase().includes(internalSearchQuery.toLowerCase()) ||
                    rule.messageTemplate.toLowerCase().includes(internalSearchQuery.toLowerCase())
            );

            if (typeFilter !== 'all') {
                filtered = filtered.filter((rule) => rule.type.toLowerCase() === typeFilter.toLowerCase());
            }

            if (channelFilter !== 'all') {
                filtered = filtered.filter((rule) => rule.channels[channelFilter as keyof typeof rule.channels]);
            }

            if (statusFilter !== 'all') {
                filtered = filtered.filter((rule) => rule.enabled === (statusFilter === 'enabled'));
            }

            if (sortField) {
                filtered.sort((a, b) => {
                    if (sortField === 'event') {
                        return sortOrder === 'asc'
                            ? a.event.localeCompare(b.event)
                            : b.event.localeCompare(a.event);
                    } else if (sortField === 'type') {
                        // Ensure case-insensitive type sorting
                        const typeA = a.type.toLowerCase();
                        const typeB = b.type.toLowerCase();
                        return sortOrder === 'asc'
                            ? typeA.localeCompare(typeB)
                            : typeB.localeCompare(typeA);
                    } else if (sortField === 'enabled') {
                        return sortOrder === 'asc'
                            ? Number(a.enabled) - Number(b.enabled)
                            : Number(b.enabled) - Number(a.enabled);
                    }
                    return 0;
                });
            }

            return filtered;
        }, [rules, internalSearchQuery, typeFilter, channelFilter, statusFilter, sortField, sortOrder]);

        const groupedRules = useMemo(() => {
            const grouped: Record<string, NotificationRule[]> = {};
            filteredRules.forEach((rule) => {
                const type = rule.type.toLowerCase();
                if (!grouped[type]) {
                    grouped[type] = [];
                }
                grouped[type].push(rule);
            });
            return grouped;
        }, [filteredRules]);

        const sortedTypes = useMemo(() => {
            return Object.keys(groupedRules).sort((a, b) => {
                // Respect sortField and sortOrder for type sorting
                if (sortField === 'type') {
                    return sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
                }
                return a.localeCompare(b); // Default sorting
            });
        }, [groupedRules, sortField, sortOrder]);

        const totalRules = filteredRules.length;
        const totalPages = Math.max(1, Math.ceil(totalRules / itemsPerPage));
        const paginatedRules = useMemo(() => {
            const start = (currentPage - 1) * itemsPerPage;
            return filteredRules.slice(start, start + itemsPerPage);
        }, [filteredRules, currentPage, itemsPerPage]);

        const paginatedGroupedRules = useMemo(() => {
            const grouped: Record<string, NotificationRule[]> = {};
            paginatedRules.forEach((rule) => {
                const type = rule.type.toLowerCase();
                if (!grouped[type]) {
                    grouped[type] = [];
                }
                grouped[type].push(rule);
            });
            return grouped;
        }, [paginatedRules]);

        useEffect(() => {
            if (currentPage > totalPages) {
                setCurrentPage(totalPages);
            }
        }, [totalPages, currentPage, setCurrentPage]);

        const handleToggleRow = useCallback((ruleID: string) => {
            setExpandedRows((prev) =>
                prev.includes(ruleID) ? prev.filter((id) => id !== ruleID) : [...prev, ruleID]
            );
        }, []);

        const handleToggleType = useCallback((type: string) => {
            setExpandedTypes((prev) =>
                prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
            );
        }, []);

        const handleEditRule = useCallback(
            (rule: NotificationRule) => {
                setSelectedRule(rule);
                setView('notification-rule-details');
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
                    setError(`Rule ${updatedRule.enabled ? 'enabled' : 'disabled'} successfully`);
                } catch (err: unknown) {
                    console.error('Failed to update rule:', err);
                    setError('Failed to update rule');
                }
            },
            [setRules, setError]
        );

        const handleDeleteRule = useCallback(
            async (ruleID: string) => {
                if (!window.confirm('Are you sure you want to delete this notification rule?')) return;
                try {
                    await deleteNotificationRule(ruleID);
                    setRules((prev) => prev.filter((r) => r.ruleID !== ruleID));
                    setExpandedRows((prev) => prev.filter((id) => id !== ruleID));
                    setError('Notification rule deleted successfully');
                } catch (err: unknown) {
                    console.error('Failed to delete notification rule:', err);
                    setError('Failed to delete notification rule');
                }
            },
            [setRules, setError]
        );

        const renderSkeleton = () => (
            <div className="rule-list">
                {Array.from({ length: SKELETON_ITEMS }).map((_, i) => (
                    <motion.div
                        key={i}
                        className="rule-row"
                        variants={rowVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: i * 0.1 }}
                    >
                        <div className="rule-header">
                            <div className="custom-skeleton pulsing" style={{ width: '200px', height: '20px' }} />
                            <div className="custom-skeleton pulsing" style={{ width: '80px', height: '20px' }} />
                        </div>
                    </motion.div>
                ))}
            </div>
        );

        if (view !== 'notifications') return null;

        return (
            <div className="table-card">
                <h2>Notification Rules</h2>
                {loading && renderSkeleton()}
                {!loading && (
                    <>
                        <div className="rule-list">
                            <AnimatePresence>
                                {sortedTypes.length > 0 ? (
                                    sortedTypes.map((type) => (
                                        <motion.div
                                            key={type}
                                            className="type-section"
                                            variants={sectionVariants}
                                            initial="hidden"
                                            animate="visible"
                                            exit="exit"
                                        >
                                            <div
                                                className="type-header"
                                                onClick={() => handleToggleType(type)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(e) => e.key === 'Enter' && handleToggleType(type)}
                                            >
                                                <h3>
                                                    {type.charAt(0).toUpperCase() + type.slice(1)} (
                                                    {groupedRules[type].length})
                                                </h3>
                                                <div className="type-header-actions">
                                                    {expandedTypes.includes(type) ? (
                                                        <FaChevronUp />
                                                    ) : (
                                                        <FaChevronDown />
                                                    )}
                                                </div>
                                            </div>
                                            <AnimatePresence>
                                                {expandedTypes.includes(type) && (
                                                    <motion.div
                                                        variants={detailsVariants}
                                                        initial="hidden"
                                                        animate="visible"
                                                        exit="exit"
                                                    >
                                                        {paginatedGroupedRules[type]?.map((rule) => (
                                                            <motion.div
                                                                key={rule.ruleID}
                                                                className="rule-row"
                                                                variants={rowVariants}
                                                                initial="hidden"
                                                                animate="visible"
                                                                exit="exit"
                                                            >
                                                                <div
                                                                    className="rule-header"
                                                                    onClick={() => handleToggleRow(rule.ruleID)}
                                                                    role="button"
                                                                    tabIndex={0}
                                                                    onKeyDown={(e) =>
                                                                        e.key === 'Enter' && handleToggleRow(rule.ruleID)
                                                                    }
                                                                >
                                                                    <h4>{rule.event}</h4>
                                                                    <div className="rule-header-actions">
                                                                        <span>Type: {rule.type}</span>
                                                                        <label className="toggle-switch">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={rule.enabled}
                                                                                onChange={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleToggleEnabled(rule);
                                                                                }}
                                                                            />
                                                                            <span className="slider"></span>
                                                                        </label>
                                                                        {expandedRows.includes(rule.ruleID) ? (
                                                                            <FaChevronUp />
                                                                        ) : (
                                                                            <FaChevronDown />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <AnimatePresence>
                                                                    {expandedRows.includes(rule.ruleID) && (
                                                                        <motion.div
                                                                            className="rule-details"
                                                                            variants={detailsVariants}
                                                                            initial="hidden"
                                                                            animate="visible"
                                                                            exit="exit"
                                                                        >
                                                                            <div className="rule-details-content">
                                                                                <div className="pill-group">
                                                                                    <strong>From Type:</strong>
                                                                                    <span className="pill pill-type">
                                                                                        {rule.type.toUpperCase()}
                                                                                    </span>
                                                                                </div>
                                                                                <hr />
                                                                                <div className="pill-group">
                                                                                    <strong>For Roles:</strong>
                                                                                    <div className="pill-container">
                                                                                        {rule.recipients.roles!.length > 0 ? (
                                                                                            rule.recipients.roles!.map(
                                                                                                (role) => (
                                                                                                    <span
                                                                                                        key={role}
                                                                                                        className="pill pill-role"
                                                                                                    >
                                                                                                        {role}
                                                                                                    </span>
                                                                                                )
                                                                                            )
                                                                                        ) : (
                                                                                            <span className="pill pill-none">
                                                                                                None
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <hr />
                                                                                <div className="pill-group">
                                                                                    <strong>Channels:</strong>
                                                                                    <div className="pill-container">
                                                                                        {Object.entries(rule.channels)
                                                                                            .filter(([, enabled]) => enabled)
                                                                                            .map(([channel]) => (
                                                                                                <span
                                                                                                    key={channel}
                                                                                                    className="pill pill-channel"
                                                                                                >
                                                                                                    {channel}
                                                                                                </span>
                                                                                            ))}
                                                                                        {Object.values(rule.channels).every(
                                                                                            (enabled) => !enabled
                                                                                        ) && (
                                                                                                <span className="pill pill-none">
                                                                                                    None
                                                                                                </span>
                                                                                            )}
                                                                                    </div>
                                                                                </div>
                                                                                <hr />
                                                                                <hr />
                                                                                <hr />
                                                                                <div className="pill-group">
                                                                                    <strong>Message:</strong>
                                                                                    <span className="message-text">
                                                                                        {rule.messageTemplate.slice(0, 50)}
                                                                                        {rule.messageTemplate.length > 50
                                                                                            ? '...'
                                                                                            : ''}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            <div className="rule-actions compact">
                                                                                <motion.button
                                                                                    className="action-button compact edit-button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleEditRule(rule);
                                                                                    }}
                                                                                    whileHover={{ scale: 1.05 }}
                                                                                    whileTap={{ scale: 0.95 }}
                                                                                    aria-label="Edit Rule"
                                                                                >
                                                                                    <FaEdit />
                                                                                </motion.button>
                                                                                <motion.button
                                                                                    className="action-button compact delete-button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleDeleteRule(rule.ruleID);
                                                                                    }}
                                                                                    whileHover={{ scale: 1.05 }}
                                                                                    whileTap={{ scale: 0.95 }}
                                                                                    aria-label="Delete Rule"
                                                                                >
                                                                                    <FaTrash />
                                                                                </motion.button>
                                                                            </div>
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </motion.div>
                                                        )) || (
                                                                <motion.div
                                                                    className="no-items"
                                                                    variants={rowVariants}
                                                                    initial="hidden"
                                                                    animate="visible"
                                                                >
                                                                    No rules for this type
                                                                </motion.div>
                                                            )}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    ))
                                ) : (
                                    <motion.div
                                        className="no-items"
                                        variants={rowVariants}
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
                                <div className="pagination-progress">
                                    <div
                                        className="progress-bar"
                                        style={{ width: `${(currentPage / totalPages) * 100}%` }}
                                    />
                                </div>
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
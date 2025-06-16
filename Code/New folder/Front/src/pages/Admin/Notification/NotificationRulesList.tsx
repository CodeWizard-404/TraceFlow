import React, { useMemo, useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FaTrash, FaEdit, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { debounce } from 'lodash';
import NotificationRule from '../../../models/NotificationRule';
import { updateNotificationRule, deleteNotificationRule, getNotificationRules } from '../../../apis/notificationAPI';
import { ViewMode } from '../adminTypes';
import { onNotification, offNotification, isSocketConnected } from '../../../lib/socket';
import { getEntityEvents, NotificationEvent } from '../../../lib/notifEvents';
import '../AdminDashboard.css';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';

interface NotificationRulesListProps {
    rules: NotificationRule[];
    setRules: React.Dispatch<React.SetStateAction<NotificationRule[]>>;
    view: ViewMode;
    setView: React.Dispatch<React.SetStateAction<ViewMode>>;
    setSelectedRule: React.Dispatch<React.SetStateAction<NotificationRule | null>>;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
    searchQuery: string;
    typeFilter: string;
    channelFilter: string;
    statusFilter: string;
    sortField: string;
    sortOrder: string;
}

const SKELETON_ITEMS = 6;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const MAX_RETRIES = 1;
const BASE_RETRY_DELAY = 300;

const cache = new Map<string, { data: NotificationRule[]; timestamp: number }>();

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
        view,
        typeFilter,
        channelFilter,
        statusFilter,
        sortField,
        sortOrder,
    }) => {
        const { t } = useTranslation();

        const [internalSearchQuery, setInternalSearchQuery] = useState(searchQuery);
        const [loading, setLoading] = useState(true);
        const [filterLoading, setFilterLoading] = useState(false);
        const [expandedRows, setExpandedRows] = useState<string[]>([]);
        const [expandedTypes, setExpandedTypes] = useState<string[]>([]);

        const getCachedData = useCallback((key: string): NotificationRule[] | null => {
            const cached = cache.get(key);
            if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
                return cached.data;
            }
            return null;
        }, []);

        const setCachedData = useCallback((key: string, data: NotificationRule[]) => {
            cache.set(key, { data, timestamp: Date.now() });
        }, []);

        const fetchWithRetry = useCallback(
            async (
                fetchFn: () => Promise<NotificationRule[]>,
                cacheKey: string,
                retries = MAX_RETRIES
            ): Promise<NotificationRule[]> => {
                const cachedData = getCachedData(cacheKey);
                if (cachedData) {
                    return cachedData;
                }

                try {
                    const data = await fetchFn();
                    setCachedData(cacheKey, data);
                    return data;
                } catch (err: unknown) {
                    console.error(`[Error] ${cacheKey}:`, err);
                    if (
                        retries > 0 &&
                        err instanceof Error &&
                        err.message.includes("out of shared memory")
                    ) {
                        const delay = BASE_RETRY_DELAY * (MAX_RETRIES - retries + 1);
                        await new Promise((resolve) => setTimeout(resolve, delay));
                        return fetchWithRetry(fetchFn, cacheKey, retries - 1);
                    }
                    return [];
                }
            },
            [getCachedData, setCachedData]
        );

        useEffect(() => {
            const fetchRules = async () => {
                setLoading(true);
                try {
                    const rulesData = await fetchWithRetry(
                        getNotificationRules,
                        'notification_rules'
                    );
                    setRules(rulesData);
                    setExpandedTypes([]);
                } catch (err) {
                    console.error('Failed to fetch notification rules:', err);
                    setError('Failed to load notification rules');
                    setExpandedTypes([]);
                } finally {
                    setLoading(false);
                }
            };
            if (view === 'notifications') {
                fetchRules();
            }
        }, [view, setRules, setError, fetchWithRetry]);

        // WebSocket listener for notification rule events
        useEffect(() => {
            if (view !== 'notifications' || !isSocketConnected()) return;

            let isMounted = true;

            const setupNotifications = async () => {
                setLoading(true);
                try {
                    const ruleEvents = await getEntityEvents('notification_rule');
                    if (!isMounted) return;

                    const handleRuleEvent = async (
                        event: NotificationEvent,
                        data: NotificationRule
                    ) => {
                        cache.delete('notification_rules');
                        try {
                            switch (event) {
                                case 'notification_rule:created': {
                                    const matchesSearch =
                                        !internalSearchQuery ||
                                        data.event.toLowerCase().includes(internalSearchQuery.toLowerCase()) ||
                                        data.type.toLowerCase().includes(internalSearchQuery.toLowerCase()) ||
                                        data.messageTemplate.toLowerCase().includes(internalSearchQuery.toLowerCase());
                                    const matchesType = typeFilter === 'all' || data.type.toLowerCase() === typeFilter.toLowerCase();
                                    const matchesChannel = channelFilter === 'all' || data.channels[channelFilter as keyof typeof data.channels];
                                    const matchesStatus = statusFilter === 'all' || data.enabled === (statusFilter === 'enabled');
                                    if (matchesSearch && matchesType && matchesChannel && matchesStatus) {
                                        setRules((prev) => [...prev, data]);
                                    }
                                    break;
                                }
                                case 'notification_rule:updated': {
                                    setRules((prev) =>
                                        prev.map((r) =>
                                            r.ruleID === data.ruleID ? { ...r, ...data } : r
                                        )
                                    );
                                    break;
                                }
                                case 'notification_rule:deleted': {
                                    setRules((prev) =>
                                        prev.filter((r) => r.ruleID !== data.ruleID)
                                    );
                                    setExpandedRows((prev) => prev.filter((id) => id !== data.ruleID));
                                    break;
                                }
                                default:
                                    if (event.startsWith('notification_rule:')) {
                                        const rulesData = await fetchWithRetry(
                                            getNotificationRules,
                                            'notification_rules'
                                        );
                                        setRules(rulesData);
                                    }
                            }
                        } catch (err) {
                            console.error('Failed to handle rule event:', err);
                            setError('Failed to update notification rules in real-time.');
                        }
                    };

                    ruleEvents.forEach((event) => {
                        onNotification((ev: NotificationEvent, data: unknown) => {
                            if (ev === event && isMounted) {
                                handleRuleEvent(ev, data as NotificationRule);
                            }
                        });
                    });
                } catch (err) {
                    console.error('Failed to set up WebSocket notifications:', err);
                    setError('Failed to initialize real-time updates.');
                } finally {
                    setLoading(false);
                }
            };

            setupNotifications();

            return () => {
                isMounted = false;
                offNotification();
            };
        }, [view, internalSearchQuery, typeFilter, channelFilter, statusFilter, setRules, setError, fetchWithRetry]);

        const debouncedSetSearchQuery = useCallback(
            debounce((value: string) => setInternalSearchQuery(value), 300),
            []
        );

        useEffect(() => {
            debouncedSetSearchQuery(searchQuery);
            return () => debouncedSetSearchQuery.cancel();
        }, [searchQuery, debouncedSetSearchQuery]);

        useEffect(() => {
            setFilterLoading(true);
            const timer = setTimeout(() => setFilterLoading(false), 300);
            return () => clearTimeout(timer);
        }, [typeFilter, channelFilter, statusFilter]);

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
                        const typeA = a.type.toLowerCase();
                        const typeB = b.type.toLowerCase();
                        return sortOrder === 'asc'
                            ? typeA.localeCompare(typeB)
                            : typeB.localeCompare(typeA);
                    } else if (sortField === 'enabled') {
                        return sortOrder === 'asc'
                            ? Number(a.enabled) - Number(b.enabled)
                            : Number(b.enabled) - Number(a.enabled);
                    } else if (sortField === 'priority') {
                        const priorityA = a.priority.toLowerCase();
                        const priorityB = b.priority.toLowerCase();
                        return sortOrder === 'asc'
                            ? priorityA.localeCompare(priorityB)
                            : priorityB.localeCompare(priorityA);
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
                if (sortField === 'type') {
                    return sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
                }
                return a.localeCompare(b);
            });
        }, [groupedRules, sortField, sortOrder]);

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
                } catch (err: unknown) {
                    console.error('Failed to update rule:', err);
                    setError('Failed to update rule');
                }
            },
            [setRules, setError]
        );

        const handleDeleteRule = useCallback(
            async (ruleID: string) => {
                confirmAlert({
                    title: t('notificationRules.deleteConfirmTitle'),
                    message: t('notificationRules.deleteConfirm'),
                    buttons: [
                        {
                            label: t('notificationRules.yes'),
                            onClick: async () => {
                                try {
                                    await deleteNotificationRule(ruleID);
                                    setRules((prev) => prev.filter((r) => r.ruleID !== ruleID));
                                    setExpandedRows((prev) => prev.filter((id) => id !== ruleID));
                                } catch (err: unknown) {
                                    console.error('Failed to delete notification rule:', err);
                                    setError('Failed to delete notification rule');
                                }
                            },
                        },
                        {
                            label: t('notificationRules.no'),
                            onClick: () => { },
                        },
                    ],
                });
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
                {(loading || filterLoading) && renderSkeleton()}
                {!loading && !filterLoading && (
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
                                                    {groupedRules[type].map((rule) => (
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
                                                                                <strong>Priority:</strong>
                                                                                <span className="pill pill-priority">
                                                                                    {rule.priority.toUpperCase()}
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
                                                                            <div className="pill-group">
                                                                                <strong>Type:</strong>
                                                                                <span className="pill pill-type">
                                                                                    {rule.type.toUpperCase()}
                                                                                </span>
                                                                            </div>
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
                )}
            </div>
        );
    }
);

export default NotificationRulesList;
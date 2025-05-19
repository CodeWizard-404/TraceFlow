/**
 * NotificationPreferences.tsx
 * Component for managing notification preferences with filtering and sorting.
 * Displays only rules assigned to the user (by role or userID) and disables editing for high-priority rules.
 */
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import { getNotificationRules, updateNotificationPreferences } from "../../../apis/notificationAPI";
import { useProfile } from "./useProfile";
import { FaFilter, FaSort } from "react-icons/fa";
import NotificationRule from "../../../models/NotificationRule";
import NotificationPreference from "../../../models/NotificationPreference";

const NotificationPreferences: React.FC = React.memo(() => {
    const { user } = useAuth();
    const {
        notificationView,
        notificationPrefs,
        setNotificationPrefs,
        notificationTypes,
        groupedPreferences,
        prefFilterType,
        setPrefFilterType,
        prefSortBy,
        setPrefSortBy,
        prefSortOrder,
        setPrefSortOrder,
        isLoadingNotifications,
        setTempSuccess,
        setNotificationError,
    } = useProfile();
    const [notificationRules, setNotificationRules] = useState<NotificationRule[]>([]);
    const [showPrefTypeFilter, setShowPrefTypeFilter] = useState(false);
    const [showPrefSortPanel, setShowPrefSortPanel] = useState(false);
    const [originalPrefs, setOriginalPrefs] = useState<NotificationPreference['preferences']>({});
    const [hasChanges, setHasChanges] = useState(false);

    console.debug("NotificationPreferences component mounted", {
        notificationView,
        userID: user?.userID,
        timestamp: new Date().toISOString(),
    });

    // Fetch notification rules and filter by user assignment
    useEffect(() => {
        const fetchRules = async () => {
            if (!user) {
                console.debug("No user in AuthContext, skipping rule fetch", { timestamp: new Date().toISOString() });
                return;
            }

            try {
                const rules = await getNotificationRules();
                console.debug("Fetched notification rules", {
                    ruleCount: rules.length,
                    rules: rules.map(r => ({ event: r.event, type: r.type, recipients: r.recipients, priority: r.priority })),
                    timestamp: new Date().toISOString(),
                });

                // Filter rules where user is assigned by role or userID
                const userRoles = user.Roles?.map(role => role.name) || [];
                const userRules = rules.filter(rule => {
                    const byRole = rule.recipients.roles && userRoles.some(role => rule.recipients.roles!.includes(role));
                    const byUserID = rule.recipients.userIDs && rule.recipients.userIDs.includes(user.userID);
                    return byRole || byUserID;
                });

                console.debug("Filtered user-assigned rules", {
                    userID: user.userID,
                    userRoles,
                    filteredRuleCount: userRules.length,
                    filteredRules: userRules.map(r => ({ event: r.event, type: r.type, priority: r.priority })),
                    timestamp: new Date().toISOString(),
                });

                setNotificationRules(userRules);
                // Initialize original preferences
                const initialPrefs: NotificationPreference['preferences'] = {};
                userRules.forEach(rule => {
                    initialPrefs[rule.event] = {
                        email: rule.channels.email,
                        sms: rule.channels.sms,
                        inApp: rule.channels.inApp,
                    };
                });
                setOriginalPrefs(initialPrefs);
            } catch (error) {
                setNotificationError("Failed to fetch notification rules");
                console.error("Error fetching notification rules:", {
                    error,
                    timestamp: new Date().toISOString(),
                });
            }
        };

        fetchRules();
    }, [user, setNotificationError]);

    // Track changes to notification preferences
    useEffect(() => {
        const hasPrefsChanged = Object.keys(notificationPrefs).some(event => {
            if (!originalPrefs[event]) return true;
            return Object.keys(notificationPrefs[event]).some(channel =>
                notificationPrefs[event][channel as keyof typeof notificationPrefs[typeof event]] !==
                originalPrefs[event][channel as keyof typeof originalPrefs[typeof event]]
            );
        });
        setHasChanges(hasPrefsChanged);
    }, [notificationPrefs, originalPrefs]);

    // Debug groupedPreferences and notificationPrefs
    useEffect(() => {
        console.debug("Current groupedPreferences and notificationPrefs", {
            groupedPreferences: Object.keys(groupedPreferences).map(type => ({
                type,
                events: groupedPreferences[type].map(e => ({ value: e.value, label: e.label })),
            })),
            notificationPrefs: Object.keys(notificationPrefs).map(event => ({
                event,
                channels: notificationPrefs[event],
            })),
            timestamp: new Date().toISOString(),
        });
    }, [groupedPreferences, notificationPrefs]);

    const handlePreferenceChange = useCallback((event: string, channel: "email" | "sms" | "inApp") => {
        const rule = notificationRules.find(r => r.event === event);
        if (rule?.priority === "high") {
            console.debug("Blocked preference change for high-priority rule", {
                event,
                channel,
                rule,
                timestamp: new Date().toISOString(),
            });
            return;
        }

        setNotificationPrefs((prev) => ({
            ...prev,
            [event]: {
                ...prev[event],
                [channel]: !prev[event][channel],
            },
        }));
    }, [notificationRules, setNotificationPrefs]);

    const handleSavePreferences = useCallback(async () => {
        try {
            const editablePrefs: typeof notificationPrefs = {};
            Object.entries(notificationPrefs).forEach(([event, channels]) => {
                const rule = notificationRules.find(r => r.event === event);
                if (rule?.priority !== "high") {
                    editablePrefs[event] = channels;
                }
            });

            console.debug("Saving notification preferences", {
                editablePrefs: Object.keys(editablePrefs).map(event => ({
                    event,
                    channels: editablePrefs[event],
                })),
                timestamp: new Date().toISOString(),
            });

            await updateNotificationPreferences(editablePrefs);
            setOriginalPrefs(notificationPrefs);
            setHasChanges(false);
            setTempSuccess("Notification preferences saved successfully");
        } catch (err) {
            setNotificationError("Failed to save notification preferences");
            console.error("Failed to save preferences:", {
                error: err,
                timestamp: new Date().toISOString(),
            });
        }
    }, [notificationPrefs, notificationRules, setTempSuccess, setNotificationError]);

    const handleCancelChanges = useCallback(() => {
        setNotificationPrefs(originalPrefs);
        setHasChanges(false);
    }, [originalPrefs, setNotificationPrefs]);

    const handleResetPreferences = useCallback(() => {
        const resetPrefs: NotificationPreference['preferences'] = {};
        notificationRules.forEach(rule => {
            resetPrefs[rule.event] = {
                email: rule.channels.email,
                sms: rule.channels.sms,
                inApp: rule.channels.inApp,
            };
        });
        setNotificationPrefs(resetPrefs);
        setOriginalPrefs(resetPrefs);
        setHasChanges(false);
        setTempSuccess("Preferences reset to default rules");
    }, [notificationRules, setNotificationPrefs, setTempSuccess]);

    // Filter grouped preferences to only show events from user-assigned rules
    const filteredGroupedPreferences = Object.fromEntries(
        Object.entries(groupedPreferences)
            .map(([type, events]) => [
                type,
                events.filter(event =>
                    notificationRules.some(rule => rule.event.toLowerCase() === event.value.toLowerCase())
                ),
            ])
            .filter(([_, events]) => events.length > 0)
    );

    console.debug("Rendering filteredGroupedPreferences", {
        filteredGroupedPreferences: Object.keys(filteredGroupedPreferences).map(type => ({
            type,
            events: filteredGroupedPreferences[type].map((e: { value: any; label: any; }) => ({ value: e.value, label: e.label })),
        })),
        notificationPrefs,
        timestamp: new Date().toISOString(),
    });

    return (
        <div className="notification-preferences-wrapper">
            <div className="notification-preferences">
                <h2>Notification Preferences</h2>
                {Object.keys(filteredGroupedPreferences).length === 0 ? (
                    <p>No assigned notification preferences available</p>
                ) : (
                    Object.entries(filteredGroupedPreferences).map(([type, events]) => (
                        <div key={type} className="preference-group">
                            <h3>{type}</h3>
                            <table className="preferences-table">
                                <thead>
                                    <tr>
                                        <th>Event</th>
                                        <th>Email</th>
                                        <th>SMS</th>
                                        <th>In-App</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(events as { value: string; label: string }[]).map((event) => {
                                        const { value, label } = event;
                                        const rule = notificationRules.find(r => r.event === value);
                                        const isHighPriority = rule?.priority === "high";
                                        const prefs = notificationPrefs[value] || { email: false, sms: false, inApp: false };
                                        return (
                                            <tr key={value}>
                                                <td>{label}</td>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={prefs.email}
                                                        onChange={() => handlePreferenceChange(value, "email")}
                                                        disabled={isHighPriority}
                                                        title={isHighPriority ? "High priority rule - cannot be modified" : ""}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={prefs.sms}
                                                        onChange={() => handlePreferenceChange(value, "sms")}
                                                        disabled={isHighPriority}
                                                        title={isHighPriority ? "High priority rule - cannot be modified" : ""}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={prefs.inApp}
                                                        onChange={() => handlePreferenceChange(value, "inApp")}
                                                        disabled={isHighPriority}
                                                        title={isHighPriority ? "High priority rule - cannot be modified" : ""}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ))
                )}
                <div className="button-group">
                    <button
                        onClick={handleResetPreferences}
                        className="reset-btn"
                        disabled={isLoadingNotifications}
                    >
                        Reset to Defaults
                    </button>
                    {hasChanges && (
                        <>
                            <button
                                onClick={handleCancelChanges}
                                className="cancel-btn"
                                disabled={isLoadingNotifications}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSavePreferences}
                                className="save-btn"
                                disabled={isLoadingNotifications}
                            >
                                Save
                            </button>
                        </>
                    )}
                </div>
            </div>
            <aside className="filter-sidebar">
                <div className="filter-section">
                    <button
                        className={`filter-toggle ${showPrefTypeFilter ? "active" : ""}`}
                        onClick={() => {
                            setShowPrefTypeFilter(!showPrefTypeFilter);
                            setShowPrefSortPanel(false);
                        }}
                    >
                        <FaFilter /> Type Filter
                    </button>
                    {showPrefTypeFilter && (
                        <div className="filter-content">
                            <div className="filter-group">
                                <div className="filter-options">
                                    <button
                                        className={`filter-option ${prefFilterType === "" ? "active" : ""}`}
                                        onClick={() => setPrefFilterType("")}
                                    >
                                        All Types
                                    </button>
                                    {notificationTypes.map((type) => (
                                        <button
                                            key={type}
                                            className={`filter-option ${prefFilterType === type ? "active" : ""}`}
                                            onClick={() => setPrefFilterType(type)}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="filter-section">
                    <button
                        className={`filter-toggle ${showPrefSortPanel ? "active" : ""}`}
                        onClick={() => {
                            setShowPrefSortPanel(!showPrefSortPanel);
                            setShowPrefTypeFilter(false);
                        }}
                    >
                        <FaSort /> Sort
                    </button>
                    {showPrefSortPanel && (
                        <div className="filter-content">
                            <div className="filter-group">
                                <div className="filter-options">
                                    <button
                                        className={`filter-option ${prefSortBy === "none" ? "active" : ""}`}
                                        onClick={() => setPrefSortBy("none")}
                                    >
                                        Default
                                    </button>
                                    <button
                                        className={`filter-option ${prefSortBy === "event" && prefSortOrder === "asc" ? "active" : ""}`}
                                        onClick={() => {
                                            setPrefSortBy("event");
                                            setPrefSortOrder("asc");
                                        }}
                                    >
                                        Event (A-Z)
                                    </button>
                                    <button
                                        className={`filter-option ${prefSortBy === "event" && prefSortOrder === "desc" ? "active" : ""}`}
                                        onClick={() => {
                                            setPrefSortBy("event");
                                            setPrefSortOrder("desc");
                                        }}
                                    >
                                        Event (Z-A)
                                    </button>
                                    <button
                                        className={`filter-option ${prefSortBy === "type" && prefSortOrder === "asc" ? "active" : ""}`}
                                        onClick={() => {
                                            setPrefSortBy("type");
                                            setPrefSortOrder("asc");
                                        }}
                                    >
                                        Type (A-Z)
                                    </button>
                                    <button
                                        className={`filter-option ${prefSortBy === "type" && prefSortOrder === "desc" ? "active" : ""}`}
                                        onClick={() => {
                                            setPrefSortBy("type");
                                            setPrefSortOrder("desc");
                                        }}
                                    >
                                        Type (Z-A)
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
});

export default NotificationPreferences;
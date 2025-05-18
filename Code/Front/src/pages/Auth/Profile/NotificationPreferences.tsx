/**
 * NotificationPreferences.tsx
 * Component for managing notification preferences with filtering and sorting.
 */
import React, { useState } from "react";
import { updateNotificationPreferences } from "../../../apis/notificationAPI";
import { useProfile } from "./useProfile";
import { FaFilter, FaSort } from "react-icons/fa";

const NotificationPreferences: React.FC = React.memo(() => {
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

    const [showPrefTypeFilter, setShowPrefTypeFilter] = useState(false);
    const [showPrefSortPanel, setShowPrefSortPanel] = useState(false);

    const handlePreferenceChange = (event: string, channel: "email" | "sms" | "inApp") => {
        setNotificationPrefs((prev) => ({
            ...prev,
            [event]: {
                ...prev[event],
                [channel]: !prev[event][channel],
            },
        }));
    };

    const handleSavePreferences = async () => {
        try {
            await updateNotificationPreferences(notificationPrefs);
            setTempSuccess("Notification preferences saved successfully");
        } catch (err) {
            setNotificationError("Failed to save notification preferences");
            console.error("Failed to save preferences:", err);
        }
    };

    if (notificationView !== "preferences") return null;

    return (
        <div className="notification-preferences-wrapper">
            <div className="notification-preferences">
                {Object.entries(groupedPreferences).length === 0 ? (
                    <p>No enabled notification preferences available</p>
                ) : (
                    Object.entries(groupedPreferences).map(([type, events]) => (
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
                                    {events.map(({ value, label }) => (
                                        <tr key={value}>
                                            <td>{label}</td>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={notificationPrefs[value]?.email || false}
                                                    onChange={() => handlePreferenceChange(value, "email")}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={notificationPrefs[value]?.sms || false}
                                                    onChange={() => handlePreferenceChange(value, "sms")}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={notificationPrefs[value]?.inApp || false}
                                                    onChange={() => handlePreferenceChange(value, "inApp")}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))
                )}
                <button
                    onClick={handleSavePreferences}
                    className="update-btn"
                    disabled={isLoadingNotifications}
                >
                    Save Preferences
                </button>
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
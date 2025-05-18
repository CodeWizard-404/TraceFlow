/**
 * NotificationList.tsx
 * Component for rendering the notification list with search and controls.
 * Handles filtering, sorting, and notification actions.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
} from "../../../apis/notificationAPI";
import { FaSearch, FaSync, FaFilter, FaSort, FaTimes } from "react-icons/fa";
import { useProfile } from "./useProfile";

const NotificationList: React.FC = React.memo(() => {
    const {
        notificationView,
        notifications,
        setNotifications,
        searchQuery,
        setSearchQuery,
        showRead,
        setShowRead,
        filterTypes,
        setFilterTypes,
        filterEvents,
        setFilterEvents,
        filterStatuses,
        setFilterStatuses,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        sortBy,
        setSortBy,
        sortOrder,
        setSortOrder,
        isLoadingNotifications,
        setIsLoadingNotifications,
        notificationError,
        setNotificationError,
        availableEventActions,
        notificationTypes,
        setTempSuccess,
    } = useProfile();

    const [showTypeFilter, setShowTypeFilter] = useState(false);
    const [showEventFilter, setShowEventFilter] = useState(false);
    const [showStatusFilter, setShowStatusFilter] = useState(false);
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [showSortPanel, setShowSortPanel] = useState(false);

    useEffect(() => {
        if (notificationView !== "list") return;

        const fetchNotifications = async () => {
            setIsLoadingNotifications(true);
            try {
                const fetchedNotifications = await getNotifications();
                setNotifications(fetchedNotifications);
                setNotificationError(null);
            } catch (err) {
                setNotificationError("Failed to load notifications");
                console.error("Failed to fetch notifications:", err);
            } finally {
                setIsLoadingNotifications(false);
            }
        };

        fetchNotifications();
    }, [notificationView, setIsLoadingNotifications, setNotifications, setNotificationError]);

    const handleRefreshNotifications = async () => {
        setIsLoadingNotifications(true);
        try {
            const fetchedNotifications = await getNotifications();
            setNotifications(fetchedNotifications);
            setNotificationError(null);
        } catch (err) {
            setNotificationError("Failed to refresh notifications");
            console.error("Failed to refresh notifications:", err);
        } finally {
            setIsLoadingNotifications(false);
        }
    };

    const handleMarkAsRead = async (notificationID: string) => {
        try {
            const updatedNotification = await markNotificationAsRead(notificationID);
            setNotifications((prev) =>
                prev.map((n) =>
                    n.notificationID === notificationID ? updatedNotification : n
                )
            );
        } catch (err) {
            setNotificationError("Failed to mark notification as read");
            console.error("Failed to mark notification as read:", err);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await markAllNotificationsAsRead();
            setNotifications((prev) =>
                prev.map((n) => ({ ...n, status: "read" }))
            );
            setTempSuccess("All notifications marked as read");
        } catch (err) {
            setNotificationError("Failed to mark all notifications as read");
            console.error("Failed to mark all notifications as read:", err);
        }
    };

    const handleResetFilters = () => {
        setSearchQuery("");
        setShowRead(false);
        setFilterTypes([]);
        setFilterEvents([]);
        setFilterStatuses([]);
        setStartDate("");
        setEndDate("");
        setSortBy("createdAt");
        setSortOrder("desc");
        setShowTypeFilter(false);
        setShowEventFilter(false);
        setShowStatusFilter(false);
        setShowDateFilter(false);
        setShowSortPanel(false);
    };

    const filteredNotifications = useMemo(() => {
        return notifications
            .filter((n) => {
                const matchesSearch = n.message
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase());
                const matchesRead = showRead || n.status !== "read";
                const matchesType =
                    filterTypes.length === 0 || filterTypes.includes(n.type);
                const matchesEvent =
                    filterEvents.length === 0 ||
                    filterEvents.some((action) => {
                        const eventAction = n.message.split(':')[1]?.toLowerCase();
                        return eventAction && action.toLowerCase() === eventAction;
                    });
                const matchesStatus =
                    filterStatuses.length === 0 || filterStatuses.includes(n.status);
                const notificationDate = new Date(n.createdAt);
                const matchesDate =
                    (!startDate || notificationDate >= new Date(startDate)) &&
                    (!endDate || notificationDate <= new Date(endDate));
                return (
                    matchesSearch &&
                    matchesRead &&
                    matchesType &&
                    matchesEvent &&
                    matchesStatus &&
                    matchesDate
                );
            })
            .sort((a, b) => {
                let valueA: string | number;
                let valueB: string | number;
                switch (sortBy) {
                    case "createdAt":
                        valueA = new Date(a.createdAt).getTime();
                        valueB = new Date(b.createdAt).getTime();
                        break;
                    case "type":
                        valueA = a.type.toLowerCase();
                        valueB = b.type.toLowerCase();
                        break;
                    case "message":
                        valueA = a.message.toLowerCase();
                        valueB = b.message.toLowerCase();
                        break;
                }
                return sortOrder === "asc" ? (valueA > valueB ? 1 : -1) : valueA < valueB ? 1 : -1;
            });
    }, [
        notifications,
        searchQuery,
        showRead,
        filterTypes,
        filterEvents,
        filterStatuses,
        startDate,
        endDate,
        sortBy,
        sortOrder,
    ]);

    if (notificationView !== "list") return null;

    return (
        <div className="notification-list-wrapper">
            <div className="notification-list-container">
                <div className="notification-controls">
                    <div className="search-container">
                        <FaSearch />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search notifications..."
                            className="search-input"
                        />
                    </div>
                    <button
                        className={`toggle-read-btn ${showRead ? "active" : ""}`}
                        onClick={() => setShowRead(!showRead)}
                    >
                        {showRead ? "Hide Read" : "Show All"}
                    </button>
                    <button
                        onClick={handleRefreshNotifications}
                        className="action-btn"
                        disabled={isLoadingNotifications}
                    >
                        <FaSync className={isLoadingNotifications ? "spinning" : ""} />
                        Refresh
                    </button>
                    <button
                        onClick={handleMarkAllAsRead}
                        className="action-btn"
                        disabled={isLoadingNotifications || notifications.length === 0}
                    >
                        Mark All Read
                    </button>
                </div>
                {notificationError && (
                    <div className="error-message">{notificationError}</div>
                )}
                {isLoadingNotifications ? (
                    <div className="custom-skeleton pulsing" style={{ width: '100%', height: '200px' }} />
                ) : filteredNotifications.length === 0 ? (
                    <p>No notifications found</p>
                ) : (
                    <div className="notification-list notification-list-0">
                        {filteredNotifications.map((notification) => (
                            <div
                                key={notification.notificationID}
                                className={`notification-item ${notification.status === "read" ? "read" : ""}`}
                                onClick={() => handleMarkAsRead(notification.notificationID)}
                            >
                                <div className="notification-details">
                                    <span className="notification-message">{notification.message}</span>
                                    <span className="notification-meta">
                                        {notification.type} • {notification.status} • {notification.channel} • {new Date(notification.createdAt).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <aside className="filter-sidebar">
                <div className="filter-section">
                    <button
                        className={`filter-toggle ${showTypeFilter ? "active" : ""}`}
                        onClick={() => {
                            setShowTypeFilter(!showTypeFilter);
                            setShowEventFilter(false);
                            setShowStatusFilter(false);
                            setShowDateFilter(false);
                            setShowSortPanel(false);
                        }}
                    >
                        <FaFilter /> Type Filter
                    </button>
                    {showTypeFilter && (
                        <div className="filter-content">
                            <div className="filter-group">
                                <div className="filter-options">
                                    {notificationTypes.map((type) => (
                                        <button
                                            key={type}
                                            className={`filter-option ${filterTypes.includes(type) ? "active" : ""}`}
                                            onClick={() =>
                                                setFilterTypes((prev) =>
                                                    prev.includes(type)
                                                        ? prev.filter((t) => t !== type)
                                                        : [...prev, type]
                                                )
                                            }
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
                        className={`filter-toggle ${showEventFilter ? "active" : ""}`}
                        onClick={() => {
                            setShowEventFilter(!showEventFilter);
                            setShowTypeFilter(false);
                            setShowStatusFilter(false);
                            setShowDateFilter(false);
                            setShowSortPanel(false);
                        }}
                    >
                        <FaFilter /> Event Filter
                    </button>
                    {showEventFilter && (
                        <div className="filter-content">
                            <div className="filter-group">
                                <div className="filter-options">
                                    {availableEventActions.map(({ value, label }) => (
                                        <button
                                            key={value}
                                            className={`filter-option ${filterEvents.includes(value) ? "active" : ""}`}
                                            onClick={() =>
                                                setFilterEvents((prev) =>
                                                    prev.includes(value)
                                                        ? prev.filter((e) => e !== value)
                                                        : [...prev, value]
                                                )
                                            }
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="filter-section">
                    <button
                        className={`filter-toggle ${showStatusFilter ? "active" : ""}`}
                        onClick={() => {
                            setShowStatusFilter(!showStatusFilter);
                            setShowTypeFilter(false);
                            setShowEventFilter(false);
                            setShowDateFilter(false);
                            setShowSortPanel(false);
                        }}
                    >
                        <FaFilter /> Status Filter
                    </button>
                    {showStatusFilter && (
                        <div className="filter-content">
                            <div className="filter-group">
                                <div className="filter-options">
                                    {["pending", "sent", "read", "failed"].map((status) => (
                                        <button
                                            key={status}
                                            className={`filter-option ${filterStatuses.includes(status) ? "active" : ""}`}
                                            onClick={() =>
                                                setFilterStatuses((prev) =>
                                                    prev.includes(status)
                                                        ? prev.filter((s) => s !== status)
                                                        : [...prev, status]
                                                )
                                            }
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="filter-section">
                    <button
                        className={`filter-toggle ${showDateFilter ? "active" : ""}`}
                        onClick={() => {
                            setShowDateFilter(!showDateFilter);
                            setShowTypeFilter(false);
                            setShowEventFilter(false);
                            setShowStatusFilter(false);
                            setShowSortPanel(false);
                        }}
                    >
                        <FaFilter /> Date Filter
                    </button>
                    {showDateFilter && (
                        <div className="filter-content">
                            <div className="filter-group">
                                <label>Start Date</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                                <label>End Date</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                </div>
                <div className="filter-section">
                    <button
                        className={`filter-toggle ${showSortPanel ? "active" : ""}`}
                        onClick={() => {
                            setShowSortPanel(!showSortPanel);
                            setShowTypeFilter(false);
                            setShowEventFilter(false);
                            setShowStatusFilter(false);
                            setShowDateFilter(false);
                        }}
                    >
                        <FaSort /> Sort
                    </button>
                    {showSortPanel && (
                        <div className="filter-content">
                            <div className="filter-group">
                                <div className="filter-options">
                                    <button
                                        className={`filter-option ${sortBy === "createdAt" && sortOrder === "desc" ? "active" : ""}`}
                                        onClick={() => {
                                            setSortBy("createdAt");
                                            setSortOrder("desc");
                                        }}
                                    >
                                        Newest First
                                    </button>
                                    <button
                                        className={`filter-option ${sortBy === "createdAt" && sortOrder === "asc" ? "active" : ""}`}
                                        onClick={() => {
                                            setSortBy("createdAt");
                                            setSortOrder("asc");
                                        }}
                                    >
                                        Oldest First
                                    </button>
                                    <button
                                        className={`filter-option ${sortBy === "type" && sortOrder === "asc" ? "active" : ""}`}
                                        onClick={() => {
                                            setSortBy("type");
                                            setSortOrder("asc");
                                        }}
                                    >
                                        Type (A-Z)
                                    </button>
                                    <button
                                        className={`filter-option ${sortBy === "type" && sortOrder === "desc" ? "active" : ""}`}
                                        onClick={() => {
                                            setSortBy("type");
                                            setSortOrder("desc");
                                        }}
                                    >
                                        Type (Z-A)
                                    </button>
                                    <button
                                        className={`filter-option ${sortBy === "message" && sortOrder === "asc" ? "active" : ""}`}
                                        onClick={() => {
                                            setSortBy("message");
                                            setSortOrder("asc");
                                        }}
                                    >
                                        Message (A-Z)
                                    </button>
                                    <button
                                        className={`filter-option ${sortBy === "message" && sortOrder === "desc" ? "active" : ""}`}
                                        onClick={() => {
                                            setSortBy("message");
                                            setSortOrder("desc");
                                        }}
                                    >
                                        Message (Z-A)
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <button
                    onClick={handleResetFilters}
                    className="action-btn reset-btn"
                >
                    <FaTimes /> Reset Filters
                </button>
            </aside>
        </div>
    );
});

export default NotificationList;
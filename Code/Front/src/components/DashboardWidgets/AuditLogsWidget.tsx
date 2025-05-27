import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    getLogs,
    getLogsByCategory,
    getLogStatistics,
    getUniqueValues,
    deleteLogs,
    archiveLogs,
    exportLogs,
    clearAllLogs,
    getLoggerHealth,
    getLoggerMetrics,
} from '../../apis/logAPI';

import {
    GetLogsResponse,
    LogStatisticsResponse,
    UniqueValuesResponse,
    DeleteLogsResponse,
    ArchiveLogsResponse,
    ExportLogsResponse,
    ClearLogsResponse,
    LoggerHealthResponse,
} from '../../apis/index';
import { Log } from '../../models/log';



const AuditLogsWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [logs, setLogs] = useState<Log[]>([]);
    const [statistics, setStatistics] = useState<LogStatisticsResponse | null>(null);
    const [uniqueUsers, setUniqueUsers] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'logs' | 'stats' | 'actions'>('logs');

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_AUDIT_LOGS
    );

    useEffect(() => {
        const fetchData = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                // Fetch recent logs
                const logsResponse: GetLogsResponse = await getLogs({ pageSize: 5 });
                setLogs(logsResponse.data || []);

                // Fetch statistics
                const statsResponse: LogStatisticsResponse = await getLogStatistics({});
                setStatistics(statsResponse);

                // Fetch unique users
                const usersResponse: UniqueValuesResponse = await getUniqueValues('userId');
                setUniqueUsers(usersResponse || []);
            } catch (err) {
                setError('Failed to fetch audit data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user, hasPermission]);

    const handleDeleteLogs = async () => {
        try {
            const response: DeleteLogsResponse = await deleteLogs({ startDate: '2025-01-01' });
            setActionMessage(`Deleted ${response.deletedCount} logs`);
        } catch (err) {
            setActionMessage('Failed to delete logs');
        }
    };

    const handleArchiveLogs = async () => {
        try {
            const response: ArchiveLogsResponse = await archiveLogs(30);
            setActionMessage(`Archived ${response.deletedCount} logs`);
        } catch (err) {
            setActionMessage('Failed to archive logs');
        }
    };

    const handleExportLogs = async () => {
        try {
            const response: ExportLogsResponse = await exportLogs({});
            setActionMessage(`Exported ${response.length} logs`);
        } catch (err) {
            setActionMessage('Failed to export logs');
        }
    };

    const handleClearLogs = async () => {
        try {
            const response: ClearLogsResponse = await clearAllLogs();
            setActionMessage(`Cleared ${response.deletedCount} logs`);
            setLogs([]); // Clear logs in UI
        } catch (err) {
            setActionMessage('Failed to clear logs');
        }
    };

    const handleGetLogsByCategory = async (category: string) => {
        try {
            const response = await getLogsByCategory(category, {});
            setActionMessage(`Fetched ${response.length} logs for category ${category}`);
        } catch (err) {
            setActionMessage(`Failed to fetch logs for category ${category}`);
        }
    };

    const handleGetLoggerHealth = async () => {
        try {
            const response: LoggerHealthResponse = await getLoggerHealth();
            setActionMessage(`Logger status: ${response.status}`);
        } catch (err) {
            setActionMessage('Failed to fetch logger health');
        }
    };

    const handleGetLoggerMetrics = async () => {
        try {
            const response: string = await getLoggerMetrics();
            setActionMessage(`Metrics: ${response}`);
        } catch (err) {
            setActionMessage('Failed to fetch logger metrics');
        }
    };

    if (!hasPermission) return null;
    if (loading) return <div>Loading audit data...</div>;
    if (error) return <div>{error}</div>;

    return (
        <div className="widget-content">
            <h2>Audit Logs Dashboard</h2>
            <div className="tabs">
                <button onClick={() => setActiveTab('logs')} className={activeTab === 'logs' ? 'active' : ''}>
                    Recent Logs
                </button>
                <button onClick={() => setActiveTab('stats')} className={activeTab === 'stats' ? 'active' : ''}>
                    Statistics
                </button>
                <button onClick={() => setActiveTab('actions')} className={activeTab === 'actions' ? 'active' : ''}>
                    Actions
                </button>
            </div>

            {activeTab === 'logs' && (
                <div>
                    <h3>Recent Logs</h3>
                    {logs.length === 0 ? (
                        <p>No recent logs.</p>
                    ) : (
                        <ul>
                            {logs.map((log) => (
                                <li key={log.logID}>
                                    {log.message} by {log.userId || 'Unknown'} at {log.timestamp}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {activeTab === 'stats' && (
                <div>
                    <h3>Log Statistics</h3>
                    {statistics ? (
                        <div>
                            <p>Total Logs: {statistics.total}</p>
                            <h4>By Level:</h4>
                            <ul>
                                {statistics.byLevel.map((item) => (
                                    <li key={item.level}>
                                        {item.level}: {item.count}
                                    </li>
                                ))}
                            </ul>
                            <h4>Unique Users:</h4>
                            <ul>
                                {uniqueUsers.map((user) => (
                                    <li key={user}>{user}</li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <p>No statistics available.</p>
                    )}
                </div>
            )}

            {activeTab === 'actions' && (
                <div>
                    <h3>Log Actions</h3>
                    {actionMessage && <p>{actionMessage}</p>}
                    <button onClick={handleDeleteLogs}>Delete Logs (Since 2025-01-01)</button>
                    <button onClick={handleArchiveLogs}>Archive Logs (30 days)</button>
                    <button onClick={handleExportLogs}>Export Logs</button>
                    <button onClick={handleClearLogs}>Clear All Logs</button>
                    <button onClick={() => handleGetLogsByCategory('level')}>Get Logs by Level</button>
                    <button onClick={handleGetLoggerHealth}>Check Logger Health</button>
                    <button onClick={handleGetLoggerMetrics}>Get Logger Metrics</button>
                </div>
            )}

            <style>
                {`
                    .tabs {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 20px;
                    }
                    .tabs button {
                        padding: 8px 16px;
                        border: none;
                        background: #f0f0f0;
                        cursor: pointer;
                    }
                    .tabs button.active {
                        background: #007bff;
                        color: white;
                    }
                    button {
                        margin: 5px;
                        padding: 8px 12px;
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    }
                    button:hover {
                        background: #0056b3;
                    }
                    ul {
                        list-style: none;
                        padding: 0;
                    }
                    li {
                        margin: 5px 0;
                    }
                `}
            </style>
        </div>
    );
};

export default AuditLogsWidget;
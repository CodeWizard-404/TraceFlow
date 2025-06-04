import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { confirmAlert } from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import { useTranslation } from 'react-i18next';
import { Log } from '../../models/log';
import {
    getLogs,
    getLogsByCategory,
    deleteLogs,
    archiveLogs,
    getLogStatistics,
    exportLogs,
    clearAllLogs,
    getUniqueValues,
    getLoggerHealth,
} from '../../apis/logAPI';
import { FaTrash, FaArchive, FaChartBar, FaDownload, FaRedo, FaCog, FaTimes, FaInfoCircle } from 'react-icons/fa';
import Select from 'react-select';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import './AdminDashboard.css';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

// Define props interface
interface LogsListProps {
    logs: Log[];
    totalLogs: number;
    logsPage: number;
    setLogsPage: (page: number) => void;
    logSortField: string;
    setLogSortField: (field: string) => void;
    logSortOrder: 'asc' | 'desc';
    setLogSortOrder: (order: 'asc' | 'desc') => void;
    itemsPerPage: number;
    logsLoading: boolean;
    logFilters: {
        level?: string;
        route?: string;
        service?: string;
        status?: number;
        method?: string;
        userId?: string;
        traceId?: string;
        startDate?: string;
        endDate?: string;
        search?: string;
    };
    setLogFilters: (filters: LogFilters) => void;
    refreshLogs: () => void;
}

interface LogFilters {
    level?: string;
    route?: string;
    service?: string;
    status?: number;
    method?: string;
    userId?: string;
    traceId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
}

const LogsList: React.FC<LogsListProps> = ({
    logs,
    totalLogs,
    logsPage,
    setLogsPage,
    logSortField,
    setLogSortField,
    logSortOrder,
    setLogSortOrder,
    itemsPerPage,
    logsLoading,
    logFilters,
    setLogFilters,
    refreshLogs,
}) => {
    const { t } = useTranslation();
    const [uniqueLevels, setUniqueLevels] = useState<string[]>([]);
    const [uniqueRoutes, setUniqueRoutes] = useState<string[]>([]);
    const [uniqueServices, setUniqueServices] = useState<string[]>([]);
    const [uniqueMethods, setUniqueMethods] = useState<string[]>([]);
    const [uniqueUserIds, setUniqueUserIds] = useState<string[]>([]);
    const [showStats, setShowStats] = useState<boolean>(false);
    const [logStatistics, setLogStatistics] = useState<any>({ total: 0 });
    const [healthStatus, setHealthStatus] = useState<string>('unknown');
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [isArchiving, setIsArchiving] = useState<boolean>(false);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [isClearing, setIsClearing] = useState<boolean>(false);
    const [showFilterPopup, setShowFilterPopup] = useState<boolean>(false);
    const [selectedLog, setSelectedLog] = useState<Log | null>(null);
    const totalPages = useMemo(() => Math.ceil(totalLogs / itemsPerPage), [totalLogs, itemsPerPage]);

    // Chart options
    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: true,
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: t('logs.count'),
                },
            },
        },
    };

    // Chart data for logs by level
    const levelChartData = useMemo(() => ({
        labels: logStatistics.database?.byLevel?.map((stat: any) => stat.level) || [],
        datasets: [{
            label: t('logs.byLevel'),
            data: logStatistics.database?.byLevel?.map((stat: any) => stat.count) || [],
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1,
        }],
    }), [logStatistics, t]);

    // Chart data for logs by route
    const routeChartData = useMemo(() => ({
        labels: logStatistics.database?.byRoute?.map((stat: any) => stat.route) || [],
        datasets: [{
            label: t('logs.byRoute'),
            data: logStatistics.database?.byRoute?.map((stat: any) => stat.count) || [],
            backgroundColor: 'rgba(255, 99, 132, 0.6)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1,
        }],
    }), [logStatistics, t]);

    // Chart data for logs by service
    const serviceChartData = useMemo(() => ({
        labels: logStatistics.database?.byService?.map((stat: any) => stat.service) || [],
        datasets: [{
            label: t('logs.byService'),
            data: logStatistics.database?.byService?.map((stat: any) => stat.count) || [],
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
        }],
    }), [logStatistics, t]);

    // Chart data for logs by status
    const statusChartData = useMemo(() => ({
        labels: logStatistics.database?.byStatus?.map((stat: any) => stat.status ?? 'NULL') || [],
        datasets: [{
            label: t('logs.byStatus'),
            data: logStatistics.database?.byStatus?.map((stat: any) => stat.count) || [],
            backgroundColor: 'rgba(255, 206, 86, 0.6)',
            borderColor: 'rgba(255, 206, 86, 1)',
            borderWidth: 1,
        }],
    }), [logStatistics, t]);

    // Chart data for logs by method
    const methodChartData = useMemo(() => ({
        labels: logStatistics.database?.byMethod?.map((stat: any) => stat.method ?? 'NULL') || [],
        datasets: [{
            label: t('logs.byMethod'),
            data: logStatistics.database?.byMethod?.map((stat: any) => stat.count) || [],
            backgroundColor: 'rgba(153, 102, 255, 0.6)',
            borderColor: 'rgba(153, 102, 255, 1)',
            borderWidth: 1,
        }],
    }), [logStatistics, t]);

    // Fetch unique values for filters
    const fetchUniqueValues = useCallback(async () => {
        try {
            const [levels, routes, services, methods, userIds] = await Promise.all([
                getUniqueValues('level'),
                getUniqueValues('route'),
                getUniqueValues('service'),
                getUniqueValues('method'),
                getUniqueValues('userId'),
            ]);
            setUniqueLevels(levels);
            setUniqueRoutes(routes);
            setUniqueServices(services);
            setUniqueMethods(methods);
            setUniqueUserIds(userIds);
        } catch (error) {
            console.error('Failed to fetch unique values:', error);
            alert(t('logs.error.uniqueValues'));
        }
    }, [t]);

    // Fetch logger health
    const fetchHealthStatus = useCallback(async () => {
        try {
            const health = await getLoggerHealth();
            setHealthStatus(health.status);
        } catch (error) {
            console.error('Failed to fetch logger health:', error);
            alert(t('logs.error.health'));
        }
    }, [t]);

    // Fetch log statistics
    const fetchStatistics = useCallback(async () => {
        try {
            const stats = await getLogStatistics({
                startDate: logFilters.startDate,
                endDate: logFilters.endDate,
                route: logFilters.route,
                service: logFilters.service,
                level: logFilters.level !== 'all' ? logFilters.level : undefined,
            });
            setLogStatistics(stats);
        } catch (error) {
            console.error('Failed to fetch log statistics:', error);
            alert(t('logs.error.stats'));
        }
    }, [logFilters, t]);

    useEffect(() => {
        fetchUniqueValues();
        fetchHealthStatus();
    }, [fetchUniqueValues, fetchHealthStatus]);

    // Handle sorting
    const handleSort = useCallback(
        (field: string) => {
            if (logSortField === field) {
                setLogSortOrder(logSortOrder === 'asc' ? 'desc' : 'asc');
            } else {
                setLogSortField(field);
                setLogSortOrder('asc');
            }
            setLogsPage(1);
        },
        [logSortField, logSortOrder, setLogSortField, setLogSortOrder, setLogsPage]
    );

    // Handle filter changes
    const handleFilterChange = useCallback(
        (key: keyof LogFilters, value: any) => {
            setLogFilters({ ...logFilters, [key]: value === 'all' ? undefined : value });
            setLogsPage(1);
        },
        [logFilters, setLogFilters, setLogsPage]
    );

    // Handle date changes
    const handleDateChange = useCallback(
        (key: 'startDate' | 'endDate', value: string) => {
            setLogFilters({ ...logFilters, [key]: value || undefined });
            setLogsPage(1);
        },
        [logFilters, setLogFilters, setLogsPage]
    );

    // Handle delete logs
    const handleDeleteLogs = useCallback(async () => {
        if (isDeleting) return;
        confirmAlert({
            title: t('logs.confirmDelete.title'),
            message: t('logs.confirmDelete.message'),
            buttons: [
                {
                    label: t('logs.confirmDelete.hardDelete'),
                    onClick: async () => {
                        setIsDeleting(true);
                        try {
                            const filters = Object.fromEntries(
                                Object.entries(logFilters).filter(([_, value]) => value !== undefined && value !== '')
                            );
                            const response = await deleteLogs({
                                ...filters,
                                status: logFilters.status ? Number(logFilters.status) : undefined,
                            });
                            alert(t('logs.deleteSuccess', { count: response.deletedCount }));
                            refreshLogs();
                        } catch (error: any) {
                            alert(t('logs.error.delete', { message: error.message }));
                        } finally {
                            setIsDeleting(false);
                        }
                    },
                },
                {
                    label: t('logs.confirmDelete.softDelete'),
                    onClick: async () => {
                        setIsDeleting(true);
                        try {
                            const filters = Object.fromEntries(
                                Object.entries(logFilters).filter(([_, value]) => value !== undefined && value !== '')
                            );
                            const response = await deleteLogs({
                                ...filters,
                                status: logFilters.status ? Number(logFilters.status) : undefined,
                            });
                            alert(t('logs.deleteSuccess', { count: response.deletedCount }));
                            refreshLogs();
                        } catch (error: any) {
                            alert(t('logs.error.delete', { message: error.message }));
                        } finally {
                            setIsDeleting(false);
                        }
                    },
                },
                {
                    label: t('logs.confirmDelete.cancel'),
                    onClick: () => { },
                },
            ],
        });
    }, [isDeleting, logFilters, refreshLogs, t]);

    // Handle archive logs
    const handleArchiveLogs = useCallback(async () => {
        if (isArchiving) return;
        setIsArchiving(true);
        try {
            const response = await archiveLogs(30);
            alert(t('logs.archiveSuccess', { count: response.deletedCount }));
            refreshLogs();
        } catch (error: any) {
            alert(t('logs.error.archive', { message: error.message }));
        } finally {
            setIsArchiving(false);
        }
    }, [isArchiving, refreshLogs, t]);

    // Handle export logs
    const handleExportLogs = useCallback(async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            const logs = await exportLogs({
                ...logFilters,
                status: logFilters.status ? Number(logFilters.status) : undefined,
            });
            const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `logs_export_${new Date().toISOString()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            alert(t('logs.exportSuccess'));
        } catch (error: any) {
            alert(t('logs.error.export', { message: error.message }));
        } finally {
            setIsExporting(false);
        }
    }, [isExporting, logFilters, t]);

    // Handle clear logs
    const handleClearLogs = useCallback(async () => {
        if (isClearing) return;
        confirmAlert({
            title: t('logs.confirmClear.title'),
            message: t('logs.confirmClear.message'),
            buttons: [
                {
                    label: t('logs.confirmClear.confirm'),
                    onClick: async () => {
                        setIsClearing(true);
                        try {
                            const response = await clearAllLogs();
                            alert(t('logs.clearSuccess', { count: response.deletedCount }));
                            refreshLogs();
                        } catch (error: any) {
                            alert(t('logs.error.clear', { message: error.message }));
                        } finally {
                            setIsClearing(false);
                        }
                    },
                },
                {
                    label: t('logs.confirmClear.cancel'),
                    onClick: () => { },
                },
            ],
        });
    }, [isClearing, refreshLogs, t]);

    // Handle log row click
    const handleLogClick = useCallback((log: Log) => {
        setSelectedLog(log);
    }, []);

    // Filter options
    const levelOptions = useMemo(
        () => [
            { value: 'all', label: t('logs.allLevels') },
            ...uniqueLevels.map((level) => ({ value: level, label: level })),
        ],
        [uniqueLevels, t]
    );

    const routeOptions = useMemo(
        () => [
            { value: 'all', label: t('logs.allRoutes') },
            ...uniqueRoutes.map((route) => ({ value: route, label: route })),
        ],
        [uniqueRoutes, t]
    );

    const serviceOptions = useMemo(
        () => [
            { value: 'all', label: t('logs.allServices') },
            ...uniqueServices.map((service) => ({ value: service, label: service })),
        ],
        [uniqueServices, t]
    );

    const methodOptions = useMemo(
        () => [
            { value: 'all', label: t('logs.allMethods') },
            ...uniqueMethods.map((method) => ({ value: method, label: method })),
        ],
        [uniqueMethods, t]
    );

    const userIdOptions = useMemo(
        () => [
            { value: 'all', label: t('logs.allUsers') },
            ...uniqueUserIds.map((userId) => ({ value: userId, label: userId })),
        ],
        [uniqueUserIds, t]
    );

    return (
        <div className="table-card">
            <h2>{t('adminDashboard.header.logs')}</h2>
            <div className="logs-controls">
                <div className="action-buttons">
                    <button
                        onClick={() => setShowFilterPopup(true)}
                        aria-label={t('logs.filterLogs')}
                        className="action-button-0"
                    >
                        <FaCog /> {t('logs.filterLogs')}
                    </button>
                    <button
                        onClick={handleDeleteLogs}
                        disabled={isDeleting}
                        aria-label={t('logs.deleteLogs')}
                        className="action-button-0 danger"
                    >
                        <FaTrash /> {isDeleting ? t('logs.deleting') : t('logs.deleteLogs')}
                    </button>
                    <button
                        onClick={handleArchiveLogs}
                        disabled={isArchiving}
                        aria-label={t('logs.archiveLogs')}
                        className="action-button-0"
                    >
                        <FaArchive /> {isArchiving ? t('logs.archiving') : t('logs.archiveLogs')}
                    </button>
                    <button
                        onClick={handleExportLogs}
                        disabled={isExporting}
                        aria-label={t('logs.exportLogs')}
                        className="action-button-0"
                    >
                        <FaDownload /> {isExporting ? t('logs.exporting') : t('logs.exportLogs')}
                    </button>
                    <button
                        onClick={handleClearLogs}
                        disabled={isClearing}
                        aria-label={t('logs.clearLogs')}
                        className="action-button-0 danger"
                    >
                        <FaTrash /> {isClearing ? t('logs.clearing') : t('logs.clearLogs')}
                    </button>
                    <button
                        onClick={() => {
                            setShowStats(!showStats);
                            if (!showStats) fetchStatistics();
                        }}
                        aria-label={t('logs.toggleStats')}
                        className="action-button-0"
                    >
                        <FaChartBar /> {showStats ? t('logs.hideStats') : t('logs.showStats')}
                    </button>
                </div>
            </div>

            {/* Filter Popup */}
            {showFilterPopup && (
                <div className="modal-overlay">
                    <div className="modal-content-44">
                        <div className="modal-header">
                            <h3>{t('logs.filterLogs')}</h3>
                            <button
                                onClick={() => setShowFilterPopup(false)}
                                className="modal-close"
                                aria-label={t('logs.closeFilter')}
                            >
                                <FaTimes />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="filter-section">
                                <label>{t('logs.filterByLevel')}</label>
                                <Select
                                    options={levelOptions}
                                    value={levelOptions.find((opt) => opt.value === (logFilters.level || 'all'))}
                                    onChange={(opt) => handleFilterChange('level', opt?.value)}
                                    placeholder={t('logs.filterByLevel')}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                />
                                <label>{t('logs.filterByRoute')}</label>
                                <Select
                                    options={routeOptions}
                                    value={routeOptions.find((opt) => opt.value === (logFilters.route || 'all'))}
                                    onChange={(opt) => handleFilterChange('route', opt?.value)}
                                    placeholder={t('logs.filterByRoute')}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                />
                                <label>{t('logs.filterByService')}</label>
                                <Select
                                    options={serviceOptions}
                                    value={serviceOptions.find((opt) => opt.value === (logFilters.service || 'all'))}
                                    onChange={(opt) => handleFilterChange('service', opt?.value)}
                                    placeholder={t('logs.filterByService')}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                />
                                <label>{t('logs.filterByMethod')}</label>
                                <Select
                                    options={methodOptions}
                                    value={methodOptions.find((opt) => opt.value === (logFilters.method || 'all'))}
                                    onChange={(opt) => handleFilterChange('method', opt?.value)}
                                    placeholder={t('logs.filterByMethod')}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                />
                                <label>{t('logs.filterByUserId')}</label>
                                <Select
                                    options={userIdOptions}
                                    value={userIdOptions.find((opt) => opt.value === (logFilters.userId || 'all'))}
                                    onChange={(opt) => handleFilterChange('userId', opt?.value)}
                                    placeholder={t('logs.filterByUserId')}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                />
                                <label>{t('logs.filterByTraceId')}</label>
                                <input
                                    type="text"
                                    placeholder={t('logs.filterByTraceId')}
                                    value={logFilters.traceId || ''}
                                    onChange={(e) => handleFilterChange('traceId', e.target.value)}
                                    className="filter-input"
                                />
                                <label>{t('logs.filterByStatus')}</label>
                                <input
                                    type="number"
                                    placeholder={t('logs.filterByStatus')}
                                    value={logFilters.status || ''}
                                    onChange={(e) => handleFilterChange('status', e.target.value ? Number(e.target.value) : undefined)}
                                    className="filter-input"
                                />
                                <label>{t('logs.filterBySearch')}</label>
                                <input
                                    type="text"
                                    placeholder={t('logs.filterBySearch')}
                                    value={logFilters.search || ''}
                                    onChange={(e) => handleFilterChange('search', e.target.value)}
                                    className="filter-input"
                                />
                                <label>{t('logs.filterByStartDate')}</label>
                                <input
                                    type="date"
                                    value={logFilters.startDate || ''}
                                    onChange={(e) => handleDateChange('startDate', e.target.value)}
                                    className="filter-input"
                                />
                                <label>{t('logs.filterByEndDate')}</label>
                                <input
                                    type="date"
                                    value={logFilters.endDate || ''}
                                    onChange={(e) => handleDateChange('endDate', e.target.value)}
                                    className="filter-input"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                onClick={() => {
                                    setShowFilterPopup(false);
                                    refreshLogs();
                                }}
                                className="action-button-0"
                            >
                                {t('logs.applyFilters')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Log Details Popup */}
            {selectedLog && (
                <div className="modal-overlay">
                    <div className="modal-content-44">
                        <div className="modal-header">
                            <h3>{t('logs.logDetails')}</h3>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="modal-close"
                                aria-label={t('logs.closeDetails')}
                            >
                                <FaTimes />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="log-details">
                                <p><strong>{t('logs.logID')}:</strong> {selectedLog.logID}</p>
                                <p><strong>{t('logs.timestamp')}:</strong> {new Date(selectedLog.timestamp).toLocaleString()}</p>
                                <p><strong>{t('logs.level')}:</strong> {selectedLog.level}</p>
                                <p><strong>{t('logs.message')}:</strong> {selectedLog.message}</p>
                                <p><strong>{t('logs.userId')}:</strong> {selectedLog.userId || 'N/A'}</p>
                                <p><strong>{t('logs.traceId')}:</strong> {selectedLog.traceId}</p>
                                <p><strong>{t('logs.route')}:</strong> {selectedLog.route || 'N/A'}</p>
                                <p><strong>{t('logs.service')}:</strong> {selectedLog.service || 'N/A'}</p>
                                <p><strong>{t('logs.method')}:</strong> {selectedLog.method || 'N/A'}</p>
                                <p><strong>{t('logs.status')}:</strong> {selectedLog.status || 'N/A'}</p>
                                <p><strong>{t('logs.ip')}:</strong> {selectedLog.ip || 'N/A'}</p>
                                <p><strong>{t('logs.url')}:</strong> {selectedLog.url || 'N/A'}</p>
                                <p><strong>{t('logs.metadata')}:</strong> {selectedLog.metadata ? JSON.stringify(selectedLog.metadata, null, 2) : 'N/A'}</p>
                                <p><strong>{t('logs.createdAt')}:</strong> {selectedLog.createdAt ? new Date(selectedLog.createdAt).toLocaleString() : 'N/A'}</p>
                                <p><strong>{t('logs.updatedAt')}:</strong> {selectedLog.updatedAt ? new Date(selectedLog.updatedAt).toLocaleString() : 'N/A'}</p>
                                <p><strong>{t('logs.deletedAt')}:</strong> {selectedLog.deletedAt ? new Date(selectedLog.deletedAt).toLocaleString() : 'N/A'}</p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="action-button-0"
                            >
                                {t('logs.closeDetails')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Statistics Panel */}
            {showStats && (
                <div className="stats-panel">
                    <h3>{t('logs.statistics')}</h3>
                    <p>{t('logs.totalLogs', { count: logStatistics.database?.total || 0 })}</p>
                    <p>{t('logs.uniqueUsers', { count: logStatistics.database?.uniqueUsers || 0 })}</p>
                    <h4>{t('logs.byLevel')}</h4>
                    <div className="chart-container">
                        <Bar
                            options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t('logs.byLevel') } } }}
                            data={levelChartData}
                        />
                    </div>
                    <h4>{t('logs.byRoute')}</h4>
                    <div className="chart-container">
                        <Bar
                            options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t('logs.byRoute') } } }}
                            data={routeChartData}
                        />
                    </div>
                    <h4>{t('logs.byService')}</h4>
                    <div className="chart-container">
                        <Bar
                            options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t('logs.byService') } } }}
                            data={serviceChartData}
                        />
                    </div>
                    <h4>{t('logs.byStatus')}</h4>
                    <div className="chart-container">
                        <Bar
                            options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t('logs.byStatus') } } }}
                            data={statusChartData}
                        />
                    </div>
                    <h4>{t('logs.byMethod')}</h4>
                    <div className="chart-container">
                        <Bar
                            options={{ ...chartOptions, plugins: { ...chartOptions.plugins, title: { ...chartOptions.plugins.title, text: t('logs.byMethod') } } }}
                            data={methodChartData}
                        />
                    </div>
                    <p>{t('logs.healthStatus', { status: healthStatus })}</p>
                </div>
            )}

            {/* Logs Table */}
            {logsLoading ? (
                <div>{t('adminDashboard.loading.logs')}</div>
            ) : (
                <>
                    <div className="table-container">
                        <div className="table-head">
                            <div className="table-row table-row-44">
                                <div className="table-cell" onClick={() => handleSort('timestamp')}>
                                    {t('logs.timestamp')}
                                    {logSortField === 'timestamp' && (logSortOrder === 'asc' ? ' ▲' : ' ▼')}
                                </div>
                                <div className="table-cell" onClick={() => handleSort('level')}>
                                    {t('logs.level')}
                                    {logSortField === 'level' && (logSortOrder === 'asc' ? ' ▲' : ' ▼')}
                                </div>
                                <div className="table-cell" onClick={() => handleSort('traceId')}>
                                    {t('logs.traceId')}
                                    {logSortField === 'traceId' && (logSortOrder === 'asc' ? ' ▲' : ' ▼')}
                                </div>
                                <div className="table-cell">{t('logs.route')}</div>
                                <div className="table-cell">{t('logs.service')}</div>
                                <div className="table-cell">{t('logs.method')}</div>
                                <div className="table-cell">{t('logs.status')}</div>
                                <div className="table-cell">{t('logs.actions')}</div>
                            </div>
                        </div>
                        <div className="table-body">
                            {logs.length === 0 ? (
                                <div className="table-row table-row-44">
                                    <div className="table-cell">{t('adminDashboard.noItems.logs')}</div>
                                </div>
                            ) : (
                                logs.map((log) => (
                                    <div
                                        key={log.logID}
                                        className="table-row table-row-44"
                                        onClick={() => handleLogClick(log)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="table-cell">{new Date(log.timestamp).toLocaleString()}</div>
                                        <div className="table-cell">{log.level}</div>
                                        <div className="table-cell">{log.traceId}</div>
                                        <div className="table-cell">{log.route || 'N/A'}</div>
                                        <div className="table-cell">{log.service || 'N/A'}</div>
                                        <div className="table-cell">{log.method || 'N/A'}</div>
                                        <div className="table-cell">{log.status || 'N/A'}</div>
                                        <div className="table-cell actions">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleLogClick(log);
                                                }}
                                                className="action-button-0 action-button-55"
                                                aria-label={t('logs.viewDetails')}
                                            >
                                                <FaInfoCircle />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    {totalPages > 1 && (
                        <div className="pagination">
                            <button
                                onClick={() => setLogsPage(Math.max(logsPage - 1, 1))}
                                disabled={logsPage === 1}
                                aria-label={t('adminDashboard.pagination.aria.previous')}
                            >
                                {t('adminDashboard.pagination.previous')}
                            </button>
                            <span>
                                {t('adminDashboard.pagination.page', { page: logsPage, total: totalPages })}
                            </span>
                            <button
                                onClick={() => setLogsPage(Math.min(logsPage + 1, totalPages))}
                                disabled={logsPage === totalPages}
                                aria-label={t('adminDashboard.pagination.aria.next')}
                            >
                                {t('adminDashboard.pagination.next')}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default LogsList;
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Log } from '../../models/log';
import './AdminDashboard.css';

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
}) => {
    const { t } = useTranslation();
    const total = Math.ceil(totalLogs / itemsPerPage);

    const handleSort = (field: string) => {
        if (logSortField === field) {
            setLogSortOrder(logSortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setLogSortField(field);
            setLogSortOrder('asc');
        }
    };

    return (
        <div className="table-card">
            <h2>{t("adminDashboard.header.logs")}</h2>
            {logsLoading ? (
                <div>{t("adminDashboard.loading.logs")}</div>
            ) : (
                <>
                    <div className="table-container">
                        <div className="table-head">
                            <div className="table-row table-row-44">
                                <div className="table-cell" onClick={() => handleSort('timestamp')}>
                                    {t("logs.timestamp")}
                                    {logSortField === 'timestamp' && (logSortOrder === 'asc' ? ' ▲' : ' ▼')}
                                </div>
                                <div className="table-cell" onClick={() => handleSort('level')}>
                                    {t("logs.level")}
                                    {logSortField === 'level' && (logSortOrder === 'asc' ? ' ▲' : ' ▼')}
                                </div>
                                <div className="table-cell" onClick={() => handleSort('message')}>
                                    {t("logs.message")}
                                    {logSortField === 'message' && (logSortOrder === 'asc' ? ' ▲' : ' ▼')}
                                </div>
                                <div className="table-cell">{t("logs.userId")}</div>
                                <div className="table-cell">{t("logs.traceId")}</div>
                            </div>
                        </div>
                        <div className="table-body">
                            {logs.length === 0 ? (
                                <div className="table-row table-row-44">
                                    <div className="table-cell">
                                        {t("adminDashboard.noItems.logs")}
                                    </div>
                                </div>
                            ) : (
                                logs.map((log) => (
                                    <div key={log.logID} className="table-row table-row-44">
                                        <div className="table-cell">{new Date(log.timestamp).toLocaleString()}</div>
                                        <div className="table-cell">{log.level}</div>
                                        <div className="table-cell">{log.message}</div>
                                        <div className="table-cell">{log.userId || 'N/A'}</div>
                                        <div className="table-cell">{log.traceId}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    {totalLogs > itemsPerPage && (
                        <div className="pagination">
                            <button
                                onClick={() => setLogsPage(Math.max(logsPage - 1, 1))}
                                disabled={logsPage === 1}
                                aria-label={t('adminDashboard.pagination.aria.previous')}
                            >
                                {t("adminDashboard.pagination.previous")}
                            </button>
                            <span>
                                {t("adminDashboard.pagination.page", { page: logsPage, total })}
                            </span>
                            <button
                                onClick={() => setLogsPage(Math.min(logsPage + 1, total))}
                                disabled={logsPage === total}
                                aria-label={t('adminDashboard.pagination.aria.next')}
                            >
                                {t("adminDashboard.pagination.next")}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default LogsList;
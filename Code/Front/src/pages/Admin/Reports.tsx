import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaDownload } from 'react-icons/fa';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { getAllUsers } from '../../apis/userAPI';
import { getAllRegions } from '../../apis/locationApi';
import { getAllAgents } from '../../apis/agentAPI';
import { getAllReceiptBookTypes } from '../../apis/receiptBookAPI';
import { generateReport, scheduleReport, downloadReport } from '../../apis/reportAPI';
import User from '../../models/User';
import Region from '../../models/Region';
import Agent from '../../models/Agent';
import ReceiptBookType from '../../models/ReceiptBookType';
import { ReportFilters, ReportType } from '../../models/Report';
import './Reports.css';

interface SelectOption {
    value: string;
    label: string;
}

const Reports: React.FC = () => {
    const { t } = useTranslation();
    const [reportType, setReportType] = useState<ReportType | ''>('');
    const [filters, setFilters] = useState<ReportFilters>({});
    const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
    const [reportPath, setReportPath] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [supervisors, setSupervisors] = useState<User[]>([]);
    const [regionalManagers, setRegionalManagers] = useState<User[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [receiptBookTypes, setReceiptBookTypes] = useState<ReceiptBookType[]>([]);
    const [isScheduling, setIsScheduling] = useState(false);
    const [cronExpression, setCronExpression] = useState('');
    const [cronError, setCronError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const users = await getAllUsers();
                setSupervisors(users.filter(user => user.Roles?.some(role => role.name === 'Supervisor')));
                setRegionalManagers(users.filter(user => user.Roles?.some(role => role.name === 'RegionalManager')));
                const regionsData = await getAllRegions();
                setRegions(regionsData);
                const agentsData = await getAllAgents();
                setAgents(agentsData.agents);
                const bookTypes = await getAllReceiptBookTypes();
                setReceiptBookTypes(bookTypes);
            } catch (err) {
                setError(t('reports.errors.fetchFailed'));
            }
        };
        fetchData();
    }, [t]);

    const reportTypes: SelectOption[] = [
        { value: 'VisitSummary', label: t('reports.visitSummary') },
        { value: 'Timesheet', label: t('reports.timesheet') },
        { value: 'ReceiptBookInventory', label: t('reports.receiptBookInventory') },
        { value: 'StubCollection', label: t('reports.stubCollection') },
        { value: 'UserActivity', label: t('reports.userActivity') },
        { value: 'AIAnomaly', label: t('reports.aiAnomaly') },
        { value: 'AgentPerformance', label: t('reports.agentPerformance') },
        { value: 'RegionPerformance', label: t('reports.regionPerformance') },
        { value: 'Full', label: t('reports.fullReport') },
    ];

    const validateCron = (expression: string): boolean => {
        const cronRegex = /^(\*|[0-5]?[0-9])(\/[0-5]?[0-9])? (\*|[0-5]?[0-9])(\/[0-5]?[0-9])? (\*|[0-2]?[0-9])(\/[0-2]?[0-9])? (\*|[1-9]|1[0-2])(\/[1-9]|1[0-2])? (\*|[0-7])(\/[0-7])?$/;
        return cronRegex.test(expression);
    };

    const handleReportTypeChange = (value: string) => {
        setReportType(value as ReportType);
        setFilters({});
        setReportPath(null);
        setError(null);
    };

    const handleFilterChange = (key: string, value: string | { start: string; end: string }) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleGenerateReport = async () => {
        if (!reportType) {
            setError(t('reports.errors.selectReportType'));
            return;
        }
        if (filters.dateRange && (!filters.dateRange.start || !filters.dateRange.end)) {
            setError(t('reports.errors.invalidDateRange'));
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await generateReport(reportType as ReportType, filters, format);
            setReportPath(response.reportPath);
        } catch (err: any) {
            setError(err.message || t('reports.errors.generateFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadReport = async () => {
        if (reportPath) {
            try {
                const fileName = reportPath.split('file=')[1];
                const blob = await downloadReport(fileName);
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                setReportPath(null); // Clear after download
            } catch (err: any) {
                setError(err.message || t('reports.errors.downloadFailed'));
            }
        }
    };

    const handleScheduleReport = async () => {
        if (!reportType) {
            setError(t('reports.errors.selectReportType'));
            return;
        }
        if (!cronExpression || !validateCron(cronExpression)) {
            setCronError(t('reports.errors.invalidCron'));
            return;
        }
        if (filters.dateRange && (!filters.dateRange.start || !filters.dateRange.end)) {
            setError(t('reports.errors.invalidDateRange'));
            return;
        }
        setIsLoading(true);
        setError(null);
        setCronError(null);
        try {
            const response = await scheduleReport(reportType as ReportType, filters, format, cronExpression);
            setError(null);
            setIsScheduling(false);
            setCronExpression('');
            setError(t('reports.scheduleSuccess', { scheduleID: response.scheduleID }));
        } catch (err: any) {
            setError(err.message || t('reports.errors.scheduleFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const renderSelect = (label: string, options: SelectOption[], onChange: (value: string) => void, value?: string) => (
        <div className="select-wrapper">
            <label className="form-label">{label}</label>
            <Select onValueChange={onChange} value={value}>
                <SelectTrigger>
                    <SelectValue placeholder={t('reports.selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                    {options.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );

    const renderDateRange = () => (
        <div className="date-range-wrapper">
            <label className="form-label">{t('reports.filters.dateRange')}</label>
            <div className="date-inputs">
                <input
                    type="date"
                    className="form-input"
                    value={filters.dateRange?.start || ''}
                    onChange={e => handleFilterChange('dateRange', { start: e.target.value, end: filters.dateRange?.end || '' })}
                />
                <span>{t('reports.filters.to')}</span>
                <input
                    type="date"
                    className="form-input"
                    value={filters.dateRange?.end || ''}
                    onChange={e => handleFilterChange('dateRange', { start: filters.dateRange?.start || '', end: e.target.value })}
                />
            </div>
        </div>
    );

    const renderFilters = () => {
        switch (reportType) {
            case 'VisitSummary':
                return (
                    <>
                        {renderSelect(
                            t('reports.filters.supervisor'),
                            supervisors.map(user => ({ value: user.userID, label: `${user.firstname} ${user.lastname}` })),
                            value => handleFilterChange('supervisorID', value),
                            filters.supervisorID
                        )}
                        {renderDateRange()}
                        {renderSelect(
                            t('reports.filters.region'),
                            regions.map(region => ({ value: region.regionID, label: region.name })),
                            value => handleFilterChange('regionID', value),
                            filters.regionID
                        )}
                        {renderSelect(
                            t('reports.filters.agent'),
                            agents.map(agent => ({ value: agent.agentID, label: `${agent.name} ${agent.lastname}` })),
                            value => handleFilterChange('agentID', value),
                            filters.agentID
                        )}
                        {renderSelect(
                            t('reports.filters.status'),
                            [
                                { value: 'completed', label: t('reports.status.completed') },
                                { value: 'pending', label: t('reports.status.pending') },
                            ],
                            value => handleFilterChange('status', value),
                            filters.status
                        )}
                    </>
                );
            case 'Timesheet':
                return (
                    <>
                        {renderSelect(
                            t('reports.filters.supervisor'),
                            supervisors.map(user => ({ value: user.userID, label: `${user.firstname} ${user.lastname}` })),
                            value => handleFilterChange('supervisorID', value),
                            filters.supervisorID
                        )}
                        {renderSelect(
                            t('reports.filters.regionalManager'),
                            regionalManagers.map(user => ({ value: user.userID, label: `${user.firstname} ${user.lastname}` })),
                            value => handleFilterChange('regionalManagerID', value),
                            filters.regionalManagerID
                        )}
                        {renderDateRange()}
                        {renderSelect(
                            t('reports.filters.status'),
                            [
                                { value: 'validated', label: t('reports.status.validated') },
                                { value: 'pending', label: t('reports.status.pending') },
                                { value: 'anomaly', label: t('reports.status.anomaly') },
                            ],
                            value => handleFilterChange('status', value),
                            filters.status
                        )}
                    </>
                );
            case 'ReceiptBookInventory':
                return (
                    <>
                        {renderDateRange()}
                        {renderSelect(
                            t('reports.filters.region'),
                            regions.map(region => ({ value: region.regionID, label: region.name })),
                            value => handleFilterChange('regionID', value),
                            filters.regionID
                        )}
                        {renderSelect(
                            t('reports.filters.bookType'),
                            receiptBookTypes.map(type => ({ value: type.typeID, label: type.name })),
                            value => handleFilterChange('bookType', value),
                            filters.bookType
                        )}
                        {renderSelect(
                            t('reports.filters.status'),
                            [
                                { value: 'In Stock', label: t('reports.status.inStock') },
                                { value: 'Assigned to Agent', label: t('reports.status.assigned') },
                                { value: 'Stub Collected', label: t('reports.status.collected') },
                            ],
                            value => handleFilterChange('status', value),
                            filters.status
                        )}
                    </>
                );
            case 'StubCollection':
                return (
                    <>
                        {renderSelect(
                            t('reports.filters.agent'),
                            agents.map(agent => ({ value: agent.agentID, label: `${agent.name} ${agent.lastname}` })),
                            value => handleFilterChange('agentID', value),
                            filters.agentID
                        )}
                        {renderSelect(
                            t('reports.filters.supervisor'),
                            supervisors.map(user => ({ value: user.userID, label: `${user.firstname} ${user.lastname}` })),
                            value => handleFilterChange('supervisorID', value),
                            filters.supervisorID
                        )}
                        {renderSelect(
                            t('reports.filters.regionalManager'),
                            regionalManagers.map(user => ({ value: user.userID, label: `${user.firstname} ${user.lastname}` })),
                            value => handleFilterChange('regionalManagerID', value),
                            filters.regionalManagerID
                        )}
                        {renderDateRange()}
                        {renderSelect(
                            t('reports.filters.status'),
                            [
                                { value: 'collected', label: t('reports.status.collected') },
                                { value: 'pending', label: t('reports.status.pending') },
                                { value: 'archived', label: t('reports.status.archived') },
                            ],
                            value => handleFilterChange('status', value),
                            filters.status
                        )}
                    </>
                );
            case 'UserActivity':
                return (
                    <>
                        {renderSelect(
                            t('reports.filters.role'),
                            [
                                { value: '1', label: t('reports.roles.admin') },
                                { value: '2', label: t('reports.roles.supervisor') },
                                { value: '3', label: t('reports.roles.regionalManager') },
                            ],
                            value => handleFilterChange('roleID', value),
                            filters.roleID
                        )}
                        {renderDateRange()}
                        {renderSelect(
                            t('reports.filters.activityType'),
                            [
                                { value: '/api/auth/login', label: t('reports.activity.login') },
                                { value: '/api/visits', label: t('reports.activity.visits') },
                                { value: '/api/timesheets', label: t('reports.activity.timesheets') },
                            ],
                            value => handleFilterChange('activityType', value),
                            filters.activityType
                        )}
                    </>
                );
            case 'AIAnomaly':
                return (
                    <>
                        {renderDateRange()}
                        {renderSelect(
                            t('reports.filters.anomalyType'),
                            [
                                { value: 'login_failed', label: t('reports.anomaly.loginFailed') },
                                { value: 'timesheet_anomaly', label: t('reports.anomaly.timesheet') },
                                { value: 'visit_anomaly', label: t('reports.anomaly.visit') },
                            ],
                            value => handleFilterChange('anomalyType', value),
                            filters.anomalyType
                        )}
                        {renderSelect(
                            t('reports.filters.role'),
                            [
                                { value: '1', label: t('reports.roles.admin') },
                                { value: '2', label: t('reports.roles.supervisor') },
                                { value: '3', label: t('reports.roles.regionalManager') },
                            ],
                            value => handleFilterChange('roleID', value),
                            filters.roleID
                        )}
                    </>
                );
            case 'AgentPerformance':
                return (
                    <>
                        {renderSelect(
                            t('reports.filters.supervisor'),
                            supervisors.map(user => ({ value: user.userID, label: `${user.firstname} ${user.lastname}` })),
                            value => handleFilterChange('supervisorID', value),
                            filters.supervisorID
                        )}
                        {renderSelect(
                            t('reports.filters.regionalManager'),
                            regionalManagers.map(user => ({ value: user.userID, label: `${user.firstname} ${user.lastname}` })),
                            value => handleFilterChange('regionalManagerID', value),
                            filters.regionalManagerID
                        )}
                        {renderDateRange()}
                        {renderSelect(
                            t('reports.filters.agent'),
                            agents.map(agent => ({ value: agent.agentID, label: `${agent.name} ${agent.lastname}` })),
                            value => handleFilterChange('agentID', value),
                            filters.agentID
                        )}
                    </>
                );
            case 'RegionPerformance':
                return (
                    <>
                        {renderSelect(
                            t('reports.filters.regionalManager'),
                            regionalManagers.map(user => ({ value: user.userID, label: `${user.firstname} ${user.lastname}` })),
                            value => handleFilterChange('regionalManagerID', value),
                            filters.regionalManagerID
                        )}
                        {renderDateRange()}
                        {renderSelect(
                            t('reports.filters.region'),
                            regions.map(region => ({ value: region.regionID, label: region.name })),
                            value => handleFilterChange('regionID', value),
                            filters.regionID
                        )}
                    </>
                );
            case 'Full':
                return (
                    <>
                        {renderSelect(
                            t('reports.filters.supervisor'),
                            supervisors.map(user => ({ value: user.userID, label: `${user.firstname} ${user.lastname}` })),
                            value => handleFilterChange('supervisorID', value),
                            filters.supervisorID
                        )}
                        {renderSelect(
                            t('reports.filters.regionalManager'),
                            regionalManagers.map(user => ({ value: user.userID, label: `${user.firstname} ${user.lastname}` })),
                            value => handleFilterChange('regionalManagerID', value),
                            filters.regionalManagerID
                        )}
                        {renderDateRange()}
                        {renderSelect(
                            t('reports.filters.region'),
                            regions.map(region => ({ value: region.regionID, label: region.name })),
                            value => handleFilterChange('regionID', value),
                            filters.regionID
                        )}
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <div className="reports-page">
            <h1>{t('reports.title')}</h1>
            <div className="report-form">
                {renderSelect(
                    t('reports.selectReportType'),
                    reportTypes,
                    handleReportTypeChange,
                    reportType
                )}
                {reportType && (
                    <div className="filters-section">
                        <h3>{t('reports.filters.title')}</h3>
                        {renderFilters()}
                    </div>
                )}
                {renderSelect(
                    t('reports.selectFormat'),
                    [
                        { value: 'pdf', label: 'PDF' },
                        { value: 'excel', label: 'Excel' },
                    ],
                    value => setFormat(value as 'pdf' | 'excel'),
                    format
                )}
                <div className="action-buttons">
                    <button
                        className="action-button"
                        onClick={handleGenerateReport}
                        disabled={isLoading || !reportType}
                    >
                        {isLoading ? t('reports.generating') : t('reports.generate')}
                    </button>
                    <button
                        className="action-button"
                        onClick={() => setIsScheduling(!isScheduling)}
                        disabled={!reportType}
                    >
                        {isScheduling ? t('reports.cancelSchedule') : t('reports.scheduleToggle')}
                    </button>
                </div>
            </div>
            {isScheduling && (
                <div className="schedule-section">
                    <h2>{t('reports.scheduleReport')}</h2>
                    <div className="cron-input-wrapper">
                        <label className="form-label">{t('reports.cronExpression')}</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g., 0 0 * * * (daily at midnight)"
                            value={cronExpression}
                            onChange={e => setCronExpression(e.target.value)}
                        />
                        {cronError && <div className="error-message">{cronError}</div>}
                    </div>
                    <button
                        className="action-button"
                        onClick={handleScheduleReport}
                        disabled={isLoading || !cronExpression}
                    >
                        {t('reports.schedule')}
                    </button>
                </div>
            )}
            {reportPath && (
                <div className="report-download">
                    <button className="action-button" onClick={handleDownloadReport}>
                        <FaDownload /> {t('reports.downloadReport')}
                    </button>
                </div>
            )}
            {error && <div className="error-message">{error}</div>}
        </div>
    );
};

export default Reports;
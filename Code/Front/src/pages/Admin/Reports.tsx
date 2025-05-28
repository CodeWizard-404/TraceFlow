import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaDownload } from 'react-icons/fa';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { getAllUsers } from '../../apis/userAPI';
import { getAllRegions } from '../../apis/locationApi';
import { getAllAgents } from '../../apis/agentAPI';
import { generateReport, scheduleReport, downloadReport } from '../../apis/reportAPI';
import User from '../../models/User';
import Region from '../../models/Region';
import Agent from '../../models/Agent';
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
    const [regions, setRegions] = useState<Region[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [isScheduling, setIsScheduling] = useState(false);
    const [cronExpression, setCronExpression] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const users = await getAllUsers();
                setSupervisors(users.filter(user => user.Roles!.some(role => role.name === 'Supervisor')));
                const regionsData = await getAllRegions();
                setRegions(regionsData);
                const agentsData = await getAllAgents();
                setAgents(agentsData.agents);
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

    const handleReportTypeChange = (value: string) => {
        setReportType(value as ReportType);
        setFilters({});
    };

    const handleFilterChange = (key: string, value: string | { start: string; end: string }) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleGenerateReport = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await generateReport(reportType as ReportType, filters, format);
            setReportPath(response.reportPath);
        } catch (err: any) {
            setError(t('reports.errors.generateFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadReport = async () => {
        if (reportPath) {
            try {
                const fileName = reportPath.split('file=')[1];
                const url = await downloadReport(fileName);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            } catch (err: any) {
                setError(t('reports.errors.downloadFailed'));
            }
        }
    };

    const handleScheduleReport = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await scheduleReport(reportType as ReportType, filters, format, cronExpression);
            setError(null);
            setIsScheduling(false);
            setCronExpression('');
        } catch (err: any) {
            setError(t('reports.errors.scheduleFailed'));
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
                        <input
                            type="date"
                            className="form-input"
                            onChange={e => handleFilterChange('dateRange', { start: e.target.value, end: filters.dateRange?.end || '' })}
                        />
                        <input
                            type="date"
                            className="form-input"
                            onChange={e => handleFilterChange('dateRange', { start: filters.dateRange?.start || '', end: e.target.value })}
                        />
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
                        <input
                            type="date"
                            className="form-input"
                            onChange={e => handleFilterChange('dateRange', { start: e.target.value, end: filters.dateRange?.end || '' })}
                        />
                        <input
                            type="date"
                            className="form-input"
                            onChange={e => handleFilterChange('dateRange', { start: filters.dateRange?.start || '', end: e.target.value })}
                        />
                        {renderSelect(
                            t('reports.filters.status'),
                            [
                                { value: 'validated', label: t('reports.status.validated') },
                                { value: 'pending', label: t('reports.status.pending') },
                            ],
                            value => handleFilterChange('status', value),
                            filters.status
                        )}
                    </>
                );
            case 'Full':
                return (
                    <>
                        {renderSelect(
                            t('reports.filters.filterBy'),
                            [
                                { value: 'supervisor', label: t('reports.filters.supervisor') },
                                { value: 'regionalManager', label: t('reports.filters.regionalManager') },
                            ],
                            value => handleFilterChange('filterBy', value),
                            filters.filterBy
                        )}
                        {filters.filterBy === 'supervisor' && renderSelect(
                            t('reports.filters.supervisor'),
                            supervisors.map(user => ({ value: user.userID, label: `${user.firstname} ${user.lastname}` })),
                            value => handleFilterChange('supervisorID', value),
                            filters.supervisorID
                        )}
                        {filters.filterBy === 'regionalManager' && renderSelect(
                            t('reports.filters.regionalManager'),
                            supervisors.map(user => ({ value: user.userID, label: `${user.firstname} ${user.lastname}` })),
                            value => handleFilterChange('regionalManagerID', value),
                            filters.regionalManagerID
                        )}
                        <input
                            type="date"
                            className="form-input"
                            onChange={e => handleFilterChange('dateRange', { start: e.target.value, end: filters.dateRange?.end || '' })}
                        />
                        <input
                            type="date"
                            className="form-input"
                            onChange={e => handleFilterChange('dateRange', { start: filters.dateRange?.start || '', end: e.target.value })}
                        />
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
                {reportType && renderFilters()}
                {renderSelect(
                    t('reports.selectFormat'),
                    [
                        { value: 'pdf', label: 'PDF' },
                        { value: 'excel', label: 'Excel' },
                    ],
                    value => setFormat(value as 'pdf' | 'excel'),
                    format
                )}
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
                    {t('reports.scheduleToggle')}
                </button>
            </div>
            {isScheduling && (
                <div className="schedule-section">
                    <h2>{t('reports.scheduleReport')}</h2>
                    <input
                        type="text"
                        className="form-input"
                        placeholder={t('reports.cronExpression')}
                        value={cronExpression}
                        onChange={e => setCronExpression(e.target.value)}
                    />
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
                        <FaDownload /> {t('reports.download')}
                    </button>
                </div>
            )}
            {error && <div className="error">{error}</div>}
        </div>
    );
};

export default Reports;
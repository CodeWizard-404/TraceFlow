import React, { useState, useEffect, useCallback } from 'react';
import { FaTrash, FaDownload, FaChartBar, FaBell } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Chart as ChartJS, BarElement, PieController, ArcElement, CategoryScale, LinearScale, Legend, Tooltip } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import {
  generateReport,
  scheduleReport,
  downloadReport,
  listSchedules,
  listGeneratedReports,
  deleteSchedule,
  ReportSchedule,
  GeneratedReport,
} from '../../apis/reportAPI';
import { getUsersByRole } from '../../apis/userAPI';
import { getAllRegions } from '../../apis/locationApi';
import { getAllAgents } from '../../apis/agentAPI';
import { Region } from '../../models/Region';
import { User } from '../../models/User';
import Agent from '../../models/Agent';
import './Reports.css';

ChartJS.register(BarElement, PieController, ArcElement, CategoryScale, LinearScale, Legend, Tooltip);

const reportTypes = [
  'VisitSummary', 'Timesheet', 'ReceiptBookInventory', 'StubCollection',
  'UserActivity', 'AIAnomaly', 'AgentPerformance', 'RegionPerformance', 'Full',
];

// Dynamic filter configurations
const filterConfigs: Record<string, Array<{ type: string; label: string; options?: string[] }>> = {
  VisitSummary: [
    { type: 'dateRange', label: 'Date Range' },
    { type: 'select', label: 'Status', options: ['pending', 'validated'] },
    { type: 'select', label: 'Region', options: [] },
    { type: 'select', label: 'Supervisor', options: [] },
    { type: 'select', label: 'Agent', options: [] },
  ],
  Timesheet: [
    { type: 'dateRange', label: 'Date Range' },
    { type: 'select', label: 'Supervisor', options: [] },
    { type: 'select', label: 'Status', options: ['pending', 'validated'] },
  ],
  ReceiptBookInventory: [
    { type: 'select', label: 'Status', options: ['in_stock', 'assigned', 'archived'] },
    { type: 'select', label: 'Region', options: [] },
  ],
  StubCollection: [
    { type: 'dateRange', label: 'Date Range' },
    { type: 'select', label: 'Agent', options: [] },
    { type: 'select', label: 'Status', options: ['collected', 'transmitted', 'archived'] },
  ],
  UserActivity: [
    { type: 'dateRange', label: 'Date Range' },
    { type: 'select', label: 'User Role', options: ['supervisor', 'regional_manager', 'director', 'admin'] },
  ],
  AIAnomaly: [
    { type: 'dateRange', label: 'Date Range' },
    { type: 'select', label: 'User Role', options: ['supervisor', 'regional_manager', 'agent'] },
  ],
  AgentPerformance: [
    { type: 'dateRange', label: 'Date Range' },
    { type: 'select', label: 'Agent', options: [] },
    { type: 'select', label: 'Region', options: [] },
  ],
  RegionPerformance: [
    { type: 'dateRange', label: 'Date Range' },
    { type: 'select', label: 'Region', options: [] },
  ],
  Full: [
    { type: 'dateRange', label: 'Date Range' },
    { type: 'select', label: 'Region', options: [] },
    { type: 'select', label: 'Supervisor', options: [] },
    { type: 'select', label: 'Agent', options: [] },
  ],
};

// Error handling function
const handleApiError = (error: unknown, defaultMessage: string): string => {
  if (error instanceof Error) {
    return error.message || defaultMessage;
  }
  return defaultMessage;
};

// Table component
const Table = ({ columns, data }: { columns: any[], data: any[] }) => (
  <div className="table-container">
    <div className="table-head">
      <div className="table-row">
        {columns.map(col => (
          <div key={col.key} className="table-cell">{col.label}</div>
        ))}
      </div>
    </div>
    <div className="table-body">
      {data.length > 0 ? (
        data.map(row => (
          <div key={row.id} className="table-row">
            {columns.map(col => (
              <div key={col.key} className="table-cell">
                {col.render ? col.render(row) : row[col.key]}
              </div>
            ))}
          </div>
        ))
      ) : (
        <div className="no-data">No data available</div>
      )}
    </div>
  </div>
);

// DateRangePicker component
const DateRangePicker = ({ value, onChange }: { value: { start: string; end: string }; onChange: (value: { start: string; end: string }) => void }) => {
  const [startDate, setStartDate] = useState(value?.start || '');
  const [endDate, setEndDate] = useState(value?.end || '');

  useEffect(() => {
    if (startDate !== value.start || endDate !== value.end) {
      onChange({ start: startDate, end: endDate });
    }
  }, [startDate, endDate, onChange, value.start, value.end]);

  return (
    <div className="date-range">
      <input
        type="date"
        className="report-input"
        value={startDate}
        onChange={e => setStartDate(e.target.value)}
      />
      <input
        type="date"
        className="report-input"
        value={endDate}
        onChange={e => setEndDate(e.target.value)}
      />
    </div>
  );
};

// Modal component
const Modal = ({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

const Reports = () => {
  const { effectivePermissions, permissionsLoaded } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('generate');
  const [reportType, setReportType] = useState(reportTypes[0]);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [cronExpression, setCronExpression] = useState('');
  const [regions, setRegions] = useState<Region[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showDashboard, setShowDashboard] = useState(false);

  // Permissions
  const canGenerateReports = effectivePermissions?.some(p => p.name === 'generate_report');
  const canScheduleReports = effectivePermissions?.some(p => p.name === 'schedule_report');
  const canViewSchedules = effectivePermissions?.some(p => p.name === 'view_schedules');
  const canViewGenerated = effectivePermissions?.some(p => p.name === 'view_generated_reports');
  const canDeleteSchedules = effectivePermissions?.some(p => p.name === 'delete_schedule');
  const canViewAnomalies = effectivePermissions?.some(p => p.name === 'view_anomalies');

  // Memoized handleFilterChange function
  const handleFilterChange = useCallback((label: string, value: any) => {
    setFilters(prev => ({ ...prev, [label]: value }));
  }, []);

  // Fetch dynamic filter options
  const fetchFilterOptions = useCallback(async () => {
    try {
      setLoading(true);
      const [regionData, supervisorData, agentData] = await Promise.all([
        getAllRegions(),
        getUsersByRole(import.meta.env.VITE_ROLES_SUPERVISOR),
        getAllAgents().then(res => res.agents),
      ]);
      setRegions(regionData);
      setSupervisors(supervisorData);
      setAgents(agentData);

      // Update filterConfigs with dynamic options using unique IDs
      const updatedFilterConfigs = { ...filterConfigs };
      updatedFilterConfigs.VisitSummary.find(f => f.label === 'Region')!.options = regionData.map(r => r.name);
      updatedFilterConfigs.VisitSummary.find(f => f.label === 'Supervisor')!.options = supervisorData.map(s => `${s.userID}:${s.firstname} ${s.lastname}`);
      updatedFilterConfigs.VisitSummary.find(f => f.label === 'Agent')!.options = agentData.map(a => `${a.agentID}:${a.name} ${a.lastname}`);
      updatedFilterConfigs.Timesheet.find(f => f.label === 'Supervisor')!.options = supervisorData.map(s => `${s.userID}:${s.firstname} ${s.lastname}`);
      updatedFilterConfigs.ReceiptBookInventory.find(f => f.label === 'Region')!.options = regionData.map(r => r.name);
      updatedFilterConfigs.StubCollection.find(f => f.label === 'Agent')!.options = agentData.map(a => `${a.agentID}:${a.name} ${a.lastname}`);
      updatedFilterConfigs.AgentPerformance.find(f => f.label === 'Agent')!.options = agentData.map(a => `${a.agentID}:${a.name} ${a.lastname}`);
      updatedFilterConfigs.AgentPerformance.find(f => f.label === 'Region')!.options = regionData.map(r => r.name);
      updatedFilterConfigs.RegionPerformance.find(f => f.label === 'Region')!.options = regionData.map(r => r.name);
      updatedFilterConfigs.Full.find(f => f.label === 'Region')!.options = regionData.map(r => r.name);
      updatedFilterConfigs.Full.find(f => f.label === 'Supervisor')!.options = supervisorData.map(s => `${s.userID}:${s.firstname} ${s.lastname}`);
      updatedFilterConfigs.Full.find(f => f.label === 'Agent')!.options = agentData.map(a => `${a.agentID}:${a.name} ${a.lastname}`);
    } catch (err) {
      setError(handleApiError(err, 'Unable to fetch filter options.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (permissionsLoaded) {
      fetchFilterOptions();
      if (canViewSchedules) fetchSchedules();
      if (canViewGenerated) fetchGeneratedReports();
    }
  }, [permissionsLoaded, canViewSchedules, canViewGenerated, fetchFilterOptions]);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const data = await listSchedules();
      setSchedules(data);
    } catch (err) {
      setError(handleApiError(err, 'Unable to fetch schedules.'));
    } finally {
      setLoading(false);
    }
  };

  const fetchGeneratedReports = async () => {
    try {
      setLoading(true);
      const data = await listGeneratedReports();
      setGeneratedReports(data);
    } catch (err) {
      setError(handleApiError(err, 'Unable to fetch generated reports.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!canGenerateReports) return;
    try {
      setLoading(true);
      await generateReport({ reportType, filters, format });
      fetchGeneratedReports();
      alert('Report generated successfully!');
      setShowDashboard(true);
    } catch (err) {
      setError(handleApiError(err, 'Unable to generate report.'));
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleReport = async () => {
    if (!canScheduleReports) return;
    try {
      setLoading(true);
      await scheduleReport({ reportType, filters, format, cronExpression });
      setIsScheduleModalOpen(false);
      setCronExpression('');
      fetchSchedules();
      alert('Report scheduled successfully!');
    } catch (err) {
      setError(handleApiError(err, 'Unable to schedule report.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (scheduleID: string) => {
    if (!canDeleteSchedules || !window.confirm('Are you sure you want to delete this schedule?')) return;
    try {
      setLoading(true);
      await deleteSchedule(scheduleID);
      fetchSchedules();
      alert('Schedule deleted successfully!');
    } catch (err) {
      setError(handleApiError(err, 'Unable to delete schedule.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async (filePath: string, format: 'pdf' | 'excel') => {
    if (!canViewGenerated) return;
    try {
      setLoading(true);
      const data = await downloadReport(filePath);
      const mimeType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${new Date().toISOString()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(handleApiError(err, 'Unable to download report.'));
    } finally {
      setLoading(false);
    }
  };

  // Chart data based on report type
  const getChartData = () => {
    switch (reportType) {
      case 'VisitSummary':
        return {
          data: {
            labels: ['Total Visits', 'Validated', 'Pending'],
            datasets: [{
              label: 'Visits',
              data: [100, 70, 30],
              backgroundColor: ['#4cb1c7', '#63b3ed', '#f87171'],
            }],
          },
          options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: {
              x: { type: 'category' },
              y: { beginAtZero: true },
            },
          },
        };
      case 'Timesheet':
        return {
          data: {
            labels: ['Validated', 'Pending'],
            datasets: [{
              data: [60, 40],
              backgroundColor: ['#4cb1c7', '#f87171'],
            }],
          },
          options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
          },
        };
      default:
        return null;
    }
  };

  // Column definitions
  const scheduleColumns = [
    { key: 'scheduleID', label: 'ID' },
    { key: 'reportType', label: 'Report Type' },
    { key: 'format', label: 'Format' },
    { key: 'cronExpression', label: 'Schedule' },
    { key: 'createdBy', label: 'Created By', render: (row: ReportSchedule) => row.creator ? `${row.creator.firstname} ${row.creator.lastname}` : 'N/A' },
    { key: 'createdAt', label: 'Created At', render: (row: ReportSchedule) => new Date(row.createdAt).toLocaleString() },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: ReportSchedule) => canDeleteSchedules && (
        <button onClick={() => handleDeleteSchedule(row.scheduleID)} className="table-action">
          <FaTrash />
        </button>
      ),
    },
  ];

  const generatedColumns = [
    { key: 'generatedReportID', label: 'ID' },
    { key: 'reportType', label: 'Report Type' },
    { key: 'format', label: 'Format' },
    { key: 'generatedAt', label: 'Generated At', render: (row: GeneratedReport) => new Date(row.generatedAt).toLocaleString() },
    { key: 'generatedBy', label: 'Generated By', render: (row: GeneratedReport) => row.generator ? `${row.generator.firstname} ${row.generator.lastname}` : 'N/A' },
    { key: 'scheduleID', label: 'Schedule ID' },
    {
      key: 'download',
      label: 'Download',
      render: (row: GeneratedReport) => canViewGenerated && (
        <button onClick={() => handleDownloadReport(row.filePath, row.format)} className="table-action">
          <FaDownload />
        </button>
      ),
    },
  ];

  if (!permissionsLoaded) {
    return <div>Loading permissions...</div>;
  }

  return (
    <div className="reports-container">
      <header className="reports-header">
        <h1>{t('reports.title')}</h1>
        <div className="tabs">
          <button
            className={activeTab === 'generate' ? 'active' : ''}
            onClick={() => setActiveTab('generate')}
          >
            {t('reports.tabs.generate')}
          </button>
          <button
            className={activeTab === 'scheduled' ? 'active' : ''}
            onClick={() => setActiveTab('scheduled')}
          >
            {t('reports.tabs.scheduled')}
          </button>
          <button
            className={activeTab === 'generated' ? 'active' : ''}
            onClick={() => setActiveTab('generated')}
          >
            {t('reports.tabs.generated')}
          </button>
          {canViewAnomalies && (
            <button
              className={activeTab === 'anomalies' ? 'active' : ''}
              onClick={() => setActiveTab('anomalies')}
            >
              {t('reports.tabs.anomalies')}
            </button>
          )}
        </div>
      </header>
      <main className="reports-content">
        {loading && <div className="loading-text">{t('reports.loading')}</div>}
        {error && <div className="error-message">{error}</div>}
        {activeTab === 'generate' && canGenerateReports && (
          <div className="generate-report">
            <div className="form-group">
              <label>{t('reports.generate.reportType')}</label>
              <select
                className="report-select"
                value={reportType}
                onChange={e => {
                  setReportType(e.target.value);
                  setFilters({});
                  setShowDashboard(false);
                }}
              >
                {reportTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            {filterConfigs[reportType]?.map(config => (
              <div key={config.label} className="form-group">
                <label>{config.label}</label>
                {config.type === 'dateRange' && (
                  <DateRangePicker
                    value={filters[config.label] || { start: '', end: '' }}
                    onChange={(value) => handleFilterChange(config.label, value)}
                  />
                )}
                {config.type === 'select' && (
                  <select
                    className="report-select"
                    value={filters[config.label] || ''}
                    onChange={e => handleFilterChange(config.label, e.target.value)}
                  >
                    <option value="">{`Select ${config.label}`}</option>
                    {config.options?.map(option => {
                      const [id, name] = option.includes(':') ? option.split(':') : [option, option];
                      return (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            ))}
            <div className="form-group">
              <label>{t('reports.generate.format')}</label>
              <select
                className="report-select"
                value={format}
                onChange={e => setFormat(e.target.value as 'pdf' | 'excel')}
              >
                <option value="pdf">PDF</option>
                <option value="excel">Excel</option>
              </select>
            </div>
            <div className="action-buttons">
              <button className="action-button" onClick={handleGenerateReport}>
                {t('reports.actions.generate')}
              </button>
              {canScheduleReports && (
                <button
                  className="action-button"
                  onClick={() => setIsScheduleModalOpen(true)}
                >
                  {t('reports.actions.schedule')}
                </button>
              )}
              <button
                className="action-button"
                onClick={() => setShowDashboard(!showDashboard)}
              >
                <FaChartBar /> {showDashboard ? 'Hide Dashboard' : 'Show Dashboard'}
              </button>
            </div>
            {showDashboard && getChartData() && (
              <div className="chart-container">
                <Chart
                  type={reportType === 'VisitSummary' ? 'bar' : 'pie'}
                  data={getChartData().data}
                  options={getChartData().options}
                />
              </div>
            )}
          </div>
        )}
        {activeTab === 'scheduled' && canViewSchedules && (
          <div className="scheduled-reports">
            <h2>{t('reports.tabs.scheduled')}</h2>
            <Table
              columns={scheduleColumns}
              data={schedules.map(schedule => ({ ...schedule, id: schedule.scheduleID }))}
            />
          </div>
        )}
        {activeTab === 'generated' && canViewGenerated && (
          <div className="generated-reports">
            <h2>{t('reports.tabs.generated')}</h2>
            <Table
              columns={generatedColumns}
              data={generatedReports.map(report => ({ ...report, id: report.generatedReportID }))}
            />
          </div>
        )}
        {activeTab === 'anomalies' && canViewAnomalies && (
          <div className="anomalies-reports">
            <h2>{t('reports.anomalies.title')}</h2>
            <div className="anomaly-realtime">
              <FaBell style={{ marginRight: 8 }} />
              <span>{t('reports.anomalies.realtime')}</span>
            </div>
            <Table
              columns={[
                { key: 'id', label: 'ID' },
                { key: 'user', label: 'User' },
                { key: 'anomaly', label: 'Anomaly' },
                { key: 'timestamp', label: 'Timestamp' },
              ]}
              data={generatedReports
                .filter(r => r.reportType === 'AIAnomaly')
                .map(r => ({
                  id: r.generatedReportID,
                  user: r.generator ? `${r.generator.firstname} ${r.generator.lastname}` : 'N/A',
                  anomaly: 'Irregular Duration',
                  timestamp: new Date(r.generatedAt).toLocaleString(),
                }))
              }
            />
          </div>
        )}
        {canScheduleReports && (
          <Modal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)}>
            <h2>{t('reports.schedule.title')}</h2>
            <p>{t('reports.schedule.reportType')}: {reportType}</p>
            <p>{t('reports.schedule.filters')}: {JSON.stringify(filters)}</p>
            <p>{t('reports.schedule.format')}: {format}</p>
            <div className="form-group">
              <label>{t('reports.schedule.cronExpression')}</label>
              <input
                className="report-input"
                type="text"
                value={cronExpression}
                onChange={e => setCronExpression(e.target.value)}
                placeholder="e.g., 0 0 * * * (daily at midnight)"
              />
            </div>
            <button className="action-button" onClick={handleScheduleReport}>
              {t('reports.actions.schedule')}
            </button>
          </Modal>
        )}
      </main>
    </div>
  );
};

export default Reports;

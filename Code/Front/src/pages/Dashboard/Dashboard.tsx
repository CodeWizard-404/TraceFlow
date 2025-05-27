import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Dashboard.css';

// Import all widgets
import VisitCalendarWidget from '../../components/DashboardWidgets/VisitCalendarWidget';
import MapWidget from '../../components/DashboardWidgets/MapWidget';
import TimesheetSummaryWidget from '../../components/DashboardWidgets/TimesheetSummaryWidget';
import ReceiptBookWidget from '../../components/DashboardWidgets/ReceiptBookWidget';
import StubCollectionWidget from '../../components/DashboardWidgets/StubCollectionWidget';
import AISuggestionsWidget from '../../components/DashboardWidgets/AISuggestionsWidget';
import ProximityAlertsWidget from '../../components/DashboardWidgets/ProximityAlertsWidget';
import VisitGoalsWidget from '../../components/DashboardWidgets/VisitGoalsWidget';
import PhotoUploadsWidget from '../../components/DashboardWidgets/PhotoUploadsWidget';
import OfflineSyncWidget from '../../components/DashboardWidgets/OfflineSyncWidget';
import SupervisorPerformanceWidget from '../../components/DashboardWidgets/SupervisorPerformanceWidget';
import TimesheetValidationQueueWidget from '../../components/DashboardWidgets/TimesheetValidationQueueWidget';
import ReceiptBookDistributionWidget from '../../components/DashboardWidgets/ReceiptBookDistributionWidget';
import StubCollectionOverviewWidget from '../../components/DashboardWidgets/StubCollectionOverviewWidget';
import AnomalyAlertsWidget from '../../components/DashboardWidgets/AnomalyAlertsWidget';
import DynamicReportsWidget from '../../components/DashboardWidgets/DynamicReportsWidget';
import AutomatedReportScheduleWidget from '../../components/DashboardWidgets/AutomatedReportScheduleWidget';
import SystemHealthWidget from '../../components/DashboardWidgets/SystemHealthWidget';
import UserOverviewWidget from '../../components/DashboardWidgets/UserOverviewWidget';
import AIModulePerformanceWidget from '../../components/DashboardWidgets/AIModulePerformanceWidget';
import AuditLogsWidget from '../../components/DashboardWidgets/AuditLogsWidget';
import ConfigurationPanelWidget from '../../components/DashboardWidgets/ConfigurationPanelWidget';
import SecurityAlertsWidget from '../../components/DashboardWidgets/SecurityAlertsWidget';
import PlatformUsageWidget from '../../components/DashboardWidgets/PlatformUsageWidget';
import UserStatisticsWidget from '../../components/DashboardWidgets/UserStatisticsWidget';
import RoleManagementWidget from '../../components/DashboardWidgets/RoleManagementWidget';
import HierarchyViewWidget from '../../components/DashboardWidgets/HierarchyViewWidget';
import RecentActivitiesWidget from '../../components/DashboardWidgets/RecentActivitiesWidget';
import PermissionUsageWidget from '../../components/DashboardWidgets/PermissionUsageWidget';
import AgentUploadStatusWidget from '../../components/DashboardWidgets/AgentUploadStatusWidget';
import WorkforceActivityWidget from '../../components/DashboardWidgets/WorkforceActivityWidget';
import UserEngagementWidget from '../../components/DashboardWidgets/UserEngagementWidget';
import TimesheetOverviewWidget from '../../components/DashboardWidgets/TimesheetOverviewWidget';
import ComplianceMetricsWidget from '../../components/DashboardWidgets/ComplianceMetricsWidget';
import ActivityHeatmapWidget from '../../components/DashboardWidgets/ActivityHeatmapWidget';
import InventoryLevelsWidget from '../../components/DashboardWidgets/InventoryLevelsWidget';
import QRCodeGenerationWidget from '../../components/DashboardWidgets/QRCodeGenerationWidget';
import SupplierInteractionsWidget from '../../components/DashboardWidgets/SupplierInteractionsWidget';
import StockTrendsWidget from '../../components/DashboardWidgets/StockTrendsWidget';
import CSVUploadStatusWidget from '../../components/DashboardWidgets/CSVUploadStatusWidget';
import StubInventoryWidget from '../../components/DashboardWidgets/StubInventoryWidget';
import ArchivingStatusWidget from '../../components/DashboardWidgets/ArchivingStatusWidget';
import CollectionRatesWidget from '../../components/DashboardWidgets/CollectionRatesWidget';
import StubHistoryWidget from '../../components/DashboardWidgets/StubHistoryWidget';
import ValidationQueueWidget from '../../components/DashboardWidgets/ValidationQueueWidget';
import KPIsWidget from '../../components/DashboardWidgets/KPIsWidget';
import InteractiveChartsWidget from '../../components/DashboardWidgets/InteractiveChartsWidget';
import TeamPerformanceWidget from '../../components/DashboardWidgets/TeamPerformanceWidget';
import AlertsSummaryWidget from '../../components/DashboardWidgets/AlertsSummaryWidget';

const ROLES = {
    SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
    REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
    SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
    ADMIN: import.meta.env.VITE_ROLES_ADMIN,
    HR: import.meta.env.VITE_ROLES_HR,
    PURCHASE_TEAM: import.meta.env.VITE_ROLES_PURCHASE_TEAM,
    STOCK_MANAGER: import.meta.env.VITE_ROLES_STOCK_MANAGER,
    DIRECTOR: import.meta.env.VITE_ROLES_DIRECTOR,
};

// Widget names for display in the dropdown
const widgetNamesMap = {
    VisitCalendarWidget: 'Visit Calendar',
    MapWidget: 'Map',
    TimesheetSummaryWidget: 'Timesheet Summary',
    ReceiptBookWidget: 'Receipt Book',
    StubCollectionWidget: 'Stub Collection',
    AISuggestionsWidget: 'AI Suggestions',
    ProximityAlertsWidget: 'Proximity Alerts',
    VisitGoalsWidget: 'Visit Goals',
    PhotoUploadsWidget: 'Photo Uploads',
    OfflineSyncWidget: 'Offline Sync',
    SupervisorPerformanceWidget: 'Supervisor Performance',
    TimesheetValidationQueueWidget: 'Timesheet Validation Queue',
    ReceiptBookDistributionWidget: 'Receipt Book Distribution',
    StubCollectionOverviewWidget: 'Stub Collection Overview',
    AnomalyAlertsWidget: 'Anomaly Alerts',
    DynamicReportsWidget: 'Dynamic Reports',
    AutomatedReportScheduleWidget: 'Automated Report Schedule',
    SystemHealthWidget: 'System Health',
    UserOverviewWidget: 'User Overview',
    AIModulePerformanceWidget: 'AI Module Performance',
    AuditLogsWidget: 'Audit Logs',
    ConfigurationPanelWidget: 'Configuration Panel',
    SecurityAlertsWidget: 'Security Alerts',
    PlatformUsageWidget: 'Platform Usage',
    UserStatisticsWidget: 'User Statistics',
    RoleManagementWidget: 'Role Management',
    HierarchyViewWidget: 'Hierarchy View',
    RecentActivitiesWidget: 'Recent Activities',
    PermissionUsageWidget: 'Permission Usage',
    AgentUploadStatusWidget: 'Agent Upload Status',
    WorkforceActivityWidget: 'Workforce Activity',
    UserEngagementWidget: 'User Engagement',
    TimesheetOverviewWidget: 'Timesheet Overview',
    ComplianceMetricsWidget: 'Compliance Metrics',
    ActivityHeatmapWidget: 'Activity Heatmap',
    InventoryLevelsWidget: 'Inventory Levels',
    QRCodeGenerationWidget: 'QR Code Generation',
    SupplierInteractionsWidget: 'Supplier Interactions',
    StockTrendsWidget: 'Stock Trends',
    CSVUploadStatusWidget: 'CSV Upload Status',
    StubInventoryWidget: 'Stub Inventory',
    ArchivingStatusWidget: 'Archiving Status',
    CollectionRatesWidget: 'Collection Rates',
    StubHistoryWidget: 'Stub History',
    ValidationQueueWidget: 'Validation Queue',
    KPIsWidget: 'KPIs',
    InteractiveChartsWidget: 'Interactive Charts',
    TeamPerformanceWidget: 'Team Performance',
    AlertsSummaryWidget: 'Alerts Summary',
};

const roleWidgetsMap: Record<string, React.ComponentType[]> = {
    [ROLES.SUPERVISOR]: [
        VisitCalendarWidget,
        MapWidget,
        TimesheetSummaryWidget,
        ReceiptBookWidget,
        StubCollectionWidget,
        AISuggestionsWidget,
        ProximityAlertsWidget,
        VisitGoalsWidget,
        PhotoUploadsWidget,
        OfflineSyncWidget,
    ],
    [ROLES.REGIONAL_MANAGER]: [
        SupervisorPerformanceWidget,
        TimesheetValidationQueueWidget,
        ReceiptBookDistributionWidget,
        StubCollectionOverviewWidget,
        AnomalyAlertsWidget,
        DynamicReportsWidget,
        AutomatedReportScheduleWidget,
    ],
    [ROLES.SUPER_ADMIN]: [
        SystemHealthWidget,
        UserOverviewWidget,
        AIModulePerformanceWidget,
        AuditLogsWidget,
        ConfigurationPanelWidget,
        SecurityAlertsWidget,
        PlatformUsageWidget,


        VisitCalendarWidget,
        MapWidget,
        TimesheetSummaryWidget,
        ReceiptBookWidget,
        StubCollectionWidget,
        AISuggestionsWidget,
        ProximityAlertsWidget,
        VisitGoalsWidget,
        PhotoUploadsWidget,
        OfflineSyncWidget,
        SupervisorPerformanceWidget,
        TimesheetValidationQueueWidget,
        ReceiptBookDistributionWidget,
        StubCollectionOverviewWidget,
        AnomalyAlertsWidget,
        DynamicReportsWidget,
        AutomatedReportScheduleWidget,
        UserStatisticsWidget,
        RoleManagementWidget,
        HierarchyViewWidget,
        RecentActivitiesWidget,
        PermissionUsageWidget,
        AgentUploadStatusWidget,
        WorkforceActivityWidget,
        UserEngagementWidget,
        TimesheetOverviewWidget,
        ComplianceMetricsWidget,
        ActivityHeatmapWidget,
        InventoryLevelsWidget,
        QRCodeGenerationWidget,
        SupplierInteractionsWidget,
        StockTrendsWidget,
        CSVUploadStatusWidget,
        StubInventoryWidget,
        ArchivingStatusWidget,
        CollectionRatesWidget,
        StubHistoryWidget,
        ValidationQueueWidget,
        KPIsWidget,
        InteractiveChartsWidget,
        TeamPerformanceWidget,
        AlertsSummaryWidget,
    ],
    [ROLES.ADMIN]: [
        UserStatisticsWidget,
        RoleManagementWidget,
        HierarchyViewWidget,
        RecentActivitiesWidget,
        PermissionUsageWidget,
        AgentUploadStatusWidget,
    ],
    [ROLES.HR]: [
        WorkforceActivityWidget,
        UserEngagementWidget,
        TimesheetOverviewWidget,
        ComplianceMetricsWidget,
        ActivityHeatmapWidget,
    ],
    [ROLES.PURCHASE_TEAM]: [
        InventoryLevelsWidget,
        QRCodeGenerationWidget,
        SupplierInteractionsWidget,
        StockTrendsWidget,
        CSVUploadStatusWidget,
    ],
    [ROLES.STOCK_MANAGER]: [
        StubInventoryWidget,
        ArchivingStatusWidget,
        CollectionRatesWidget,
        StubHistoryWidget,
        ValidationQueueWidget,
    ],
    [ROLES.DIRECTOR]: [
        KPIsWidget,
        InteractiveChartsWidget,
        TeamPerformanceWidget,
        AlertsSummaryWidget,
    ],
};

const Dashboard: React.FC = () => {
    const { user, userRoles, permissionsLoaded } = useAuth();
    const [availableWidgets, setAvailableWidgets] = useState<React.ComponentType[]>([]);
    const [selectedWidgets, setSelectedWidgets] = useState<string[]>([]);

    useEffect(() => {
        if (user && userRoles && permissionsLoaded) {
            const userWidgets = userRoles
                .flatMap((role) => roleWidgetsMap[role.name] || [])
                .filter((Widget, index, self) => self.indexOf(Widget) === index); // Remove duplicates
            setAvailableWidgets(userWidgets);
            setSelectedWidgets(userWidgets.map((Widget) => Widget.name)); // Initially select all widgets
        }
    }, [user, userRoles, permissionsLoaded]);

    const handleWidgetSelection = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedOptions = Array.from(event.target.selectedOptions).map((option) => option.value);
        if (selectedOptions.includes('all')) {
            setSelectedWidgets(availableWidgets.map((Widget) => Widget.name));
        } else {
            setSelectedWidgets(selectedOptions);
        }
    };

    if (!user || !userRoles || !permissionsLoaded) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <h1>Welcome, {user.firstname} {user.lastname}</h1>
            <div className="widget-selector" style={{ marginBottom: '20px' }}>
                <label htmlFor="widget-select" style={{ marginRight: '10px', fontWeight: 'bold' }}>
                    Select Widgets to Display:
                </label>
                <select
                    id="widget-select"
                    multiple
                    value={selectedWidgets}
                    onChange={handleWidgetSelection}
                    style={{ width: '300px', height: '200px', padding: '5px', borderRadius: '4px' }}
                >
                    <option value="all">Select All</option>
                    {availableWidgets.map((Widget) => (
                        <option key={Widget.name} value={Widget.name}>
                            {widgetNamesMap[Widget.name as keyof typeof widgetNamesMap] || Widget.name}
                        </option>
                    ))}
                </select>
            </div>
            <div className="widget-grid">
                {availableWidgets
                    .filter((Widget) => selectedWidgets.includes(Widget.name))
                    .map((Widget, index) => (
                        <div key={index} className="widget">
                            <Widget />
                        </div>
                    ))}
            </div>
        </div>
    );
};

export default Dashboard;
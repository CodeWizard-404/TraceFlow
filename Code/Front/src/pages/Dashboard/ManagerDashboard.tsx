import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Line, Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
    getSupervisorsByRegionalManager,
    getUserById,
} from '../../apis/userAPI';
import { getTimesheetsBySupervisor } from '../../apis/timesheetAPI';
import {
    getAllReceiptBooks,
    getReceiptBooksByHolder,
} from '../../apis/receiptBookAPI';
import {
    getRegionsByUser,
    getGovernoratesByUser,
} from '../../apis/locationApi';
import { listGeneratedReports, listSchedules } from '../../apis/reportAPI';
import './RegionalManagerDashboard.css';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
);



interface Supervisor {
    userID: string;
    firstname: string;
    lastname: string;
    email: string;
    phone: string;
    visitCount?: number;
    performanceScore?: number;
}

interface VisitSummary {
    totalVisits: number;
    validatedVisits: number;
    pendingVisits: number;
    trends: { labels: string[]; values: number[] };
}

interface ReceiptBookSummary {
    totalBooks: number;
    inStock: number;
    withAgents: number;
    archived: number;
    statusDistribution: { labels: string[]; data: number[] };
}

interface LocationData {
    regions: Array<{ regionID: string; name: string; latitude?: number; longitude?: number }>;
    governorates: Array<{ governorateID: string; name: string; latitude?: number; longitude?: number }>;
}

interface ReportData {
    recentReports: Array<{ generatedReportID: string; reportType: string; generatedAt: string; filePath: string }>;
    scheduledReports: Array<{ scheduleID: string; reportType: string; cronExpression: string }>;
}

const RegionalManagerDashboard: React.FC = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const regionalManagerID = user?.userID || '';

    const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
    const [visitSummary, setVisitSummary] = useState<VisitSummary>({
        totalVisits: 0,
        validatedVisits: 0,
        pendingVisits: 0,
        trends: { labels: [], values: [] },
    });
    const [receiptBookSummary, setReceiptBookSummary] = useState<ReceiptBookSummary>({
        totalBooks: 0,
        inStock: 0,
        withAgents: 0,
        archived: 0,
        statusDistribution: { labels: [], data: [] },
    });
    const [locationData, setLocationData] = useState<LocationData>({ regions: [], governorates: [] });
    const [reportData, setReportData] = useState<ReportData>({ recentReports: [], scheduledReports: [] });
    const [timesheetPending, setTimesheetPending] = useState<number>(0);
    const [anomalyAlerts, setAnomalyAlerts] = useState<number>(0);

    const [loadingSupervisors, setLoadingSupervisors] = useState<boolean>(true);
    const [loadingVisits, setLoadingVisits] = useState<boolean>(true);
    const [loadingReceiptBooks, setLoadingReceiptBooks] = useState<boolean>(true);
    const [loadingLocations, setLoadingLocations] = useState<boolean>(true);
    const [loadingReports, setLoadingReports] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch Supervisors
                setLoadingSupervisors(true);
                const supervisorData = await getSupervisorsByRegionalManager(regionalManagerID);
                const enrichedSupervisors = await Promise.all(
                    supervisorData.map(async (supervisor: Supervisor) => {
                        const timesheets = await getTimesheetsBySupervisor(supervisor.userID);
                        const visitCount = timesheets.reduce((sum, ts) => sum + (ts.Visits?.length || 0), 0);
                        return { ...supervisor, visitCount, performanceScore: Math.random() * 100 };
                    })
                );
                setSupervisors(enrichedSupervisors);
                setLoadingSupervisors(false);

                // Fetch Visit Summaries
                setLoadingVisits(true);
                const allTimesheets = await Promise.all(
                    enrichedSupervisors.map((sup) => getTimesheetsBySupervisor(sup.userID))
                );
                const totalVisits = allTimesheets.flatMap((ts) => ts).reduce((sum, ts) => sum + (ts.Visits?.length || 0), 0);
                const validatedVisits = allTimesheets
                    .flatMap((ts) => ts)
                    .reduce((sum, ts) => sum + (ts.Visits?.filter((v) => v.status === 'validated').length || 0), 0);
                const pendingVisits = allTimesheets
                    .flatMap((ts) => ts)
                    .reduce((sum, ts) => sum + (ts.Visits?.filter((v) => v.status === 'pending').length || 0), 0);
                const trends = calculateVisitTrends(allTimesheets.flat());
                setVisitSummary({ totalVisits, validatedVisits, pendingVisits, trends });
                setTimesheetPending(allTimesheets.flat().filter((ts) => ts.status === 'pending').length);
                setLoadingVisits(false);

                // Fetch Receipt Books
                setLoadingReceiptBooks(true);
                const receiptBooks = await getAllReceiptBooks();
                const managerBooks = await getReceiptBooksByHolder(regionalManagerID, 'user');
                const allBooks = [...receiptBooks, ...managerBooks];
                const totalBooks = allBooks.length;
                const inStock = allBooks.filter((book) => book.status === 'in_stock').length;
                const withAgents = allBooks.filter((book) => book.status === 'with_agent').length;
                const archived = allBooks.filter((book) => book.status === 'archived').length;
                const statusDistribution = calculateStatusDistribution(allBooks);
                setReceiptBookSummary({ totalBooks, inStock, withAgents, archived, statusDistribution });
                setLoadingReceiptBooks(false);

                // Fetch Locations
                const regions = await getRegionsByUser(regionalManagerID);
                const governorates = await getGovernoratesByUser(regionalManagerID);
                const enrichedRegions = regions.map((r) => ({
                    ...r,
                    latitude: getMockLatitude(r.name),
                    longitude: getMockLongitude(r.name),
                }));
                const enrichedGovernorates = governorates.map((g) => ({
                    ...g,
                    latitude: getMockLatitude(g.name),
                    longitude: getMockLongitude(g.name),
                }));
                setLocationData({ regions: enrichedRegions, governorates: enrichedGovernorates });
                setLoadingLocations(false);

                // Fetch Reports
                setLoadingReports(true);
                const recentReports = await listGeneratedReports();
                const scheduledReports = await listSchedules();
                setReportData({ recentReports: recentReports.slice(0, 5), scheduledReports });
                setLoadingReports(false);

                // Mock Anomaly Alerts
                setAnomalyAlerts(Math.floor(Math.random() * 10));
            } catch (err) {
                setError('Failed to load dashboard data.');
                console.error(err);
            }
        };

        fetchDashboardData();
    }, [regionalManagerID]);

    const calculateVisitTrends = (timesheets: any[]) => {
        const lastSixMonths = Array.from({ length: 6 }, (_, i) => {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            return date.toLocaleString('default', { month: 'short' });
        }).reverse();
        const values = lastSixMonths.map((month) =>
            timesheets.reduce((sum, ts) => {
                const tsDate = new Date(ts.createdAt || '');
                return tsDate.toLocaleString('default', { month: 'short' }) === month
                    ? sum + (ts.Visits?.length || 0)
                    : sum;
            }, 0)
        );
        return { labels: lastSixMonths, values };
    };

    const calculateStatusDistribution = (books: any[]) => {
        const statuses = ['in_stock', 'with_agent', 'archived', 'with_supervisor'];
        const data = statuses.map((status) => books.filter((book) => book.status === status).length);
        return { labels: statuses.map((s) => t(`status.${s}`)), data };
    };

    const getMockLatitude = (name: string) => 36.8065 + (name.charCodeAt(0) % 10) * 0.01;
    const getMockLongitude = (name: string) => 10.1815 + (name.charCodeAt(0) % 10) * 0.01;

    const visitTrendOptions = {
        responsive: true,
        plugins: { legend: { position: 'top' as const }, title: { display: true, text: t('dashboard.visitTrends') } },
    };

    const receiptPieOptions = {
        responsive: true,
        plugins: { legend: { position: 'top' as const }, title: { display: true, text: t('dashboard.receiptStatus') } },
    };

    const visitTrendData = {
        labels: visitSummary.trends.labels,
        datasets: [
            {
                label: t('dashboard.visits'),
                data: visitSummary.trends.values,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1,
            },
        ],
    };

    const receiptPieData = {
        labels: receiptBookSummary.statusDistribution.labels,
        datasets: [
            {
                label: t('dashboard.receiptBooks'),
                data: receiptBookSummary.statusDistribution.data,
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'],
                hoverOffset: 4,
            },
        ],
    };

    return (
        <div className="dashboard-container p-6 bg-gray-100 min-h-screen">
            <h1 className="text-3xl font-bold mb-6">{t('dashboard.title')}</h1>
            {error && <div className="text-red-500 mb-4">{error}</div>}

            {/* Supervisors Section */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">{t('dashboard.supervisors')}</h2>
                {loadingSupervisors ? (
                    <div className="skeleton-grid">
                        {Array(3).fill(0).map((_, i) => (
                            <div key={i} className="skeleton-card"></div>
                        ))}
                    </div>
                ) : (
                    <div className="supervisor-grid">
                        {supervisors.map((supervisor) => (
                            <div key={supervisor.userID} className="supervisor-card bg-white p-4 rounded-lg shadow-md">
                                <h3 className="text-lg font-bold">{supervisor.firstname} {supervisor.lastname}</h3>
                                <p>{t('dashboard.email')}: {supervisor.email}</p>
                                <p>{t('dashboard.phone')}: {supervisor.phone}</p>
                                <p>{t('dashboard.visitCount')}: {supervisor.visitCount || 0}</p>
                                <p>{t('dashboard.performance')}: {supervisor.performanceScore?.toFixed(2)}%</p>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Visit Summaries Section */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">{t('dashboard.visitSummary')}</h2>
                {loadingVisits ? (
                    <div className="skeleton-grid">
                        {Array(3).fill(0).map((_, i) => (
                            <div key={i} className="skeleton-card"></div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="metric-card bg-white p-4 rounded-lg shadow-md">
                            <h3 className="text-lg font-bold">{t('dashboard.totalVisits')}</h3>
                            <p className="text-2xl">{visitSummary.totalVisits}</p>
                        </div>
                        <div className="metric-card bg-white p-4 rounded-lg shadow-md">
                            <h3 className="text-lg font-bold">{t('dashboard.validatedVisits')}</h3>
                            <p className="text-2xl">{visitSummary.validatedVisits}</p>
                        </div>
                        <div className="metric-card bg-white p-4 rounded-lg shadow-md">
                            <h3 className="text-lg font-bold">{t('dashboard.pendingVisits')}</h3>
                            <p className="text-2xl">{visitSummary.pendingVisits}</p>
                        </div>
                    </div>
                )}
                <div className="chart-container bg-white p-4 rounded-lg shadow-md">
                    <Line options={visitTrendOptions} data={visitTrendData} />
                </div>
            </section>

            {/* Receipt Books Section */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">{t('dashboard.receiptBooks')}</h2>
                {loadingReceiptBooks ? (
                    <div className="skeleton-grid">
                        {Array(3).fill(0).map((_, i) => (
                            <div key={i} className="skeleton-card"></div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="metric-card bg-white p-4 rounded-lg shadow-md">
                            <h3 className="text-lg font-bold">{t('dashboard.totalBooks')}</h3>
                            <p className="text-2xl">{receiptBookSummary.totalBooks}</p>
                        </div>
                        <div className="metric-card bg-white p-4 rounded-lg shadow-md">
                            <h3 className="text-lg font-bold">{t('dashboard.inStock')}</h3>
                            <p className="text-2xl">{receiptBookSummary.inStock}</p>
                        </div>
                        <div className="metric-card bg-white p-4 rounded-lg shadow-md">
                            <h3 className="text-lg font-bold">{t('dashboard.withAgents')}</h3>
                            <p className="text-2xl">{receiptBookSummary.withAgents}</p>
                        </div>
                    </div>
                )}
                <div className="chart-container bg-white p-4 rounded-lg shadow-md">
                    <Pie options={receiptPieOptions} data={receiptPieData} />
                </div>
            </section>

            {/* Locations Section */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">{t('dashboard.locations')}</h2>
                {loadingLocations ? (
                    <div className="skeleton-map"></div>
                ) : (
                    <div className="map-container">
                        <MapContainer>

                        </MapContainer>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="metric-card bg-white p-4 rounded-lg shadow-md">
                        <h3 className="text-lg font-bold">{t('dashboard.regionsAssigned')}</h3>
                        <p className="text-2xl">{locationData.regions.length}</p>
                    </div>
                    <div className="metric-card bg-white p-4 rounded-lg shadow-md">
                        <h3 className="text-lg font-bold">{t('dashboard.governoratesAssigned')}</h3>
                        <p className="text-2xl">{locationData.governorates.length}</p>
                    </div>
                </div>
            </section>

            {/* Reports Section */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">{t('dashboard.reports')}</h2>
                {loadingReports ? (
                    <div className="skeleton-grid">
                        {Array(3).fill(0).map((_, i) => (
                            <div key={i} className="skeleton-card"></div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="report-card bg-white p-4 rounded-lg shadow-md">
                            <h3 className="text-lg font-bold">{t('dashboard.recentReports')}</h3>
                            {reportData.recentReports.map((report) => (
                                <div key={report.generatedReportID} className="mt-2">
                                    <a
                                        href={report.filePath}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline"
                                    >
                                        {report.reportType} - {new Date(report.generatedAt).toLocaleDateString()}
                                    </a>
                                </div>
                            ))}
                        </div>
                        <div className="metric-card bg-white p-4 rounded-lg shadow-md">
                            <h3 className="text-lg font-bold">{t('dashboard.scheduledReports')}</h3>
                            <p className="text-2xl">{reportData.scheduledReports.length}</p>
                        </div>
                    </div>
                )}
            </section>

            {/* Additional Metrics Section */}
            <section>
                <h2 className="text-2xl font-semibold mb-4">{t('dashboard.additionalMetrics')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="metric-card bg-white p-4 rounded-lg shadow-md">
                        <h3 className="text-lg font-bold">{t('dashboard.pendingTimesheets')}</h3>
                        <p className="text-2xl">{timesheetPending}</p>
                    </div>
                    <div className="metric-card bg-white p-4 rounded-lg shadow-md">
                        <h3 className="text-lg font-bold">{t('dashboard.anomalyAlerts')}</h3>
                        <p className="text-2xl">{anomalyAlerts}</p>
                    </div>
                    <div className="metric-card bg-white p-4 rounded-lg shadow-md">
                        <h3 className="text-lg font-bold">{t('dashboard.supervisorCount')}</h3>
                        <p className="text-2xl">{supervisors.length}</p>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default RegionalManagerDashboard;
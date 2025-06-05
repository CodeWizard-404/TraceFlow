import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    getSupervisorsByUser,
} from '../../apis/userAPI';
import { getRegionsByUser, getGovernoratesByUser } from '../../apis/locationApi';
import { getTimesheetsBySupervisor } from '../../apis/timesheetAPI';
import { getReceiptBooksByHolder, getAllReceiptBookTypes } from '../../apis/receiptBookAPI';
import { listGeneratedReports, listSchedules } from '../../apis/reportAPI';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import MapComponent from '../../components/Google/MapComponent';
import { User } from '../../models/User';
import Visit from '../../models/Visit';
import ReceiptBook from '../../models/ReceiptBook';
import { Region } from '../../models/Region';
import { Governorate } from '../../models/Governorate';
import { GeneratedReport, ReportSchedule } from '../../models/Report';
import './ManagerDashbaord.css';

// Type Definitions
interface DashboardData {
    supervisors: { data: User[]; loading: boolean; error: string | null };
    visits: { data: Visit[]; loading: boolean; error: string | null };
    receiptBooks: { data: ReceiptBook[]; loading: boolean; error: string | null };
    regions: { data: Region[]; loading: boolean; error: string | null };
    governorates: { data: Governorate[]; loading: boolean; error: string | null };
    reports: { data: GeneratedReport[]; loading: boolean; error: string | null };
    scheduledReports: { data: ReportSchedule[]; loading: boolean; error: string | null };
}

interface VisitSummary {
    visited: number;
    pending: number;
    rejected: number;
}

interface ReceiptBookSummary {
    total: number;
    inUse: number;
    returned: number;
}

// Custom Hooks
const useDashboardData = (userId: string) => {
    const [data, setData] = useState<DashboardData>({
        supervisors: { data: [], loading: true, error: null },
        visits: { data: [], loading: true, error: null },
        receiptBooks: { data: [], loading: true, error: null },
        regions: { data: [], loading: true, error: null },
        governorates: { data: [], loading: true, error: null },
        reports: { data: [], loading: true, error: null },
        scheduledReports: { data: [], loading: true, error: null },
    });

    useEffect(() => {
        const fetchSupervisors = async () => {
            try {
                const supervisorsData = await getSupervisorsByUser(userId);
                setData(prev => ({
                    ...prev,
                    supervisors: { data: supervisorsData, loading: false, error: null },
                }));
            } catch (err) {
                setData(prev => ({
                    ...prev,
                    supervisors: { data: [], loading: false, error: 'Failed to load supervisors' },
                }));
            }
        };

        const fetchTimesheets = async () => {
            try {
                const timesheetData = await getTimesheetsBySupervisor(userId);
                const visits = timesheetData.flatMap(timesheet => timesheet.Visits || []);
                setData(prev => ({
                    ...prev,
                    visits: { data: visits, loading: false, error: null },
                }));
            } catch (err) {
                setData(prev => ({
                    ...prev,
                    visits: { data: [], loading: false, error: 'Failed to load timesheets' },
                }));
            }
        };

        const fetchReceiptBooks = async () => {
            try {
                const receiptBooksData = await getReceiptBooksByHolder(userId, 'user');
                setData(prev => ({
                    ...prev,
                    receiptBooks: { data: receiptBooksData, loading: false, error: null },
                }));
            } catch (err) {
                setData(prev => ({
                    ...prev,
                    receiptBooks: { data: [], loading: false, error: 'Failed to load receipt books' },
                }));
            }
        };

        const fetchRegions = async () => {
            try {
                const regionsData = await getRegionsByUser(userId);
                setData(prev => ({
                    ...prev,
                    regions: { data: regionsData, loading: false, error: null },
                }));
            } catch (err) {
                setData(prev => ({
                    ...prev,
                    regions: { data: [], loading: false, error: 'Failed to load regions' },
                }));
            }
        };

        const fetchGovernorates = async () => {
            try {
                const governoratesData = await getGovernoratesByUser(userId);
                setData(prev => ({
                    ...prev,
                    governorates: { data: governoratesData, loading: false, error: null },
                }));
            } catch (err) {
                setData(prev => ({
                    ...prev,
                    governorates: { data: [], loading: false, error: 'Failed to load governorates' },
                }));
            }
        };

        const fetchReports = async () => {
            try {
                const reportsData = await listGeneratedReports();
                setData(prev => ({
                    ...prev,
                    reports: { data: reportsData, loading: false, error: null },
                }));
            } catch (err) {
                setData(prev => ({
                    ...prev,
                    reports: { data: [], loading: false, error: 'Failed to load reports' },
                }));
            }
        };

        const fetchScheduledReports = async () => {
            try {
                const scheduledReportsData = await listSchedules();
                setData(prev => ({
                    ...prev,
                    scheduledReports: { data: scheduledReportsData, loading: false, error: null },
                }));
            } catch (err) {
                setData(prev => ({
                    ...prev,
                    scheduledReports: { data: [], loading: false, error: 'Failed to load scheduled reports' },
                }));
            }
        };

        fetchSupervisors();
        fetchTimesheets();
        fetchReceiptBooks();
        fetchRegions();
        fetchGovernorates();
        fetchReports();
        fetchScheduledReports();
    }, [userId]);

    return { data };
};

// Utility Functions
const calculateVisitSummary = (visits: Visit[]): VisitSummary => {
    return visits.reduce(
        (acc, visit) => {
            if (visit.status === 'visited') acc.visited++;
            else if (visit.status === 'pending') acc.pending++;
            else if (visit.status === 'rejected') acc.rejected++;
            return acc;
        },
        { visited: 0, pending: 0, rejected: 0 }
    );
};

const prepareVisitChartData = (visits: Visit[]) => {
    return visits.map(visit => ({
        date: visit.date,
        duration: visit.duration || 0,
    }));
};

const prepareReceiptBookPieData = (receiptBooks: ReceiptBook[]) => {
    const summary = receiptBooks.reduce(
        (acc, book) => {
            if (book.status === 'Assigned to Agent') acc.inUse++;
            else if (book.status === 'Stub Collected') acc.returned++;
            return acc;
        },
        { inUse: 0, returned: 0 }
    );
    return [
        { name: 'In Use', value: summary.inUse },
        { name: 'Returned', value: summary.returned },
    ];
};

// Components
const SupervisorCard: React.FC<{ supervisor: User }> = ({ supervisor }) => (
    <div className="supervisor-card">
        <h3>{supervisor.firstname} {supervisor.lastname}</h3>
        <p>Email: {supervisor.email}</p>
        <p>Phone: {supervisor.phone}</p>
    </div>
);

const VisitsSection: React.FC<{ visits: { data: Visit[]; loading: boolean; error: string | null } }> = ({ visits }) => {
    if (visits.loading) return <div className="loading">Loading Visits...</div>;
    if (visits.error) return <div className="error">{visits.error}</div>;

    const summary = calculateVisitSummary(visits.data);
    const chartData = prepareVisitChartData(visits.data);

    return (
        <div className="dashboard-section visits-section">
            <h2>Visit Summaries</h2>
            <div className="summary-cards">
                <div className="summary-card">
                    <h3>Visited</h3>
                    <p>{summary.visited}</p>
                </div>
                <div className="summary-card">
                    <h3>Pending</h3>
                    <p>{summary.pending}</p>
                </div>
                <div className="summary-card">
                    <h3>Rejected</h3>
                    <p>{summary.rejected}</p>
                </div>
            </div>
            <LineChart width={600} height={300} data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="duration" stroke="#8884d8" />
            </LineChart>
        </div>
    );
};

const ReceiptBooksSection: React.FC<{ receiptBooks: { data: ReceiptBook[]; loading: boolean; error: string | null } }> = ({ receiptBooks }) => {
    if (receiptBooks.loading) return <div className="loading">Loading Receipt Books...</div>;
    if (receiptBooks.error) return <div className="error">{receiptBooks.error}</div>;

    const pieData = prepareReceiptBookPieData(receiptBooks.data);
    const COLORS = ['#0088FE', '#FFBB28'];

    return (
        <div className="dashboard-section receipt-books-section">
            <h2>Receipt Books</h2>
            <PieChart width={400} height={400}>
                <Pie
                    data={pieData}
                    cx={200}
                    cy={200}
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                >
                    {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip />
                <Legend />
            </PieChart>
            <p>Total: {receiptBooks.data.length}</p>
        </div>
    );
};

const LocationsSection: React.FC<{ regions: { data: Region[]; loading: boolean; error: string | null }; governorates: { data: Governorate[]; loading: boolean; error: string | null } }> = ({ regions, governorates }) => {
    if (regions.loading || governorates.loading) return <div className="loading">Loading Locations...</div>;
    if (regions.error || governorates.error) return <div className="error">{regions.error || governorates.error}</div>;

    return (
        <div className="dashboard-section locations-section">
            <h2>Locations</h2>
            <div className="location-summary">
                <div className="summary-card">
                    <h3>Regions</h3>
                    <p>{regions.data.length}</p>
                </div>
                <div className="summary-card">
                    <h3>Governorates</h3>
                    <p>{governorates.data.length}</p>
                </div>
            </div>
            <MapComponent />
        </div>
    );
};

const ReportsSection: React.FC<{ reports: { data: GeneratedReport[]; loading: boolean; error: string | null }; scheduledReports: { data: ReportSchedule[]; loading: boolean; error: string | null } }> = ({ reports, scheduledReports }) => {
    if (reports.loading || scheduledReports.loading) return <div className="loading">Loading Reports...</div>;
    if (reports.error || scheduledReports.error) return <div className="error">{reports.error || scheduledReports.error}</div>;

    return (
        <div className="dashboard-section reports-section">
            <h2>Reports</h2>
            <div className="summary-cards">
                <div className="summary-card">
                    <h3>Recent Reports</h3>
                    <p>{reports.data.length}</p>
                </div>
                <div className="summary-card">
                    <h3>Scheduled Reports</h3>
                    <p>{scheduledReports.data.length}</p>
                </div>
            </div>
            <BarChart width={600} height={300} data={reports.data.slice(0, 5).map(r => ({ name: r.reportType, count: 1 }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#82ca9d" />
            </BarChart>
        </div>
    );
};

// Main Dashboard Component
const RegionalManagerDashboard: React.FC = () => {
    const { user } = useAuth();
    const { data } = useDashboardData(user!.userID);

    const isAnyLoading = Object.values(data).some(section => section.loading);

    if (isAnyLoading) return <div className="loading">Loading Dashboard...</div>;

    return (
        <div className="dashboard-container">
            <h1>Regional Manager Dashboard</h1>
            <div className="dashboard-grid">
                <div className="dashboard-section supervisors-section">
                    {data.supervisors.loading ? (
                        <div className="loading">Loading Supervisors...</div>
                    ) : data.supervisors.error ? (
                        <div className="error">{data.supervisors.error}</div>
                    ) : (
                        <>
                            <h2>Supervisors</h2>
                            <div className="supervisor-cards">
                                {data.supervisors.data.map(supervisor => (
                                    <SupervisorCard key={supervisor.userID} supervisor={supervisor} />
                                ))}
                            </div>
                        </>
                    )}
                </div>
                <VisitsSection visits={data.visits} />
                <ReceiptBooksSection receiptBooks={data.receiptBooks} />
                <LocationsSection regions={data.regions} governorates={data.governorates} />
                <ReportsSection reports={data.reports} scheduledReports={data.scheduledReports} />
            </div>
        </div>
    );
};

export default RegionalManagerDashboard;
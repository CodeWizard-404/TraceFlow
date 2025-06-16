import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../../context/NotificationContext';
import userAPI, { fetchUserProfile } from '../../apis/userAPI';
import timesheetAPI from '../../apis/timesheetAPI';
import receiptBookAPI from '../../apis/receiptBookAPI';
import locationApi from '../../apis/locationApi';
import reportAPI from '../../apis/reportAPI';
import agentAPI from '../../apis/agentAPI';
import MapComponent from '../../components/Google/MapComponent';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, ScatterChart, Scatter } from 'recharts';
import { FaUsers, FaBook, FaClock, FaMapMarkerAlt, FaChartBar, FaSitemap, FaUser, FaCalendarAlt, FaMapMarkedAlt, FaUserEdit, FaBell, FaSync, FaGlobe, FaFileAlt, FaHourglassHalf, FaMapSigns, FaUserCheck } from 'react-icons/fa';
import { FiDownload } from "react-icons/fi";
import { cn } from '../../lib/utils';
import { FixedSizeList } from 'react-window';
import NotificationItem from '../../components/ui/notification';
import User from '../../models/User';
import Timesheet from '../../models/Timesheet';
import ReceiptBook from '../../models/ReceiptBook';
import Region from '../../models/Region';
import Governorate from '../../models/Governorate';
import Delegation from '../../models/Delegation';
import Agent from '../../models/Agent';
import { ReportSchedule, GeneratedReport } from '../../models/Report';
import './ManagerDashbaord.css';
import { getNotifications } from '../../apis/notificationAPI';

const RegionalManagerDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { notifications, mergeNotifications, markAllAsRead } = useNotification();

    // State Definitions
    const [profile, setProfile] = useState<User | null>(null);
    const [director, setDirector] = useState<User | null>(null);
    const [supervisors, setSupervisors] = useState<User[]>([]);
    const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
    const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [supervisorLocations, setSupervisorLocations] = useState<{ [key: string]: { governorates: Governorate[]; delegations: Delegation[] } }>({});
    const [agents, setAgents] = useState<Agent[]>([]);
    const [scheduledReports, setScheduledReports] = useState<ReportSchedule[]>([]);
    const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errors, setErrors] = useState<{ [key: string]: string | null }>({
        director: null,
        supervisors: null,
        timesheets: null,
        receiptBooks: null,
        regions: null,
        supervisorLocations: null,
        agents: null,
        reports: null,
    });
    const [visitFilters, setVisitFilters] = useState({ status: '', supervisor: '', region: '', dateStart: '', dateEnd: '' });
    const [notificationPage, setNotificationPage] = useState(1);
    const [isNotificationLoading, setIsNotificationLoading] = useState(false);
    const [receiptBookTypes, setReceiptBookTypes] = useState<{ typeID: string; name: string }[]>([]);
    const itemsPerPage = 20;

    const COLORS = ['#4cb1c7', '#f5a800', '#036318', '#930744', '#8b8b8b', '#63b3ed', '#ff784e', '#00c49f', '#ffbb28', '#ff00ff'];

    // Data Fetching
    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            const newErrors = { ...errors };

            try {
                if (!user) throw new Error('User not authenticated');

                // Fetch Director
                const directorData = await userAPI.getDirectorByRegionalManager(user.userID).catch(err => { newErrors.director = t('dashboard.errors.director'); throw err; });
                setDirector(directorData[0] || null);

                // Fetch Supervisors
                const supervisorsData = await userAPI.getSupervisorsByRegionalManager(user.userID).catch(err => { newErrors.supervisors = t('dashboard.errors.supervisors'); throw err; });
                setSupervisors(supervisorsData || []);

                // Fetch Timesheets
                if (supervisorsData.length > 0) {
                    const timesheetsPromises = supervisorsData.map(sup => timesheetAPI.getTimesheetsBySupervisor(sup.userID).catch(() => []));
                    const timesheetsData = await Promise.all(timesheetsPromises);
                    setTimesheets(timesheetsData.flat());
                }

                // Fetch Receipt Books
                const rmReceiptBooks = await receiptBookAPI.getReceiptBooksByHolder(user.userID, 'user').catch(err => { newErrors.receiptBooks = t('dashboard.errors.receiptBooks'); throw err; });
                const supervisorsReceiptBooks = await Promise.all(
                    supervisorsData.map(sup => receiptBookAPI.getReceiptBooksByHolder(sup.userID, 'user').catch(() => []))
                );
                setReceiptBooks([...(rmReceiptBooks || []), ...supervisorsReceiptBooks.flat()]);

                // Fetch Receipt Book Types
                const receiptBookTypesData = await receiptBookAPI.getAllReceiptBookTypes().catch(err => { newErrors.receiptBooks = t('dashboard.errors.receiptBookTypes'); throw err; });
                setReceiptBookTypes(receiptBookTypesData || []);

                // Fetch Regions
                const regionsData = await locationApi.getRegionsByUser(user.userID).catch(err => { newErrors.regions = t('dashboard.errors.regions'); throw err; });
                setRegions(regionsData || []);

                // Fetch Supervisor Locations and Agents
                if (supervisorsData.length > 0) {
                    const locationsPromises = supervisorsData.map(async (sup) => {
                        const governorates = await locationApi.getGovernoratesByUser(sup.userID).catch(() => []);
                        const delegations = await locationApi.getDelegationsByUser(sup.userID).catch(() => []);
                        const supAgents = await agentAPI.getAgentsByUser(sup.userID).catch(() => ({ agents: [] }));
                        return { supervisorID: sup.userID, governorates, delegations, agents: supAgents };
                    });
                    const locationsData = await Promise.all(locationsPromises);
                    const AllAgents = await agentAPI.getAllAgents();
                    const locationsMap = locationsData.reduce((acc, { supervisorID, governorates, delegations }) => {
                        acc[supervisorID] = { governorates, delegations };
                        return acc;
                    }, {} as { [key: string]: { governorates: Governorate[]; delegations: Delegation[] } });
                    setSupervisorLocations(locationsMap);
                    setAgents(AllAgents.agents || []);
                }

                // Fetch Reports
                const scheduled = await reportAPI.listSchedules().catch(err => { newErrors.reports = t('dashboard.errors.reports'); throw err; });
                const generated = await reportAPI.listGeneratedReports().catch(() => []);
                setScheduledReports(scheduled.filter(r => r.createdBy === user.userID));
                setGeneratedReports(generated.filter(r => r.generatedBy === user.userID));

                setErrors(newErrors);
            } catch (err) {
                console.error('Unexpected error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [t]);


    useEffect(() => {
        const fecthUserProfile = async () => {
            try {
                const userProfile = await fetchUserProfile();
                setProfile(userProfile);
            } catch (error) {
                console.error('Failed to fetch user profile:', error);
            }
        };
        fecthUserProfile();
    }, []);

    // Data Processing
    const allVisits = timesheets.flatMap(ts => ts.Visits || []);
    const filteredVisits = allVisits.filter(visit => {
        const statusMatch = !visitFilters.status || visit.status === visitFilters.status;
        const supervisorMatch = !visitFilters.supervisor || timesheets.find(ts => ts.timesheetID === visit.timesheetID)?.supervisorID === visitFilters.supervisor;
        const regionMatch = !visitFilters.region || agents.find(a => a.agentID === visit.agentID)?.Delegation?.Governorate?.Region?.regionID === visitFilters.region;
        const date = new Date(visit.date);
        const dateStart = visitFilters.dateStart ? new Date(visitFilters.dateStart) : null;
        const dateEnd = visitFilters.dateEnd ? new Date(visitFilters.dateEnd) : null;
        const dateMatch = (!dateStart || date >= dateStart) && (!dateEnd || date <= dateEnd);
        return statusMatch && supervisorMatch && regionMatch && dateMatch;
    });

    // KPIs
    const numSupervisors = supervisors.length;
    const numAgents = agents.length;
    const numVisits = allVisits.length;
    const numReceiptBooks = receiptBooks.length;
    const numRegions = regions.length;
    const totalGovernorates = Object.values(supervisorLocations).reduce((sum, loc) => sum + loc.governorates.length, 0);
    const totalDelegations = Object.values(supervisorLocations).reduce((sum, loc) => sum + loc.delegations.length, 0);
    const validatedVisits = allVisits.filter(v => v.status === 'validated').length;
    const avgVisitDuration = allVisits.length > 0 ? Number((allVisits.reduce((sum, v) => sum + (v.duration || 0), 0) / allVisits.length).toFixed(2)) : 0;
    const visitsLast7Days = allVisits.filter(v => new Date(v.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length;
    const activeSupervisors = supervisors.filter(sup => allVisits.some(v => timesheets.find(ts => ts.timesheetID === v.timesheetID)?.supervisorID === sup.userID)).length;

    // Chart Data
    const visitStatusCounts = filteredVisits.reduce((acc, visit) => { acc[visit.status] = (acc[visit.status] || 0) + 1; return acc; }, {} as Record<string, number>);
    const visitPieData = Object.keys(visitStatusCounts).map(status => ({ name: status, value: visitStatusCounts[status] }));

    const visitsByDate = filteredVisits.reduce((acc, visit) => { const date = visit.date.split('T')[0]; acc[date] = (acc[date] || 0) + 1; return acc; }, {} as Record<string, number>);
    const visitTrendData = Object.keys(visitsByDate).sort().map(date => ({ date, visits: visitsByDate[date] }));

    const visitsPerSupervisor = supervisors.map(sup => {
        const supVisits = allVisits.filter(v => timesheets.find(ts => ts.timesheetID === v.timesheetID)?.supervisorID === sup.userID);
        return { name: `${sup.firstname} ${sup.lastname}`, visits: supVisits.length };
    });

    const receiptBooksByType = receiptBooks.reduce((acc, book) => {
        const type = receiptBookTypes.find(t => t.typeID === book.typeID);
        const typeName = type ? type.name : book.typeID || 'Unknown';
        acc[typeName] = (acc[typeName] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const receiptBookPieData = Object.keys(receiptBooksByType).map(type => ({ name: type, value: receiptBooksByType[type] }));

    const receiptBooksPerSupervisor = supervisors.map(sup => {
        const supBooks = receiptBooks.filter(b => b.holder?.userID === sup.userID);
        return { name: `${sup.firstname} ${sup.lastname}`, books: supBooks.length };
    });

    const avgDurationPerSupervisor = supervisors.map(sup => {
        const supVisits = allVisits.filter(v => timesheets.find(ts => ts.timesheetID === v.timesheetID)?.supervisorID === sup.userID);
        const avg = supVisits.length > 0 ? supVisits.reduce((sum, v) => sum + (v.duration || 0), 0) / supVisits.length : 0;
        return { name: `${sup.firstname} ${sup.lastname}`, avgDuration: Number(avg.toFixed(2)) };
    });

    const anomalies = notifications
        .filter(n => n.type === 'anomaly' && n.userID === user?.userID)
        .map(n => ({
            supervisor: supervisors.find(s => s.userID === n.userID)?.firstname || 'Unknown',
            date: new Date(n.createdAt).toISOString().split('T')[0],
        }));

    const visitsPerRegion = regions.map(region => {
        const regionVisits = allVisits.filter(v => {
            const agent = agents.find(a => a.agentID === v.agentID);
            return agent?.Delegation?.Governorate?.Region?.regionID === region.regionID;
        });
        return { name: region.name, visits: regionVisits.length };
    });

    const agentsPerSupervisor = supervisors.map(sup => {
        const supAgents = agents.filter(a => a.supervisorID === sup.userID);
        return { name: `${sup.firstname} ${sup.lastname}`, agents: supAgents.length };
    });

    const receiptBookStatusCounts = receiptBooks.reduce((acc, book) => { acc[book.status] = (acc[book.status] || 0) + 1; return acc; }, {} as Record<string, number>);
    const receiptBookStatusPieData = Object.keys(receiptBookStatusCounts).map(status => ({ name: status, value: receiptBookStatusCounts[status] }));

    // Convert cron expression to user-friendly format
    const formatCronExpression = (cron: string): string => {
        if (cron === '0 0 * * 0') return 'Weekly';
        if (cron === '0 0 1 * *') return 'Monthly';
        if (cron === '0 0 * * *') return 'Daily';
        return cron; // Fallback to raw cron if unrecognized
    };

    // Notification Handlers
    const handleRefreshNotifications = async () => {
        setIsNotificationLoading(true);
        try {
            let fetchedNotifications = await getNotifications();
            mergeNotifications(fetchedNotifications);
            setNotificationPage(1);
        } catch (error) {
            console.error('Failed to refresh notifications:', error);
        } finally {
            setIsNotificationLoading(false);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await markAllAsRead();
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const loadMoreNotifications = () => {
        if (paginatedNotifications.length < filteredNotifications.length) {
            setNotificationPage(prev => prev + 1);
        }
    };

    const filteredNotifications = notifications.filter(n => n.status !== 'read' && n.channel === 'in-app').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const paginatedNotifications = filteredNotifications.slice(0, notificationPage * itemsPerPage);
    const unreadCount = filteredNotifications.length;

    const NotificationRow = ({ index, style }: { index: number; style: React.CSSProperties }) => (
        <div style={style}>
            <NotificationItem notification={paginatedNotifications[index]} />
        </div>
    );

    if (isLoading) {
        return (
            <div className="dashboard-container">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="dashboard-container regional-manager-container"
                >
                    {/* Skeleton for Header */}
                    <header className="dashboard-header dashboard-header-1">
                        <div className="header-top">
                            <div className="custom-skeleton pulsing" style={{ width: '200px', height: '30px' }} />
                            <div className="user-profile">
                                <div className="custom-skeleton pulsing" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                                <div className="custom-skeleton pulsing" style={{ width: '100px', height: '20px', marginLeft: '10px' }} />
                            </div>
                        </div>
                        <div className="header-stats">
                            {[...Array(10)].map((_, i) => (
                                <div key={i} className="stat-card stat-card-1">
                                    <div className="custom-skeleton pulsing" style={{ width: '40px', height: '40px', margin: '10px' }} />
                                    <div>
                                        <div className="custom-skeleton pulsing" style={{ width: '100px', height: '20px', margin: '5px 0' }} />
                                        <div className="custom-skeleton pulsing" style={{ width: '60px', height: '30px', margin: '5px 0' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </header>

                    {/* Skeleton for Dashboard Grid */}
                    <div className="dashboard-grid dashboard-grid-01">
                        {/* Skeleton for Quick Actions Card */}
                        <section className="dashboard-card quick-actions-card">
                            <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                            <hr />
                            <div className="action-grid">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="custom-skeleton pulsing" style={{ width: '100%', height: '40px', margin: '5px' }} />
                                ))}
                            </div>
                        </section>

                        {/* Skeleton for Hierarchy Card */}
                        <section className="dashboard-card medium-card">
                            <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                            <hr />
                            <div className="card-content">
                                {[...Array(2)].map((_, i) => (
                                    <div key={i} className="hierarchy-level">
                                        <div className="custom-skeleton pulsing" style={{ width: '100px', height: '20px', margin: '5px 0' }} />
                                        <div className="custom-skeleton pulsing" style={{ width: '150px', height: '15px', margin: '5px 0' }} />
                                        <div className="custom-skeleton pulsing" style={{ width: '150px', height: '15px', margin: '5px 0' }} />
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Skeleton for Supervisors Summary Card */}
                        <section className="dashboard-card medium-card sup-summary">
                            <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                            <hr />
                            <div className="supervisor-grid">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="supervisor-card">
                                        <div className="custom-skeleton pulsing" style={{ width: '100px', height: '20px', margin: '5px 0' }} />
                                        <div className="custom-skeleton pulsing" style={{ width: '80px', height: '15px', margin: '5px 0' }} />
                                        <div className="custom-skeleton pulsing" style={{ width: '80px', height: '15px', margin: '5px 0' }} />
                                        <div className="custom-skeleton pulsing" style={{ width: '80px', height: '15px', margin: '5px 0' }} />
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Skeleton for Notifications Card */}
                        <section className="dashboard-card medium-card notifications-card">
                            <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                            <hr />
                            <div>
                                <div className="notification-panel-header">
                                    <div className="notification-panel-controls">
                                        <div className="custom-skeleton pulsing" style={{ width: '30px', height: '30px', margin: '5px' }} />
                                        <div className="custom-skeleton pulsing" style={{ width: '60px', height: '30px', margin: '5px' }} />
                                    </div>
                                </div>
                                <div className="notification-skeleton">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="custom-skeleton pulsing" style={{ width: '100%', height: '50px', margin: '5px 0' }} />
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Skeleton for Visit Summary Card */}
                        <section className="dashboard-card xlarge-card">
                            <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                            <hr />
                            <div className="card-content">
                                <div className="filter-bar">
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} className="custom-skeleton pulsing" style={{ width: '150px', height: '30px', margin: '5px' }} />
                                    ))}
                                </div>
                                <div className="custom-skeleton pulsing" style={{ width: '100px', height: '20px', margin: '10px 0' }} />
                                <div className="chart-grid chart-grid-2">
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} className="chart-container">
                                            <div className="custom-skeleton pulsing" style={{ width: '400px', height: '300px', margin: '10px 0' }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Skeleton for Geographical Assignments Card */}
                        <section className="dashboard-card medium-card">
                            <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                            <hr />
                            <div className="card-content">
                                <div className="custom-skeleton pulsing" style={{ width: '100px', height: '20px', margin: '5px 0' }} />
                                <div className="custom-skeleton pulsing" style={{ width: '150px', height: '15px', margin: '5px 0' }} />
                                <div className="custom-skeleton pulsing" style={{ width: '100px', height: '20px', margin: '5px 0' }} />
                                <div className="custom-skeleton pulsing" style={{ width: '150px', height: '15px', margin: '5px 0' }} />
                            </div>
                        </section>

                        {/* Skeleton for Report Summary Card */}
                        <section className="dashboard-card medium-card">
                            <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                            <hr />
                            <div className="card-content">
                                <div className="custom-skeleton pulsing" style={{ width: '100px', height: '20px', margin: '5px 0' }} />
                                <div className="custom-skeleton pulsing" style={{ width: '150px', height: '15px', margin: '5px 0' }} />
                                <div className="custom-skeleton pulsing" style={{ width: '100px', height: '20px', margin: '5px 0' }} />
                                <div className="custom-skeleton pulsing" style={{ width: '150px', height: '15px', margin: '5px 0' }} />
                            </div>
                        </section>

                        {/* Skeleton for Receipt Book Summary Card */}
                        <section className="dashboard-card xlarge-card">
                            <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                            <hr />
                            <div className="card-content">
                                <div className="custom-skeleton pulsing" style={{ width: '100px', height: '20px', margin: '10px 0' }} />
                                <div className="chart-grid">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="chart-container">
                                            <div className="custom-skeleton pulsing" style={{ width: '400px', height: '300px', margin: '10px 0' }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Skeleton for Map Card */}
                        <section className="dashboard-card full-width-card">
                            <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                            <hr />
                            <div className="card-content">
                                <div className="custom-skeleton pulsing" style={{ width: '100%', height: '400px', margin: '10px 0' }} />
                            </div>
                        </section>

                        {/* Skeleton for Additional KPIs Card */}
                        <section className="dashboard-card full-width-card">
                            <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                            <hr />
                            <div className="card-content">
                                <div className="chart-grid chart-grid-1">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="chart-container">
                                            <div className="custom-skeleton pulsing" style={{ width: '400px', height: '300px', margin: '10px 0' }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>
                </motion.div>
            </div>
        );
    }



    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="dashboard-container regional-manager-container">
            {/* Enhanced Header */}
            <header className="dashboard-header dashboard-header-1">
                <div className="header-top">
                    <h1>{t('dashboard.regionalManagerTitle')}</h1>
                    <div className="user-profile">
                        <FaUser className="user-icon" />
                        <span>{user ? `${profile!.firstname} ${profile!.lastname}` : 'Guest'}</span>
                    </div>
                </div>
                <div className="header-stats">
                    <div className="stat-card stat-card-1"><FaUsers /><div><h3>{t('dashboard.totalSupervisors')}</h3><p>{numSupervisors}</p></div></div>
                    <div className="stat-card stat-card-1"><FaUserCheck /><div><h3>{t('dashboard.activeSupervisors')}</h3><p>{activeSupervisors}</p></div></div>
                    <div className="stat-card stat-card-1"><FaUsers /><div><h3>{t('dashboard.totalAgents')}</h3><p>{numAgents}</p></div></div>
                    <div className="stat-card stat-card-1"><FaClock /><div><h3>{t('dashboard.totalVisits')}</h3><p>{numVisits}</p></div></div>
                    <div className="stat-card stat-card-1"><FaBook /><div><h3>{t('dashboard.totalReceiptBooks')}</h3><p>{numReceiptBooks}</p></div></div>
                    <div className="stat-card stat-card-1"><FaMapMarkerAlt /><div><h3>{t('dashboard.totalRegions')}</h3><p>{numRegions}</p></div></div>
                    <div className="stat-card stat-card-1"><FaGlobe /><div><h3>{t('dashboard.totalGovernorates')}</h3><p>{totalGovernorates}</p></div></div>
                    <div className="stat-card stat-card-1"><FaMapSigns /><div><h3>{t('dashboard.totalDelegations')}</h3><p>{totalDelegations}</p></div></div>
                    <div className="stat-card stat-card-1"><FaClock /><div><h3>{t('dashboard.visitsLast7Days')}</h3><p>{visitsLast7Days}</p></div></div>
                    <div className="stat-card stat-card-1"><FaHourglassHalf /><div><h3>{t('dashboard.avgVisitDuration')}</h3><p>{avgVisitDuration} min</p></div></div>
                </div>
            </header>

            <div className="dashboard-grid dashboard-grid-01">
                {/* Quick Actions */}
                <section className="dashboard-card quick-actions-card">
                    <h2>{t('dashboard.quickActions')}</h2>
                    <hr />
                    <div className="action-grid">
                        <button className="action-btn" onClick={() => navigate('/timesheet-form')}><FaCalendarAlt /><span>{t('dashboard.addTimesheet')}</span></button>
                        <button className="action-btn" onClick={() => navigate('/reports')}><FaChartBar /><span>{t('dashboard.generateReport')}</span></button>
                        <button className="action-btn" onClick={() => navigate('/transfer-receipt-books')}><FaBook /><span>{t('dashboard.assignReceiptBook')}</span></button>
                        <button className="action-btn" onClick={() => navigate('/timesheet')}><FaCalendarAlt /><span>{t('dashboard.validateTimesheets')}</span></button>
                        <button className="action-btn" onClick={() => navigate('/profile')}><FaUserEdit /><span>{t('dashboard.editProfile')}</span></button>
                        <button className="action-btn" onClick={() => navigate('/profile', { state: { scrollTo: 'notification-preferences' } })}><FaBell /><span>{t('dashboard.notificationPreferences')}</span></button>
                    </div>
                </section>

                {/* Hierarchy */}
                <section className="dashboard-card medium-card">
                    <h2><FaSitemap /> {t('dashboard.hierarchy')}</h2>
                    <hr />
                    <div className="card-content">
                        {director ? (
                            <div className="hierarchy-level">
                                <h3>{t('dashboard.director')}</h3>
                                <p>{`${director.firstname} ${director.lastname}`}</p>
                                <p>{t('dashboard.email')}: {director.email || 'N/A'}</p>
                                <p>{t('dashboard.phone')}: {director.phone || 'N/A'}</p>
                            </div>
                        ) : (
                            <p>{t('dashboard.noDirectorAssigned')}</p>
                        )}
                        <div className="hierarchy-level">
                            <h3>{t('dashboard.supervisors')}</h3>
                            <ul>
                                {supervisors.map(sup => (
                                    <li key={sup.userID}>
                                        {`${sup.firstname} ${sup.lastname}`} -
                                        Agents: {agents.filter(a => a.supervisorID === sup.userID).length}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Supervisors Summary */}
                <section className="dashboard-card medium-card sup-summary">
                    <h2><FaUsers /> {t('dashboard.supervisorsSummary')}</h2>
                    <hr />
                    <div className="card-content">
                        <div className="supervisor-grid">
                            {supervisors.map(sup => {
                                const supVisits = allVisits.filter(v => timesheets.find(ts => ts.timesheetID === v.timesheetID)?.supervisorID === sup.userID);
                                const supBooks = receiptBooks.filter(b => b.holder?.userID === sup.userID);
                                const supAgents = agents.filter(a => a.supervisorID === sup.userID);
                                return (
                                    <div key={sup.userID} className="supervisor-card" onClick={() => navigate(`/supervisor/${sup.userID}`)}>
                                        <h3>{`${sup.firstname} ${sup.lastname}`}</h3>
                                        <p>{t('dashboard.visits')}: {supVisits.length}</p>
                                        <p>{t('dashboard.receiptBooks')}: {supBooks.length}</p>
                                        <p>{t('dashboard.agents')}: {supAgents.length}</p>
                                        <p>{t('dashboard.governorates')}: {supervisorLocations[sup.userID]?.governorates.length || 0}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Notifications */}
                <section className="dashboard-card medium-card notifications-card">
                    <h2>Latest Notifications {unreadCount > 0 && <span className="unread-count">{unreadCount}</span>}</h2>
                    <hr />
                    <div>
                        <div className="notification-panel-header">
                            <div className="notification-panel-controls">
                                <button onClick={handleRefreshNotifications} disabled={isNotificationLoading}><FaSync className={cn(isNotificationLoading && 'spinning')} /></button>
                                <button onClick={handleMarkAllRead} disabled={isNotificationLoading || unreadCount === 0}>Clear</button>
                            </div>
                        </div>
                        {isNotificationLoading ? (
                            <div>Loading...</div>
                        ) : paginatedNotifications.length === 0 ? (
                            <p>No unread notifications</p>
                        ) : (
                            <FixedSizeList height={150} width="100%" itemCount={paginatedNotifications.length} itemSize={62} onItemsRendered={({ visibleStopIndex }) => {
                                if (visibleStopIndex >= paginatedNotifications.length - 1) loadMoreNotifications();
                            }}>
                                {NotificationRow}
                            </FixedSizeList>
                        )}
                    </div>
                </section>

                {/* Visit Summary */}
                <section className="dashboard-card xlarge-card">
                    <h2><FaClock /> {t('dashboard.visitSummary')}</h2>
                    <hr />
                    <div className="card-content">
                        <div className="filter-bar">
                            <select value={visitFilters.status} onChange={e => setVisitFilters({ ...visitFilters, status: e.target.value })}>
                                <option value="">{t('dashboard.allStatuses')}</option>
                                <option value="pending">{t('dashboard.pending')}</option>
                                <option value="validated">{t('dashboard.validated')}</option>
                                <option value="rejected">{t('dashboard.rejected')}</option>
                                <option value="visisted">{t('dashboard.visisted')}</option>
                            </select>
                            <select value={visitFilters.supervisor} onChange={e => setVisitFilters({ ...visitFilters, supervisor: e.target.value })}>
                                <option value="">{t('dashboard.allSupervisors')}</option>
                                {supervisors.map(sup => (
                                    <option key={sup.userID} value={sup.userID}>{`${sup.firstname} ${sup.lastname}`}</option>
                                ))}
                            </select>
                            <input type="date" value={visitFilters.dateStart} onChange={e => setVisitFilters({ ...visitFilters, dateStart: e.target.value })} />
                            <input type="date" value={visitFilters.dateEnd} onChange={e => setVisitFilters({ ...visitFilters, dateEnd: e.target.value })} />
                        </div>
                        <p>{t('dashboard.totalVisits')}: {filteredVisits.length}</p>
                        <div className="chart-grid chart-grid-2">
                            <div className="chart-container">
                                <h3>{t('dashboard.visitStatusDistribution')}</h3>
                                <PieChart width={400} height={300}>
                                    <Pie data={visitPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                        {visitPieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </div>
                            <div className="chart-container">
                                <h3>{t('dashboard.visitTrends')}</h3>
                                <LineChart width={400} height={300} data={visitTrendData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="visits" stroke="#4cb1c7" />
                                </LineChart>
                            </div>
                            <div className="chart-container">
                                <h3>{t('dashboard.visitsPerSupervisor')}</h3>
                                <BarChart width={400} height={300} data={visitsPerSupervisor}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="visits" fill="#4cb1c7" />
                                </BarChart>
                            </div>
                            <div className="chart-container">
                                <h3>{t('dashboard.visitsPerRegion')}</h3>
                                <BarChart width={400} height={300} data={visitsPerRegion}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="visits" fill="#4cb1c7" />
                                </BarChart>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Geographical Assignments */}
                <section className="dashboard-card medium-card">
                    <h2><FaMapMarkerAlt /> {t('dashboard.geographicalAssignments')}</h2>
                    <hr />
                    <div className="card-content">
                        <h4>{t('dashboard.regionsAssigned')}</h4>
                        <ul>{regions.map(region => <li key={region.regionID}>{region.name}</li>)}</ul>
                        <h4>{t('dashboard.supervisorsAssignments')}</h4>
                        {supervisors.map(sup => (
                            <div key={sup.userID}>
                                <h4>{`${sup.firstname} ${sup.lastname}`}</h4>
                                <p>{t('dashboard.governorates')}: {supervisorLocations[sup.userID]?.governorates.map(g => g.name).join(', ') || 'None'}</p>
                                <p>{t('dashboard.delegations')}: {supervisorLocations[sup.userID]?.delegations.map(d => d.name).join(', ') || 'None'}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Report Summary */}
                <section className="dashboard-card medium-card">
                    <h2><FaFileAlt /> {t('dashboard.reportSummary')}</h2>
                    <hr />
                    <div className="card-content">
                        <h3>{t('dashboard.scheduledReports')}</h3>
                        {scheduledReports.length === 0 ? (
                            <p>{t('dashboard.noScheduledReports')}</p>
                        ) : (
                            <ul>
                                {scheduledReports.slice(0, 5).map(report => (
                                    <li key={report.scheduleID}>
                                        {report.reportType} - {formatCronExpression(report.cronExpression)}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <h3>{t('dashboard.generatedReports')}</h3>
                        <ul>
                            {generatedReports.slice(0, 5).map(report => (
                                <li key={report.generatedReportID}>
                                    {report.reportType} - {new Date(report.generatedAt).toLocaleDateString()}
                                    <button className='Download-report-btn' onClick={() => reportAPI.downloadReport(report.filePath).then(blob => {/* Download logic */ })}><FiDownload /></button>
                                </li>
                            ))}
                        </ul>
                        <button className="action-btn" onClick={() => navigate('/reports')}>{t('dashboard.viewAllReports')}</button>
                    </div>
                </section>

                {/* Receipt Book Summary */}
                <section className="dashboard-card xlarge-card">
                    <h2><FaBook /> {t('dashboard.receiptBookSummary')}</h2>
                    <hr />
                    <div>
                        <p>{t('dashboard.totalReceiptBooks')}: {numReceiptBooks}</p>
                        <div className="chart-grid">
                            <div className="chart-container">
                                <h3>{t('dashboard.receiptBooksByType')}</h3>
                                <PieChart width={400} height={310}>
                                    <Pie data={receiptBookPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                        {receiptBookPieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </div>
                            <div className="chart-container">
                                <h3>{t('dashboard.receiptBooksPerSupervisor')}</h3>
                                <BarChart width={400} height={300} data={receiptBooksPerSupervisor}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="books" fill="#4cb1c7" />
                                </BarChart>
                            </div>
                            <div className="chart-container">
                                <h3>{t('dashboard.receiptBookStatusDistribution')}</h3>
                                <PieChart width={400} height={300}>
                                    <Pie data={receiptBookStatusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                        {receiptBookStatusPieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Map */}
                <section className="dashboard-card full-width-card">
                    <h2><FaMapMarkedAlt /> {t('dashboard.map')}</h2>
                    <hr />
                    <div className="card-content">
                        <MapComponent />
                    </div>
                </section>

                {/* Additional KPIs */}
                <section className="dashboard-card full-width-card">
                    <h2><FaChartBar /> {t('dashboard.kpis')}</h2>
                    <hr />
                    <div className="card-content">
                        <div className="chart-grid chart-grid-1">
                            <div className="chart-container">
                                <h3>{t('dashboard.avgDurationPerSupervisor')}</h3>
                                <BarChart width={400} height={300} data={avgDurationPerSupervisor}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="avgDuration" fill="#4cb1c7" />
                                </BarChart>
                            </div>
                            <div className="chart-container">
                                <h3>{t('dashboard.visitAnomalies')}</h3>
                                <ScatterChart width={400} height={300}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis dataKey="duration" />
                                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                    <Scatter name="Anomalies" data={anomalies} fill="#930744" />
                                </ScatterChart>
                            </div>
                            <div className="chart-container">
                                <h3>{t('dashboard.agentsPerSupervisor')}</h3>
                                <BarChart width={400} height={300} data={agentsPerSupervisor}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="agents" fill="#4cb1c7" />
                                </BarChart>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </motion.div>
    );
};

export default RegionalManagerDashboard;
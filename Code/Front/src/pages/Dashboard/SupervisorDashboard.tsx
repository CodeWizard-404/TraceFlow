import React, { useEffect, useState, Component, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import agentAPI from '../../apis/agentAPI';
import locationApi from '../../apis/locationApi';
import receiptBookAPI from '../../apis/receiptBookAPI';
import timesheetAPI, { SyncTimesheetCalendarResponse, syncTimesheetToCalendar } from '../../apis/timesheetAPI';
import userAPI from '../../apis/userAPI';
import MapComponent from '../../components/Google/MapComponent';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ScatterChart, Scatter } from 'recharts';
import Agent from '../../models/Agent';
import Delegation from '../../models/Delegation';
import Governorate from '../../models/Governorate';
import ReceiptBook from '../../models/ReceiptBook';
import Region from '../../models/Region';
import Timesheet from '../../models/Timesheet';
import User from '../../models/User';
import ReceiptBookType from '../../models/ReceiptBookType';
import './SupervisorDashboard.css';
import { useTranslation } from 'react-i18next';
import { FaUsers, FaBook, FaClock, FaMapMarkerAlt, FaChartBar, FaSitemap, FaUser, FaUserCheck, FaMapSigns, FaHourglassHalf, FaCheckCircle, FaCalendarAlt, FaMapMarkedAlt, FaRobot, FaUserEdit, FaBell, FaSync } from 'react-icons/fa';
import { SlCalender } from "react-icons/sl";
import { GiBookPile } from "react-icons/gi";
import { toast } from 'react-toastify';
import { cn } from '../../lib/utils';
import { FixedSizeList } from 'react-window';
import NotificationItem from '../../components/ui/notification';
import { useNotification } from '../../context/NotificationContext';
import Notifcation from '../../models/Notification';

// Error Boundary Component
interface ErrorBoundaryProps {
    children: ReactNode;
    fallback: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }
        return this.props.children;
    }
}

const SupervisorDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { notifications, mergeNotifications, markAllAsRead } = useNotification();

    // State for data
    const [agents, setAgents] = useState<Agent[]>([]);
    const [agentLocations, setAgentLocations] = useState<any>(null);
    const [delegations, setDelegations] = useState<Delegation[]>([]);
    const [governorates, setGovernorates] = useState<Governorate[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
    const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
    const [regionalManager, setRegionalManager] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errors, setErrors] = useState<{ [key: string]: string | null }>({
        agents: null,
        locations: null,
        delegations: null,
        governorates: null,
        regions: null,
        receiptBooks: null,
        timesheets: null,
        regionalManager: null,
        visits: null,
    });
    const [receiptBookTypes, setReceiptBookTypes] = useState<ReceiptBookType[]>([]);
    const [director, setDirector] = useState<User | null>(null);
    const [regionalManagerRegions, setRegionalManagerRegions] = useState<Region[]>([]);
    const [visitFilters, setVisitFilters] = useState({
        status: '',
        agent: '',
        dateStart: '',
        dateEnd: '',
    });
    const [showMapPopup, setShowMapPopup] = useState(false);
    const [todayVisits, setTodayVisits] = useState<any[]>([]);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [notificationPage, setNotificationPage] = useState(1);
    const [isNotificationLoading, setIsNotificationLoading] = useState(false);
    const itemsPerPage = 20;

    // Colors for charts
    const COLORS = ['#4cb1c7', '#f5a800', '#036318', '#930744', '#8b8b8b', '#63b3ed', '#ff784e', '#00c49f', '#ffbb28', '#ff00ff'];

    const handleSyncToCalendar = async () => {
        if (!user || !isLoading) return;
        setIsLoading(true);
        try {
            const response: SyncTimesheetCalendarResponse = await syncTimesheetToCalendar(user.userID);
            const created = response.filter(r => r.status === 'created').length;
            const updated = response.filter(r => r.status === 'updated').length;
            toast.success(`Synced ${created} new and ${updated} updated events to calendar`);
            console.log(`Timesheet for user ${user.userID} synced: ${created} created, ${updated} updated`);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to sync timesheet to calendar';
            toast.error(errorMsg);
            console.error('Timesheet sync error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Placeholder function for fetching notifications
    const getLatestNotifications = async (userID: string, limit: number): Promise<Notifcation[]> => {
        return Promise.resolve([]);
    };

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            const newErrors = { ...errors };

            try {
                if (!user) throw new Error('User not authenticated');

                const fetchAgents = async () => {
                    try {
                        const agentsData = await agentAPI.getAgentsByUser(user.userID);
                        setAgents(agentsData.agents || []);
                    } catch (err) {
                        newErrors.agents = t('dashboard.errors.agents');
                        console.error('Error fetching agents:', err);
                    }
                };

                const fetchLocations = async () => {
                    try {
                        const locationsData = await agentAPI.getAgentLocations();
                        setAgentLocations(locationsData || null);
                    } catch (err) {
                        newErrors.locations = t('dashboard.errors.locations');
                        console.error('Error fetching locations:', err);
                    }
                };

                const fetchDelegations = async () => {
                    try {
                        const delegationsData = await locationApi.getDelegationsByUser(user.userID);
                        setDelegations(delegationsData || []);
                    } catch (err) {
                        newErrors.delegations = t('dashboard.errors.delegations');
                        console.error('Error fetching delegations:', err);
                    }
                };

                const fetchGovernorates = async () => {
                    try {
                        const governoratesData = await locationApi.getGovernoratesByUser(user.userID);
                        setGovernorates(governoratesData || []);
                    } catch (err) {
                        newErrors.governorates = t('dashboard.errors.governorates');
                        console.error('Error fetching governorates:', err);
                    }
                };

                const fetchRegions = async () => {
                    try {
                        const regionsData = await locationApi.getRegionsByUser(user.userID);
                        setRegions(regionsData || []);
                    } catch (err) {
                        newErrors.regions = t('dashboard.errors.regions');
                        console.error('Error fetching regions:', err);
                    }
                };

                const fetchReceiptBooks = async () => {
                    try {
                        const supervisorReceiptBooks = await receiptBookAPI.getReceiptBooksByHolder(user.userID, 'user');
                        const agentReceiptBooks = await Promise.all(
                            agents.map(agent => receiptBookAPI.getReceiptBooksByHolder(agent.agentID, 'agent').catch(() => []))
                        ).then(results => results.flat());
                        setReceiptBooks([...(supervisorReceiptBooks || []), ...(agentReceiptBooks || [])]);
                    } catch (err) {
                        newErrors.receiptBooks = t('dashboard.errors.receiptBooks');
                        console.error('Error fetching receipt books:', err);
                    }
                };

                const fetchTimesheets = async () => {
                    try {
                        const timesheetsData = await timesheetAPI.getTimesheetsBySupervisor(user.userID);
                        const sortedTimesheets = (timesheetsData || []).sort((a, b) => a.weekNumber - b.weekNumber);
                        setTimesheets(sortedTimesheets);
                    } catch (err) {
                        newErrors.timesheets = t('dashboard.errors.timesheets');
                        console.error('Error fetching timesheets:', err);
                    }
                };

                const fetchRegionalManager = async () => {
                    try {
                        const regionalManagerData = await userAPI.getRegionalManagerBySupervisor(user.userID);
                        const rm = regionalManagerData[0] || null;
                        setRegionalManager(rm);
                        if (rm) {
                            const directorData = await userAPI.getDirectorByUser(rm.userID);
                            setDirector(directorData[0] || null);
                            const regionsData = await locationApi.getRegionsByUser(rm.userID);
                            setRegionalManagerRegions(regionsData || []);
                        }
                    } catch (err) {
                        newErrors.regionalManager = t('dashboard.errors.regionalManager');
                        console.error('Error fetching regional manager:', err);
                    }
                };

                const fetchReceiptBookTypes = async () => {
                    try {
                        const typesData = await receiptBookAPI.getAllReceiptBookTypes();
                        setReceiptBookTypes(typesData || []);
                    } catch (err) {
                        console.error('Error fetching receipt book types:', err);
                    }
                };

                const fetchNotifications = async () => {
                    try {
                        const notifs = await getLatestNotifications(user.userID, 5);
                        mergeNotifications(notifs);
                    } catch (error) {
                        console.error('Error fetching notifications:', error);
                    }
                };

                const fetchUserLocation = () => {
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                            (position) => {
                                setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
                            },
                            (error) => {
                                console.error('Geolocation error:', error);
                            }
                        );
                    }
                };

                await Promise.all([
                    fetchAgents(),
                    fetchLocations(),
                    fetchDelegations(),
                    fetchGovernorates(),
                    fetchRegions(),
                    fetchReceiptBooks(),
                    fetchTimesheets(),
                    fetchRegionalManager(),
                    fetchReceiptBookTypes(),
                    fetchNotifications(),
                    fetchUserLocation(),
                ]);

                setErrors(newErrors);
            } catch (err) {
                console.error('Unexpected error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [user, t]);

    // KPI Calculations
    const allVisits = timesheets.flatMap(ts => ts.Visits || []);
    const numAgents = agents.length;
    const numReceiptBooks = receiptBooks.length;
    const numVisits = allVisits.length;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const visitsLast7Days = allVisits.filter(visit => new Date(visit.date) >= sevenDaysAgo).length;
    const pendingVisits = allVisits.filter(visit => visit.status === 'pending').length;
    const agentsWithVisits = new Set(allVisits.map(visit => visit.agentID).filter(id => id)).size;
    const activeAgents = agents.filter(agent => allVisits.some(visit => visit.agentID === agent.agentID && new Date(visit.date) >= sevenDaysAgo)).length;
    const totalDelegations = delegations.length;
    const avgVisitDuration = allVisits.length > 0 ? Number((allVisits.reduce((sum, visit) => sum + (visit.duration || 0), 0) / allVisits.length).toFixed(2)) : 0;
    const ValidatedVists = allVisits.filter(visit => visit.status === 'validated').length;
    const completionRate = allVisits.length > 0 ? Number(((allVisits.filter(visit => visit.status === 'visited').length / allVisits.length) * 100).toFixed(1)) : 0;

    // Filtered visits
    const filteredVisits = allVisits.filter(visit => {
        const statusMatch = !visitFilters.status || visit.status === visitFilters.status;
        const agentMatch = !visitFilters.agent || visit.agentID === visitFilters.agent;
        const date = new Date(visit.date);
        const dateStart = visitFilters.dateStart ? new Date(visitFilters.dateStart) : null;
        const dateEnd = visitFilters.dateEnd ? new Date(visitFilters.dateEnd) : null;
        const dateMatch = (!dateStart || date >= dateStart) && (!dateEnd || date <= dateEnd);
        return statusMatch && agentMatch && dateMatch;
    });

    // Chart Data
    const visitStatusCounts = filteredVisits.reduce((acc, visit) => {
        acc[visit.status] = (acc[visit.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const visitPieData = Object.keys(visitStatusCounts).map(status => ({
        name: status,
        value: visitStatusCounts[status],
    }));

    const visitsByDate = filteredVisits.reduce((acc, visit) => {
        const date = visit.date.split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const visitTrendData = Object.keys(visitsByDate).sort().map(date => ({
        date,
        visits: visitsByDate[date],
    }));

    const receiptBooksByType = receiptBooks.reduce((acc, book) => {
        const typeName = receiptBookTypes.find(type => type.typeID === book.typeID)?.name || 'Unknown';
        acc[typeName] = (acc[typeName] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const receiptBookBarData = Object.keys(receiptBooksByType).map(type => ({
        type,
        count: receiptBooksByType[type],
    }));

    const visitsPerAgent = agents.map(agent => {
        const agentVisits = allVisits.filter(visit => visit.agentID === agent.agentID);
        return {
            name: `${agent.name} ${agent.lastname}`,
            visits: agentVisits.length,
        };
    }).filter(agent => agent.visits > 0);

    const visitTrends = timesheets.map(ts => ({
        week: `Week ${ts.weekNumber}`,
        visits: ts.Visits?.length || 0,
    }));

    const agentStats = timesheets.reduce((acc, ts) => {
        ts.Visits?.forEach(visit => {
            if (visit.agentID) {
                if (!acc[visit.agentID]) {
                    acc[visit.agentID] = { visitCount: 0, durations: [] };
                }
                acc[visit.agentID].visitCount++;
                if (visit.duration != null) {
                    acc[visit.agentID].durations.push(visit.duration);
                }
            }
        });
        return acc;
    }, {} as { [key: string]: { visitCount: number; durations: number[] } });

    const averageDurationPerAgent = Object.keys(agentStats).map(agentID => {
        const agent = agents.find(a => a.agentID === agentID);
        const durations = agentStats[agentID].durations;
        const average = durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;
        return {
            name: agent ? `${agent.name} ${agent.lastname}` : agentID,
            averageDuration: Number(average.toFixed(2)),
        };
    }).filter(agent => agent.averageDuration > 0);

    const agentVisitTrendsData = timesheets.map(ts => {
        const weekData: { week: string;[key: string]: string | number } = { week: `Week ${ts.weekNumber}` };
        agents.forEach(agent => {
            const agentVisits = (ts.Visits || []).filter(visit => visit.agentID === agent.agentID).length;
            weekData[`${agent.name} ${agent.lastname}`] = agentVisits;
        });
        return weekData;
    });

    const agentDelegationMap = agents.reduce((map, agent) => {
        map[agent.agentID] = agent.delegationID;
        return map;
    }, {} as Record<string, string>);

    const visitsByDelegation = allVisits.reduce((acc, visit) => {
        const delegationID = agentDelegationMap[visit.agentID!];
        if (delegationID) {
            acc[delegationID] = (acc[delegationID] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    const delegationNameMap = delegations.reduce((map, del) => {
        map[del.delegationID] = del.name;
        return map;
    }, {} as Record<string, string>);

    const visitsPerDelegationData = Object.keys(visitsByDelegation).map(delegationID => ({
        name: delegationNameMap[delegationID] || delegationID,
        visits: visitsByDelegation[delegationID],
    }));



    const visitsPerDayLast30 = (() => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const visitsByDay = allVisits.reduce((acc, visit) => {
            const date = visit.date.split('T')[0];
            if (new Date(date) >= thirtyDaysAgo) {
                acc[date] = (acc[date] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);
        return Object.keys(visitsByDay).sort().map(date => ({
            date,
            visits: visitsByDay[date],
        }));
    })();

    const durationTrends = allVisits.reduce((acc, visit) => {
        const date = visit.date.split('T')[0];
        if (visit.duration) {
            if (!acc[date]) acc[date] = [];
            acc[date].push(visit.duration);
        }
        return acc;
    }, {} as Record<string, number[]>);
    const avgDurationPerDay = Object.keys(durationTrends).sort().map(date => ({
        date,
        avgDuration: durationTrends[date].reduce((sum, d) => sum + d, 0) / durationTrends[date].length,
    }));

    const visitsScatterData = allVisits.map(visit => ({
        date: visit.date.split('T')[0],
        duration: visit.duration || 0,
        agent: agents.find(a => a.agentID === visit.agentID)?.name || 'Unknown',
    }));

    // Quick Action Handlers
    const handleStartVisit = () => {
        const today = new Date().toISOString().split('T')[0];
        const todayVisitsFiltered = allVisits.filter(visit => visit.date.split('T')[0] === today);
        setTodayVisits(todayVisitsFiltered);
        setShowMapPopup(true);
    };

    const handleGenerateTimesheets = () => {
        navigate('/timesheet', { state: { openSuggestionModal: true } });
    };

    const handleEditProfile = () => {
        navigate('/profile');
    };

    const handleEditNotificationPreferences = () => {
        navigate('/profile', { state: { scrollTo: 'notification-preferences' } });
    };

    const handleRefreshNotifications = async () => {
        setIsNotificationLoading(true);
        try {
            const fetchedNotifications = await getLatestNotifications(user!.userID, itemsPerPage);
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
            setNotificationPage((prev) => prev + 1);
        }
    };

    const filteredNotifications = notifications
        .filter((n) => n.status !== 'read' && n.channel === 'in-app')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const paginatedNotifications = filteredNotifications.slice(0, notificationPage * itemsPerPage);
    const unreadCount = filteredNotifications.length;

    const NotificationRow = ({ index, style }: { index: number; style: React.CSSProperties }) => (
        <div style={style}>
            <NotificationItem
                notification={paginatedNotifications[index]}
            />
        </div>
    );

    if (isLoading) {
        return (
            <div className="dashboard-container">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="dashboard-container supervisor-container"
                >
                    {/* Skeleton for Header */}
                    <header className="dashboard-header dashboard-header-1">
                        <div className="header-top">
                            <div className="header-left">
                                <div className="custom-skeleton pulsing" style={{ width: '200px', height: '30px' }} />
                            </div>
                            <div className="user-profile">
                                <div className="custom-skeleton pulsing" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                                <div className="custom-skeleton pulsing" style={{ width: '100px', height: '20px', marginLeft: '10px' }} />
                            </div>
                        </div>
                        <div className="header-stats">
                            {[...Array(9)].map((_, i) => (
                                <div key={i} className="stat-card">
                                    <div className="custom-skeleton pulsing" style={{ width: '40px', height: '40px', margin: '10px' }} />
                                    <div className="stat-content">
                                        <div className="custom-skeleton pulsing" style={{ width: '100px', height: '20px', margin: '5px 0' }} />
                                        <div className="custom-skeleton pulsing" style={{ width: '60px', height: '30px', margin: '5px 0' }} />
                                        <div className="custom-skeleton pulsing" style={{ width: '120px', height: '15px', margin: '5px 0' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </header>

                    {/* Skeleton for Main Dashboard Grid */}
                    <div className="dashboard-grid">
                        {/* Skeleton for Quick Actions Card */}
                        <section className="dashboard-card quick-actions-card">
                            <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                            <hr />
                            <div className="action-grid">
                                {[...Array(7)].map((_, i) => (
                                    <div key={i} className="custom-skeleton pulsing" style={{ width: '100%', height: '40px', margin: '5px' }} />
                                ))}
                            </div>
                        </section>

                        <div className="dashboard-card-22">
                            {/* Skeleton for Agents Assigned Card */}
                            <section className="dashboard-card medium-card">
                                <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                                <hr />
                                <div className="card-content agents-card">
                                    <div className="custom-skeleton pulsing" style={{ width: '100%', height: '20px', margin: '10px 0' }} />
                                    <div className="custom-skeleton pulsing" style={{ width: '100%', height: '20px', margin: '10px 0' }} />
                                    <div className="custom-skeleton pulsing" style={{ width: '120px', height: '35px', margin: '10px 0' }} />
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
                        </div>

                        {/* Skeleton for Hierarchy Card */}
                        <section className="dashboard-card medium-card">
                            <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                            <hr />
                            <div className="card-content">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="hierarchy-level">
                                        <div className="custom-skeleton pulsing" style={{ width: '100px', height: '20px', margin: '5px 0' }} />
                                        <div className="custom-skeleton pulsing" style={{ width: '150px', height: '15px', margin: '5px 0' }} />
                                        <div className="custom-skeleton pulsing" style={{ width: '150px', height: '15px', margin: '5px 0' }} />
                                        <div className="custom-skeleton pulsing" style={{ width: '100px', height: '15px', margin: '5px 0' }} />
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Skeleton for Receipt Books Card */}
                        <section className="dashboard-card medium-card">
                            <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                            <hr />
                            <div className="card-content">
                                <div className="custom-skeleton pulsing" style={{ width: '100%', height: '20px', margin: '10px 0' }} />
                                <div className="chart-container">
                                    <div className="custom-skeleton pulsing" style={{ width: '270px', height: '400px', margin: '10px 0' }} />
                                </div>
                            </div>
                        </section>

                        {/* Skeleton for Visits Card */}
                        <section className="dashboard-card large-card">
                            <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                            <hr />
                            <div className="card-content">
                                <div className="filter-bar">
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} className="custom-skeleton pulsing" style={{ width: '150px', height: '30px', margin: '5px' }} />
                                    ))}
                                </div>
                                <div className="custom-skeleton pulsing" style={{ width: '100%', height: '20px', margin: '10px 0' }} />
                                <div className="chart-grid chart-grid-2">
                                    <div className="chart-container">
                                        <div className="custom-skeleton pulsing" style={{ width: '300px', height: '300px', margin: '10px 0' }} />
                                    </div>
                                    <div className="chart-container">
                                        <div className="custom-skeleton pulsing" style={{ width: '500px', height: '300px', margin: '10px 0' }} />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Skeleton for Locations Card */}
                        <section className="dashboard-card full-width-card">
                            <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                            <hr />
                            <div className="card-content">
                                <div className="custom-skeleton pulsing" style={{ width: '100%', height: '400px', margin: '10px 0' }} />
                            </div>
                        </section>

                        {/* Skeleton for KPIs Card */}
                        <section className="dashboard-card full-width-card">
                            <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                            <hr />
                            <div className="card-content">
                                <div className="chart-grid chart-grid-1">
                                    {[...Array(8)].map((_, i) => (
                                        <div key={i} className="chart-container">
                                            <div className="custom-skeleton pulsing" style={{ width: '600px', height: '300px', margin: '10px 0' }} />
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
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="dashboard-container supervisor-container"
        >
            {/* Enhanced Header */}
            <header className="dashboard-header dashboard-header-1">
                <div className="header-top">
                    <div className="header-left">
                        <h1>{t('dashboard.title')}</h1>
                    </div>
                    <div className="user-profile">
                        <FaUser className="user-icon" />
                        <span>{`${user?.firstname} ${user?.lastname}`}</span>
                    </div>
                </div>
                <div className="header-stats">
                    <div className="stat-card">
                        <FaUsers className="card-icon" />
                        <div className="stat-content">
                            <h3>{t('dashboard.agents')}</h3>
                            <p className="stat-value">{numAgents}</p>
                            <p className="stat-description">{t('dashboard.agentsAssigned')}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <FaBook className="card-icon" />
                        <div className="stat-content">
                            <h3>{t('dashboard.receiptBooks')}</h3>
                            <p className="stat-value">{numReceiptBooks}</p>
                            <p className="stat-description">{t('dashboard.receiptBooksNetwork')}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <FaMapMarkerAlt className="card-icon" />
                        <div className="stat-content">
                            <h3>{t('dashboard.visits')}</h3>
                            <p className="stat-value">{numVisits}</p>
                            <p className="stat-description">{t('dashboard.visitsLogged')}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <FaClock className="card-icon" />
                        <div className="stat-content">
                            <h3>{t('dashboard.visitsLast7Days')}</h3>
                            <p className="stat-value">{visitsLast7Days}</p>
                            <p className="stat-description">{t('dashboard.visitsInLast7Days')}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <FaClock className="card-icon" />
                        <div className="stat-content">
                            <h3>{t('dashboard.pendingVisits')}</h3>
                            <p className="stat-value">{pendingVisits}</p>
                            <p className="stat-description">{t('dashboard.pendingVisitsDescription')}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <FaUserCheck className="card-icon" />
                        <div className="stat-content">
                            <h3>{t('dashboard.activeAgents')}</h3>
                            <p className="stat-value">{activeAgents}</p>
                            <p className="stat-description">{t('dashboard.activeAgentsLast7Days')}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <FaMapSigns className="card-icon" />
                        <div className="stat-content">
                            <h3>{t('dashboard.totalDelegations')}</h3>
                            <p className="stat-value">{totalDelegations}</p>
                            <p className="stat-description">{t('dashboard.delegationsAssigned')}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <FaHourglassHalf className="card-icon" />
                        <div className="stat-content">
                            <h3>{t('dashboard.avgVisitDuration')}</h3>
                            <p className="stat-value">{avgVisitDuration}</p>
                            <p className="stat-description">{t('dashboard.avgDurationMinutes')}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <FaCheckCircle className="card-icon" />
                        <div className="stat-content">
                            <h3>{t('dashboard.validatedVisits')}</h3>
                            <p className="stat-value">{ValidatedVists}</p>
                            <p className="stat-description">{t('dashboard.validatedVisitsNb')}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <FaCheckCircle className="card-icon" />
                        <div className="stat-content">
                            <h3>{t('dashboard.completionRate')}</h3>
                            <p className="stat-value">{completionRate}%</p>
                            <p className="stat-description">{t('dashboard.validatedVisitsRate')}</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Dashboard Grid */}
            <div className="dashboard-grid">
                {/* Quick Actions Card */}
                <section className="dashboard-card quick-actions-card">
                    <h2>{t('dashboard.quickActions')}</h2>
                    <hr />
                    <div className="action-grid">
                        <button className="action-btn action-btn-88" onClick={() => navigate('/timesheet-form')}>
                            <SlCalender /><span>{t('dashboard.addTimesheet')}</span>
                        </button>
                        <button className="action-btn action-btn-88" onClick={() => navigate('/transfer-receipt-books')}>
                            <GiBookPile /><span>{t('dashboard.assignReceiptBook')}</span>
                        </button>
                        <button className="action-btn action-btn-88" onClick={handleSyncToCalendar}>
                            <FaCalendarAlt /> <span>Sync to Calendar</span>
                        </button>
                        <button className="action-btn action-btn-88" onClick={handleStartVisit}>
                            <FaMapMarkedAlt /> <span>Start Visit</span>
                        </button>
                        <button className="action-btn action-btn-88" onClick={handleGenerateTimesheets}>
                            <FaRobot /> <span>Generate Timesheets</span>
                        </button>
                        <button className="action-btn action-btn-88" onClick={handleEditProfile}>
                            <FaUserEdit /> <span>Edit Profile</span>
                        </button>
                        <button className="action-btn action-btn-88" onClick={handleEditNotificationPreferences}>
                            <FaBell /> <span>Notification Preferences</span>
                        </button>
                    </div>
                </section>
                <div className="dashboard-card-22">

                    {/* Agents Assigned Card */}
                    <ErrorBoundary fallback={<div className="dashboard-card"><p className="error-text">{t('dashboard.errors.agents')}</p></div>}>
                        {!errors.agents && (
                            <section className="dashboard-card medium-card">
                                <h2><FaUsers /> {t('dashboard.agentsAssigned')}</h2>
                                <hr />
                                <div className="card-content agents-card">
                                    <p style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontFamily: "'Inter', sans-serif",
                                        fontSize: '0.875rem',
                                        color: '#6b7280',
                                        margin: '0.25rem 0',
                                        padding: '0.5rem 0',
                                        borderBottom: '1px solid #eee'
                                    }}>
                                        <FaUsers style={{ color: '#4cb1c7', fontSize: '1.5rem' }} />
                                        {t('dashboard.totalAgents')}: {agents.length}
                                    </p>
                                    <p style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontFamily: "'Inter', sans-serif",
                                        fontSize: '0.875rem',
                                        color: '#6b7280',
                                        margin: '0.25rem 0',
                                        padding: '0.5rem 0',
                                        borderBottom: '1px solid #eee'
                                    }}>
                                        <FaUserCheck style={{ color: '#4cb1c7', fontSize: '1.5rem' }} />
                                        {t('dashboard.agentsWithVisits')}: {agentsWithVisits}
                                    </p>
                                    <button className="action-btn primary" onClick={() => navigate('/agents')}>
                                        {t('dashboard.viewAllAgents')}
                                    </button>
                                </div>
                            </section>
                        )}
                    </ErrorBoundary>

                    {/* Notifications Card */}
                    <section className="dashboard-card medium-card notifications-card">
                        <h2>Latest Notifications {unreadCount > 0 && <span className="unread-count">{unreadCount}</span>}</h2>
                        <hr />
                        <div>
                            <div className="notification-panel-header">
                                <div className="notification-panel-controls">
                                    <button onClick={handleRefreshNotifications} className="control-button" disabled={isNotificationLoading}>
                                        <FaSync className={cn(isNotificationLoading && 'spinning')} />
                                    </button>
                                    <button onClick={handleMarkAllRead} className="control-button" disabled={isNotificationLoading || unreadCount === 0}>
                                        Clear
                                    </button>
                                </div>
                            </div>
                            {isNotificationLoading && (
                                <div className="notification-skeleton">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="skeleton-item pulsing" />
                                    ))}
                                </div>
                            )}
                            {!isNotificationLoading && paginatedNotifications.length === 0 ? (
                                <p className="no-notifications">No unread notifications</p>
                            ) : (
                                <FixedSizeList
                                    height={150}
                                    width="100%"
                                    itemCount={paginatedNotifications.length}
                                    itemSize={62}
                                    onItemsRendered={({ visibleStopIndex }) => {
                                        if (visibleStopIndex >= paginatedNotifications.length - 1) loadMoreNotifications();
                                    }}
                                >
                                    {NotificationRow}
                                </FixedSizeList>
                            )}
                        </div>
                    </section>
                </div>

                {/* Hierarchy Card */}
                <ErrorBoundary fallback={<div className="dashboard-card medium-card"><p className="error-text">{t('dashboard.errors.regionalManager')}</p></div>}>
                    {!errors.regionalManager && (
                        <section className="dashboard-card medium-card">
                            <h2><FaSitemap /> {t('dashboard.hierarchy')}</h2>
                            <hr />
                            <div className="card-content">
                                {director && (
                                    <div className="hierarchy-level">
                                        <h3>{t('dashboard.director')}</h3>
                                        <p>{`${director.firstname} ${director.lastname}`}</p>
                                        <p>{t('dashboard.email')}: {director.email}</p>
                                        <p>{t('dashboard.phone')}: {director.phone}</p>
                                    </div>
                                )}
                                {regionalManager && (
                                    <div className="hierarchy-level">
                                        <h3>{t('dashboard.regionalManager')}</h3>
                                        <p>{`${regionalManager.firstname} ${regionalManager.lastname}`}</p>
                                        <p>{t('dashboard.email')}: {regionalManager.email}</p>
                                        <p>{t('dashboard.phone')}: {regionalManager.phone}</p>
                                        <h4>{t('dashboard.assignedRegions')}</h4>
                                        <ul>
                                            {regionalManagerRegions.map(region => (
                                                <li key={region.regionID}>{region.name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <div className="hierarchy-level">
                                    <h3>{t('dashboard.supervisor')}</h3>
                                    <p>{`${user?.firstname} ${user?.lastname}`}</p>
                                    <h4>{t('dashboard.assignedGovernorates')}</h4>
                                    {governorates.map(gov => (
                                        <div key={gov.governorateID}>
                                            <h5>{gov.name}</h5>
                                            <ul>
                                                {delegations.filter(del => del.governorateID === gov.governorateID).map(del => (
                                                    <li key={del.delegationID}>{del.name}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}
                </ErrorBoundary>

                {/* Receipt Books Card */}
                <ErrorBoundary fallback={<div className="dashboard-card medium-card"><p className="error-text">{t('dashboard.errors.receiptBooks')}</p></div>}>
                    {!errors.receiptBooks && (
                        <section className="dashboard-card medium-card">
                            <h2><FaBook /> {t('dashboard.receiptBooks')}</h2>
                            <hr />
                            <div className="card-content">
                                <p>{t('dashboard.totalReceiptBooks')}: {receiptBooks.length}</p>
                                <ErrorBoundary fallback={<p className="error-text">{t('dashboard.errors.receiptBookTypeChart')}</p>}>
                                    {receiptBookBarData.length > 0 && (
                                        <div className="chart-container">
                                            <h3>{t('dashboard.receiptBooksByType')}</h3>
                                            <BarChart width={270} height={400} data={receiptBookBarData}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="type" />
                                                <YAxis />
                                                <Tooltip />
                                                <Legend />
                                                <Bar dataKey="count" fill="#4cb1c7" />
                                            </BarChart>
                                        </div>
                                    )}
                                </ErrorBoundary>
                            </div>
                        </section>
                    )}
                </ErrorBoundary>

                {/* Visits Card */}
                <ErrorBoundary fallback={<div className="dashboard-card large-card"><p className="error-text">{t('dashboard.errors.timesheets')}</p></div>}>
                    {!errors.timesheets && (
                        <section className="dashboard-card large-card">
                            <h2><FaClock /> {t('dashboard.visits')}</h2>
                            <hr />
                            <div className="card-content">
                                <div className="filter-bar">
                                    <select
                                        value={visitFilters.status}
                                        onChange={(e) => setVisitFilters({ ...visitFilters, status: e.target.value })}
                                    >
                                        <option value="">{t('dashboard.allStatuses')}</option>
                                        <option value="pending">{t('dashboard.pending')}</option>
                                        <option value="validated">{t('dashboard.validated')}</option>
                                    </select>
                                    <select
                                        value={visitFilters.agent}
                                        onChange={(e) => setVisitFilters({ ...visitFilters, agent: e.target.value })}
                                    >
                                        <option value="">{t('dashboard.allAgents')}</option>
                                        {agents.map(agent => (
                                            <option key={agent.agentID} value={agent.agentID}>{`${agent.name} ${agent.lastname}`}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="date"
                                        value={visitFilters.dateStart}
                                        onChange={(e) => setVisitFilters({ ...visitFilters, dateStart: e.target.value })}
                                    />
                                    <input
                                        type="date"
                                        value={visitFilters.dateEnd}
                                        onChange={(e) => setVisitFilters({ ...visitFilters, dateEnd: e.target.value })}
                                    />
                                </div>
                                <p>{t('dashboard.totalVisits')}: {filteredVisits.length}</p>
                                <div className="chart-grid chart-grid-2">
                                    <ErrorBoundary fallback={<p className="error-text">{t('dashboard.errors.visitStatusChart')}</p>}>
                                        {visitPieData.length > 0 && (
                                            <div className="chart-container">
                                                <h3>{t('dashboard.visitStatusDistribution')}</h3>
                                                <PieChart width={300} height={300}>
                                                    <Pie data={visitPieData} cx={150} cy={150} labelLine={false} outerRadius={80} dataKey="value">
                                                        {visitPieData.map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                    <Legend />
                                                </PieChart>
                                            </div>
                                        )}
                                    </ErrorBoundary>
                                    <ErrorBoundary fallback={<p className="error-text">{t('dashboard.errors.visitTrendChart')}</p>}>
                                        {visitTrendData.length > 0 && (
                                            <div className="chart-container">
                                                <h3>{t('dashboard.visitTrends')}</h3>
                                                <LineChart width={500} height={300} data={visitTrendData}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="date" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Legend />
                                                    <Line type="monotone" dataKey="visits" stroke="#4cb1c7" />
                                                </LineChart>
                                            </div>
                                        )}
                                    </ErrorBoundary>
                                </div>
                            </div>
                        </section>
                    )}
                </ErrorBoundary>

                {/* Locations Card */}
                <ErrorBoundary fallback={<div className="dashboard-card full-width-card"><p className="error-text">{t('dashboard.errors.locations')}</p></div>}>
                    {(
                        <section className="dashboard-card full-width-card">
                            <h2><FaMapMarkerAlt /> {t('dashboard.assignedLocations')}</h2>
                            <hr />
                            <div className="card-content">
                                <MapComponent />
                            </div>
                        </section>
                    )}
                </ErrorBoundary>

                {/* KPIs Card */}
                <ErrorBoundary fallback={<div className="dashboard-card full-width-card"><p className="error-text">{t('dashboard.errors.kpis')}</p></div>}>
                    {!errors.agents && !errors.timesheets && (
                        <section className="dashboard-card full-width-card">
                            <h2><FaChartBar /> {t('dashboard.kpis')}</h2>
                            <hr />
                            <div className="card-content">
                                <div className="chart-grid chart-grid-1">
                                    <ErrorBoundary fallback={<p className="error-text">{t('dashboard.errors.visitsPerAgent')}</p>}>
                                        {visitsPerAgent.length > 0 && (
                                            <div className="chart-container">
                                                <h3>{t('dashboard.visitsPerAgent')}</h3>
                                                <BarChart width={600} height={300} data={visitsPerAgent}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="name" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Legend />
                                                    <Bar dataKey="visits" fill="#4cb1c7" />
                                                </BarChart>
                                            </div>
                                        )}
                                    </ErrorBoundary>
                                    <ErrorBoundary fallback={<p className="error-text">{t('dashboard.errors.visitTrends')}</p>}>
                                        {visitTrends.length > 0 && (
                                            <div className="chart-container">
                                                <h3>{t('dashboard.visitTrends')}</h3>
                                                <LineChart width={600} height={300} data={visitTrends}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="week" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Legend />
                                                    <Line type="monotone" dataKey="visits" stroke="#4cb1c7" />
                                                </LineChart>
                                            </div>
                                        )}
                                    </ErrorBoundary>
                                    <ErrorBoundary fallback={<p className="error-text">{t('dashboard.errors.averageVisitDuration')}</p>}>
                                        {averageDurationPerAgent.length > 0 && (
                                            <div className="chart-container">
                                                <h3>{t('dashboard.averageVisitDuration')}</h3>
                                                <BarChart width={600} height={300} data={averageDurationPerAgent}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="name" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Legend />
                                                    <Bar dataKey="averageDuration" fill="#4cb1c7" />
                                                </BarChart>
                                            </div>
                                        )}
                                    </ErrorBoundary>
                                    <ErrorBoundary fallback={<p className="error-text">{t('dashboard.errors.agentActivity')}</p>}>
                                        {agentVisitTrendsData.length > 0 && (
                                            <div className="chart-container">
                                                <h3>{t('dashboard.agentActivity')}</h3>
                                                <LineChart width={600} height={300} data={agentVisitTrendsData}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="week" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Legend />
                                                    {agents.map((agent, index) => (
                                                        <Line
                                                            key={agent.agentID}
                                                            type="monotone"
                                                            dataKey={`${agent.name} ${agent.lastname}`}
                                                            stroke={COLORS[index % COLORS.length]}
                                                        />
                                                    ))}
                                                </LineChart>
                                            </div>
                                        )}
                                    </ErrorBoundary>
                                    <ErrorBoundary fallback={<p className="error-text">{t('dashboard.errors.visitsPerDelegation')}</p>}>
                                        {visitsPerDelegationData.length > 0 && (
                                            <div className="chart-container">
                                                <h3>{t('dashboard.visitsPerDelegation')}</h3>
                                                <BarChart width={600} height={300} data={visitsPerDelegationData}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="name" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Legend />
                                                    <Bar dataKey="visits" fill="#4cb1c7" />
                                                </BarChart>
                                            </div>
                                        )}
                                    </ErrorBoundary>
                                    <ErrorBoundary fallback={<p className="error-text">{t('dashboard.errors.visitsPerDayLast30')}</p>}>
                                        {visitsPerDayLast30.length > 0 && (
                                            <div className="chart-container">
                                                <h3>{t('dashboard.visitsPerDayLast30')}</h3>
                                                <AreaChart width={600} height={300} data={visitsPerDayLast30}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="date" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Legend />
                                                    <Area type="monotone" dataKey="visits" stroke="#4cb1c7" fill="#4cb1c7" fillOpacity={0.3} />
                                                </AreaChart>
                                            </div>
                                        )}
                                    </ErrorBoundary>
                                    <ErrorBoundary fallback={<p className="error-text">{t('dashboard.errors.avgDurationPerDay')}</p>}>
                                        {avgDurationPerDay.length > 0 && (
                                            <div className="chart-container">
                                                <h3>{t('dashboard.avgDurationPerDay')}</h3>
                                                <LineChart width={600} height={300} data={avgDurationPerDay}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="date" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Legend />
                                                    <Line type="monotone" dataKey="avgDuration" stroke="#4cb1c7" />
                                                </LineChart>
                                            </div>
                                        )}
                                    </ErrorBoundary>
                                    <ErrorBoundary fallback={<p className="error-text">{t('dashboard.errors.visitsScatter')}</p>}>
                                        {visitsScatterData.length > 0 && (
                                            <div className="chart-container">
                                                <h3>{t('dashboard.visitsScatter')}</h3>
                                                <ScatterChart width={600} height={300}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="date" />
                                                    <YAxis dataKey="duration" />
                                                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                                    <Legend />
                                                    <Scatter name="Visits" data={visitsScatterData} fill="#4cb1c7" />
                                                </ScatterChart>
                                            </div>
                                        )}
                                    </ErrorBoundary>
                                </div>
                            </div>
                        </section>
                    )}
                </ErrorBoundary>
            </div>

            {/* Map Popup */}
            {showMapPopup && (
                <div className="map-popup">
                    <button className="map-popup-close" onClick={() => setShowMapPopup(false)}>Close</button>
                    <MapComponent
                        visits={todayVisits.map(visit => ({
                            visitID: visit.visitID,
                            latitude: visit.latitude || 0,
                            longitude: visit.longitude || 0,
                            location: visit.location || 'Unknown',
                            time: visit.time,
                            reasons: visit.Reasons ? visit.Reasons.map((r: any) => r.item).join(', ') : '',
                            agentName: agents.find(a => a.agentID === visit.agentID)?.name || 'Unknown'
                        }))}
                        userLocation={userLocation}
                        isTimesheetModal={true}
                    />
                </div>
            )}
        </motion.div>
    );
};

export default SupervisorDashboard;


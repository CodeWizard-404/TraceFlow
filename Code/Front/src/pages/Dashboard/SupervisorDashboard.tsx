/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, Component, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import agentAPI from '../../apis/agentAPI';
import locationApi from '../../apis/locationApi';
import receiptBookAPI from '../../apis/receiptBookAPI';
import timesheetAPI from '../../apis/timesheetAPI';
import userAPI from '../../apis/userAPI';
import MapComponent from '../../components/Google/MapComponent';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import Agent from '../../models/Agent';
import Delegation from '../../models/Delegation';
import Governorate from '../../models/Governorate';
import ReceiptBook from '../../models/ReceiptBook';
import Region from '../../models/Region';
import Timesheet from '../../models/Timesheet';
import User from '../../models/User';
import './SupervisorDashboard.css';
import { useTranslation } from 'react-i18next';
import { FaUsers, FaBook, FaClock, FaMapMarkerAlt, FaChartBar, FaSitemap } from 'react-icons/fa';

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

    // Existing state
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

    // Pagination and search state
    const [agentPage, setAgentPage] = useState(1);
    const [agentsPerPage] = useState(10);
    const [agentSearch, setAgentSearch] = useState('');

    const [receiptBookPage, setReceiptBookPage] = useState(1);
    const [receiptBooksPerPage] = useState(10);
    const [receiptBookSearch, setReceiptBookSearch] = useState('');

    const [timesheetPage, setTimesheetPage] = useState(1);
    const [timesheetsPerPage] = useState(10);
    const [timesheetSearch, setTimesheetSearch] = useState('');

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
                        setRegionalManager(regionalManagerData[0] || null);
                    } catch (err) {
                        newErrors.regionalManager = t('dashboard.errors.regionalManager');
                        console.error('Error fetching regional manager:', err);
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
    const numTimesheets = timesheets.length;
    const numVisits = allVisits.length;

    // Visits Per Agent
    const visitsPerAgent = agents.map(agent => {
        const agentVisits = allVisits.filter(visit => visit.agentID === agent.agentID);
        return {
            name: `${agent.name} ${agent.lastname}`,
            visits: agentVisits.length,
        };
    }).filter(agent => agent.visits > 0);

    // Move useMemo to the top of the hook declarations to ensure consistent order
    const visitsPerDelegationData = React.useMemo(() => {
        try {
            const agentDelegationMap = agents.reduce((map, agent) => {
                map[agent.agentID] = agent.delegationID;
                return map;
            }, {} as Record<string, string>);

            const visitsWithAgent = allVisits.filter(visit => visit.agentID);
            const visitsByDelegation = visitsWithAgent.reduce((acc, visit) => {
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

            return Object.keys(visitsByDelegation).map(delegationID => ({
                name: delegationNameMap[delegationID] || delegationID,
                visits: visitsByDelegation[delegationID],
            }));
        } catch (err) {
            console.error('Error computing visits per delegation:', err);
            return [];
        }
    }, [agents, allVisits, delegations]);

    if (isLoading) {
        return (
            <div className="dashboard-container">
                <div className="custom-skeleton pulsing" style={{ width: '100%', height: '100vh' }} />
            </div>
        );
    }



    // Receipt Book Status Counts
    const receiptBookStatusCounts = receiptBooks.reduce((acc, book) => {
        acc[book.status] = (acc[book.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const pieData = Object.keys(receiptBookStatusCounts).map(status => ({
        name: status,
        value: receiptBookStatusCounts[status],
    }));

    // Timesheet Status Counts
    const timesheetStatusCounts = timesheets.reduce((acc, ts) => {
        acc[ts.status] = (acc[ts.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const timesheetPieData = Object.keys(timesheetStatusCounts).map(status => ({
        name: status,
        value: timesheetStatusCounts[status],
    }));

    // Visit Trends
    const visitTrends = timesheets.map(ts => ({
        week: `Week ${ts.weekNumber}`,
        visits: ts.Visits?.length || 0,
    }));

    // Average Visit Duration Per Agent
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

    // Agent Activity Over Time
    const agentVisitTrendsData = timesheets.map(ts => {
        const weekData: { week: string;[key: string]: string | number } = { week: `Week ${ts.weekNumber}` };
        agents.forEach(agent => {
            const agentVisits = (ts.Visits || []).filter(visit => visit.agentID === agent.agentID).length;
            weekData[`${agent.name} ${agent.lastname}`] = agentVisits;
        });
        return weekData;
    });

    // Visit Status Distribution
    const visitStatusCounts = allVisits.reduce((acc, visit) => {
        const status = visit.status || 'Unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const visitStatusPieData = Object.keys(visitStatusCounts).map(status => ({
        name: status,
        value: visitStatusCounts[status],
    }));

    // Pagination and Filtering
    const filteredAgents = agents.filter(agent =>
        `${agent.name} ${agent.lastname}`.toLowerCase().includes(agentSearch.toLowerCase()) ||
        agent.phone.includes(agentSearch)
    );
    const indexOfLastAgent = agentPage * agentsPerPage;
    const indexOfFirstAgent = indexOfLastAgent - agentsPerPage;
    const currentAgents = filteredAgents.slice(indexOfFirstAgent, indexOfLastAgent);
    const totalAgentPages = Math.ceil(filteredAgents.length / agentsPerPage);

    const filteredReceiptBooks = receiptBooks.filter(book =>
        book.number.toLowerCase().includes(receiptBookSearch.toLowerCase())
    );
    const indexOfLastReceiptBook = receiptBookPage * receiptBooksPerPage;
    const indexOfFirstReceiptBook = indexOfLastReceiptBook - receiptBooksPerPage;
    const currentReceiptBooks = filteredReceiptBooks.slice(indexOfFirstReceiptBook, indexOfLastReceiptBook);
    const totalReceiptBookPages = Math.ceil(filteredReceiptBooks.length / receiptBooksPerPage);

    const filteredTimesheets = timesheets.filter(ts =>
        ts.weekNumber.toString().includes(timesheetSearch) ||
        ts.year.toString().includes(timesheetSearch)
    );
    const indexOfLastTimesheet = timesheetPage * timesheetsPerPage;
    const indexOfFirstTimesheet = indexOfLastTimesheet - timesheetsPerPage;
    const currentTimesheets = filteredTimesheets.slice(indexOfFirstTimesheet, indexOfLastTimesheet);
    const totalTimesheetPages = Math.ceil(filteredTimesheets.length / timesheetsPerPage);

    // Agent Visits Map
    const agentVisitsMap = agents.reduce((map, agent) => {
        const agentVisits = allVisits.filter(visit => visit.agentID === agent.agentID);
        map[agent.agentID] = agentVisits.length;
        return map;
    }, {} as Record<string, number>);

    const COLORS = ['#4cb1c7', '#f5a800', '#036318', '#930744', '#8b8b8b', '#63b3ed', '#ff784e', '#00c49f', '#ffbb28', '#ff00ff'];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="dashboard-container supervisor-container"
        >
            <header className="dashboard-header">
                <h1>{t('dashboard.title')}</h1>
                <p className="welcome-text">{t('dashboard.welcome', { name: `${user?.firstname} ${user?.lastname}` })}</p>
            </header>

            {/* Summary Cards */}
            <section className="summary-cards">
                <ErrorBoundary fallback={<div className="summary-card"><p className="error-text">{t('dashboard.errors.agents')}</p></div>}>
                    <div className="summary-card">
                        <FaUsers className="card-icon" />
                        <h2>{t('dashboard.agents')}</h2>
                        {errors.agents ? (
                            <p className="error-text">{errors.agents}</p>
                        ) : (
                            <>
                                <p className="card-value">{numAgents}</p>
                                <p className="card-description">{t('dashboard.agentsAssigned')}</p>
                            </>
                        )}
                    </div>
                </ErrorBoundary>
                <ErrorBoundary fallback={<div className="summary-card"><p className="error-text">{t('dashboard.errors.receiptBooks')}</p></div>}>
                    <div className="summary-card">
                        <FaBook className="card-icon" />
                        <h2>{t('dashboard.receiptBooks')}</h2>
                        {errors.receiptBooks ? (
                            <p className="error-text">{errors.receiptBooks}</p>
                        ) : (
                            <>
                                <p className="card-value">{numReceiptBooks}</p>
                                <p className="card-description">{t('dashboard.receiptBooksNetwork')}</p>
                            </>
                        )}
                    </div>
                </ErrorBoundary>
                <ErrorBoundary fallback={<div className="summary-card"><p className="error-text">{t('dashboard.errors.timesheets')}</p></div>}>
                    <div className="summary-card">
                        <FaClock className="card-icon" />
                        <h2>{t('dashboard.timesheets')}</h2>
                        {errors.timesheets ? (
                            <p className="error-text">{errors.timesheets}</p>
                        ) : (
                            <>
                                <p className="card-value">{numTimesheets}</p>
                                <p className="card-description">{t('dashboard.timesheetsSubmitted')}</p>
                            </>
                        )}
                    </div>
                </ErrorBoundary>
                <ErrorBoundary fallback={<div className="summary-card"><p className="error-text">{t('dashboard.errors.visits')}</p></div>}>
                    <div className="summary-card">
                        <FaMapMarkerAlt className="card-icon" />
                        <h2>{t('dashboard.visits')}</h2>
                        {errors.visits ? (
                            <p className="error-text">{errors.visits}</p>
                        ) : (
                            <>
                                <p className="card-value">{numVisits}</p>
                                <p className="card-description">{t('dashboard.visitsLogged')}</p>
                            </>
                        )}
                    </div>
                </ErrorBoundary>
            </section>

            {/* Agents Section */}
            <ErrorBoundary fallback={<section className="dashboard-section"><p className="error-text">{t('dashboard.errors.agents')}</p></section>}>
                {!errors.agents && (
                    <section className="dashboard-section">
                        <h2><FaUsers /> {t('dashboard.agentsAssigned')}</h2>
                        <div className="section-card">
                            <div className="search-bar">
                                <input
                                    type="text"
                                    placeholder={t('dashboard.searchAgents')}
                                    value={agentSearch}
                                    onChange={(e) => setAgentSearch(e.target.value)}
                                />
                            </div>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('dashboard.table.name')}</th>
                                        <th>{t('dashboard.table.phone')}</th>
                                        <th>{t('dashboard.table.email')}</th>
                                        <th>{t('dashboard.table.location')}</th>
                                        <th>{t('dashboard.table.visits')}</th>
                                        <th>{t('dashboard.table.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentAgents.map(agent => (
                                        <tr key={agent.agentID}>
                                            <td>
                                                <Link to={`/agents/${agent.agentID}`} className="table-link">
                                                    {agent.name} {agent.lastname}
                                                </Link>
                                            </td>
                                            <td>{agent.phone}</td>
                                            <td>{agent.email}</td>
                                            <td>{agent.location || 'N/A'}</td>
                                            <td>{agentVisitsMap[agent.agentID] || 0}</td>
                                            <td>
                                                <button
                                                    className="action-btn"
                                                    onClick={() => navigate(`/agents/${agent.agentID}`)}
                                                >
                                                    {t('dashboard.viewDetails')}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredAgents.length === 0 && <p className="no-data">{t('dashboard.noAgents')}</p>}
                            {totalAgentPages > 1 && (
                                <Pagination
                                    currentPage={agentPage}
                                    totalPages={totalAgentPages}
                                    onPageChange={setAgentPage}
                                />
                            )}
                        </div>
                    </section>
                )}
            </ErrorBoundary>

            {/* Locations Section */}
            <ErrorBoundary fallback={<section className="dashboard-section"><p className="error-text">{t('dashboard.errors.locations')}</p></section>}>
                {!errors.locations && !errors.delegations && !errors.governorates && !errors.regions && (
                    <section className="dashboard-section">
                        <h2><FaMapMarkerAlt /> {t('dashboard.assignedLocations')}</h2>
                        <div className="section-card">
                            <ErrorBoundary fallback={<p className="error-text">{t('dashboard.errors.map')}</p>}>
                                {agentLocations ? <MapComponent /> : <p className="no-data">{t('dashboard.loadingMap')}</p>}
                            </ErrorBoundary>
                            <div className="location-grid">
                                <div>
                                    <h3>{t('dashboard.regions')}</h3>
                                    <ul className="location-list">
                                        {regions.map(region => (
                                            <li key={region.regionID}>{region.name}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <h3>{t('dashboard.governorates')}</h3>
                                    <ul className="location-list">
                                        {governorates.map(gov => (
                                            <li key={gov.governorateID}>{gov.name}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <h3>{t('dashboard.delegations')}</h3>
                                    <ul className="location-list">
                                        {delegations.map(del => (
                                            <li key={del.delegationID}>{del.name}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </section>
                )}
            </ErrorBoundary>

            {/* Receipt Books Section */}
            <ErrorBoundary fallback={<section className="dashboard-section"><p className="error-text">{t('dashboard.errors.receiptBooks')}</p></section>}>
                {!errors.receiptBooks && (
                    <section className="dashboard-section">
                        <h2><FaBook /> {t('dashboard.receiptBooks')}</h2>
                        <div className="section-card">
                            <div className="search-bar">
                                <input
                                    type="text"
                                    placeholder={t('dashboard.searchReceiptBooks')}
                                    value={receiptBookSearch}
                                    onChange={(e) => setReceiptBookSearch(e.target.value)}
                                />
                            </div>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('dashboard.table.number')}</th>
                                        <th>{t('dashboard.table.type')}</th>
                                        <th>{t('dashboard.table.status')}</th>
                                        <th>{t('dashboard.table.holder')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentReceiptBooks.map(book => (
                                        <tr key={book.bookID}>
                                            <td>{book.number}</td>
                                            <td>{book.typeID}</td>
                                            <td>{book.status}</td>
                                            <td>{book.holder ? `${book.holder.firstname} ${book.holder.lastname}` : 'N/A'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredReceiptBooks.length === 0 && <p className="no-data">{t('dashboard.noReceiptBooks')}</p>}
                            {totalReceiptBookPages > 1 && (
                                <Pagination
                                    currentPage={receiptBookPage}
                                    totalPages={totalReceiptBookPages}
                                    onPageChange={setReceiptBookPage}
                                />
                            )}
                            <ErrorBoundary fallback={<p className="error-text">{t('dashboard.errors.receiptBookChart')}</p>}>
                                {pieData.length > 0 && (
                                    <div className="chart-container">
                                        <h3>{t('dashboard.receiptBookStatus')}</h3>
                                        <PieChart width={400} height={400}>
                                            <Pie data={pieData} cx={200} cy={200} labelLine={false} outerRadius={80} dataKey="value">
                                                {pieData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </div>
                                )}
                            </ErrorBoundary>
                        </div>
                    </section>
                )}
            </ErrorBoundary>

            {/* Timesheets Section */}
            <ErrorBoundary fallback={<section className="dashboard-section"><p className="error-text">{t('dashboard.errors.timesheets')}</p></section>}>
                {!errors.timesheets && (
                    <section className="dashboard-section">
                        <h2><FaClock /> {t('dashboard.timesheets')}</h2>
                        <div className="section-card">
                            <div className="search-bar">
                                <input
                                    type="text"
                                    placeholder={t('dashboard.searchTimesheets')}
                                    value={timesheetSearch}
                                    onChange={(e) => setTimesheetSearch(e.target.value)}
                                />
                            </div>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('dashboard.table.week')}</th>
                                        <th>{t('dashboard.table.year')}</th>
                                        <th>{t('dashboard.table.status')}</th>
                                        <th>{t('dashboard.table.visits')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentTimesheets.map(ts => (
                                        <tr key={ts.timesheetID}>
                                            <td>{ts.weekNumber}</td>
                                            <td>{ts.year}</td>
                                            <td>{ts.status}</td>
                                            <td>{ts.Visits?.length || 0}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredTimesheets.length === 0 && <p className="no-data">{t('dashboard.noTimesheets')}</p>}
                            {totalTimesheetPages > 1 && (
                                <Pagination
                                    currentPage={timesheetPage}
                                    totalPages={totalTimesheetPages}
                                    onPageChange={setTimesheetPage}
                                />
                            )}
                            <ErrorBoundary fallback={<p className="error-text">{t('dashboard.errors.timesheetChart')}</p>}>
                                {timesheetPieData.length > 0 && (
                                    <div className="chart-container">
                                        <h3>{t('dashboard.timesheetStatus')}</h3>
                                        <PieChart width={400} height={400}>
                                            <Pie data={timesheetPieData} cx={200} cy={200} labelLine={false} outerRadius={80} dataKey="value">
                                                {timesheetPieData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </div>
                                )}
                            </ErrorBoundary>
                        </div>
                    </section>
                )}
            </ErrorBoundary>

            {/* KPIs Section */}
            <ErrorBoundary fallback={<section className="dashboard-section"><p className="error-text">{t('dashboard.errors.kpis')}</p></section>}>
                {!errors.agents && !errors.timesheets && (
                    <section className="dashboard-section">
                        <h2><FaChartBar /> {t('dashboard.kpis')}</h2>
                        <div className="section-card">
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
                            <ErrorBoundary fallback={<p className="error-text">{t('dashboard.errors.visitStatusDistribution')}</p>}>
                                {visitStatusPieData.length > 0 && (
                                    <div className="chart-container">
                                        <h3>{t('dashboard.visitStatusDistribution')}</h3>
                                        <PieChart width={400} height={400}>
                                            <Pie data={visitStatusPieData} cx={200} cy={200} labelLine={false} outerRadius={80} dataKey="value">
                                                {visitStatusPieData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </div>
                                )}
                            </ErrorBoundary>

                        </div>
                    </section>
                )}
            </ErrorBoundary>

            {/* Hierarchy Section */}
            <ErrorBoundary fallback={<section className="dashboard-section"><p className="error-text">{t('dashboard.errors.regionalManager')}</p></section>}>
                {!errors.regionalManager && (
                    <section className="dashboard-section">
                        <h2><FaSitemap /> {t('dashboard.hierarchy')}</h2>
                        <div className="section-card">
                            {regionalManager ? (
                                <div className="hierarchy-info">
                                    <p>{t('dashboard.reportsTo')}: <span className="highlight">{regionalManager.firstname} {regionalManager.lastname}</span></p>
                                    <p>{t('dashboard.email')}: {regionalManager.email}</p>
                                    <p>{t('dashboard.phone')}: {regionalManager.phone}</p>
                                </div>
                            ) : (
                                <p className="no-data">{t('dashboard.noRegionalManager')}</p>
                            )}
                        </div>
                    </section>
                )}
            </ErrorBoundary>

            {/* Quick Actions Section */}
            <section className="dashboard-section">
                <h2>{t('dashboard.quickActions')}</h2>
                <div className="section-card action-grid">
                    <button className="action-btn primary" onClick={() => navigate('/visit-form')}>
                        {t('dashboard.recordVisit')}
                    </button>
                    <button className="action-btn secondary" onClick={() => navigate('/timesheet-form')}>
                        {t('dashboard.addTimesheet')}
                    </button>
                    <button className="action-btn tertiary" onClick={() => navigate('/receipt-book-form')}>
                        {t('dashboard.assignReceiptBook')}
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="dashboard-footer">
                <p>© {new Date().getFullYear()} TraceFlow. {t('dashboard.allRightsReserved')}</p>
            </footer>
        </motion.div>
    );
};

// Pagination Component
const Pagination: React.FC<{ currentPage: number; totalPages: number; onPageChange: (page: number) => void }> = ({ currentPage, totalPages, onPageChange }) => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
    }
    return (
        <div className="pagination">
            {pages.map(page => (
                <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={page === currentPage ? 'active' : ''}
                >
                    {page}
                </button>
            ))}
        </div>
    );
};

export default SupervisorDashboard;
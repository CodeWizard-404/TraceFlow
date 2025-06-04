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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ScatterChart, Scatter } from 'recharts';
import Agent from '../../models/Agent';
import Delegation from '../../models/Delegation';
import Governorate from '../../models/Governorate';
import ReceiptBook from '../../models/ReceiptBook';
import Region from '../../models/Region';
import Timesheet from '../../models/Timesheet';
import User from '../../models/User';
import Visit from '../../models/Visit';
import './SupervisorDashboard.css';
import { useTranslation } from 'react-i18next';
import { FaUsers, FaBook, FaClock, FaMapMarkerAlt, FaChartBar, FaSitemap, FaFilter, FaCalendarAlt, FaChartLine, FaChartPie } from 'react-icons/fa';

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

    // State Declarations
    const [agents, setAgents] = useState<Agent[]>([]);
    const [agentLocations, setAgentLocations] = useState<any>(null);
    const [delegations, setDelegations] = useState<Delegation[]>([]);
    const [governorates, setGovernorates] = useState<Governorate[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
    const [visits, setVisits] = useState<Visit[]>([]);
    const [regionalManager, setRegionalManager] = useState<User | null>(null);
    const [director, setDirector] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errors, setErrors] = useState<{ [key: string]: string | null }>({
        agents: null,
        locations: null,
        delegations: null,
        governorates: null,
        regions: null,
        receiptBooks: null,
        visits: null,
        regionalManager: null,
        director: null,
    });

    // Pagination State
    const [agentPage, setAgentPage] = useState(1);
    const [agentsPerPage] = useState(5);
    const [agentSearch, setAgentSearch] = useState('');
    const [agentFilterStatus, setAgentFilterStatus] = useState('');

    const [receiptBookPage, setReceiptBookPage] = useState(1);
    const [receiptBooksPerPage] = useState(5);
    const [receiptBookSearch, setReceiptBookSearch] = useState('');
    const [receiptBookFilterType, setReceiptBookFilterType] = useState('');
    const [receiptBookFilterStatus, setReceiptBookFilterStatus] = useState('');

    const [visitPage, setVisitPage] = useState(1);
    const [visitsPerPage] = useState(5);
    const [visitSearch, setVisitSearch] = useState('');
    const [visitFilterPeriod, setVisitFilterPeriod] = useState('');
    const [visitFilterStatus, setVisitFilterStatus] = useState('');

    // Additional State for New Features
    const [assignedLocations, setAssignedLocations] = useState<any>(null);
    const [regionalManagerRegions, setRegionalManagerRegions] = useState<Region[]>([]);

    // Fetch Data on Mount
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

                const fetchVisits = async () => {
                    try {
                        const timesheetsData = await timesheetAPI.getTimesheetsBySupervisor(user.userID);
                        const allVisits = timesheetsData.flatMap(ts => ts.Visits || []);
                        setVisits(allVisits);
                    } catch (err) {
                        newErrors.visits = t('dashboard.errors.visits');
                        console.error('Error fetching visits:', err);
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

                const fetchDirector = async () => {
                    try {
                        const directorData = await userAPI.getDirectorByUser(user.userID);
                        setDirector(directorData[0] || null);
                    } catch (err) {
                        newErrors.director = t('dashboard.errors.director');
                        console.error('Error fetching director:', err);
                    }
                };

                const fetchAssignedLocations = async () => {
                    try {
                        const assignedData = await locationApi.getAssignedLocations(user.userID);
                        setAssignedLocations(assignedData);
                    } catch (err) {
                        console.error('Error fetching assigned locations:', err);
                    }
                };

                const fetchRegionalManagerRegions = async () => {
                    if (regionalManager) {
                        try {
                            const regionsData = await locationApi.getRegionsByUser(regionalManager.userID);
                            setRegionalManagerRegions(regionsData || []);
                        } catch (err) {
                            console.error('Error fetching regional manager regions:', err);
                        }
                    }
                };

                await Promise.all([
                    fetchAgents(),
                    fetchLocations(),
                    fetchDelegations(),
                    fetchGovernorates(),
                    fetchRegions(),
                    fetchReceiptBooks(),
                    fetchVisits(),
                    fetchRegionalManager(),
                    fetchDirector(),
                    fetchAssignedLocations(),
                    fetchRegionalManagerRegions(),
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
    const allVisits = visits;
    const numAgents = agents.length;
    const numReceiptBooks = receiptBooks.length;
    const numVisits = allVisits.length;

    // Visits Per Agent
    const visitsPerAgent = agents.map(agent => {
        const agentVisits = allVisits.filter(visit => visit.agentID === agent.agentID);
        return {
            name: `${agent.name} ${agent.lastname}`,
            visits: agentVisits.length,
        };
    }).filter(agent => agent.visits > 0);

    // Visits Per Delegation
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

    // Receipt Book Status Counts
    const receiptBookStatusCounts = receiptBooks.reduce((acc, book) => {
        acc[book.status] = (acc[book.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const receiptBookPieData = Object.keys(receiptBookStatusCounts).map(status => ({
        name: status,
        value: receiptBookStatusCounts[status],
    }));

    // Receipt Books by Type
    const receiptBooksByTypeData = receiptBooks.reduce((acc, book) => {
        acc[book.typeID] = (acc[book.typeID] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const receiptBooksByTypeChartData = Object.keys(receiptBooksByTypeData).map(type => ({
        type: type,
        count: receiptBooksByTypeData[type],
    }));

    // Visit Status Counts
    const visitStatusCounts = allVisits.reduce((acc, visit) => {
        acc[visit.status] = (acc[visit.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const visitPieData = Object.keys(visitStatusCounts).map(status => ({
        name: status,
        value: visitStatusCounts[status],
    }));

    // Visit Trends
    const visitTrends = React.useMemo(() => {
        const visitsByWeek = allVisits.reduce((acc, visit) => {
            const week = new Date(visit.date).toLocaleDateString('en-US', { week: 'numeric', year: 'numeric' });
            acc[week] = (acc[week] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.keys(visitsByWeek).map(week => ({
            week,
            visits: visitsByWeek[week],
        }));
    }, [allVisits]);

    // Visits by Month
    const visitsByMonthData = React.useMemo(() => {
        const visitsByMonth = allVisits.reduce((acc, visit) => {
            const month = new Date(visit.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            acc[month] = (acc[month] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.keys(visitsByMonth).map(month => ({
            month,
            visits: visitsByMonth[month],
        }));
    }, [allVisits]);

    // Average Visit Duration Per Agent
    const agentStats = allVisits.reduce((acc, visit) => {
        if (visit.agentID) {
            if (!acc[visit.agentID]) {
                acc[visit.agentID] = { visitCount: 0, durations: [] };
            }
            acc[visit.agentID].visitCount++;
            if (visit.duration != null) {
                acc[visit.agentID].durations.push(visit.duration);
            }
        }
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
    const agentVisitTrendsData = React.useMemo(() => {
        const visitsByWeekAndAgent = allVisits.reduce((acc, visit) => {
            const week = new Date(visit.date).toLocaleDateString('en-US', { week: 'numeric', year: 'numeric' });
            if (visit.agentID) {
                if (!acc[week]) acc[week] = {};
                acc[week][visit.agentID] = (acc[week][visit.agentID] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, Record<string, number>>);

        const weeks = Object.keys(visitsByWeekAndAgent).sort();
        return weeks.map(week => {
            const weekData: { week: string;[key: string]: string | number } = { week };
            agents.forEach(agent => {
                weekData[`${agent.name} ${agent.lastname}`] = visitsByWeekAndAgent[week][agent.agentID] || 0;
            });
            return weekData;
        });
    }, [allVisits, agents]);

    // Agent Performance (Scatter Data)
    const agentPerformanceData = React.useMemo(() => {
        return agents.map(agent => {
            const agentVisits = allVisits.filter(visit => visit.agentID === agent.agentID);
            const totalDuration = agentVisits.reduce((sum, visit) => sum + (visit.duration || 0), 0);
            return {
                name: `${agent.name} ${agent.lastname}`,
                visits: agentVisits.length,
                duration: totalDuration,
            };
        }).filter(data => data.visits > 0);
    }, [agents, allVisits]);

    // Pagination and Filtering
    const filteredAgents = agents.filter(agent =>
        (`${agent.name} ${agent.lastname}`.toLowerCase().includes(agentSearch.toLowerCase()) ||
            agent.phone.includes(agentSearch)) &&
        (agentFilterStatus ? agent.status === agentFilterStatus : true)
    );
    const indexOfLastAgent = agentPage * agentsPerPage;
    const indexOfFirstAgent = indexOfLastAgent - agentsPerPage;
    const currentAgents = filteredAgents.slice(indexOfFirstAgent, indexOfLastAgent);
    const totalAgentPages = Math.ceil(filteredAgents.length / agentsPerPage);

    const filteredReceiptBooks = receiptBooks.filter(book =>
        book.number.toLowerCase().includes(receiptBookSearch.toLowerCase()) &&
        (receiptBookFilterType ? book.typeID === receiptBookFilterType : true) &&
        (receiptBookFilterStatus ? book.status === receiptBookFilterStatus : true)
    );
    const indexOfLastReceiptBook = receiptBookPage * receiptBooksPerPage;
    const indexOfFirstReceiptBook = indexOfLastReceiptBook - receiptBooksPerPage;
    const currentReceiptBooks = filteredReceiptBooks.slice(indexOfFirstReceiptBook, indexOfLastReceiptBook);
    const totalReceiptBookPages = Math.ceil(filteredReceiptBooks.length / receiptBooksPerPage);

    const filteredVisits = visits.filter(visit =>
        (visit.date.includes(visitSearch) ||
            visit.agentID?.includes(visitSearch) ||
            visit.location?.includes(visitSearch)) &&
        (visitFilterPeriod ? new Date(visit.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) === visitFilterPeriod : true) &&
        (visitFilterStatus ? visit.status === visitFilterStatus : true)
    );
    const indexOfLastVisit = visitPage * visitsPerPage;
    const indexOfFirstVisit = indexOfLastVisit - visitsPerPage;
    const currentVisits = filteredVisits.slice(indexOfFirstVisit, indexOfLastVisit);
    const totalVisitPages = Math.ceil(filteredVisits.length / visitsPerPage);

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
                <ErrorBoundary fallback={<div className="summary-card"><p className="error-text">{t('dashboard.errors.visits')}</p></div>}>
                    <div className="summary-card">
                        <FaClock className="card-icon" />
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
                <ErrorBoundary fallback={<div className="summary-card"><p className="error-text">{t('dashboard.errors.delegations')}</p></div>}>
                    <div className="summary-card">
                        <FaMapMarkerAlt className="card-icon" />
                        <h2>{t('dashboard.delegations')}</h2>
                        {errors.delegations ? (
                            <p className="error-text">{errors.delegations}</p>
                        ) : (
                            <>
                                <p className="card-value">{delegations.length}</p>
                                <p className="card-description">{t('dashboard.delegationsAssigned')}</p>
                            </>
                        )}
                    </div>
                </ErrorBoundary>
                <ErrorBoundary fallback={<div className="summary-card"><p className="error-text">{t('dashboard.errors.governorates')}</p></div>}>
                    <div className="summary-card">
                        <FaMapMarkerAlt className="card-icon" />
                        <h2>{t('dashboard.governorates')}</h2>
                        {errors.governorates ? (
                            <p className="error-text">{errors.governorates}</p>
                        ) : (
                            <>
                                <p className="card-value">{governorates.length}</p>
                                <p className="card-description">{t('dashboard.governoratesAssigned')}</p>
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
                                <select
                                    value={agentFilterStatus}
                                    onChange={(e) => setAgentFilterStatus(e.target.value)}
                                >
                                    <option value="">{t('dashboard.allStatuses')}</option>
                                    <option value="active">{t('dashboard.active')}</option>
                                    <option value="inactive">{t('dashboard.inactive')}</option>
                                </select>
                            </div>
                            <div className="card-grid">
                                {currentAgents.map(agent => (
                                    <div key={agent.agentID} className="agent-card">
                                        <h3>{`${agent.name} ${agent.lastname}`}</h3>
                                        <p>{t('dashboard.phone')}: {agent.phone}</p>
                                        <p>{t('dashboard.email')}: {agent.email}</p>
                                        <p>{t('dashboard.location')}: {agent.location || 'N/A'}</p>
                                        <p>{t('dashboard.visits')}: {agentVisitsMap[agent.agentID] || 0}</p>
                                        <button
                                            className="action-btn"
                                            onClick={() => navigate(`/visit-form?agentId=${agent.agentID}`)}
                                        >
                                            {t('dashboard.addVisit')}
                                        </button>
                                    </div>
                                ))}
                            </div>
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
                            {assignedLocations && (
                                <div className="assigned-locations">
                                    <h3>{t('dashboard.assignedGovernorates')}</h3>
                                    <ul className="location-list">
                                        {assignedLocations.governorates.map((gov: Governorate) => (
                                            <li key={gov.governorateID}>
                                                {gov.name}
                                                <ul>
                                                    {assignedLocations.delegations.filter((del: Delegation) => del.governorateID === gov.governorateID).map((del: Delegation) => (
                                                        <li key={del.delegationID}>{del.name}</li>
                                                    ))}
                                                </ul>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {regionalManagerRegions.length > 0 && (
                                <div className="regional-manager-regions">
                                    <h3>{t('dashboard.regionalManagerRegions')}</h3>
                                    <ul className="location-list">
                                        {regionalManagerRegions.map(region => (
                                            <li key={region.regionID}>{region.name}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
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
                                <select
                                    value={receiptBookFilterType}
                                    onChange={(e) => setReceiptBookFilterType(e.target.value)}
                                >
                                    <option value="">{t('dashboard.allTypes')}</option>
                                    {/* Populate with actual receipt book types */}
                                    {Object.keys(receiptBooksByTypeData).map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                                <select
                                    value={receiptBookFilterStatus}
                                    onChange={(e) => setReceiptBookFilterStatus(e.target.value)}
                                >
                                    <option value="">{t('dashboard.allStatuses')}</option>
                                    {Object.keys(receiptBookStatusCounts).map(status => (
                                        <option key={status} value={status}>{status}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="card-grid">
                                {currentReceiptBooks.map(book => (
                                    <div key={book.bookID} className="receipt-book-card">
                                        <h3>{book.number}</h3>
                                        <p>{t('dashboard.type')}: {book.typeName || book.typeID}</p>
                                        <p>{t('dashboard.status')}: {book.status}</p>
                                        <p>{t('dashboard.holder')}: {book.holder ? `${book.holder.firstname} ${book.holder.lastname}` : 'N/A'}</p>
                                    </div>
                                ))}
                            </div>
                            {filteredReceiptBooks.length === 0 && <p className="no-data">{t('dashboard.noReceiptBooks')}</p>}
                            {totalReceiptBookPages > 1 && (
                                <Pagination
                                    currentPage={receiptBookPage}
                                    totalPages={totalReceiptBookPages}
                                    onPageChange={setReceiptBookPage}
                                />
                            )}
                            <div className="chart-container">
                                <h3>{t('dashboard.receiptBookStatus')}</h3>
                                <PieChart width={400} height={400}>
                                    <Pie data={receiptBookPieData} cx={200} cy={200} labelLine={false} outerRadius={80} dataKey="value">
                                        {receiptBookPieData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </div>
                            <div className="chart-container">
                                <h3>{t('dashboard.receiptBooksByType')}</h3>
                                <BarChart width={600} height={300} data={receiptBooksByTypeChartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="type" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="count" fill="#4cb1c7" />
                                </BarChart>
                            </div>
                        </div>
                    </section>
                )}
            </ErrorBoundary>

            {/* Visits Section */}
            <ErrorBoundary fallback={<section className="dashboard-section"><p className="error-text">{t('dashboard.errors.visits')}</p></section>}>
                {!errors.visits && (
                    <section className="dashboard-section">
                        <h2><FaCalendarAlt /> {t('dashboard.visits')}</h2>
                        <div className="section-card">
                            <div className="search-bar">
                                <input
                                    type="text"
                                    placeholder={t('dashboard.searchVisits')}
                                    value={visitSearch}
                                    onChange={(e) => setVisitSearch(e.target.value)}
                                />
                                <select
                                    value={visitFilterPeriod}
                                    onChange={(e) => setVisitFilterPeriod(e.target.value)}
                                >
                                    <option value="">{t('dashboard.allPeriods')}</option>
                                    {visitsByMonthData.map(data => (
                                        <option key={data.month} value={data.month}>{data.month}</option>
                                    ))}
                                </select>
                                <select
                                    value={visitFilterStatus}
                                    onChange={(e) => setVisitFilterStatus(e.target.value)}
                                >
                                    <option value="">{t('dashboard.allStatuses')}</option>
                                    {Object.keys(visitStatusCounts).map(status => (
                                        <option key={status} value={status}>{status}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="card-grid">
                                {currentVisits.map(visit => (
                                    <div key={visit.visitID} className="visit-card">
                                        <h3>{visit.date}</h3>
                                        <p>{t('dashboard.agent')}: {visit.agentID || 'N/A'}</p>
                                        <p>{t('dashboard.location')}: {visit.location || 'N/A'}</p>
                                        <p>{t('dashboard.status')}: {visit.status}</p>
                                    </div>
                                ))}
                            </div>
                            {filteredVisits.length === 0 && <p className="no-data">{t('dashboard.noVisits')}</p>}
                            {totalVisitPages > 1 && (
                                <Pagination
                                    currentPage={visitPage}
                                    totalPages={totalVisitPages}
                                    onPageChange={setVisitPage}
                                />
                            )}
                            <div className="chart-container">
                                <h3>{t('dashboard.visitStatus')}</h3>
                                <PieChart width={400} height={400}>
                                    <Pie data={visitPieData} cx={200} cy={200} labelLine={false} outerRadius={80} dataKey="value">
                                        {visitPieData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </div>
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
                        </div>
                    </section>
                )}
            </ErrorBoundary>

            {/* KPIs Section */}
            <ErrorBoundary fallback={<section className="dashboard-section"><p className="error-text">{t('dashboard.errors.kpis')}</p></section>}>
                {!errors.agents && !errors.visits && (
                    <section className="dashboard-section">
                        <h2><FaChartBar /> {t('dashboard.kpis')}</h2>
                        <div className="section-card">
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
                            <div className="chart-container">
                                <h3>{t('dashboard.visitStatusDistribution')}</h3>
                                <PieChart width={400} height={400}>
                                    <Pie data={visitPieData} cx={200} cy={200} labelLine={false} outerRadius={80} dataKey="value">
                                        {visitPieData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </div>
                            <div className="chart-container">
                                <h3>{t('dashboard.visitsByMonth')}</h3>
                                <AreaChart width={600} height={300} data={visitsByMonthData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Area type="monotone" dataKey="visits" stroke="#4cb1c7" fill="#4cb1c7" />
                                </AreaChart>
                            </div>
                            <div className="chart-container">
                                <h3>{t('dashboard.agentPerformance')}</h3>
                                <ScatterChart width={600} height={300}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" dataKey="visits" name="Visits" />
                                    <YAxis type="number" dataKey="duration" name="Duration (min)" />
                                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                    <Legend />
                                    <Scatter name="Agents" data={agentPerformanceData} fill="#4cb1c7" />
                                </ScatterChart>
                            </div>
                        </div>
                    </section>
                )}
            </ErrorBoundary>

            {/* Hierarchy Section */}
            <ErrorBoundary fallback={<section className="dashboard-section"><p className="error-text">{t('dashboard.errors.hierarchy')}</p></section>}>
                {!errors.regionalManager && !errors.director && (
                    <section className="dashboard-section">
                        <h2><FaSitemap /> {t('dashboard.hierarchy')}</h2>
                        <div className="section-card hierarchy-card">
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
                                <p>{t('dashboard.email')}: {user?.email}</p>
                                <p>{t('dashboard.phone')}: {user?.phone}</p>
                            </div>
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
                    <button className="action-btn" onClick={() => navigate('/agents')}>
                        {t('dashboard.manageAgents')}
                    </button>
                    <button className="action-btn" onClick={() => navigate('/reports')}>
                        {t('dashboard.viewReports')}
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
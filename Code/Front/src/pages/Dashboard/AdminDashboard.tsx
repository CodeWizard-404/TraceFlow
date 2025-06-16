import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    PieChart, Pie, Cell, LineChart, Line, ScatterChart, Scatter,
    AreaChart, Area
} from 'recharts';
import {
    FaUsers, FaUserShield, FaLock, FaList, FaQuestion,
    FaBell, FaUserFriends, FaFileAlt, FaCog,
    FaChartBar, FaExclamationTriangle,
    FaTimes
} from 'react-icons/fa';
import { getAllUsers } from '../../apis/userAPI';
import { getAllRoles } from '../../apis/roleAPI';
import { getAllPermissions } from '../../apis/permissionAPI';
import { getAllChecklists } from '../../apis/checklistAPI';
import { getAllReasons } from '../../apis/reasonAPI';
import { getNotificationRules } from '../../apis/notificationAPI';
import { getAllAgents } from '../../apis/agentAPI';
import { getLogs } from '../../apis/logAPI';
import { listAIConfigs } from '../../apis/aiAPI';
import User from '../../models/User';
import Role from '../../models/Role';
import Permission from '../../models/Permission';
import { Checklist } from '../../models/Checklist';
import { Reason } from '../../models/Reason';
import NotificationRule from '../../models/NotificationRule';
import Agent from '../../models/Agent';
import { Log } from '../../models/log';
import { AIConfig } from '../../models/AI';
import './Admindashboard.css';

const COLORS = ['#63b3ed', '#f5a800', '#036318', '#930744', '#8b8b8b', '#63b3ed', '#ff784e', '#00c49f', '#ffbb28', '#ff00ff'];

const AdminDashboardSummary: React.FC = () => {
    const { t } = useTranslation();

    // State definitions
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [checklists, setChecklists] = useState<Checklist[]>([]);
    const [reasons, setReasons] = useState<Reason[]>([]);
    const [notificationRules, setNotificationRules] = useState<NotificationRule[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [logFilter, setLogFilter] = useState({ level: '', userId: '', dateStart: '', dateEnd: '' });
    const [notificationFilter, setNotificationFilter] = useState({ event: '', priority: '' });
    const [closedInsights, setClosedInsights] = useState<number[]>([]);
    const [sortType, setSortType] = useState<'alphabetical' | 'count' | null>(null);




    // Fetch all data on component mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [
                    usersData,
                    rolesData,
                    permissionsData,
                    checklistsData,
                    reasonsData,
                    notificationRulesData,
                    agentsData,
                    logsData,
                    aiConfigsData,
                ] = await Promise.all([
                    getAllUsers(),
                    getAllRoles(),
                    getAllPermissions(),
                    getAllChecklists(),
                    getAllReasons(),
                    getNotificationRules(),
                    getAllAgents(),
                    getLogs({ page: 1, pageSize: 100 }),
                    listAIConfigs({}),
                ]);

                setUsers(usersData);
                setRoles(rolesData);
                setPermissions(permissionsData);
                setChecklists(checklistsData);
                setReasons(reasonsData);
                setNotificationRules(notificationRulesData);
                setAgents(agentsData.agents);
                setLogs(logsData.data);
                setAiConfigs(aiConfigsData);
                setError(null);
            } catch (err) {
                console.error('Failed to fetch data', err);
                setError(t('dashboardAdmin.error.fetchFailed'));
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [t]);

    // Data Processing
    // User Metrics
    const totalUsers = users.length;
    const onlineUsers = users.filter(u => u.isOnline).length;


    interface UserPerRole {
        role: string;
        count: number;
    }

    const usersPerRole: UserPerRole[] = (!users.length || !roles.length)
        ? []
        : roles.reduce((acc: UserPerRole[], role: Role) => {
            console.log(`Processing role: ${role.name}`);
            const count = users.reduce((sum: number, user: User) => {
                const hasRole = user.Roles?.some(r => {
                    console.log(`User ${user.userID} role name: ${r.name}, Role name: ${role.name}, Match: ${r.name === role.name}`);
                    return r.name === role.name;
                }) ?? false;
                return sum + (hasRole ? 1 : 0);
            }, 0);
            console.log(`Role ${role.name} has ${count} users`);
            return [...acc, { role: role.name, count }];
        }, []);

    console.log('Final usersPerRole:', JSON.stringify(usersPerRole, null, 2));

    const userGrowthData = users.reduce((acc, u) => {
        const month = new Date(u.createdAt || Date.now()).toISOString().slice(0, 7);
        acc[month] = (acc[month] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const userGrowthChartData = Object.keys(userGrowthData).sort().map(month => ({
        month,
        users: userGrowthData[month],
    }));


    const inactiveUsers = users.filter(u => !u.isOnline && new Date(u.updatedAt || Date.now()) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length;

    // Role Metrics
    const totalRoles = roles.length;
    const permissionsPerRole = roles.map(r => ({
        role: r.name,
        count: r.Permissions?.length || 0,
    }));

    // Permission Metrics
    const totalPermissions = permissions.length;
    const permissionsByClass = permissions.reduce((acc, p) => {
        acc[p.class] = (acc[p.class] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const permissionsByClassData = Object.keys(permissionsByClass).map(cls => ({
        class: cls,
        count: permissionsByClass[cls],
    }));

    // Agent Metrics
    const totalAgents = agents.length;
    interface AgentPerSupervisor {
        name: string;
        count: number;
    }

    const agentsPerSupervisor: AgentPerSupervisor[] = users
        .filter(u => agents.some(a => a.supervisorID === u.userID))
        .map(u => ({
            name: `${u.firstname} ${u.lastname}`,
            count: agents.filter(a => a.supervisorID === u.userID).length,
        }));

    console.log('Agents per Supervisor:', JSON.stringify(agentsPerSupervisor, null, 2));
    interface AgentPerGovernorate {
        name: string;
        count: number;
    }

    const agentsPerGovernorate = agents.reduce((acc, a) => {
        const governorate = a.Delegation?.Governorate?.name || 'Unknown';
        acc[governorate] = (acc[governorate] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const agentsPerGovernorateData: AgentPerGovernorate[] = Object.keys(agentsPerGovernorate).map(name => ({
        name,
        count: agentsPerGovernorate[name],
    }));

    console.log('Agents per Governorate:', JSON.stringify(agentsPerGovernorateData, null, 2));
    const agentsWithoutSupervisor = agents.filter(a => !a.supervisorID).length;

    const sortedAgentsPerGovernorateData = [...agentsPerGovernorateData].sort((a, b) => {
        if (sortType === 'alphabetical') {
            return a.name.localeCompare(b.name);
        } else if (sortType === 'count') {
            return b.count - a.count;
        }
        return 0;
    });

    // AI Config Metrics
    const totalAIConfigs = aiConfigs.length;
    const aiConfigsPerModel = aiConfigs.reduce((acc, c) => {
        acc[c.modelName] = (acc[c.modelName] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const aiConfigsPerModelData = Object.keys(aiConfigsPerModel).map(name => ({
        name,
        count: aiConfigsPerModel[name],
    }));
    const avgMaxOptimizeRoute = aiConfigs.length > 0 ? aiConfigs.reduce((sum, c) => sum + c.maxOptimizeRoute, 0) / aiConfigs.length : 0;

    // Log Metrics
    const filteredLogs = logs.filter(l => {
        const levelMatch = !logFilter.level || l.level === logFilter.level;
        const userMatch = !logFilter.userId || l.userId === logFilter.userId;
        const date = new Date(l.timestamp);
        const dateStart = logFilter.dateStart ? new Date(logFilter.dateStart) : null;
        const dateEnd = logFilter.dateEnd ? new Date(logFilter.dateEnd) : null;
        const dateMatch = (!dateStart || date >= dateStart) && (!dateEnd || date <= dateEnd);
        return levelMatch && userMatch && dateMatch;
    });
    const totalLogs = logs.length;
    const logsByLevel = ['info', 'warn', 'trace', 'error', 'verbose', 'debug'].map(level => ({
        level,
        count: filteredLogs.filter(l => l.level === level).length,
    }));
    const logsByService = filteredLogs.reduce((acc, l) => {
        acc[l.service] = (acc[l.service] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const logsByServiceData = Object.keys(logsByService).map(service => ({
        service,
        count: logsByService[service],
    }));
    const logsByDate = filteredLogs.reduce((acc, l) => {
        const date = new Date(l.timestamp).toISOString().slice(0, 10);
        acc[date] = (acc[date] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const logsByDateData = Object.keys(logsByDate).sort().map(date => ({
        date,
        count: logsByDate[date],
    }));
    const errorLogsLast24Hours = filteredLogs.filter(l => l.level === 'error' && new Date(l.timestamp) >= new Date(Date.now() - 24 * 60 * 60 * 1000)).length;

    // Notification Rule Metrics
    const filteredNotificationRules = notificationRules.filter(r => {
        const eventMatch = !notificationFilter.event || r.event === notificationFilter.event;
        const priorityMatch = !notificationFilter.priority || r.priority === notificationFilter.priority;
        return eventMatch && priorityMatch;
    });
    const totalNotificationRules = notificationRules.length;
    const notificationRulesByEvent = filteredNotificationRules.reduce((acc, r) => {
        acc[r.event] = (acc[r.event] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const notificationRulesByEventData = Object.keys(notificationRulesByEvent).map(event => ({
        event,
        count: notificationRulesByEvent[event],
    }));
    const notificationRulesByChannel = ['email', 'sms', 'inApp'].map(channel => ({
        channel,
        count: filteredNotificationRules.filter(r => r.channels[channel as keyof typeof r.channels]).length,
    }));
    const highPriorityRules = filteredNotificationRules.filter(r => r.priority === 'high').length;

    // Checklist Metrics
    const totalChecklists = checklists.length;



    // Reason Metrics
    const totalReasons = reasons.length;
    const reasonsByDate = reasons.reduce((acc, r) => {
        const date = new Date(r.createdAt).toISOString().slice(0, 10);
        acc[date] = (acc[date] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const reasonsByDateData = Object.keys(reasonsByDate).sort().map(date => ({
        date,
        count: reasonsByDate[date],
    }));

    // Insights
    const insights = [
        inactiveUsers > totalUsers * 0.2 ? {
            id: 1,
            title: t('dashboardAdmin.insights.inactiveUsers'),
            message: t('dashboardAdmin.insights.inactiveUsersMessage', { count: inactiveUsers }),
            icon: <FaExclamationTriangle />,
            severity: 'warning',
        } : null,
        errorLogsLast24Hours > 10 ? {
            id: 2,
            title: t('dashboardAdmin.insights.errorLogs'),
            message: t('dashboardAdmin.insights.errorLogsMessage', { count: errorLogsLast24Hours }),
            icon: <FaExclamationTriangle />,
            severity: 'error',
        } : null,
        agentsWithoutSupervisor > 0 ? {
            id: 3,
            title: t('dashboardAdmin.insights.agentsWithoutSupervisor'),
            message: t('dashboardAdmin.insights.agentsWithoutSupervisorMessage', { count: agentsWithoutSupervisor }),
            icon: <FaExclamationTriangle />,
            severity: 'warning',
        } : null,
    ].filter(i => i !== null && !closedInsights.includes(i!.id));

    // MetricCard component
    const MetricCard = ({ title, value, icon, subtext }: { title: string; value: number | string; icon: React.ReactNode; subtext?: string }) => (
        <div className="metric-card">
            <div className="metric-icon">{icon}</div>
            <div>
                <div className="metric-value">{value}</div>
                <div className="metric-title">{title}</div>
                {subtext && <div className="metric-subtext">{subtext}</div>}
            </div>
        </div>
    );

    // InsightCard component
    const InsightCard = ({ title, message, icon, severity, id }: { title: string; message: string; icon: React.ReactNode; severity: string; id: number }) => (
        <div className={`insight-card ${severity}`}>
            <div className="insight-icon">{icon}</div>
            <div>
                <div className="insight-title">{title}</div>
                <div className="insight-message">{message}</div>
            </div>
            <button
                className="insight-close"
                onClick={() => setClosedInsights(prev => [...prev, id])}
                aria-label="Close insight"
            >
                <FaTimes />
            </button>
        </div>
    );


    if (loading) {
        return <div className="loading">{t('dashboardAdmin.loading')}</div>;
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="admin-dashboard-summary"
        >
            <div className="dashboard-header dashboard-header-2">
                <h1>{t('dashboardAdmin.title')}</h1>
            </div>
            {error && <div className="error">{error}</div>}

            {/* Insights */}
            {insights.length > 0 && (
                <section className="dashboard-section">
                    <h2><FaExclamationTriangle /> {t('dashboardAdmin.insights.title')}</h2>
                    <hr />
                    <div className="insights-grid">
                        {insights.map((insight, index) => (
                            <InsightCard
                                key={insight!.id}
                                title={insight!.title}
                                message={insight!.message}
                                icon={insight!.icon}
                                severity={insight!.severity}
                                id={insight!.id}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Key Metrics */}
            <section className="dashboard-section">
                <h2><FaChartBar /> {t('dashboardAdmin.keyMetrics')}</h2>
                <hr />
                <div className="metrics-grid">
                    <MetricCard title={t('dashboardAdmin.totalUsers')} value={totalUsers} icon={<FaUsers />} subtext={t('dashboardAdmin.onlineUsers', { count: onlineUsers })} />
                    <MetricCard title={t('dashboardAdmin.totalRoles')} value={totalRoles} icon={<FaUserShield />} />
                    <MetricCard title={t('dashboardAdmin.totalPermissions')} value={totalPermissions} icon={<FaLock />} />
                    <MetricCard title={t('dashboardAdmin.totalAgents')} value={totalAgents} icon={<FaUserFriends />} />
                    <MetricCard title={t('dashboardAdmin.totalChecklists')} value={totalChecklists} icon={<FaList />} />
                    <MetricCard title={t('dashboardAdmin.totalReasons')} value={totalReasons} icon={<FaQuestion />} />
                    <MetricCard title={t('dashboardAdmin.totalNotificationRules')} value={totalNotificationRules} icon={<FaBell />} subtext={t('dashboardAdmin.highPriorityRules', { count: highPriorityRules })} />
                    <MetricCard title={t('dashboardAdmin.totalLogs')} value={totalLogs} icon={<FaFileAlt />} subtext={t('dashboardAdmin.errorLogsLast24Hours', { count: errorLogsLast24Hours })} />
                    <MetricCard title={t('dashboardAdmin.totalAIConfigs')} value={totalAIConfigs} icon={<FaCog />} subtext={t('dashboardAdmin.avgMaxOptimizeRoute', { count: avgMaxOptimizeRoute })} />
                </div>
            </section>

            {/* User Statistics */}
            <section className="dashboard-section">
                <h2><FaUsers /> {t('dashboardAdmin.userStatistics')}</h2>
                <hr />
                <div className="chart-grid">
                    <div className="chart-container">
                        <h3>{t('dashboardAdmin.usersPerRole')}</h3>
                        <BarChart width={600} height={350} data={usersPerRole} margin={{ bottom: 80 }}>                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="role" angle={45} textAnchor="start" />
                            <Tooltip />
                            <Bar dataKey="count" fill="#63b3ed" />
                        </BarChart>
                    </div>
                    <div className="chart-container">
                        <h3>{t('dashboardAdmin.userGrowth')}</h3>
                        <AreaChart width={600} height={350} data={userGrowthChartData} margin={{ bottom: 80 }}>                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" angle={45} textAnchor="start" />                            <Tooltip />
                            <Area type="monotone" dataKey="users" fill="#63b3ed" stroke="#63b3ed" />
                        </AreaChart>
                    </div>
                </div>
            </section>

            {/* Role and Permission Statistics */}
            <section className="dashboard-section">
                <h2><FaUserShield /> {t('dashboardAdmin.roleAndPermissionStatistics')}</h2>
                <hr />
                <div className="chart-grid">
                    <div className="chart-container">
                        <h3>{t('dashboardAdmin.permissionsPerRole')}</h3>
                        <BarChart width={600} height={450} data={permissionsPerRole} margin={{ bottom: 80 }}>                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="role" angle={45} textAnchor="start" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" fill="#63b3ed" />
                        </BarChart>
                    </div>
                    <div className="chart-container">
                        <h3>{t('dashboardAdmin.permissionsByClass')}</h3>
                        <PieChart width={600} height={450}>
                            <Pie data={permissionsByClassData} dataKey="count" nameKey="class" cx="50%" cy="50%" outerRadius={80} label>
                                {permissionsByClassData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </div>
                </div>
            </section>

            {/* Agent Statistics */}
            <section className="dashboard-section">
                <h2><FaUserFriends /> {t('dashboardAdmin.agentStatistics')}</h2>
                <hr />
                <div className="chart-container">
                    <h3>{t('dashboardAdmin.agentsPerSupervisor')}</h3>
                    <BarChart width={1300} height={350} data={agentsPerSupervisor}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#63b3ed" />
                    </BarChart>
                </div>
                <div className="chart-container">
                    <h3>{t('dashboardAdmin.agentsPerGovernorate')}</h3>
                    <div className="filter-bar">
                        <label>{t('dashboardAdmin.sortBy')}: </label>
                        <select value={sortType || ''} onChange={e => setSortType(e.target.value as 'alphabetical' | 'count' | null)}>
                            <option value="">{t('dashboardAdmin.defaultSort')}</option>
                            <option value="alphabetical">{t('dashboardAdmin.sortAlphabetical')}</option>
                            <option value="count">{t('dashboardAdmin.sortByCount')}</option>
                        </select>
                    </div>
                    <AreaChart width={2000} height={350} data={sortedAgentsPerGovernorateData} margin={{ bottom: 80 }}>
                        <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#63b3ed" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#63b3ed" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="name" angle={45} textAnchor="start" />
                        <YAxis />
                        <CartesianGrid strokeDasharray="3 3" />
                        <Tooltip />
                        <Area type="monotone" dataKey="count" stroke="#63b3ed" fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                </div>
            </section>

            {/* AI Configuration Statistics */}
            <section className="dashboard-section">
                <h2><FaCog /> {t('dashboardAdmin.aiConfigStatistics')}</h2>
                <hr />
                <div className="chart-grid">
                    <div className="chart-container">
                        <h3>{t('dashboardAdmin.aiConfigsPerModel')}</h3>
                        <PieChart width={600} height={350}>
                            <Pie data={aiConfigsPerModelData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                {aiConfigsPerModelData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </div>
                    <div className="chart-container">
                        <h3>{t('dashboardAdmin.maxOptimizeRouteDistribution')}</h3>
                        <ScatterChart width={600} height={350} data={aiConfigs} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="maxOptimizeRoute"
                                name={t('dashboardAdmin.maxOptimizeRoute')}
                                type="number"
                                label={{ value: t('dashboardAdmin.maxOptimizeRoute'), position: 'insideBottom', offset: -10 }}
                            />
                            <YAxis
                                dataKey="timesheetMaxSuggestions"
                                name={t('dashboardAdmin.timesheetMaxSuggestions')}
                                type="number"
                                label={{ value: t('dashboardAdmin.timesheetMaxSuggestions'), angle: -90, position: 'insideLeft', offset: 10 }}
                            />
                            <Tooltip
                                formatter={(value, name) => [
                                    value,
                                    name === 'maxOptimizeRoute' ? t('dashboardAdmin.maxOptimizeRoute') : t('dashboardAdmin.timesheetMaxSuggestions'),
                                ]}
                            />
                            <Scatter name={t('dashboardAdmin.aiConfigs')} data={aiConfigs} fill="#63b3ed" shape="circle" />
                        </ScatterChart>
                    </div>
                </div>
            </section>

            {/* Log Statistics */}
            <section className="dashboard-section">
                <h2><FaFileAlt /> {t('dashboardAdmin.logStatistics')}</h2>
                <hr />
                <div className="filter-bar">
                    <select value={logFilter.level} onChange={e => setLogFilter({ ...logFilter, level: e.target.value })}>
                        <option value="">{t('dashboardAdmin.allLevels')}</option>
                        <option value="error">Error</option>
                        <option value="warn">Warn</option>
                        <option value="info">Info</option>
                        <option value="verbose">Verbose</option>
                        <option value="debug">Debug</option>
                        <option value="trace">Trace</option>
                    </select>
                    <select value={logFilter.userId} onChange={e => setLogFilter({ ...logFilter, userId: e.target.value })}>
                        <option value="">{t('dashboardAdmin.allUsers')}</option>
                        {users.map(u => (
                            <option key={u.userID} value={u.userID}>{`${u.firstname} ${u.lastname}`}</option>
                        ))}
                    </select>
                    <input type="date" value={logFilter.dateStart} onChange={e => setLogFilter({ ...logFilter, dateStart: e.target.value })} />
                    <input type="date" value={logFilter.dateEnd} onChange={e => setLogFilter({ ...logFilter, dateEnd: e.target.value })} />
                </div>
                <div className="chart-grid">
                    <div className="chart-container">
                        <h3>{t('dashboardAdmin.logsByLevel')}</h3>
                        <PieChart width={600} height={350}>
                            <Pie data={logsByLevel} dataKey="count" nameKey="level" cx="50%" cy="50%" outerRadius={80} label>
                                {logsByLevel.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </div>
                    <div className="chart-container">
                        <h3>{t('dashboardAdmin.logsByService')}</h3>
                        <BarChart width={600} height={350} data={logsByServiceData} margin={{ bottom: 80 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="service" angle={45} textAnchor="start" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" fill="#63b3ed" />
                        </BarChart>
                    </div>

                </div>
                <div className="chart-grid">
                    <div className="chart-container">
                        <h3>{t('dashboardAdmin.logsOverTime')}</h3>
                        <LineChart width={600} height={350} data={logsByDateData} margin={{ bottom: 80 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" angle={45} textAnchor="start" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="count" stroke="#63b3ed" />
                        </LineChart>
                    </div>

                    <div className="chart-container">
                        <h3>{t('dashboardAdmin.recentLogs')}</h3>
                        <div className="summary-list">
                            {filteredLogs.slice(0, 5).map(log => (
                                <div key={log.logID} className="summary-item">
                                    <span className="log-date">{new Date(log.timestamp).toLocaleString()}</span>
                                    <span className="log-level">{log.level}</span>
                                    <span className="log-service">{log.service}</span>
                                    <span className="log-message">{log.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>


                </div>
            </section>

            {/* Notification Rules Statistics */}
            <section className="dashboard-section">
                <h2><FaBell /> {t('dashboardAdmin.notificationRulesStatistics')}</h2>
                <hr />
                <div className="filter-bar">
                    <select value={notificationFilter.event} onChange={e => setNotificationFilter({ ...notificationFilter, event: e.target.value })}>
                        <option value="">{t('dashboardAdmin.allEvents')}</option>
                        {[...new Set(notificationRules.map(r => r.event))].map(event => (
                            <option key={event} value={event}>{event}</option>
                        ))}
                    </select>
                    <select value={notificationFilter.priority} onChange={e => setNotificationFilter({ ...notificationFilter, priority: e.target.value })}>
                        <option value="">{t('dashboardAdmin.allPriorities')}</option>
                        <option value="high">High</option>
                        <option value="normal">Normal</option>
                    </select>
                </div>
                <div className="chart-grid">
                    <div className="chart-container">
                        <h3>{t('dashboardAdmin.notificationRulesByEvent')}</h3>
                        <BarChart width={600} height={350} data={notificationRulesByEventData} margin={{ bottom: 100 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="event" angle={80} textAnchor="start" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" fill="#63b3ed" />
                        </BarChart>
                    </div>
                    <div className="chart-container">
                        <h3>{t('dashboardAdmin.notificationRulesByChannel')}</h3>
                        <PieChart width={600} height={350}>
                            <Pie data={notificationRulesByChannel} dataKey="count" nameKey="channel" cx="50%" cy="50%" outerRadius={80} label>
                                {notificationRulesByChannel.map((_, index) => <Cell key={`cell-${index + 3}`} fill={COLORS[index + 3 % COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </div>
                </div>
            </section>

            {/* Checklist and Reason Statistics */}
            <section className="dashboard-section">
                <h2><FaList /> {t('dashboardAdmin.checklistAndReasonStatistics')}</h2>
                <hr />
                <div className="chart-grid">
                    <div className="chart-container">
                        <h3>{t('dashboardAdmin.checklistsOverTime')}</h3>
                        <AreaChart width={600} height={350} data={reasonsByDateData} margin={{ bottom: 80 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" angle={45} textAnchor="start" />
                            <YAxis />
                            <Tooltip />
                            <Area type="monotone" dataKey="count" fill="#63b3ed" stroke="#63b3ed" />
                        </AreaChart>
                    </div>
                    <div className="chart-container">
                        <h3>{t('dashboardAdmin.reasonsOverTime')}</h3>
                        <AreaChart width={600} height={350} data={reasonsByDateData} margin={{ bottom: 80 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" angle={45} textAnchor="start" />
                            <YAxis />
                            <Tooltip />
                            <Area type="monotone" dataKey="count" fill="#63b3ed" stroke="#63b3ed" />
                        </AreaChart>
                    </div>
                </div>
            </section>
        </motion.div>
    );
};

export default AdminDashboardSummary;
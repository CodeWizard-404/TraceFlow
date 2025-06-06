import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Tabs, Card, Table, Select, Row, Col, Spin, Modal, Input, Tooltip, DatePicker, Space, Button, Badge, Tag, Statistic, Progress, Descriptions, Popover, Divider } from 'antd';
import Tree from 'react-d3-tree';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ScatterChart, Scatter } from 'recharts';
import { useNavigate } from 'react-router-dom';
import MapComponent from '../../components/Google/MapComponent';
import { useAuth } from '../../context/AuthContext';
import { getAllTimesheets } from '../../apis/timesheetAPI';
import { getAllReceiptBooks, getReceiptBookHolders } from '../../apis/receiptBookAPI';
import { getAllAgents } from '../../apis/agentAPI';
import { getAllUsers, getUsersByRole } from '../../apis/userAPI';
import { getAllRegions, getAllGovernorates, getAllDelegations } from '../../apis/locationApi';
import { getNotifications } from '../../apis/notificationAPI';
import './HRDashboard.css';
import Timesheet from '../../models/Timesheet';
import ReceiptBook from '../../models/ReceiptBook';
import Visit from '../../models/Visit';
import User from '../../models/User';
import Agent from '../../models/Agent';
import Region from '../../models/Region';
import ReceiptBookStatus from '../../models/Enum/ReceiptBookStatus';
import { FaUsers, FaBook, FaClock, FaMapMarkerAlt, FaChartBar, FaSitemap, FaBell, FaSync } from 'react-icons/fa';
import { debounce } from 'lodash';

const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface HierarchyNode {
    name: string;
    children?: HierarchyNode[];
    userID?: string;
    role?: string;
    regionID?: string;
    governorateID?: string;
    delegationID?: string;
}

interface DisplayUser {
    userID: string;
    firstname: string;
    lastname: string;
    Roles?: any[];
    Regions?: any[];
}

interface ReceiptBookHolder {
    name: string;
    books: number;
}

interface ActivityLog {
    id: number;
    action: string;
    timestamp: string;
}

const HRDashboard: React.FC = () => {
    const { effectivePermissions } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
    const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
    const [visits, setVisits] = useState<Visit[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [hierarchyData, setHierarchyData] = useState<HierarchyNode | null>(null);
    const [anomalies, setAnomalies] = useState<any[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [governorates, setGovernorates] = useState<any[]>([]);
    const [delegations, setDelegations] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<DisplayUser | null>(null);
    const [isUserModalVisible, setIsUserModalVisible] = useState(false);
    const [globalFilters, setGlobalFilters] = useState({ dateRange: null as [any, any] | null, role: '', region: '', supervisor: '' });
    const [searchText, setSearchText] = useState('');
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const treeContainerRef = useRef<HTMLDivElement>(null);
    const [metrics, setMetrics] = useState({
        totalUsers: 0,
        totalTimesheets: 0,
        totalVisits: 0,
        totalReceiptBooks: 0,
        anomaliesDetected: 0,
        activeSupervisors: 0,
    });

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [timesheetData, receiptBookData, userData, agentData, regionData, govData, delData, notificationData] = await Promise.all([
                    getAllTimesheets(),
                    getAllReceiptBooks(),
                    getAllUsers(),
                    getAllAgents(),
                    getAllRegions(),
                    getAllGovernorates(),
                    getAllDelegations(),
                    getNotifications(),
                ]);

                setTimesheets(timesheetData);
                setVisits(timesheetData.flatMap((ts: any) => ts.Visits || []));
                setReceiptBooks(Array.isArray(receiptBookData) ? receiptBookData : receiptBookData.books || []);
                setUsers(userData);
                setAgents(agentData.agents);
                setRegions(regionData);
                setGovernorates(govData);
                setDelegations(delData);
                setAnomalies(notificationData.filter((n: any) => n.type === 'anomaly'));

                const directors = userData.filter((u: any) => u.Roles.some((r: any) => r.name === 'Director'));
                const regionalManagers = userData.filter((u: any) => u.Roles.some((r: any) => r.name === 'Regional Manager'));
                const supervisors = userData.filter((u: any) => u.Roles.some((r: any) => r.name === 'Supervisor'));

                const hierarchy = {
                    name: 'System',
                    children: [
                        {
                            name: 'Directors',
                            children: directors.map((director: any) => ({
                                name: `${director.firstname} ${director.lastname}`,
                                userID: director.userID,
                                role: 'Director',
                                children: [
                                    {
                                        name: 'Regional Managers',
                                        children: regionalManagers.filter((rm: any) => rm.directorID === director.userID).map((rm: any) => ({
                                            name: `${rm.firstname} ${rm.lastname}`,
                                            userID: rm.userID,
                                            role: 'Regional Manager',
                                            children: [
                                                {
                                                    name: 'Regions',
                                                    children: regionData.filter((r: any) => rm.Regions?.some((reg: any) => reg.regionID === r.regionID)).map((region: any) => ({
                                                        name: region.name,
                                                        regionID: region.regionID,
                                                        children: [
                                                            {
                                                                name: 'Governorates',
                                                                children: govData.filter((g: any) => g.regionID === region.regionID).map((gov: any) => ({
                                                                    name: gov.name,
                                                                    governorateID: gov.governorateID,
                                                                    children: [
                                                                        {
                                                                            name: 'Delegations',
                                                                            children: delData.filter((d: any) => d.governorateID === gov.governorateID).map((del: any) => ({
                                                                                name: del.name,
                                                                                delegationID: del.delegationID,
                                                                            })),
                                                                        },
                                                                    ],
                                                                })),
                                                            },
                                                        ],
                                                    })),
                                                },
                                                {
                                                    name: 'Supervisors',
                                                    children: supervisors.filter((sup: any) => sup.regionalManagerID === rm.userID).map((sup: any) => ({
                                                        name: `${sup.firstname} ${sup.lastname}`,
                                                        userID: sup.userID,
                                                        role: 'Supervisor',
                                                        children: [
                                                            {
                                                                name: 'Agents',
                                                                children: agentData.agents.filter((agent: any) => agent.supervisorID === sup.userID).map((agent: any) => ({
                                                                    name: `${agent.name} ${agent.lastname}`,
                                                                    userID: agent.agentID,
                                                                    role: 'Agent',
                                                                })),
                                                            },
                                                        ],
                                                    })),
                                                },
                                            ],
                                        })),
                                    },
                                ],
                            })),
                        },
                    ],
                };

                setHierarchyData(hierarchy);
                setMetrics({
                    totalUsers: userData.length,
                    totalTimesheets: timesheetData.length,
                    totalVisits: timesheetData.flatMap((ts: any) => ts.Visits || []).length,
                    totalReceiptBooks: receiptBookData.length,
                    anomaliesDetected: notificationData.filter((n: any) => n.type === 'anomaly').length,
                    activeSupervisors: supervisors.filter((sup: any) => timesheetData.some((ts: any) => ts.supervisorID === sup.userID)).length,
                });
                setActivityLogs([...activityLogs, { id: Date.now(), action: 'Data Fetched', timestamp: new Date().toLocaleString() }]);
            } catch (error) {
                console.error('Failed to fetch HR dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleNodeClick = (node: any) => {
        if (node.userID) {
            const user = users.find(u => u.userID === node.userID);
            const agent = agents.find(a => a.agentID === node.userID);
            if (user) {
                setSelectedUser(user);
            } else if (agent) {
                setSelectedUser({
                    userID: agent.agentID,
                    firstname: agent.name,
                    lastname: agent.lastname || ''
                });
            }
            setIsUserModalVisible(true);
        }
    };

    const applyGlobalFilters = (data: any[], key: string) => {
        return data.filter(item => {
            const matchesDate = globalFilters.dateRange
                ? new Date(item.createdAt || item.date).getTime() >= globalFilters.dateRange[0].toDate().getTime() &&
                new Date(item.createdAt || item.date).getTime() <= globalFilters.dateRange[1].toDate().getTime()
                : true;
            const matchesRole = globalFilters.role
                ? (item.Roles || []).some((r: any) => r.name === globalFilters.role) || (item.role === globalFilters.role)
                : true;
            const matchesRegion = globalFilters.region
                ? (item.Regions || []).some((r: any) => r.regionID === globalFilters.region) ||
                (item.Delegation?.Governorate?.regionID === globalFilters.region)
                : true;
            const matchesSupervisor = globalFilters.supervisor
                ? item.supervisorID === globalFilters.supervisor
                : true;
            return matchesDate && matchesRole && matchesRegion && matchesSupervisor;
        });
    };

    const debouncedSearch = useCallback(debounce((value: string) => setSearchText(value), 300), []);

    // Hierarchy Tab
    const renderHierarchyTab = () => (
        <Card title="System Hierarchy" extra={<Button onClick={() => navigate('/admin')}>Manage Hierarchy</Button>}>
            <div ref={treeContainerRef} style={{ width: '100%', height: '800px', overflow: 'auto' }}>
                {hierarchyData && (
                    <Tree
                        data={hierarchyData}
                        orientation="vertical"
                        translate={{ x: treeContainerRef.current?.offsetWidth ? treeContainerRef.current.offsetWidth / 2 : 500, y: 50 }}
                        zoomable
                        collapsible
                        pathFunc="step"
                        onNodeClick={handleNodeClick}
                        nodeSize={{ x: 200, y: 100 }}
                    />
                )}
            </div>
            <Divider />
            <Statistic title="Total Entities" value={users.length + agents.length + regions.length + governorates.length + delegations.length} />
        </Card>
    );

    // Users Tab
    const userColumns = [
        { title: 'Name', dataIndex: 'firstname', key: 'name', sorter: (a: User, b: User) => `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`), render: (_: any, record: User) => `${record.firstname} ${record.lastname}` },
        { title: 'Email', dataIndex: 'email', key: 'email', sorter: (a: User, b: User) => a.email.localeCompare(b.email) },
        { title: 'Phone', dataIndex: 'phone', key: 'phone', sorter: (a: User, b: User) => a.phone.localeCompare(b.phone) },
        { title: 'Roles', dataIndex: 'Roles', key: 'roles', render: (roles: any[]) => roles.map(r => r.name).join(', ') },
        { title: 'Regions', key: 'regions', render: (_: any, record: User) => record.Regions?.length || 0 },
        { title: 'Timesheets', key: 'timesheets', render: (_: any, record: User) => timesheets.filter(ts => ts.supervisorID === record.userID).length },
        { title: 'Visits', key: 'visits', render: (_: any, record: User) => timesheets.filter(ts => ts.supervisorID === record.userID).reduce((sum, ts) => sum + (ts.Visits?.length || 0), 0) },
    ];

    const roleDistributionData = useMemo(() => users.reduce((acc: any, u: any) => {
        u.Roles.forEach((r: any) => { const existing = acc.find((item: any) => item.name === r.name); if (existing) existing.value += 1; else acc.push({ name: r.name, value: 1 }); });
        return acc;
    }, []), [users]);

    const registrationTrendData = useMemo(() => users.reduce((acc: any, u: any) => {
        const month = new Date(u.createdAt).toLocaleString('default', { month: 'long', year: 'numeric' });
        acc[month] = (acc[month] || 0) + 1;
        return acc;
    }, {}), [users]);
    const registrationChartData = Object.entries(registrationTrendData).map(([month, count]) => ({ month, count }));

    const supervisors = users.filter(u => u.Roles?.some((r: any) => r.name === 'Supervisor'));
    const governorateCounts = supervisors.reduce((acc: any, sup: any) => {
        sup.Governorates?.forEach((gov: any) => { acc[gov.name] = (acc[gov.name] || 0) + 1; });
        return acc;
    }, {});
    const supervisorPerGovData = Object.entries(governorateCounts).map(([name, count]) => ({ name, count }));

    const renderUsersTab = () => (
        <div>
            <Space style={{ marginBottom: 16 }}>
                <Input.Search placeholder="Search users" onChange={(e) => debouncedSearch(e.target.value)} />
                <Select placeholder="Filter by Role" onChange={(value) => setGlobalFilters({ ...globalFilters, role: value })} value={globalFilters.role}>
                    <Option value="">All</Option>
                    <Option value="Director">Director</Option>
                    <Option value="Regional Manager">Regional Manager</Option>
                    <Option value="Supervisor">Supervisor</Option>
                    <Option value="Agent">Agent</Option>
                </Select>
            </Space>
            <Row gutter={16}>
                <Col span={16}>
                    <Card title="User List">
                        <Table columns={userColumns} dataSource={applyGlobalFilters(users.filter(u => `${u.firstname} ${u.lastname}`.toLowerCase().includes(searchText.toLowerCase())), 'userID')} rowKey="userID" pagination={{ pageSize: 10 }} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card title="Role Distribution"><PieChart width={300} height={300}><Pie data={roleDistributionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{roleDistributionData.map((_: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><RechartsTooltip /><Legend /></PieChart></Card>
                    <Card title="Registration Trend"><LineChart width={300} height={300} data={registrationChartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><RechartsTooltip /><Line type="monotone" dataKey="count" stroke="#8884d8" /></LineChart></Card>
                    <Card title="Supervisors per Governorate"><BarChart width={300} height={300} data={supervisorPerGovData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><RechartsTooltip /><Bar dataKey="count" fill="#82ca9d" /></BarChart></Card>
                </Col>
            </Row>
        </div>
    );

    // Timesheets Tab
    const timesheetColumns = [
        { title: 'Supervisor', dataIndex: 'User', key: 'supervisor', sorter: (a: Timesheet, b: Timesheet) => `${a.User?.firstname} ${a.User?.lastname}`.localeCompare(`${b.User?.firstname} ${b.User?.lastname}`), render: (user: any) => user ? `${user.firstname} ${user.lastname}` : 'N/A' },
        { title: 'Week', dataIndex: 'weekNumber', key: 'weekNumber', sorter: (a: Timesheet, b: Timesheet) => a.weekNumber - b.weekNumber },
        { title: 'Year', dataIndex: 'year', key: 'year', sorter: (a: Timesheet, b: Timesheet) => a.year - b.year },
        { title: 'Status', dataIndex: 'status', key: 'status', sorter: (a: Timesheet, b: Timesheet) => a.status.localeCompare(b.status), render: (status: string) => <Tag color={status === 'validated' ? 'green' : 'orange'}>{status}</Tag> },
        { title: 'Visits', key: 'visits', render: (_: any, record: Timesheet) => record.Visits?.length || 0 },
        { title: 'Total Hours', key: 'hours', render: (_: any, record: Timesheet) => record.Visits?.reduce((sum: number, v: Visit) => sum + (v.duration || 0), 0) || 0 },
    ];

    const timesheetStatusData = useMemo(() => [
        { name: 'Pending', value: timesheets.filter(t => t.status === 'pending').length },
        { name: 'Validated', value: timesheets.filter(t => t.status === 'validated').length },
    ], [timesheets]);

    const timesheetTrendData = useMemo(() => timesheets.reduce((acc: any, ts: any) => {
        const week = `Week ${ts.weekNumber} ${ts.year}`;
        acc[week] = (acc[week] || 0) + 1;
        return acc;
    }, {}), [timesheets]);
    const timesheetChartData = Object.entries(timesheetTrendData).map(([week, count]) => ({ week, count }));

    const hoursPerSupervisor = useMemo(() => supervisors.map((sup: any) => {
        const supTimesheets = timesheets.filter(ts => ts.supervisorID === sup.userID);
        const totalHours = supTimesheets.reduce((sum: number, ts: any) => sum + (ts.Visits?.reduce((vSum: number, v: Visit) => vSum + (v.duration || 0), 0) || 0), 0);
        return { name: `${sup.firstname} ${sup.lastname}`, hours: totalHours };
    }), [timesheets, supervisors]);

    const renderTimesheetsTab = () => (
        <div>
            <Space style={{ marginBottom: 16 }}>
                <Input.Search placeholder="Search timesheets" onChange={(e) => debouncedSearch(e.target.value)} />
                <Select placeholder="Filter by Status" onChange={(value) => setTimesheets(applyGlobalFilters(timesheets.filter(t => !value || t.status === value), 'timesheetID'))}>
                    <Option value="">All</Option>
                    <Option value="pending">Pending</Option>
                    <Option value="validated">Validated</Option>
                </Select>
            </Space>
            <Row gutter={16}>
                <Col span={16}>
                    <Card title="Timesheet List">
                        <Table columns={timesheetColumns} dataSource={applyGlobalFilters(timesheets.filter(t => `${t.User?.firstname} ${t.User?.lastname}`.toLowerCase().includes(searchText.toLowerCase())), 'timesheetID')} rowKey="timesheetID" pagination={{ pageSize: 10 }} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card title="Timesheet Status"><PieChart width={300} height={300}><Pie data={timesheetStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{timesheetStatusData.map((_: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><RechartsTooltip /><Legend /></PieChart></Card>
                    <Card title="Timesheet Trends"><LineChart width={300} height={300} data={timesheetChartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" /><YAxis /><RechartsTooltip /><Line type="monotone" dataKey="count" stroke="#8884d8" /></LineChart></Card>
                    <Card title="Hours per Supervisor"><BarChart width={300} height={300} data={hoursPerSupervisor}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><RechartsTooltip /><Bar dataKey="hours" fill="#82ca9d" /></BarChart></Card>
                    <Card title="Timesheet Metrics">
                        <Statistic title="Total Timesheets" value={timesheets.length} />
                        <Statistic title="Pending" value={timesheetStatusData[0].value} />
                        <Statistic title="Validated" value={timesheetStatusData[1].value} />
                    </Card>
                </Col>
            </Row>
        </div>
    );

    // Receipt Books Tab
    const receiptBookColumns = [
        { title: 'Number', dataIndex: 'number', key: 'number', sorter: (a: ReceiptBook, b: ReceiptBook) => a.number.localeCompare(b.number) },
        { title: 'Status', dataIndex: 'status', key: 'status', sorter: (a: ReceiptBook, b: ReceiptBook) => a.status.localeCompare(b.status), render: (status: string) => <Tag color={status === ReceiptBookStatus.InStock ? 'blue' : 'purple'}>{status}</Tag> },
        { title: 'Holder', dataIndex: 'holder', key: 'holder', render: (holder: any) => holder ? `${holder.firstname} ${holder.lastname}` : 'N/A' },
    ];

    const receiptBookStatusData = useMemo(() => [
        { name: 'In Stock', value: receiptBooks.filter(rb => rb.status === ReceiptBookStatus.InStock).length },
        { name: 'With Agents', value: receiptBooks.filter(rb => rb.status === ReceiptBookStatus.AssignedToAgent).length },
        { name: 'With Supervisors', value: receiptBooks.filter(rb => rb.status === ReceiptBookStatus.WithSupervisor).length },
        { name: 'Archived', value: receiptBooks.filter(rb => rb.status === ReceiptBookStatus.Archived).length },
    ], [receiptBooks]);

    const receiptBooksPerHolder = useMemo(() => users.map((u: any) => ({
        name: `${u.firstname} ${u.lastname}`,
        books: receiptBooks.filter(rb => rb.holder?.userID === u.userID).length,
    })).filter((h: ReceiptBookHolder) => h.books > 0), [receiptBooks, users]);

    const renderReceiptBooksTab = () => (
        <div>
            <Space style={{ marginBottom: 16 }}>
                <Input.Search placeholder="Search receipt books" onChange={(e) => debouncedSearch(e.target.value)} />
                <Select placeholder="Filter by Status" onChange={(value) => setReceiptBooks(applyGlobalFilters(receiptBooks.filter(rb => !value || rb.status === value), 'bookID'))}>
                    <Option value="">All</Option>
                    <Option value={ReceiptBookStatus.InStock}>In Stock</Option>
                    <Option value={ReceiptBookStatus.AssignedToAgent}>With Agents</Option>
                    <Option value={ReceiptBookStatus.WithSupervisor}>With Supervisors</Option>
                    <Option value={ReceiptBookStatus.Archived}>Archived</Option>
                </Select>
            </Space>
            <Row gutter={16}>
                <Col span={16}>
                    <Card title="Receipt Book List">
                        <Table columns={receiptBookColumns} dataSource={applyGlobalFilters(receiptBooks.filter(rb => rb.number.toLowerCase().includes(searchText.toLowerCase())), 'bookID')} rowKey="bookID" pagination={{ pageSize: 10 }} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card title="Receipt Book Status"><PieChart width={300} height={300}><Pie data={receiptBookStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{receiptBookStatusData.map((_: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><RechartsTooltip /><Legend /></PieChart></Card>
                    <Card title="Receipt Books per Holder"><BarChart width={300} height={300} data={receiptBooksPerHolder}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><RechartsTooltip /><Bar dataKey="books" fill="#82ca9d" /></BarChart></Card>
                    <Card title="Receipt Book Metrics">
                        <Statistic title="Total Books" value={receiptBooks.length} />
                        <Statistic title="In Stock" value={receiptBookStatusData[0].value} />
                        <Statistic title="With Agents" value={receiptBookStatusData[1].value} />
                    </Card>
                </Col>
            </Row>
        </div>
    );

    // Visits Tab
    const visitColumns = [
        { title: 'Date', dataIndex: 'date', key: 'date', sorter: (a: Visit, b: Visit) => new Date(a.date).getTime() - new Date(b.date).getTime() },
        { title: 'Time', dataIndex: 'time', key: 'time', sorter: (a: Visit, b: Visit) => a.time.localeCompare(b.time) },
        { title: 'Agent', dataIndex: 'Agent', key: 'agent', render: (agent: any) => agent ? `${agent.name} ${agent.lastname}` : 'N/A' },
        { title: 'Status', dataIndex: 'status', key: 'status', sorter: (a: Visit, b: Visit) => a.status.localeCompare(b.status), render: (status: string) => <Tag color={status === 'validated' ? 'green' : 'red'}>{status}</Tag> },
        { title: 'Duration', dataIndex: 'duration', key: 'duration', sorter: (a: Visit, b: Visit) => (a.duration || 0) - (b.duration || 0) },
    ];

    const visitStatusData = useMemo(() => [
        { name: 'Pending', value: visits.filter(v => v.status === 'pending').length },
        { name: 'Visited', value: visits.filter(v => v.status === 'visited').length },
        { name: 'Validated', value: visits.filter(v => v.status === 'validated').length },
        { name: 'Rejected', value: visits.filter(v => v.status === 'rejected').length },
    ], [visits]);

    const visitTrendData = useMemo(() => visits.reduce((acc: any, v: any) => {
        const date = v.date.split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
    }, {}), [visits]);
    const visitChartData = Object.entries(visitTrendData).map(([date, count]) => ({ date, count }));

    const renderVisitsTab = () => (
        <div>
            <Space style={{ marginBottom: 16 }}>
                <Input.Search placeholder="Search visits" onChange={(e) => debouncedSearch(e.target.value)} />
                <Select placeholder="Filter by Status" onChange={(value) => setVisits(applyGlobalFilters(visits.filter(v => !value || v.status === value), 'visitID'))}>
                    <Option value="">All</Option>
                    <Option value="pending">Pending</Option>
                    <Option value="visited">Visited</Option>
                    <Option value="validated">Validated</Option>
                    <Option value="rejected">Rejected</Option>
                </Select>
            </Space>
            <Row gutter={16}>
                <Col span={12}>
                    <Card title="Visit List">
                        <Table columns={visitColumns} dataSource={applyGlobalFilters(visits.filter(v => v.Agent ? `${v.Agent.name} ${v.Agent.lastname}`.toLowerCase().includes(searchText.toLowerCase()) : true), 'visitID')} rowKey="visitID" pagination={{ pageSize: 10 }} />
                    </Card>
                </Col>
                <Col span={12}>
                    <Card title="Visit Status"><BarChart width={400} height={300} data={visitStatusData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><RechartsTooltip /><Legend /><Bar dataKey="value" fill="#82ca9d" /></BarChart></Card>
                    <Card title="Visit Trends"><LineChart width={400} height={300} data={visitChartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><RechartsTooltip /><Line type="monotone" dataKey="count" stroke="#8884d8" /></LineChart></Card>
                    <Card title="Agent Locations"><MapComponent /></Card>
                    <Card title="Visit Metrics">
                        <Statistic title="Total Visits" value={visits.length} />
                        <Statistic title="Validated" value={visitStatusData[2].value} />
                        <Statistic title="Pending" value={visitStatusData[0].value} />
                    </Card>
                </Col>
            </Row>
        </div>
    );

    // Anomalies Tab
    const anomalyColumns = [
        { title: 'Type', dataIndex: 'type', key: 'type', sorter: (a: any, b: any) => a.type.localeCompare(b.type) },
        { title: 'Message', dataIndex: 'message', key: 'message' },
        { title: 'Date', dataIndex: 'createdAt', key: 'createdAt', sorter: (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() },
    ];

    const anomalyTrendData = useMemo(() => anomalies.reduce((acc: any, a: any) => {
        const date = new Date(a.createdAt).toLocaleDateString();
        acc[date] = (acc[date] || 0) + 1;
        return acc;
    }, {}), [anomalies]);
    const anomalyChartData = Object.entries(anomalyTrendData).map(([date, count]) => ({ date, count }));

    const renderAnomaliesTab = () => (
        <div>
            <Card title="Detected Anomalies">
                <Table columns={anomalyColumns} dataSource={applyGlobalFilters(anomalies, 'notificationID')} rowKey="notificationID" pagination={{ pageSize: 10 }} />
            </Card>
            <Card title="Anomaly Trends"><LineChart width={400} height={300} data={anomalyChartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><RechartsTooltip /><Line type="monotone" dataKey="count" stroke="#FF6384" /></LineChart></Card>
            <Card title="Anomaly Metrics">
                <Statistic title="Total Anomalies" value={anomalies.length} />
                <Statistic title="Critical" value={anomalies.filter(a => a.severity === 'critical').length} />
            </Card>
        </div>
    );

    // Performance Tab
    const topSupervisors = useMemo(() => supervisors.map((sup: any) => ({
        name: `${sup.firstname} ${sup.lastname}`,
        visits: timesheets.filter(ts => ts.supervisorID === sup.userID).reduce((sum: number, ts: any) => sum + (ts.Visits?.length || 0), 0),
    })).sort((a, b) => b.visits - a.visits).slice(0, 5), [timesheets, supervisors]);

    const renderPerformanceTab = () => (
        <Row gutter={16}>
            <Col span={8}><Card title="Total Users"><Statistic value={metrics.totalUsers} prefix={<FaUsers />} /></Card></Col>
            <Col span={8}><Card title="Total Timesheets"><Statistic value={metrics.totalTimesheets} prefix={<FaClock />} /></Card></Col>
            <Col span={8}><Card title="Total Visits"><Statistic value={metrics.totalVisits} prefix={<FaMapMarkerAlt />} /></Card></Col>
            <Col span={8}><Card title="Total Receipt Books"><Statistic value={metrics.totalReceiptBooks} prefix={<FaBook />} /></Card></Col>
            <Col span={8}><Card title="Anomalies Detected"><Statistic value={metrics.anomaliesDetected} prefix={<FaBell />} /></Card></Col>
            <Col span={8}><Card title="Active Supervisors"><Statistic value={metrics.activeSupervisors} prefix={<FaUsers />} /></Card></Col>
            <Col span={12}><Card title="Top Supervisors"><BarChart width={400} height={300} data={topSupervisors}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><RechartsTooltip /><Bar dataKey="visits" fill="#82ca9d" /></BarChart></Card></Col>
            <Col span={12}><Card title="Workload Distribution"><PieChart width={400} height={300}><Pie data={topSupervisors} dataKey="visits" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{topSupervisors.map((_: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><RechartsTooltip /><Legend /></PieChart></Card></Col>
        </Row>
    );

    // Activity Log Tab
    const activityColumns = [
        { title: 'Action', dataIndex: 'action', key: 'action' },
        { title: 'Timestamp', dataIndex: 'timestamp', key: 'timestamp', sorter: (a: ActivityLog, b: ActivityLog) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() },
    ];

    const renderActivityLogTab = () => (
        <Card title="Activity Log">
            <Table columns={activityColumns} dataSource={activityLogs} rowKey="id" pagination={{ pageSize: 10 }} />
        </Card>
    );

    return (
        <div className="hr-dashboard">
            <h1>HR Dashboard</h1>
            <Space style={{ marginBottom: 16 }}>
                <RangePicker onChange={(dates) => setGlobalFilters({ ...globalFilters, dateRange: dates as [any, any] })} />
                <Select placeholder="Filter by Role" onChange={(value) => setGlobalFilters({ ...globalFilters, role: value })}>
                    <Option value="">All</Option>
                    <Option value="Director">Director</Option>
                    <Option value="Regional Manager">Regional Manager</Option>
                    <Option value="Supervisor">Supervisor</Option>
                    <Option value="Agent">Agent</Option>
                </Select>
                <Select placeholder="Filter by Region" onChange={(value) => setGlobalFilters({ ...globalFilters, region: value })}>
                    <Option value="">All</Option>
                    {regions.map(r => <Option key={r.regionID} value={r.regionID}>{r.name}</Option>)}
                </Select>
                <Select placeholder="Filter by Supervisor" onChange={(value) => setGlobalFilters({ ...globalFilters, supervisor: value })}>
                    <Option value="">All</Option>
                    {supervisors.map(s => <Option key={s.userID} value={s.userID}>{`${s.firstname} ${s.lastname}`}</Option>)}
                </Select>
            </Space>
            {loading ? (
                <Spin size="large" style={{ display: 'block', margin: '20px auto' }} />
            ) : (
                <Tabs defaultActiveKey="1">
                    <TabPane tab={<span><FaSitemap /> Hierarchy</span>} key="1">{renderHierarchyTab()}</TabPane>
                    <TabPane tab={<span><FaUsers /> Users</span>} key="2">{renderUsersTab()}</TabPane>
                    <TabPane tab={<span><FaClock /> Timesheets</span>} key="3">{renderTimesheetsTab()}</TabPane>
                    <TabPane tab={<span><FaBook /> Receipt Books</span>} key="4">{renderReceiptBooksTab()}</TabPane>
                    <TabPane tab={<span><FaMapMarkerAlt /> Visits</span>} key="5">{renderVisitsTab()}</TabPane>
                    <TabPane tab={<span><FaBell /> Anomalies</span>} key="6">{renderAnomaliesTab()}</TabPane>
                    <TabPane tab={<span><FaChartBar /> Performance</span>} key="7">{renderPerformanceTab()}</TabPane>
                    <TabPane tab={<span><FaSync /> Activity Log</span>} key="8">{renderActivityLogTab()}</TabPane>
                </Tabs>
            )}
            <Modal title="User Details" open={isUserModalVisible} onCancel={() => setIsUserModalVisible(false)} footer={null}>
                {selectedUser && (
                    <Descriptions bordered>
                        <Descriptions.Item label="Name">{`${selectedUser.firstname} ${selectedUser.lastname}`}</Descriptions.Item>
                        <Descriptions.Item label="Role">{selectedUser.Roles?.map((r: any) => r.name).join(', ') || 'Agent'}</Descriptions.Item>
                        <Descriptions.Item label="Assigned Regions">{selectedUser.Regions?.map((r: any) => r.name).join(', ') || 'N/A'}</Descriptions.Item>
                        <Descriptions.Item label="Timesheets">{timesheets.filter(ts => ts.supervisorID === selectedUser.userID).length}</Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>
        </div>
    );
};

export default HRDashboard;
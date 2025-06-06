import React, { useEffect, useState, useRef } from 'react';
import { Tabs, Card, Table, Select, Row, Col, Spin, Modal, Input, Tooltip, DatePicker, Space } from 'antd';
import Tree from 'react-d3-tree';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import MapComponent from '../../components/Google/MapComponent';
import { useAuth } from '../../context/AuthContext';
import { getAllTimesheets } from '../../apis/timesheetAPI';
import { getAllReceiptBooks } from '../../apis/receiptBookAPI';
import { getAllAgents } from '../../apis/agentAPI';
import { getAllUsers } from '../../apis/userAPI';
import { getAllRegions } from '../../apis/locationApi';
import { getNotifications } from '../../apis/notificationAPI';
import './HRDashboard.css';
import Timesheet from '../../models/Timesheet';
import ReceiptBook from '../../models/ReceiptBook';
import Visit from '../../models/Visit';
import User from '../../models/User';
import Agent from '../../models/Agent';
import Region from '../../models/Region';
import ReceiptBookStatus from '../../models/Enum/ReceiptBookStatus';

const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

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

const HRDashboard: React.FC = () => {
    const { } = useAuth();
    const [loading, setLoading] = useState(true);
    const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
    const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
    const [visits, setVisits] = useState<Visit[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [hierarchyData, setHierarchyData] = useState<HierarchyNode | null>(null);
    const [anomalies, setAnomalies] = useState<any[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [selectedUser, setSelectedUser] = useState<DisplayUser | null>(null);
    const [isUserModalVisible, setIsUserModalVisible] = useState(false);
    const [globalFilters, setGlobalFilters] = useState({ dateRange: null as [any, any] | null, role: '', region: '' });
    const treeContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [timesheetData, receiptBookData, userData, agentData, regionData, notificationData] = await Promise.all([
                    getAllTimesheets(),
                    getAllReceiptBooks(),
                    getAllUsers(),
                    getAllAgents(),
                    getAllRegions(),
                    getNotifications()
                ]);

                setTimesheets(timesheetData);
                setVisits(timesheetData.flatMap((ts: any) => ts.Visits || []));
                setReceiptBooks(Array.isArray(receiptBookData) ? receiptBookData : receiptBookData.books || []);
                setUsers(userData);
                setAgents(agentData.agents);
                setRegions(regionData);
                setAnomalies(notificationData.filter((n: any) => n.type === 'anomaly'));

                const directors = userData.filter((u: any) => u.Roles.some((r: any) => r.name === 'Director'));
                const regionalManagers = userData.filter((u: any) => u.Roles.some((r: any) => r.name === 'Regional Manager'));
                const supervisors = userData.filter((u: any) => u.Roles.some((r: any) => r.name === 'Supervisor'));

                const usersBranch = {
                    name: 'Users',
                    children: [{
                        name: 'Directors',
                        children: directors.map((director: any) => ({
                            name: `${director.firstname} ${director.lastname}`,
                            userID: director.userID,
                            role: 'Director',
                            children: [{
                                name: 'Regional Managers',
                                children: regionalManagers.filter((rm: any) => rm.directorID === director.userID).map((rm: any) => ({
                                    name: `${rm.firstname} ${rm.lastname}`,
                                    userID: rm.userID,
                                    role: 'Regional Manager',
                                    children: [{
                                        name: 'Supervisors',
                                        children: supervisors.filter((sup: any) => sup.regionalManagerID === rm.userID).map((sup: any) => ({
                                            name: `${sup.firstname} ${sup.lastname}`,
                                            userID: sup.userID,
                                            role: 'Supervisor',
                                            children: [{
                                                name: 'Agents',
                                                children: agentData.agents.filter((agent: any) => agent.supervisorID === sup.userID).map((agent: any) => ({
                                                    name: `${agent.name} ${agent.lastname}`,
                                                    userID: agent.agentID,
                                                    role: 'Agent'
                                                }))
                                            }]
                                        }))
                                    }]
                                }))
                            }]
                        }))
                    }]
                };

                const locationsBranch = {
                    name: 'Locations',
                    children: regionData.map((region: any) => ({
                        name: region.name,
                        regionID: region.regionID,
                        children: []
                    }))
                };

                setHierarchyData({ name: 'System', children: [usersBranch, locationsBranch] });
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

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#FF6384', '#36A2EB', '#FFCE56'];

    const applyGlobalFilters = (data: any[], key: string) => {
        return data.filter(item => {
            const matchesDate = globalFilters.dateRange
                ? new Date(item.createdAt || item.date).getTime() >= globalFilters.dateRange[0].toDate().getTime() &&
                new Date(item.createdAt || item.date).getTime() <= globalFilters.dateRange[1].toDate().getTime()
                : true;
            const matchesRole = globalFilters.role
                ? (item.Roles || []).some((r: any) => r.name === globalFilters.role) ||
                (item.role === globalFilters.role)
                : true;
            const matchesRegion = globalFilters.region
                ? (item.Regions || []).some((r: any) => r.regionID === globalFilters.region) ||
                (item.Delegation?.Governorate?.regionID === globalFilters.region)
                : true;
            return matchesDate && matchesRole && matchesRegion;
        });
    };

    const renderHierarchyTab = () => (
        <Card title="System Hierarchy">
            <div ref={treeContainerRef} style={{ width: '100%', height: '600px', overflow: 'auto' }}>
                {hierarchyData && (
                    <Tree
                        data={hierarchyData}
                        orientation="vertical"
                        translate={{ x: treeContainerRef.current?.offsetWidth ? treeContainerRef.current.offsetWidth / 2 : 500, y: 50 }}
                        zoomable
                        collapsible
                        pathFunc="step"
                        onNodeClick={handleNodeClick}
                    />
                )}
            </div>
        </Card>
    );

    const userColumns = [
        { title: 'Name', dataIndex: 'firstname', key: 'name', sorter: (a: User, b: User) => `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`), render: (_: any, record: User) => `${record.firstname} ${record.lastname}` },
        { title: 'Email', dataIndex: 'email', key: 'email', sorter: (a: User, b: User) => a.email.localeCompare(b.email) },
        { title: 'Phone', dataIndex: 'phone', key: 'phone', sorter: (a: User, b: User) => a.phone.localeCompare(b.phone) },
        { title: 'Roles', dataIndex: 'Roles', key: 'roles', render: (roles: any[]) => roles.map(r => r.name).join(', ') },
        {
            title: 'Assignments', key: 'assignments', render: (_: any, record: User) => (
                <Tooltip title={<div>Regions: {record.Regions?.map(r => r.name).join(', ')}</div>}>
                    <span>Regions: {record.Regions?.length || 0}</span>
                </Tooltip>
            )
        },
        { title: 'Timesheets', key: 'timesheets', render: (_: any, record: User) => timesheets.filter(ts => ts.supervisorID === record.userID).length },
        { title: 'Visits', key: 'visits', render: (_: any, record: User) => timesheets.filter(ts => ts.supervisorID === record.userID).reduce((sum, ts) => sum + (ts.Visits?.length || 0), 0) }
    ];

    const roleDistributionData = users.reduce((acc: any, u: any) => {
        u.Roles.forEach((r: any) => { const existing = acc.find((item: any) => item.name === r.name); if (existing) existing.value += 1; else acc.push({ name: r.name, value: 1 }); });
        return acc;
    }, []);

    const registrationTrendData = users.reduce((acc: any, u: any) => {
        const month = new Date(u.createdAt).toLocaleString('default', { month: 'long', year: 'numeric' });
        acc[month] = (acc[month] || 0) + 1;
        return acc;
    }, {});
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
                <Input.Search
                    placeholder="Search users"
                    onChange={(e) => setUsers(applyGlobalFilters(users.filter(u => `${u.firstname} ${u.lastname}`.toLowerCase().includes(e.target.value.toLowerCase())), 'userID'))}
                />
            </Space>
            <Row gutter={16}>
                <Col span={16}>
                    <Card title="User List">
                        <Table columns={userColumns} dataSource={applyGlobalFilters(users, 'userID')} rowKey="userID" pagination={{ pageSize: 10 }} />
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

    const timesheetColumns = [
        { title: 'Supervisor', dataIndex: 'User', key: 'supervisor', sorter: (a: Timesheet, b: Timesheet) => `${a.User?.firstname} ${a.User?.lastname}`.localeCompare(`${b.User?.firstname} ${b.User?.lastname}`), render: (user: any) => user ? `${user.firstname} ${user.lastname}` : 'N/A' },
        { title: 'Week', dataIndex: 'weekNumber', key: 'weekNumber', sorter: (a: Timesheet, b: Timesheet) => a.weekNumber - b.weekNumber },
        { title: 'Year', dataIndex: 'year', key: 'year', sorter: (a: Timesheet, b: Timesheet) => a.year - b.year },
        { title: 'Status', dataIndex: 'status', key: 'status', sorter: (a: Timesheet, b: Timesheet) => a.status.localeCompare(b.status) },
        { title: 'Visits', key: 'visits', render: (_: any, record: Timesheet) => record.Visits?.length || 0 },
        { title: 'Total Hours', key: 'hours', render: (_: any, record: Timesheet) => record.Visits?.reduce((sum: number, v: Visit) => sum + (v.duration || 0), 0) || 0 }
    ];

    const timesheetStatusData = [
        { name: 'Pending', value: timesheets.filter(t => t.status === 'pending').length },
        { name: 'Validated', value: timesheets.filter(t => t.status === 'validated').length }
    ];

    const timesheetTrendData = timesheets.reduce((acc: any, ts: any) => {
        const week = `Week ${ts.weekNumber} ${ts.year}`;
        acc[week] = (acc[week] || 0) + 1;
        return acc;
    }, {});
    const timesheetChartData = Object.entries(timesheetTrendData).map(([week, count]) => ({ week, count }));

    const hoursPerSupervisor = supervisors.map((sup: any) => {
        const supTimesheets = timesheets.filter(ts => ts.supervisorID === sup.userID);
        const totalHours = supTimesheets.reduce((sum: number, ts: any) => sum + (ts.Visits?.reduce((vSum: number, v: Visit) => vSum + (v.duration || 0), 0) || 0), 0);
        return { name: `${sup.firstname} ${sup.lastname}`, hours: totalHours };
    });

    const renderTimesheetsTab = () => (
        <div>
            <Space style={{ marginBottom: 16 }}>
                <Input.Search
                    placeholder="Search timesheets"
                    onChange={(e) => setTimesheets(applyGlobalFilters(timesheets.filter(t => `${t.User?.firstname} ${t.User?.lastname}`.toLowerCase().includes(e.target.value.toLowerCase())), 'timesheetID'))}
                />
                <Select
                    placeholder="Filter by Status"
                    onChange={(value) => setTimesheets(applyGlobalFilters(timesheets.filter(t => !value || t.status === value), 'timesheetID'))}
                >
                    <Select.Option value="">All</Select.Option>
                    <Select.Option value="pending">Pending</Select.Option>
                    <Select.Option value="validated">Validated</Select.Option>
                </Select>
            </Space>
            <Row gutter={16}>
                <Col span={16}>
                    <Card title="Timesheet List">
                        <Table columns={timesheetColumns} dataSource={applyGlobalFilters(timesheets, 'timesheetID')} rowKey="timesheetID" pagination={{ pageSize: 10 }} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card title="Timesheet Status"><PieChart width={300} height={300}><Pie data={timesheetStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{timesheetStatusData.map((_: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><RechartsTooltip /><Legend /></PieChart></Card>
                    <Card title="Timesheet Trends"><LineChart width={300} height={300} data={timesheetChartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" /><YAxis /><RechartsTooltip /><Line type="monotone" dataKey="count" stroke="#8884d8" /></LineChart></Card>
                    <Card title="Hours per Supervisor"><BarChart width={300} height={300} data={hoursPerSupervisor}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><RechartsTooltip /><Bar dataKey="hours" fill="#82ca9d" /></BarChart></Card>
                </Col>
            </Row>
        </div>
    );

    const receiptBookColumns = [
        { title: 'Number', dataIndex: 'number', key: 'number', sorter: (a: ReceiptBook, b: ReceiptBook) => a.number.localeCompare(b.number) },
        { title: 'Status', dataIndex: 'status', key: 'status', sorter: (a: ReceiptBook, b: ReceiptBook) => a.status.localeCompare(b.status) },
        { title: 'Holder', dataIndex: 'holder', key: 'holder', render: (holder: any) => holder ? `${holder.firstname} ${holder.lastname}` : 'N/A' }
    ];

    const receiptBookStatusData = [
        { name: 'In Stock', value: receiptBooks.filter(rb => rb.status === ReceiptBookStatus.InStock).length },
        { name: 'With Agents', value: receiptBooks.filter(rb => rb.status === ReceiptBookStatus.AssignedToAgent).length },
        { name: 'With Supervisors', value: receiptBooks.filter(rb => rb.status === ReceiptBookStatus.WithSupervisor).length },
        { name: 'Archived', value: receiptBooks.filter(rb => rb.status === ReceiptBookStatus.Archived).length }
    ];

    const receiptBooksPerHolder: ReceiptBookHolder[] = users.map((u: any) => ({
        name: `${u.firstname} ${u.lastname}`,
        books: receiptBooks.filter(rb => rb.holder?.userID === u.userID).length
    })).filter((h: ReceiptBookHolder) => h.books > 0);

    const renderReceiptBooksTab = () => (
        <div>
            <Space style={{ marginBottom: 16 }}>
                <Input.Search
                    placeholder="Search receipt books"
                    onChange={(e) => setReceiptBooks(applyGlobalFilters(receiptBooks.filter(rb => rb.number.toLowerCase().includes(e.target.value.toLowerCase())), 'bookID'))}
                />
                <Select
                    placeholder="Filter by Status"
                    onChange={(value) => setReceiptBooks(applyGlobalFilters(receiptBooks.filter(rb => !value || rb.status === value), 'bookID'))}
                >
                    <Select.Option value="">All</Select.Option>
                    <Select.Option value={ReceiptBookStatus.InStock}>In Stock</Select.Option>
                    <Select.Option value={ReceiptBookStatus.AssignedToAgent}>With Agents</Select.Option>
                    <Select.Option value={ReceiptBookStatus.WithSupervisor}>With Supervisors</Select.Option>
                    <Select.Option value={ReceiptBookStatus.Archived}>Archived</Select.Option>
                </Select>
            </Space>
            <Row gutter={16}>
                <Col span={16}>
                    <Card title="Receipt Book List">
                        <Table columns={receiptBookColumns} dataSource={applyGlobalFilters(receiptBooks, 'bookID')} rowKey="bookID" pagination={{ pageSize: 10 }} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card title="Receipt Book Status"><PieChart width={300} height={300}><Pie data={receiptBookStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{receiptBookStatusData.map((_: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><RechartsTooltip /><Legend /></PieChart></Card>
                    <Card title="Receipt Books per Holder"><BarChart width={300} height={300} data={receiptBooksPerHolder}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><RechartsTooltip /><Bar dataKey="books" fill="#82ca9d" /></BarChart></Card>
                </Col>
            </Row>
        </div>
    );

    const visitColumns = [
        { title: 'Date', dataIndex: 'date', key: 'date', sorter: (a: Visit, b: Visit) => new Date(a.date).getTime() - new Date(b.date).getTime() },
        { title: 'Time', dataIndex: 'time', key: 'time', sorter: (a: Visit, b: Visit) => a.time.localeCompare(b.time) },
        { title: 'Agent', dataIndex: 'Agent', key: 'agent', render: (agent: any) => agent ? `${agent.name} ${agent.lastname}` : 'N/A' },
        { title: 'Status', dataIndex: 'status', key: 'status', sorter: (a: Visit, b: Visit) => a.status.localeCompare(b.status) },
        { title: 'Duration', dataIndex: 'duration', key: 'duration', sorter: (a: Visit, b: Visit) => (a.duration || 0) - (b.duration || 0) }
    ];

    const visitStatusData = [
        { name: 'Pending', value: visits.filter(v => v.status === 'pending').length },
        { name: 'Visited', value: visits.filter(v => v.status === 'visited').length },
        { name: 'Validated', value: visits.filter(v => v.status === 'validated').length },
        { name: 'Rejected', value: visits.filter(v => v.status === 'rejected').length }
    ];

    const visitTrendData = visits.reduce((acc: any, v: any) => {
        const date = v.date.split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
    }, {});
    const visitChartData = Object.entries(visitTrendData).map(([date, count]) => ({ date, count }));

    const renderVisitsTab = () => (
        <div>
            <Space style={{ marginBottom: 16 }}>
                <Input.Search
                    placeholder="Search visits"
                    onChange={(e) => setVisits(applyGlobalFilters(visits.filter(v => v.Agent ? `${v.Agent.name} ${v.Agent.lastname}`.toLowerCase().includes(e.target.value.toLowerCase()) : true), 'visitID'))}
                />
                <Select
                    placeholder="Filter by Status"
                    onChange={(value) => setVisits(applyGlobalFilters(visits.filter(v => !value || v.status === value), 'visitID'))}
                >
                    <Select.Option value="">All</Select.Option>
                    <Select.Option value="pending">Pending</Select.Option>
                    <Select.Option value="visited">Visited</Select.Option>
                    <Select.Option value="validated">Validated</Select.Option>
                    <Select.Option value="rejected">Rejected</Select.Option>
                </Select>
            </Space>
            <Row gutter={16}>
                <Col span={12}>
                    <Card title="Visit List">
                        <Table columns={visitColumns} dataSource={applyGlobalFilters(visits, 'visitID')} rowKey="visitID" pagination={{ pageSize: 10 }} />
                    </Card>
                </Col>
                <Col span={12}>
                    <Card title="Visit Status"><BarChart width={400} height={300} data={visitStatusData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><RechartsTooltip /><Legend /><Bar dataKey="value" fill="#82ca9d" /></BarChart></Card>
                    <Card title="Visit Trends"><LineChart width={400} height={300} data={visitChartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><RechartsTooltip /><Line type="monotone" dataKey="count" stroke="#8884d8" /></LineChart></Card>
                    <Card title="Agent Locations"><MapComponent /></Card>
                </Col>
            </Row>
        </div>
    );

    const anomalyColumns = [
        { title: 'Type', dataIndex: 'type', key: 'type', sorter: (a: any, b: any) => a.type.localeCompare(b.type) },
        { title: 'Message', dataIndex: 'message', key: 'message' },
        { title: 'Date', dataIndex: 'createdAt', key: 'createdAt', sorter: (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() }
    ];

    const anomalyTrendData = anomalies.reduce((acc: any, a: any) => {
        const date = new Date(a.createdAt).toLocaleDateString();
        acc[date] = (acc[date] || 0) + 1;
        return acc;
    }, {});
    const anomalyChartData = Object.entries(anomalyTrendData).map(([date, count]) => ({ date, count }));

    const renderAnomaliesTab = () => (
        <div>
            <Card title="Detected Anomalies">
                <Table columns={anomalyColumns} dataSource={applyGlobalFilters(anomalies, 'notificationID')} rowKey="notificationID" pagination={{ pageSize: 10 }} />
            </Card>
            <Card title="Anomaly Trends"><LineChart width={400} height={300} data={anomalyChartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><RechartsTooltip /><Line type="monotone" dataKey="count" stroke="#FF6384" /></LineChart></Card>
        </div>
    );

    const topSupervisors = supervisors.map((sup: any) => ({
        name: `${sup.firstname} ${sup.lastname}`,
        visits: timesheets.filter(ts => ts.supervisorID === sup.userID).reduce((sum: number, ts: any) => sum + (ts.Visits?.length || 0), 0)
    })).sort((a, b) => b.visits - a.visits).slice(0, 5);

    const renderPerformanceTab = () => (
        <Row gutter={16}>
            <Col span={8}><Card title="Total Users"><p>{users.length}</p></Card></Col>
            <Col span={8}><Card title="Total Timesheets"><p>{timesheets.length}</p></Card></Col>
            <Col span={8}><Card title="Total Visits"><p>{visits.length}</p></Card></Col>
            <Col span={8}><Card title="Top Supervisors"><BarChart width={300} height={300} data={topSupervisors}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><RechartsTooltip /><Bar dataKey="visits" fill="#82ca9d" /></BarChart></Card></Col>
        </Row>
    );

    return (
        <div className="hr-dashboard">
            <h1>HR Dashboard</h1>
            <Space style={{ marginBottom: 16 }}>
                <RangePicker onChange={(dates) => setGlobalFilters({ ...globalFilters, dateRange: dates as [any, any] })} />
                <Select placeholder="Filter by Role" onChange={(value) => setGlobalFilters({ ...globalFilters, role: value })}>
                    <Select.Option value="">All</Select.Option>
                    <Select.Option value="Director">Director</Select.Option>
                    <Select.Option value="Regional Manager">Regional Manager</Select.Option>
                    <Select.Option value="Supervisor">Supervisor</Select.Option>
                    <Select.Option value="Agent">Agent</Select.Option>
                </Select>
                <Select placeholder="Filter by Region" onChange={(value) => setGlobalFilters({ ...globalFilters, region: value })}>
                    <Select.Option value="">All</Select.Option>
                    {regions.map(r => <Select.Option key={r.regionID} value={r.regionID}>{r.name}</Select.Option>)}
                </Select>
            </Space>
            {loading ? (
                <Spin size="large" style={{ display: 'block', margin: '20px auto' }} />
            ) : (
                <Tabs defaultActiveKey="1">
                    <TabPane tab="Hierarchy" key="1">{renderHierarchyTab()}</TabPane>
                    <TabPane tab="Users" key="2">{renderUsersTab()}</TabPane>
                    <TabPane tab="Timesheets" key="3">{renderTimesheetsTab()}</TabPane>
                    <TabPane tab="Receipt Books" key="4">{renderReceiptBooksTab()}</TabPane>
                    <TabPane tab="Visits" key="5">{renderVisitsTab()}</TabPane>
                    <TabPane tab="Anomalies" key="6">{renderAnomaliesTab()}</TabPane>
                    <TabPane tab="Performance" key="7">{renderPerformanceTab()}</TabPane>
                </Tabs>
            )}
            <Modal title="User Details" open={isUserModalVisible} onCancel={() => setIsUserModalVisible(false)} footer={null}>
                {selectedUser && (
                    <div>
                        <p><strong>Name:</strong> {selectedUser.firstname} {selectedUser.lastname}</p>
                        <p><strong>Role:</strong> {selectedUser.Roles?.map((r: any) => r.name).join(', ') || 'Agent'}</p>
                        <p><strong>Assigned Regions:</strong> {selectedUser.Regions?.map((r: any) => r.name).join(', ') || 'N/A'}</p>
                        <p><strong>Timesheets:</strong> {timesheets.filter(ts => ts.supervisorID === selectedUser.userID).length}</p>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default HRDashboard;

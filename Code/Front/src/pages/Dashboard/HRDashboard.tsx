import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Tabs, Card, Table, Select, Row, Col, Spin, Modal, Input, DatePicker, Space, Tag, Statistic, Descriptions, Popover, Divider, Tree, message, Collapse, Timeline, List, Avatar } from 'antd';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ScatterChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, Treemap, LabelList } from 'recharts';
import MapComponent from '../../components/Google/MapComponent';
import { getAllTimesheets } from '../../apis/timesheetAPI';
import { getAllReceiptBooks, getAllReceiptBookTypes } from '../../apis/receiptBookAPI';
import { getAllAgents } from '../../apis/agentAPI';
import { getAllUsers, } from '../../apis/userAPI';
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
import { FaUsers, FaBook, FaClock, FaMapMarkerAlt, FaChartBar, FaSitemap, FaBell, FaSync, } from 'react-icons/fa';
import { debounce } from 'lodash';
import Governorate from '../../models/Governorate';
import Delegation from '../../models/Delegation';

const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { Panel } = Collapse;

interface HierarchyNode {
    name: string;
    children?: HierarchyNode[];
    userID?: string;
    role?: string;
    regionID?: string;
    governorateID?: string;
    delegationID?: string;
    metrics?: {
        totalVisits: number;
        totalTimesheets: number;
        anomalies: number;
        receiptBooks: number;
    };
    key?: string;
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

interface Metrics {
    totalUsers: number;
    totalTimesheets: number;
    totalVisits: number;
    totalReceiptBooks: number;
    anomaliesDetected: number;
    activeSupervisors: number;
    totalRegions: number;
    totalGovernorates: number;
    totalDelegations: number;
}

const HRDashboard: React.FC = () => {

    const [loading, setLoading] = useState(true);
    const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
    const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
    const [visits, setVisits] = useState<Visit[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [hierarchyData, setHierarchyData] = useState<HierarchyNode | null>(null);
    const [filteredHierarchyData, setFilteredHierarchyData] = useState<HierarchyNode | null>(null);
    const [anomalies, setAnomalies] = useState<any[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [governorates, setGovernorates] = useState<Governorate[]>([]);
    const [delegations, setDelegations] = useState<Delegation[]>([]);
    const [selectedUser, setSelectedUser] = useState<DisplayUser | null>(null);
    const [isUserModalVisible, setIsUserModalVisible] = useState(false);
    const [globalFilters, setGlobalFilters] = useState({
        dateRange: null as [any, any] | null,
        role: '',
        region: '',
        governorate: '',
        delegation: '',
        supervisor: '',
        status: '',
        searchText: ''
    });
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const treeContainerRef = useRef<HTMLDivElement>(null);
    const [metrics, setMetrics] = useState<Metrics>({
        totalUsers: 0,
        totalTimesheets: 0,
        totalVisits: 0,
        totalReceiptBooks: 0,
        anomaliesDetected: 0,
        activeSupervisors: 0,
        totalRegions: 0,
        totalGovernorates: 0,
        totalDelegations: 0,
    });
    const [receiptBookTypes, setReceiptBookTypes] = useState<any[]>([]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];

    const generateTreeKeys = (nodes: HierarchyNode[], level: number = 0, parentKey: string = '', keys: string[] = [], maxLevel: number = 3): string[] => {
        nodes.forEach((node, index) => {
            const nodeKey = node.userID || node.regionID || node.governorateID || node.delegationID || `${parentKey}-${index}`;
            node.key = nodeKey;
            if (level < maxLevel && node.children) {
                keys.push(nodeKey);
                generateTreeKeys(node.children, level + 1, nodeKey, keys, maxLevel);
            }
        });
        return keys;
    };


    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [
                    timesheetData,
                    receiptBookData,
                    userData,
                    agentData,
                    regionData,
                    govData,
                    delData,
                    notificationData,
                    receiptBookTypesData
                ] = await Promise.all([
                    getAllTimesheets(),
                    getAllReceiptBooks(),
                    getAllUsers(),
                    getAllAgents(),
                    getAllRegions(),
                    getAllGovernorates(),
                    getAllDelegations(),
                    getNotifications(),
                    getAllReceiptBookTypes()
                ]);

                console.log('Regions:', regionData);
                console.log('Governorates:', govData);
                console.log('Delegations Sample:', delData.slice(0, 10).map(d => ({
                    delegationID: d.delegationID,
                    name: d.name,
                    governorateID: d.governorateID
                })));

                setTimesheets(Array.isArray(timesheetData) ? timesheetData : []);
                setVisits(Array.isArray(timesheetData) ? timesheetData.flatMap((ts: any) => ts.Visits || []) : []);
                const receiptBooksArray = Array.isArray(receiptBookData) ? receiptBookData : (receiptBookData?.books || []);
                setReceiptBooks(receiptBooksArray);
                setUsers(Array.isArray(userData) ? userData : []);
                setAgents(agentData?.agents || []);
                setRegions(Array.isArray(regionData) ? regionData : []);
                setGovernorates(Array.isArray(govData) ? govData : []);
                setDelegations(Array.isArray(delData) ? delData : []);

                if (!Array.isArray(delData) || delData.length === 0) {
                    console.warn('No delegations returned from API');
                    message.warning('No delegations found. Please check the database or API.');
                } else {
                    const invalidDelegations = delData.filter(d => !d.governorateID);
                    if (invalidDelegations.length > 0) {
                        console.warn('Delegations with missing governorateID:', invalidDelegations.map(d => ({
                            delegationID: d.delegationID,
                            name: d.name
                        })));
                    }
                }

                setAnomalies(notificationData?.filter((n: any) => n.type === 'anomaly') || []);
                setReceiptBookTypes(Array.isArray(receiptBookTypesData) ? receiptBookTypesData : []);

                const directors = Array.isArray(userData) ? userData.filter((u: any) => u.Roles?.some((r: any) => r.name === 'Director')) : [];
                const regionalManagers = Array.isArray(userData) ? userData.filter((u: any) => u.Roles?.some((r: any) => r.name === 'Regional Manager')) : [];
                const supervisors = Array.isArray(userData) ? userData.filter((u: any) => u.Roles?.some((r: any) => r.name === 'Supervisor')) : [];

                const hierarchy = buildHierarchy(
                    directors,
                    regionalManagers,
                    supervisors,
                    regionData,
                    govData,
                    delData,
                    agentData?.agents || [],
                    timesheetData || [],
                    notificationData || [],
                    receiptBooksArray
                );

                // Assign keys to hierarchy nodes
                if (hierarchy.children) {
                    generateTreeKeys(hierarchy.children);
                }

                setHierarchyData(hierarchy);
                setFilteredHierarchyData(hierarchy);

                setMetrics({
                    totalUsers: userData?.length || 0,
                    totalTimesheets: timesheetData?.length || 0,
                    totalVisits: timesheetData?.flatMap((ts: any) => ts.Visits || []).length || 0,
                    totalReceiptBooks: receiptBooksArray.length || 0,
                    anomaliesDetected: notificationData?.filter((n: any) => n.type === 'anomaly').length || 0,
                    activeSupervisors: supervisors?.filter((sup: any) => timesheetData?.some((ts: any) => ts.supervisorID === sup.userID)).length || 0,
                    totalRegions: regionData?.length || 0,
                    totalGovernorates: govData?.length || 0,
                    totalDelegations: delData?.length || 0,
                });

                setActivityLogs([...activityLogs, { id: Date.now(), action: 'Data Fetched', timestamp: new Date().toLocaleString() }]);
            } catch (error) {
                console.error('Failed to fetch HR dashboard data:', error);
                message.error('Failed to fetch data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const buildHierarchy = (
        directors: User[],
        regionalManagers: User[],
        supervisors: User[],
        regions: Region[],
        govs: Governorate[],
        dels: Delegation[],
        agents: Agent[],
        timesheets: Timesheet[],
        notifications: any[],
        receiptBooks: ReceiptBook[]
    ) => {
        // Debug: Log input data
        console.log('buildHierarchy Input - Regions:', regions);
        console.log('buildHierarchy Input - Governorates:', govs);
        console.log('buildHierarchy Input - Delegations Sample:', dels.slice(0, 10).map(d => ({
            delegationID: d.delegationID,
            name: d.name,
            governorateID: d.governorateID
        })));

        // Find unassigned delegations
        const validGovIDs = new Set(govs.map(g => g.governorateID));
        const unassignedDels = dels.filter(d => !validGovIDs.has(d.governorateID));

        // Debug: Check governorate-delegation relationships
        console.log('Governorate-Delegation Mapping:', govs.map(gov => ({
            governorate: gov.name,
            governorateID: gov.governorateID,
            delegations: dels.filter(d => d.governorateID === gov.governorateID).map(d => ({
                name: d.name,
                delegationID: d.delegationID,
                governorateID: d.governorateID
            }))
        })));
        console.log('Unassigned Delegations:', unassignedDels.map(d => ({
            delegationID: d.delegationID,
            name: d.name,
            governorateID: d.governorateID
        })));

        const directorNodes = directors.map(director => {
            const directorTimesheets = timesheets.filter(ts => ts.supervisorID === director.userID) || [];
            const directorVisits = directorTimesheets.flatMap(ts => ts.Visits || []) || [];
            const directorAnomalies = notifications?.filter(n => n.userID === director.userID && n.type === 'anomaly').length || 0;
            const directorReceiptBooks = Array.isArray(receiptBooks) ? receiptBooks.filter(rb => rb.holder?.userID === director.userID).length : 0;

            return {
                name: `${director.firstname} ${director.lastname}`,
                userID: director.userID,
                role: 'Director',
                metrics: {
                    totalVisits: directorVisits.length,
                    totalTimesheets: directorTimesheets.length,
                    anomalies: directorAnomalies,
                    receiptBooks: directorReceiptBooks,
                },
                children: [
                    {
                        name: 'Regional Managers',
                        children: regionalManagers.filter(rm => rm.directorID === director.userID).map(rm => {
                            const rmTimesheets = timesheets.filter(ts => ts.supervisorID === rm.userID) || [];
                            const rmVisits = rmTimesheets.flatMap(ts => ts.Visits || []) || [];
                            const rmAnomalies = notifications?.filter(n => n.userID === rm.userID && n.type === 'anomaly').length || 0;
                            const rmReceiptBooks = Array.isArray(receiptBooks) ? receiptBooks.filter(rb => rb.holder?.userID === rm.userID).length : 0;

                            return {
                                name: `${rm.firstname} ${rm.lastname}`,
                                userID: rm.userID,
                                role: 'Regional Manager',
                                metrics: {
                                    totalVisits: rmVisits.length,
                                    totalTimesheets: rmTimesheets.length,
                                    anomalies: rmAnomalies,
                                    receiptBooks: rmReceiptBooks,
                                },
                                children: [
                                    {
                                        name: 'Regions',
                                        children: regions.filter(r => rm.Regions?.some((reg: any) => reg.regionID === r.regionID)).map(region => ({
                                            name: region.name,
                                            regionID: region.regionID,
                                            children: [
                                                {
                                                    name: 'Governorates',
                                                    children: govs.filter(g => g.regionID === region.regionID).map(gov => ({
                                                        name: gov.name,
                                                        governorateID: gov.governorateID,
                                                        children: [
                                                            {
                                                                name: 'Delegations',
                                                                children: dels
                                                                    .filter(d => d.governorateID === gov.governorateID)
                                                                    .map(del => ({
                                                                        name: del.name,
                                                                        delegationID: del.delegationID,
                                                                        children: [
                                                                            {
                                                                                name: 'Agents',
                                                                                children: agents
                                                                                    .filter(agent => agent.delegationID === del.delegationID)
                                                                                    .map(agent => ({
                                                                                        name: `${agent.name} ${agent.lastname || ''}`,
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
                                    {
                                        name: 'Supervisors',
                                        children: supervisors.filter(sup => sup.regionalManagerID === rm.userID).map(sup => {
                                            const supTimesheets = timesheets.filter(ts => ts.supervisorID === sup.userID) || [];
                                            const supVisits = supTimesheets.flatMap(ts => ts.Visits || []) || [];
                                            const supAnomalies = notifications?.filter(n => n.userID === sup.userID && n.type === 'anomaly').length || 0;
                                            const supReceiptBooks = Array.isArray(receiptBooks) ? receiptBooks.filter(rb => rb.holder?.userID === sup.userID).length : 0;

                                            return {
                                                name: `${sup.firstname} ${sup.lastname}`,
                                                userID: sup.userID,
                                                role: 'Supervisor',
                                                metrics: {
                                                    totalVisits: supVisits.length,
                                                    totalTimesheets: supTimesheets.length,
                                                    anomalies: supAnomalies,
                                                    receiptBooks: supReceiptBooks,
                                                },
                                                children: [
                                                    {
                                                        name: 'Governorates',
                                                        children: (sup.Governorates || []).map((gov: Governorate) => ({
                                                            name: gov.name,
                                                            governorateID: gov.governorateID,
                                                            children: [
                                                                {
                                                                    name: 'Delegations',
                                                                    children: (sup.Delegations || [])
                                                                        .filter((del: Delegation) => del.governorateID === gov.governorateID)
                                                                        .map((del: Delegation) => ({
                                                                            name: del.name,
                                                                            delegationID: del.delegationID,
                                                                            children: [
                                                                                {
                                                                                    name: 'Agents',
                                                                                    children: agents
                                                                                        .filter(agent => agent.delegationID === del.delegationID && agent.supervisorID === sup.userID)
                                                                                        .map(agent => ({
                                                                                            name: `${agent.name} ${agent.lastname || ''}`,
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
                                                    {
                                                        name: 'Agents',
                                                        children: agents.filter(agent => agent.supervisorID === sup.userID).map(agent => ({
                                                            name: `${agent.name} ${agent.lastname || ''}`,
                                                            userID: agent.agentID,
                                                            role: 'Agent',
                                                            delegationID: agent.delegationID,
                                                        })),
                                                    },
                                                ],
                                            };
                                        }),
                                    },
                                ],
                            };
                        }),
                    },
                ],
            };
        });

        return {
            name: 'System',
            children: directorNodes,
        };
    };

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
        if (key === 'hierarchy') {
            const filterNode = (node: HierarchyNode): HierarchyNode | null => {
                const matchesSearch = globalFilters.searchText
                    ? node.name.toLowerCase().includes(globalFilters.searchText.toLowerCase())
                    : true;
                const matchesRole = globalFilters.role
                    ? node.role === globalFilters.role
                    : true;
                const matchesRegion = globalFilters.region
                    ? node.regionID === globalFilters.region ||
                    (node.children?.some(child => child.regionID === globalFilters.region || child.children?.some(grandchild => grandchild.regionID === globalFilters.region)))
                    : true;
                const matchesGovernorate = globalFilters.governorate
                    ? node.governorateID === globalFilters.governorate ||
                    (node.children?.some(child => child.governorateID === globalFilters.governorate || child.children?.some(grandchild => grandchild.governorateID === globalFilters.governorate)))
                    : true;
                const matchesDelegation = globalFilters.delegation
                    ? node.delegationID === globalFilters.delegation ||
                    (node.children?.some(child => child.delegationID === globalFilters.delegation || child.children?.some(grandchild => grandchild.delegationID === globalFilters.delegation)))
                    : true;
                const matchesSupervisor = globalFilters.supervisor
                    ? node.userID === globalFilters.supervisor ||
                    (node.children?.some(child => child.userID === globalFilters.supervisor || child.children?.some(grandchild => grandchild.userID === globalFilters.supervisor)))
                    : true;

                if (!matchesSearch && !matchesRole && !matchesRegion && !matchesGovernorate && !matchesDelegation && !matchesSupervisor && (!node.children || node.children.length === 0)) {
                    return null;
                }

                const filteredChildren = node.children
                    ? node.children.map(child => filterNode(child)).filter((child): child is HierarchyNode => child !== null)
                    : [];

                if (!matchesSearch && !matchesRole && !matchesRegion && !matchesGovernorate && !matchesDelegation && !matchesSupervisor && filteredChildren.length === 0) {
                    return null;
                }

                return {
                    ...node,
                    children: filteredChildren.length > 0 ? filteredChildren : node.children
                };
            };

            const filteredHierarchy = {
                ...data[0],
                children: data[0].children?.map(filterNode).filter((node: HierarchyNode): node is HierarchyNode => node !== null) || []
            };

            return [filteredHierarchy];
        }

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
                (item.Delegation?.Governorate?.Region?.regionID === globalFilters.region)
                : true;
            const matchesGovernorate = globalFilters.governorate
                ? (item.Governorates || []).some((g: any) => g.governorateID === globalFilters.governorate) ||
                (item.Delegation?.Governorate?.governorateID === globalFilters.governorate)
                : true;
            const matchesDelegation = globalFilters.delegation
                ? (item.Delegations || []).some((d: any) => d.delegationID === globalFilters.delegation) ||
                (item.Delegation?.delegationID === globalFilters.delegation)
                : true;
            const matchesSupervisor = globalFilters.supervisor
                ? item.supervisorID === globalFilters.supervisor
                : true;
            const matchesStatus = globalFilters.status
                ? item.status === globalFilters.status
                : true;
            const matchesSearch = globalFilters.searchText
                ? Object.values(item).some(val =>
                    val && typeof val === 'string' && val.toLowerCase().includes(globalFilters.searchText.toLowerCase()))
                : true;
            return matchesDate && matchesRole && matchesRegion && matchesGovernorate && matchesDelegation && matchesSupervisor && matchesStatus && matchesSearch;
        });
    };

    const debouncedSearch = useCallback(
        debounce((value: string) => {
            setGlobalFilters(prev => ({ ...prev, searchText: value }));
            if (hierarchyData) {
                const filtered = applyGlobalFilters([hierarchyData], 'hierarchy');
                setFilteredHierarchyData(filtered[0]);
            }
        }, 300),
        [hierarchyData]
    );
    // Hierarchy Tab
    const renderHierarchyTab = () => {
        // Utility to flatten hierarchy
        const flattenHierarchy = (nodes: HierarchyNode[]): any[] => {
            const result: any[] = [];
            const traverse = (node: HierarchyNode) => {
                if (node.metrics) {
                    result.push({
                        name: node.name,
                        role: node.role || 'Unknown',
                        visits: node.metrics.totalVisits || 0,
                        timesheets: node.metrics.totalTimesheets || 0,
                        anomalies: node.metrics.anomalies || 0,
                        receiptBooks: node.metrics.receiptBooks || 0,
                    });
                }
                node.children?.forEach(traverse);
            };
            nodes.forEach(traverse);
            return result;
        };

        const hierarchyTrendData = useMemo(() => {
            const data = flattenHierarchy(filteredHierarchyData?.children || []);
            return globalFilters.role ? data.filter(node => node.role === globalFilters.role) : data;
        }, [filteredHierarchyData, globalFilters.role]);

        const roleDistribution = useMemo(() => {
            const roles = { Director: 0, 'Regional Manager': 0, Supervisor: 0, Agent: 0 };
            flattenHierarchy(filteredHierarchyData?.children || []).forEach(node => {
                if (node.role) roles[node.role as keyof typeof roles]++;
            });
            return Object.entries(roles).map(([name, value]) => ({ name, value }));
        }, [filteredHierarchyData]);

        const visitTrendData = useMemo(() => {
            const trend = visits.reduce((acc: any, v: any) => {
                const date = new Date(v.date).toLocaleDateString();
                acc[date] = (acc[date] || 0) + 1;
                return acc;
            }, {});
            return Object.entries(trend).map(([date, count]) => ({ date, count }));
        }, [visits]);

        const directorMetrics = useMemo(() => {
            return flattenHierarchy(filteredHierarchyData?.children || []).filter(node => node.role === 'Director').map(d => ({
                name: d.name,
                visits: d.visits,
                timesheets: d.timesheets,
            }));
        }, [filteredHierarchyData]);

        const anomalyHeatmap = useMemo(() => {
            return anomalies.map(a => ({
                date: new Date(a.createdAt).toLocaleDateString(),
                count: 1,
            }));
        }, [anomalies]);

        const timesheetChartData = useMemo(() => {
            const trend = timesheets.reduce((acc: any, ts: any) => {
                const week = `Week ${ts.weekNumber} ${ts.year}`;
                acc[week] = (acc[week] || 0) + 1;
                return acc;
            }, {});
            return Object.entries(trend).map(([week, count]) => ({ week, count }));
        }, [timesheets]);

        const hoursPerSupervisor = useMemo(() => {
            return supervisors.map((sup: any) => {
                const supTimesheets = timesheets.filter(ts => ts.supervisorID === sup.userID);
                const totalHours = supTimesheets.reduce((sum: number, ts: any) => sum + (ts.Visits?.reduce((vSum: number, v: Visit) => vSum + (v.duration || 0), 0) || 0), 0);
                return { name: `${sup.firstname} ${sup.lastname}`, hours: totalHours };
            });
        }, [timesheets, supervisors]);

        const structureData = useMemo(() => {
            return flattenHierarchy(filteredHierarchyData?.children || []).map(node => ({
                name: node.name,
                value: node.visits,
            }));
        }, [filteredHierarchyData]);

        const defaultExpandedKeys = useMemo(() => {
            return hierarchyData?.children ? generateTreeKeys(hierarchyData.children, 0, '', [], 5) : [];
        }, [hierarchyData]);

        const totalDirectors = filteredHierarchyData?.children?.length || 0;
        const totalRegionalManagers = filteredHierarchyData?.children?.flatMap(d => d.children?.find(c => c.name === 'Regional Managers')?.children || []).length || 0;
        const totalSupervisors = filteredHierarchyData?.children?.flatMap(d => d.children?.find(c => c.name === 'Regional Managers')?.children?.flatMap(rm => rm.children?.find(sc => sc.name === 'Supervisors')?.children || []) || []).length || 0;
        const totalAgents = filteredHierarchyData?.children?.flatMap(d => d.children?.find(c => c.name === 'Regional Managers')?.children?.flatMap(rm => rm.children?.find(sc => sc.name === 'Supervisors')?.children?.flatMap(sup => sup.children?.find(ac => ac.name === 'Agents')?.children || []) || []) || []).length || 0;
        const averageVisitsPerSupervisor = totalSupervisors > 0 ? (visits.length / totalSupervisors).toFixed(2) : '0';
        const anomalyRate = totalSupervisors > 0 ? (anomalies.length / totalSupervisors * 100).toFixed(2) + '%' : '0%';

        return (
            <Card title="System Hierarchy">
                <Space style={{ marginBottom: 16 }}>
                    <Input.Search
                        placeholder="Search hierarchy"
                        onChange={(e) => debouncedSearch(e.target.value)}
                        allowClear
                    />
                    <Select
                        placeholder="Filter by Role"
                        onChange={(value) => {
                            setGlobalFilters(prev => ({ ...prev, role: value }));
                            if (hierarchyData) {
                                const filtered = applyGlobalFilters([hierarchyData], 'hierarchy');
                                setFilteredHierarchyData(filtered[0]);
                            }
                        }}
                        allowClear
                    >
                        <Option value="">All</Option>
                        <Option value="Director">Director</Option>
                        <Option value="Regional Manager">Regional Manager</Option>
                        <Option value="Supervisor">Supervisor</Option>
                        <Option value="Agent">Agent</Option>
                    </Select>
                    <Select
                        placeholder="Filter by Region"
                        onChange={(value) => {
                            setGlobalFilters(prev => ({ ...prev, region: value }));
                            if (hierarchyData) {
                                const filtered = applyGlobalFilters([hierarchyData], 'hierarchy');
                                setFilteredHierarchyData(filtered[0]);
                            }
                        }}
                        allowClear
                    >
                        <Option value="">All</Option>
                        {regions.map(r => <Option key={r.regionID} value={r.regionID}>{r.name}</Option>)}
                    </Select>
                    <Select
                        placeholder="Filter by Governorate"
                        onChange={(value) => {
                            setGlobalFilters(prev => ({ ...prev, governorate: value }));
                            if (hierarchyData) {
                                const filtered = applyGlobalFilters([hierarchyData], 'hierarchy');
                                setFilteredHierarchyData(filtered[0]);
                            }
                        }}
                        allowClear
                    >
                        <Option value="">All</Option>
                        {governorates.map(g => <Option key={g.governorateID} value={g.governorateID}>{g.name}</Option>)}
                    </Select>
                    <Select
                        placeholder="Filter by Delegation"
                        onChange={(value) => {
                            setGlobalFilters(prev => ({ ...prev, delegation: value }));
                            if (hierarchyData) {
                                const filtered = applyGlobalFilters([hierarchyData], 'hierarchy');
                                setFilteredHierarchyData(filtered[0]);
                            }
                        }}
                        allowClear
                    >
                        <Option value="">All</Option>
                        {delegations.map(d => <Option key={d.delegationID} value={d.delegationID}>{d.name}</Option>)}
                    </Select>
                    <Select
                        placeholder="Filter by Supervisor"
                        onChange={(value) => {
                            setGlobalFilters(prev => ({ ...prev, supervisor: value }));
                            if (hierarchyData) {
                                const filtered = applyGlobalFilters([hierarchyData], 'hierarchy');
                                setFilteredHierarchyData(filtered[0]);
                            }
                        }}
                        allowClear
                    >
                        <Option value="">All</Option>
                        {supervisors.map(s => <Option key={s.userID} value={s.userID}>{`${s.firstname} ${s.lastname}`}</Option>)}
                    </Select>
                </Space>
                <Row gutter={16}>
                    <Col span={12}>
                        <div ref={treeContainerRef} style={{ width: '100%', height: '100%', overflow: 'auto' }}>
                            {filteredHierarchyData && (
                                <Tree
                                    treeData={filteredHierarchyData.children}
                                    onSelect={(_, { node }) => handleNodeClick(node)}
                                    showLine
                                    switcherIcon={<FaSitemap />}
                                    defaultExpandedKeys={defaultExpandedKeys}
                                    titleRender={(nodeData: any) => (
                                        <Popover
                                            content={
                                                <div>
                                                    <p>Total Visits: {nodeData.metrics?.totalVisits || 0}</p>
                                                    <p>Total Timesheets: {nodeData.metrics?.totalTimesheets || 0}</p>
                                                    <p>Anomalies: {nodeData.metrics?.anomalies || 0}</p>
                                                    <p>Receipt Books: {nodeData.metrics?.receiptBooks || 0}</p>
                                                </div>
                                            }
                                            title={nodeData.name}
                                        >
                                            <span>{nodeData.name}</span>
                                        </Popover>
                                    )}
                                />
                            )}
                        </div>
                    </Col>
                    <Col span={12}>
                        <Collapse>
                            <Panel header="Charts" key="1">
                                <Row gutter={16}>
                                    <Col span={24}>
                                        <Card title="Hierarchy Metrics">
                                            <BarChart width={550} height={200} data={hierarchyTrendData}>
                                                <XAxis dataKey="name" />
                                                <YAxis />
                                                <RechartsTooltip />
                                                <Bar dataKey="visits" fill="#0088FE">
                                                    <LabelList dataKey="visits" position="top" fill="#000" />
                                                </Bar>
                                                <Bar dataKey="receiptBooks" fill="#FFCE56">
                                                    <LabelList dataKey="receiptBooks" position="top" fill="#000" />
                                                </Bar>
                                            </BarChart>
                                        </Card>
                                    </Col>
                                    <Col span={12}>
                                        <Card title="Role Distribution">
                                            <PieChart width={300} height={200}>
                                                <Pie data={roleDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                                    {roleDistribution.map((_entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip />
                                            </PieChart>
                                        </Card>
                                    </Col>
                                    <Col span={12}>
                                        <Card title="Director Metrics">
                                            <RadarChart width={300} height={200} data={directorMetrics}>
                                                <PolarGrid />
                                                <PolarAngleAxis dataKey="name" />
                                                <Radar dataKey="visits" stroke="#FF8042" fill="#FF8042" fillOpacity={0.6}>
                                                    <LabelList dataKey="visits" fill="#FFFFFF" />
                                                </Radar>
                                                <RechartsTooltip />
                                            </RadarChart>
                                        </Card>
                                    </Col>
                                    <Col span={24}>
                                        <Card title="Visit Trends">
                                            <LineChart width={550} height={200} data={visitTrendData}>
                                                <XAxis dataKey="date" />
                                                <YAxis />
                                                <RechartsTooltip />
                                                <Line dataKey="count" stroke="#FFBB28">
                                                    <LabelList dataKey="count" position="top" fill="#000" />
                                                </Line>
                                            </LineChart>
                                        </Card>
                                    </Col>

                                    <Col span={24}>
                                        <Card title="Timesheet Trends">
                                            <AreaChart width={550} height={200} data={timesheetChartData}>
                                                <XAxis dataKey="week" />
                                                <YAxis />
                                                <Area dataKey="count" fill="#36A2EB">
                                                    <LabelList dataKey="count" position="top" fill="#000" />
                                                </Area>
                                                <RechartsTooltip />
                                            </AreaChart>
                                        </Card>
                                    </Col>
                                    <Col span={24}>
                                        <Card title="Receipt Books">
                                            <BarChart width={550} height={200} data={hierarchyTrendData}>
                                                <XAxis dataKey="name" />
                                                <YAxis />
                                                <RechartsTooltip />
                                                <Bar dataKey="receiptBooks" fill="#FFCE56">
                                                    <LabelList dataKey="receiptBooks" position="top" fill="#000" />
                                                </Bar>
                                            </BarChart>
                                        </Card>
                                    </Col>
                                    {/* <Col span={24}>
                                        <Card title="Supervisors">
                                            <BarChart width={550} height={200} data={hoursPerSupervisor}>
                                                <XAxis dataKey="name" />
                                                <YAxis />
                                                <RechartsTooltip />
                                                <Bar dataKey="hours" fill="#4BC0C0">
                                                    <LabelList dataKey="hours" position="top" fill="#000" />
                                                </Bar>
                                            </BarChart>
                                        </Card>
                                    </Col> */}

                                </Row>
                            </Panel>
                        </Collapse>
                    </Col>
                </Row>
                <Divider />
                <Row gutter={40}>
                    <Col span={4}><Statistic title="Total Directors" value={totalDirectors} /></Col>
                    <Col span={4}><Statistic title="Total Regional Managers" value={totalRegionalManagers} /></Col>
                    <Col span={4}><Statistic title="Total Supervisors" value={totalSupervisors} /></Col>
                    <Col span={4}><Statistic title="Total Agents" value={totalAgents} /></Col>
                    <Col span={4}><Statistic title="Avg Visits/Supervisor" value={averageVisitsPerSupervisor} /></Col>
                    <Col span={4}><Statistic title="Anomaly Rate" value={anomalyRate} /></Col>
                </Row>
            </Card>
        );
    };
    // Users Tab
    const userColumns = [
        { title: 'Name', dataIndex: 'firstname', key: 'name', sorter: (a: User, b: User) => `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`), render: (_: any, record: User) => `${record.firstname} ${record.lastname}` },
        { title: 'Email', dataIndex: 'email', key: 'email', sorter: (a: User, b: User) => a.email.localeCompare(b.email) },
        { title: 'Phone', dataIndex: 'phone', key: 'phone', sorter: (a: User, b: User) => a.phone.localeCompare(b.phone) },
        { title: 'Roles', dataIndex: 'Roles', key: 'roles', render: (roles: any[]) => roles?.map(r => r.name).join(', ') || 'N/A' },
        { title: 'Regions', key: 'regions', render: (_: any, record: User) => record.Regions?.length || 0 },
        { title: 'Timesheets', key: 'timesheets', render: (_: any, record: User) => timesheets.filter(ts => ts.supervisorID === record.userID).length },
        { title: 'Visits', key: 'visits', render: (_: any, record: User) => timesheets.filter(ts => ts.supervisorID === record.userID).reduce((sum, ts) => sum + (ts.Visits?.length || 0), 0) },
        { title: 'Receipt Books', key: 'receiptBooks', render: (_: any, record: User) => receiptBooks.filter(rb => rb.holder?.userID === record.userID).length },
    ];

    const roleDistributionData = useMemo(() => {
        return users.reduce((acc: any, u: any) => {
            u.Roles?.forEach((r: any) => {
                const existing = acc.find((item: any) => item.name === r.name);
                if (existing) existing.value += 1;
                else acc.push({ name: r.name, value: 1 });
            });
            return acc;
        }, []);
    }, [users]);

    const registrationTrendData = useMemo(() => {
        const trend = users.reduce((acc: any, u: any) => {
            const month = new Date(u.createdAt).toLocaleString('default', { month: 'long', year: 'numeric' });
            acc[month] = (acc[month] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(trend).map(([month, count]) => ({ month, count }));
    }, [users]);

    const supervisors = useMemo(() => users.filter(u => u.Roles?.some((r: any) => r.name === 'Supervisor')), [users]);
    const supervisorPerGovData = useMemo(() => {
        const governorateCounts = supervisors.reduce((acc: any, sup: any) => {
            sup.Governorates?.forEach((gov: any) => { acc[gov.name] = (acc[gov.name] || 0) + 1; });
            return acc;
        }, {});
        return Object.entries(governorateCounts).map(([name, count]) => ({ name, count }));
    }, [supervisors]);

    const userActivityTimeline = useMemo(() => {
        return users.map(u => ({
            children: `${u.firstname} ${u.lastname} - ${u.createdAt ? new Date(u.createdAt).toLocaleString() : 'Unknown'}`,
            color: u.isOnline ? 'green' : 'gray',
        }));
    }, [users]);

    const userGrowthData = useMemo(() => {
        const growth = users.reduce((acc: any, u: any) => {
            const date = new Date(u.createdAt).toLocaleDateString();
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(growth).map(([date, count]) => ({ date, count }));
    }, [users]);

    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.isOnline).length;
    const inactiveUsers = totalUsers - activeUsers;
    const usersWithAnomalies = anomalies.filter(a => a.userID).length;
    const avgTimesheetsPerUser = totalUsers > 0 ? (timesheets.length / totalUsers).toFixed(2) : '0';
    const retentionRate = 'N/A'; // Placeholder

    const renderUsersTab = () => (
        <div>
            <Space style={{ marginBottom: 16 }}>
                <Input.Search placeholder="Search by name, email, phone" onChange={(e) => debouncedSearch(e.target.value)} />
                <Select placeholder="Filter by Role" onChange={(value) => setGlobalFilters(prev => ({ ...prev, role: value }))}>
                    <Option value="">All</Option>
                    <Option value="Director">Director</Option>
                    <Option value="Regional Manager">Regional Manager</Option>
                    <Option value="Supervisor">Supervisor</Option>
                    <Option value="Agent">Agent</Option>
                </Select>
                <Select placeholder="Filter by Region" onChange={(value) => setGlobalFilters(prev => ({ ...prev, region: value }))}>
                    <Option value="">All</Option>
                    {regions.map(r => <Option key={r.regionID} value={r.regionID}>{r.name}</Option>)}
                </Select>
                <Select placeholder="Filter by Governorate" onChange={(value) => setGlobalFilters(prev => ({ ...prev, governorate: value }))}>
                    <Option value="">All</Option>
                    {governorates.map(g => <Option key={g.governorateID} value={g.governorateID}>{g.name}</Option>)}
                </Select>
                <Select placeholder="Filter by Delegation" onChange={(value) => setGlobalFilters(prev => ({ ...prev, delegation: value }))}>
                    <Option value="">All</Option>
                    {delegations.map(d => <Option key={d.delegationID} value={d.delegationID}>{d.name}</Option>)}
                </Select>
            </Space>
            <Row gutter={0}>
                <Col span={12}>
                    <Card title="User List">
                        <Table columns={userColumns} dataSource={applyGlobalFilters(users, 'userID')} rowKey="userID" pagination={{ pageSize: 10 }} />
                    </Card>
                </Col>
                <Col span={12}>
                    <Collapse>
                        <Panel header="Charts" key="1">
                            <Row gutter={0}>
                                <Col span={12}>
                                    <Card title="Role Distribution">
                                        <PieChart width={300} height={200}>
                                            <Pie data={roleDistributionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                                {roleDistributionData.map((_entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip />
                                        </PieChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Registration Trend">
                                        <LineChart width={300} height={200} data={registrationTrendData}>
                                            <XAxis dataKey="month" />
                                            <YAxis />
                                            <RechartsTooltip />
                                            <Line dataKey="count" stroke="#00C49F">
                                                <LabelList dataKey="count" position="top" fill="#000" />
                                            </Line>
                                        </LineChart>
                                    </Card>
                                </Col>

                                <Col span={12}>
                                    <Card title="User Activity">
                                        <Timeline items={userActivityTimeline.slice(0, 5)} />
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="User Growth">
                                        <AreaChart width={270} height={200} data={userGrowthData}>
                                            <XAxis dataKey="date" />
                                            <YAxis />
                                            <RechartsTooltip />
                                            <Area dataKey="count" fill="#FF8042">
                                                <LabelList dataKey="count" position="top" fill="#000" />
                                            </Area>
                                        </AreaChart>
                                    </Card>
                                </Col>

                                <Col span={24}>
                                    <Card title="Visits by User">
                                        <ScatterChart width={550} height={200} data={users.map(u => ({ name: `${u.firstname} ${u.lastname}`, visits: timesheets.filter(ts => ts.supervisorID === u.userID).reduce((sum, ts) => sum + (ts.Visits?.length || 0), 0) }))}>
                                            <XAxis dataKey="name" />
                                            <YAxis dataKey="visits" />
                                            <RechartsTooltip />
                                            <Scatter fill="#FF6384">
                                                <LabelList dataKey="visits" position="top" fill="#000" />
                                            </Scatter>
                                        </ScatterChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Timesheets">
                                        <RadarChart width={300} height={200} data={users.map(u => ({ name: `${u.firstname} ${u.lastname}`, timesheets: timesheets.filter(ts => ts.supervisorID === u.userID).length }))}>
                                            <PolarGrid />
                                            <PolarAngleAxis dataKey="name" />
                                            <RechartsTooltip />
                                            <Radar dataKey="timesheets" stroke="#36A2EB" fill="#36A2EB" fillOpacity={0.6}>
                                                <LabelList dataKey="timesheets" fill="#000" />
                                            </Radar>
                                        </RadarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Receipt Books">
                                        <Treemap width={300} height={200} data={users.map(u => ({ name: `${u.firstname} ${u.lastname}`, value: receiptBooks.filter(rb => rb.holder?.userID === u.userID).length }))}>
                                            <RechartsTooltip />
                                            <LabelList dataKey="value" position="center" fill="#000" />
                                        </Treemap>
                                    </Card>
                                </Col>
                                <Col span={24}>
                                    <Card title="Anomalies">
                                        <BarChart width={550} height={200} data={users.map(u => ({ name: `${u.firstname} ${u.lastname}`, anomalies: anomalies.filter(a => a.userID === u.userID).length }))}>
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <RechartsTooltip />
                                            <Bar dataKey="anomalies" fill="#FFCE56">
                                                <LabelList dataKey="anomalies" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={24}>
                                    <Card title="Supervisors per Gov">
                                        <BarChart width={550} height={200} data={supervisorPerGovData}>
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <RechartsTooltip />
                                            <Bar dataKey="count" fill="#FFBB28">
                                                <LabelList dataKey="count" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                            </Row>
                        </Panel>
                    </Collapse>
                </Col>
            </Row>
            <Divider />
            <Row gutter={16}>
                <Col span={4}><Statistic title="Total Users" value={totalUsers} /></Col>
                <Col span={4}><Statistic title="Active Users" value={activeUsers} /></Col>
                <Col span={4}><Statistic title="Inactive Users" value={inactiveUsers} /></Col>
                <Col span={4}><Statistic title="Users with Anomalies" value={usersWithAnomalies} /></Col>
                <Col span={4}><Statistic title="Avg Timesheets/User" value={avgTimesheetsPerUser} /></Col>
                <Col span={4}><Statistic title="Retention Rate" value={retentionRate} /></Col>
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

    const timesheetChartData = useMemo(() => {
        const trend = timesheets.reduce((acc: any, ts: any) => {
            const week = `Week ${ts.weekNumber} ${ts.year}`;
            acc[week] = (acc[week] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(trend).map(([week, count]) => ({ week, count }));
    }, [timesheets]);

    const hoursPerSupervisor = useMemo(() => {
        return supervisors.map((sup: any) => {
            const supTimesheets = timesheets.filter(ts => ts.supervisorID === sup.userID);
            const totalHours = supTimesheets.reduce((sum: number, ts: any) => sum + (ts.Visits?.reduce((vSum: number, v: Visit) => vSum + (v.duration || 0), 0) || 0), 0);
            return { name: `${sup.firstname} ${sup.lastname}`, hours: totalHours };
        });
    }, [timesheets, supervisors]);

    const timesheetAnomalyData = useMemo(() => {
        return anomalies.map(a => ({
            date: new Date(a.createdAt).toLocaleDateString(),
            type: a.type,
        }));
    }, [anomalies]);

    const totalTimesheets = timesheets.length;
    const pendingTimesheets = timesheets.filter(t => t.status === 'pending').length;
    const validatedTimesheets = timesheets.filter(t => t.status === 'validated').length;
    const avgVisitsPerTimesheet = totalTimesheets > 0 ? (visits.length / totalTimesheets).toFixed(2) : '0';
    const timesheetsWithAnomalies = anomalies.filter(a => a.type === 'timesheet').length;
    const approvalRate = totalTimesheets > 0 ? (validatedTimesheets / totalTimesheets * 100).toFixed(2) + '%' : '0%';

    const renderTimesheetsTab = () => (
        <div>
            <Space style={{ marginBottom: 16 }}>
                <Input.Search placeholder="Search by supervisor, week, year" onChange={(e) => debouncedSearch(e.target.value)} />
                <Select placeholder="Filter by Status" onChange={(value) => setGlobalFilters(prev => ({ ...prev, status: value }))}>
                    <Option value="">All</Option>
                    <Option value="pending">Pending</Option>
                    <Option value="validated">Validated</Option>
                </Select>
                <Select placeholder="Filter by Supervisor" onChange={(value) => setGlobalFilters(prev => ({ ...prev, supervisor: value }))}>
                    <Option value="">All</Option>
                    {supervisors.map(s => <Option key={s.userID} value={s.userID}>{`${s.firstname} ${s.lastname}`}</Option>)}
                </Select>
            </Space>
            <Row gutter={16}>
                <Col span={12}>
                    <Card title="Timesheet List">
                        <Table columns={timesheetColumns} dataSource={applyGlobalFilters(timesheets, 'timesheetID')} rowKey="timesheetID" pagination={{ pageSize: 10 }} />
                    </Card>
                </Col>
                <Col span={12}>
                    <Collapse>
                        <Panel header="Charts" key="1">
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Card title="Status">
                                        <PieChart width={300} height={200}>
                                            <Pie data={timesheetStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                                                {timesheetStatusData.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Trends">
                                        <LineChart width={300} height={200} data={timesheetChartData}>
                                            <XAxis dataKey="week" />
                                            <YAxis />
                                            <Line dataKey="count" stroke="#00C49F" />
                                        </LineChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Hours/Supervisor">
                                        <BarChart width={300} height={200} data={hoursPerSupervisor}>
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Bar dataKey="hours" fill="#FFBB28" />
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Anomalies">
                                        <ScatterChart width={300} height={200} data={timesheetAnomalyData}>
                                            <XAxis dataKey="date" />
                                            <YAxis dataKey="type" type="category" />
                                            <Scatter fill="#FF8042" />
                                        </ScatterChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Visits">
                                        <AreaChart width={300} height={200} data={timesheets.map(t => ({ week: `Week ${t.weekNumber}`, visits: t.Visits?.length || 0 }))}>
                                            <XAxis dataKey="week" />
                                            <YAxis />
                                            <Area dataKey="visits" fill="#FF6384" />
                                        </AreaChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Hours">
                                        <RadarChart width={300} height={200} data={hoursPerSupervisor}>
                                            <PolarGrid />
                                            <PolarAngleAxis dataKey="name" />
                                            <Radar dataKey="hours" stroke="#36A2EB" fill="#36A2EB" fillOpacity={0.6} />
                                        </RadarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Timesheet Count">
                                        <Treemap width={300} height={200} data={supervisors.map(s => ({ name: `${s.firstname} ${s.lastname}`, value: timesheets.filter(t => t.supervisorID === s.userID).length }))}>
                                            <RechartsTooltip />
                                        </Treemap>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Validation">
                                        <BarChart width={300} height={200} data={timesheetStatusData}>
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Bar dataKey="value" fill="#FFCE56" />
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Weekly">
                                        <BarChart width={300} height={200} data={timesheets.map(t => ({ name: `Week ${t.weekNumber}`, visits: t.Visits?.length || 0 }))}>
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Bar dataKey="visits" fill="#9966FF" />
                                        </BarChart>
                                    </Card>
                                </Col>
                            </Row>
                        </Panel>
                    </Collapse>
                </Col>
            </Row>
            <Divider />
            <Row gutter={16}>
                <Col span={4}><Statistic title="Total Timesheets" value={totalTimesheets} /></Col>
                <Col span={4}><Statistic title="Pending" value={pendingTimesheets} /></Col>
                <Col span={4}><Statistic title="Validated" value={validatedTimesheets} /></Col>
                <Col span={4}><Statistic title="Avg Visits/Timesheet" value={avgVisitsPerTimesheet} /></Col>
                <Col span={4}><Statistic title="With Anomalies" value={timesheetsWithAnomalies} /></Col>
                <Col span={4}><Statistic title="Approval Rate" value={approvalRate} /></Col>
            </Row>
        </div>
    );

    // Receipt Books Tab
    const receiptBookColumns = [
        { title: 'Number', dataIndex: 'number', key: 'number', sorter: (a: ReceiptBook, b: ReceiptBook) => a.number.localeCompare(b.number) },
        { title: 'Status', dataIndex: 'status', key: 'status', sorter: (a: ReceiptBook, b: ReceiptBook) => a.status.localeCompare(b.status), render: (status: string) => <Tag color={status === ReceiptBookStatus.InStock ? 'blue' : 'purple'}>{status}</Tag> },
        { title: 'Holder', dataIndex: 'holder', key: 'holder', render: (holder: any) => holder ? `${holder.firstname} ${holder.lastname}` : 'N/A' },
        { title: 'Type', dataIndex: 'typeID', key: 'typeID', render: (typeID: string) => receiptBookTypes.find(t => t.typeID === typeID)?.name || typeID },
    ];

    const receiptBookStatusData = useMemo(() => [
        { name: 'In Stock', value: receiptBooks.filter(rb => rb.status === ReceiptBookStatus.InStock).length },
        { name: 'With Agents', value: receiptBooks.filter(rb => rb.status === ReceiptBookStatus.AssignedToAgent).length },
        { name: 'With Supervisors', value: receiptBooks.filter(rb => rb.status === ReceiptBookStatus.WithSupervisor).length },
        { name: 'Archived', value: receiptBooks.filter(rb => rb.status === ReceiptBookStatus.Archived).length },
    ], [receiptBooks]);

    const receiptBooksPerHolder = useMemo(() => {
        return users.map((u: any) => ({
            name: `${u.firstname} ${u.lastname}`,
            books: receiptBooks.filter(rb => rb.holder?.userID === u.userID).length,
        })).filter((h: ReceiptBookHolder) => h.books > 0);
    }, [receiptBooks, users]);

    const receiptBookTypeDistribution = useMemo(() => {
        return receiptBookTypes.map(type => ({
            name: type.name,
            value: receiptBooks.filter(rb => rb.typeID === type.typeID).length,
        }));
    }, [receiptBooks, receiptBookTypes]);

    const totalReceiptBooks = receiptBooks.length;
    const inStock = receiptBooks.filter(rb => rb.status === ReceiptBookStatus.InStock).length;
    const withAgents = receiptBooks.filter(rb => rb.status === ReceiptBookStatus.AssignedToAgent).length;
    const withSupervisors = receiptBooks.filter(rb => rb.status === ReceiptBookStatus.WithSupervisor).length;
    const archived = receiptBooks.filter(rb => rb.status === ReceiptBookStatus.Archived).length;
    const avgBooksPerHolder = receiptBooksPerHolder.length > 0 ? (totalReceiptBooks / receiptBooksPerHolder.length).toFixed(2) : '0';

    const renderReceiptBooksTab = () => (
        <div>
            <Space style={{ marginBottom: 16 }}>
                <Input.Search placeholder="Search by number, holder" onChange={(e) => debouncedSearch(e.target.value)} />
                <Select placeholder="Filter by Status" onChange={(value) => setGlobalFilters(prev => ({ ...prev, status: value }))}>
                    <Option value="">All</Option>
                    <Option value={ReceiptBookStatus.InStock}>In Stock</Option>
                    <Option value={ReceiptBookStatus.AssignedToAgent}>With Agents</Option>
                    <Option value={ReceiptBookStatus.WithSupervisor}>With Supervisors</Option>
                    <Option value={ReceiptBookStatus.Archived}>Archived</Option>
                </Select>
            </Space>
            <Row gutter={16}>
                <Col span={12}>
                    <Card title="Receipt Book List">
                        <Table columns={receiptBookColumns} dataSource={applyGlobalFilters(receiptBooks, 'bookID')} rowKey="bookID" pagination={{ pageSize: 10 }} />
                    </Card>
                </Col>
                <Col span={12}>
                    <Collapse>
                        <Panel header="Charts" key="1">
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Card title="Status">
                                        <PieChart width={300} height={200}>
                                            <Pie data={receiptBookStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                                                {receiptBookStatusData.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Books per Holder">
                                        <BarChart width={300} height={200} data={receiptBooksPerHolder}>
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Bar dataKey="books" fill="#00C49F" />
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Type Distribution">
                                        <RadarChart width={300} height={200} data={receiptBookTypeDistribution}>
                                            <PolarGrid />
                                            <PolarAngleAxis dataKey="name" />
                                            <Radar dataKey="value" stroke="#FFBB28" fill="#FFBB28" fillOpacity={0.6} />
                                        </RadarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Status Trend">
                                        <LineChart width={300} height={200} data={receiptBookStatusData}>
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Line dataKey="value" stroke="#FF8042" />
                                        </LineChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Holder Count">
                                        <ScatterChart width={300} height={200} data={receiptBooksPerHolder}>
                                            <XAxis dataKey="name" />
                                            <YAxis dataKey="books" />
                                            <Scatter fill="#FF6384" />
                                        </ScatterChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Books by Type">
                                        <AreaChart width={300} height={200} data={receiptBookTypeDistribution}>
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Area dataKey="value" fill="#36A2EB" />
                                        </AreaChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Total Books">
                                        <Treemap width={300} height={200} data={receiptBookStatusData}>
                                            <RechartsTooltip />
                                        </Treemap>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Status Breakdown">
                                        <BarChart width={300} height={200} data={receiptBookStatusData}>
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Bar dataKey="value" fill="#FFCE56" />
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Holder Distribution">
                                        <BarChart width={300} height={200} data={receiptBooksPerHolder}>
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Bar dataKey="books" fill="#9966FF" />
                                        </BarChart>
                                    </Card>
                                </Col>
                            </Row>
                        </Panel>
                    </Collapse>
                </Col>
            </Row>
            <Divider />
            <Row gutter={16}>
                <Col span={4}><Statistic title="Total Books" value={totalReceiptBooks} /></Col>
                <Col span={4}><Statistic title="In Stock" value={inStock} /></Col>
                <Col span={4}><Statistic title="With Agents" value={withAgents} /></Col>
                <Col span={4}><Statistic title="With Supervisors" value={withSupervisors} /></Col>
                <Col span={4}><Statistic title="Archived" value={archived} /></Col>
                <Col span={4}><Statistic title="Avg Books/Holder" value={avgBooksPerHolder} /></Col>
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

    const visitChartData = useMemo(() => {
        const trend = visits.reduce((acc: any, v: any) => {
            const date = v.date.split('T')[0];
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(trend).map(([date, count]) => ({ date, count }));
    }, [visits]);

    const visitDurationData = useMemo(() => {
        return visits.map(v => ({
            date: v.date.split('T')[0],
            duration: v.duration || 0,
        }));
    }, [visits]);

    const totalVisits = visits.length;
    const pendingVisits = visits.filter(v => v.status === 'pending').length;
    const visitedVisits = visits.filter(v => v.status === 'visited').length;
    const validatedVisits = visits.filter(v => v.status === 'validated').length;
    const rejectedVisits = visits.filter(v => v.status === 'rejected').length;
    const avgVisitDuration = visits.length > 0 ? (visits.reduce((sum, v) => sum + (v.duration || 0), 0) / visits.length).toFixed(2) : '0';

    const renderVisitsTab = () => (
        <div>
            <Space style={{ marginBottom: 16 }}>
                <Input.Search placeholder="Search by date, agent" onChange={(e) => debouncedSearch(e.target.value)} />
                <Select placeholder="Filter by Status" onChange={(value) => setGlobalFilters(prev => ({ ...prev, status: value }))}>
                    <Option value="">All</Option>
                    <Option value="pending">Pending</Option>
                    <Option value="visited">Visited</Option>
                    <Option value="validated">Validated</Option>
                    <Option value="rejected">Rejected</Option>
                </Select>
                <Select placeholder="Filter by Agent" onChange={(value) => setGlobalFilters(prev => ({ ...prev, agent: value }))}>
                    <Option value="">All</Option>
                    {agents.map(a => <Option key={a.agentID} value={a.agentID}>{`${a.name} ${a.lastname || ''}`}</Option>)}
                </Select>
            </Space>
            <Row gutter={16}>
                <Col span={12}>
                    <Card title="Visit List">
                        <Table columns={visitColumns} dataSource={applyGlobalFilters(visits, 'visitID')} rowKey="visitID" pagination={{ pageSize: 10 }} />
                    </Card>
                </Col>
                <Col span={12}>
                    <Collapse>
                        <Panel header="Charts" key="1">
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Card title="Status">
                                        <BarChart width={300} height={200} data={visitStatusData}>
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Bar dataKey="value" fill="#0088FE" />
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Trends">
                                        <LineChart width={300} height={200} data={visitChartData}>
                                            <XAxis dataKey="date" />
                                            <YAxis />
                                            <Line dataKey="count" stroke="#00C49F" />
                                        </LineChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Duration">
                                        <ScatterChart width={300} height={200} data={visitDurationData}>
                                            <XAxis dataKey="date" />
                                            <YAxis dataKey="duration" />
                                            <Scatter fill="#FFBB28" />
                                        </ScatterChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Locations">
                                        <MapComponent />
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Status Dist">
                                        <PieChart width={300} height={200}>
                                            <Pie data={visitStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                                                {visitStatusData.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Daily">
                                        <AreaChart width={300} height={200} data={visitChartData}>
                                            <XAxis dataKey="date" />
                                            <YAxis />
                                            <Area dataKey="count" fill="#FF6384" />
                                        </AreaChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Agent Visits">
                                        <RadarChart width={300} height={200} data={agents.map(a => ({ name: `${a.name} ${a.lastname || ''}`, visits: visits.filter(v => v.agentID === a.agentID).length }))}>
                                            <PolarGrid />
                                            <PolarAngleAxis dataKey="name" />
                                            <Radar dataKey="visits" stroke="#36A2EB" fill="#36A2EB" fillOpacity={0.6} />
                                        </RadarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Visit Count">
                                        <Treemap width={300} height={200} data={visitStatusData}>
                                            <RechartsTooltip />
                                        </Treemap>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Duration Trend">
                                        <BarChart width={300} height={200} data={visitDurationData}>
                                            <XAxis dataKey="date" />
                                            <YAxis />
                                            <Bar dataKey="duration" fill="#9966FF" />
                                        </BarChart>
                                    </Card>
                                </Col>
                            </Row>
                        </Panel>
                    </Collapse>
                </Col>
            </Row>
            <Divider />
            <Row gutter={16}>
                <Col span={4}><Statistic title="Total Visits" value={totalVisits} /></Col>
                <Col span={4}><Statistic title="Pending" value={pendingVisits} /></Col>
                <Col span={4}><Statistic title="Visited" value={visitedVisits} /></Col>
                <Col span={4}><Statistic title="Validated" value={validatedVisits} /></Col>
                <Col span={4}><Statistic title="Rejected" value={rejectedVisits} /></Col>
                <Col span={4}><Statistic title="Avg Duration" value={avgVisitDuration} suffix="min" /></Col>
            </Row>
        </div>
    );

    // Anomalies Tab
    const anomalyColumns = [
        { title: 'Type', dataIndex: 'type', key: 'type', sorter: (a: any, b: any) => a.type.localeCompare(b.type) },
        { title: 'Message', dataIndex: 'message', key: 'message' },
        { title: 'Date', dataIndex: 'createdAt', key: 'createdAt', sorter: (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() },
    ];

    const anomalyChartData = useMemo(() => {
        const trend = anomalies.reduce((acc: any, a: any) => {
            const date = new Date(a.createdAt).toLocaleDateString();
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(trend).map(([date, count]) => ({ date, count }));
    }, [anomalies]);

    const anomalySeverityChartData = useMemo(() => {
        const severityData = anomalies.reduce((acc: any, a: any) => {
            acc[a.severity || 'unknown'] = (acc[a.severity || 'unknown'] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(severityData).map(([severity, count]) => ({ severity, count }));
    }, [anomalies]);

    const anomalyTypeData = useMemo(() => {
        const typeData = anomalies.reduce((acc: any, a: any) => {
            acc[a.type] = (acc[a.type] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(typeData).map(([name, value]) => ({ name, value }));
    }, [anomalies]);

    const totalAnomalies = anomalies.length;
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical').length;
    const highSeverity = anomalies.filter(a => a.severity === 'high').length;
    const mediumSeverity = anomalies.filter(a => a.severity === 'medium').length;
    const lowSeverity = anomalies.filter(a => a.severity === 'low').length;
    const resolutionTime = 'N/A'; // Placeholder

    const renderAnomaliesTab = () => (
        <div>
            <Space style={{ marginBottom: 16 }}>
                <Input.Search placeholder="Search by type, message" onChange={(e) => debouncedSearch(e.target.value)} />
                <Select placeholder="Filter by Severity" onChange={(value) => setGlobalFilters(prev => ({ ...prev, severity: value }))}>
                    <Option value="">All</Option>
                    <Option value="critical">Critical</Option>
                    <Option value="high">High</Option>
                    <Option value="medium">Medium</Option>
                    <Option value="low">Low</Option>
                </Select>
            </Space>
            <Row gutter={16}>
                <Col span={12}>
                    <Card title="Detected Anomalies">
                        <Table columns={anomalyColumns} dataSource={applyGlobalFilters(anomalies, 'notificationID')} rowKey="notificationID" pagination={{ pageSize: 10 }} />
                    </Card>
                </Col>
                <Col span={12}>
                    <Collapse>
                        <Panel header="Charts" key="1">
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Card title="Trends">
                                        <LineChart width={300} height={200} data={anomalyChartData}>
                                            <XAxis dataKey="date" />
                                            <YAxis />
                                            <Line dataKey="count" stroke="#0088FE" />
                                        </LineChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Severity">
                                        <PieChart width={300} height={200}>
                                            <Pie data={anomalySeverityChartData} dataKey="count" nameKey="severity" cx="50%" cy="50%" outerRadius={80}>
                                                {anomalySeverityChartData.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Type">
                                        <BarChart width={300} height={200} data={anomalyTypeData}>
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Bar dataKey="value" fill="#FFBB28" />
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Daily">
                                        <ScatterChart width={300} height={200} data={anomalyChartData}>
                                            <XAxis dataKey="date" />
                                            <YAxis dataKey="count" />
                                            <Scatter fill="#FF8042" />
                                        </ScatterChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Severity Trend">
                                        <AreaChart width={300} height={200} data={anomalySeverityChartData}>
                                            <XAxis dataKey="severity" />
                                            <YAxis />
                                            <Area dataKey="count" fill="#FF6384" />
                                        </AreaChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Anomaly Types">
                                        <RadarChart width={300} height={200} data={anomalyTypeData}>
                                            <PolarGrid />
                                            <PolarAngleAxis dataKey="name" />
                                            <Radar dataKey="value" stroke="#36A2EB" fill="#36A2EB" fillOpacity={0.6} />
                                        </RadarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Count">
                                        <Treemap width={300} height={200} data={anomalySeverityChartData}>
                                            <RechartsTooltip />
                                        </Treemap>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Severity Dist">
                                        <BarChart width={300} height={200} data={anomalySeverityChartData}>
                                            <XAxis dataKey="severity" />
                                            <YAxis />
                                            <Bar dataKey="count" fill="#FFCE56" />
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Anomaly Spread">
                                        <BarChart width={300} height={200} data={anomalySeverityChartData}>
                                            <XAxis dataKey="severity" />
                                            <YAxis />
                                            <Bar dataKey="count" fill="#9966FF" />
                                        </BarChart>
                                    </Card>
                                </Col>
                            </Row>
                        </Panel>
                    </Collapse>
                </Col>
            </Row>
            <Divider />
            <Row gutter={16}>
                <Col span={4}><Statistic title="Total Anomalies" value={totalAnomalies} /></Col>
                <Col span={4}><Statistic title="Critical" value={criticalAnomalies} /></Col>
                <Col span={4}><Statistic title="High Severity" value={highSeverity} /></Col>
                <Col span={4}><Statistic title="Medium Severity" value={mediumSeverity} /></Col>
                <Col span={4}><Statistic title="Low Severity" value={lowSeverity} /></Col>
                <Col span={4}><Statistic title="Resolution Time" value={resolutionTime} /></Col>
            </Row>
        </div >
    );

    // Performance Tab
    const topSupervisors = useMemo(() => {
        return supervisors.map((sup: any) => ({
            name: `${sup.firstname} ${sup.lastname}`,
            visits: timesheets.filter(ts => ts.supervisorID === sup.userID).reduce((sum: number, ts: any) => sum + (ts.Visits?.length || 0), 0),
        })).sort((a, b) => b.visits - a.visits).slice(0, 5);
    }, [timesheets, supervisors]);

    const performanceByRegion = useMemo(() => {
        return regions.map(region => ({
            name: region.name,
            visits: visits.filter(v => agents.find(a => a.agentID === v.agentID)?.Delegation?.Governorate?.Region?.regionID === region.regionID).length,
            receiptBooks: receiptBooks.filter(rb => users.find(u => u.userID === rb.holder?.userID)?.Regions?.some(r => r.regionID === region.regionID)).length,
        }));
    }, [regions, visits, receiptBooks, agents, users]);

    const totalRegions = regions.length;
    const totalGovernorates = governorates.length;
    const totalDelegations = delegations.length;
    const avgVisitsPerRegion = totalRegions > 0 ? (visits.length / totalRegions).toFixed(2) : '0';
    const avgReceiptBooksPerRegion = totalRegions > 0 ? (receiptBooks.length / totalRegions).toFixed(2) : '0';
    const performanceIndex = 'N/A'; // Placeholder

    const renderPerformanceTab = () => (
        <div>
            <Space style={{ marginBottom: 16 }}>
                <Input.Search placeholder="Search by region, supervisor" onChange={(e) => debouncedSearch(e.target.value)} />
                <Select placeholder="Filter by Region" onChange={(value) => setGlobalFilters(prev => ({ ...prev, region: value }))}>
                    <Option value="">All</Option>
                    {regions.map(r => <Option key={r.regionID} value={r.regionID}>{r.name}</Option>)}
                </Select>
            </Space>
            <Row gutter={16}>
                <Col span={12}>
                    <Row gutter={16}>
                        <Col span={8}><Card title="Total Users"><Statistic value={metrics.totalUsers} prefix={<FaUsers />} /></Card></Col>
                        <Col span={8}><Card title="Total Timesheets"><Statistic value={metrics.totalTimesheets} prefix={<FaClock />} /></Card></Col>
                        <Col span={8}><Card title="Total Visits"><Statistic value={metrics.totalVisits} prefix={<FaMapMarkerAlt />} /></Card></Col>
                        <Col span={8}><Card title="Total Receipt Books"><Statistic value={metrics.totalReceiptBooks} prefix={<FaBook />} /></Card></Col>
                        <Col span={8}><Card title="Anomalies Detected"><Statistic value={metrics.anomaliesDetected} prefix={<FaBell />} /></Card></Col>
                        <Col span={8}><Card title="Active Supervisors"><Statistic value={metrics.activeSupervisors} prefix={<FaUsers />} /></Card></Col>
                    </Row>
                </Col>
                <Col span={12}>
                    <Collapse>
                        <Panel header="Charts" key="1">
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Card title="Top Supervisors">
                                        <BarChart width={300} height={200} data={topSupervisors}>
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Bar dataKey="visits" fill="#0088FE" />
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Performance by Region">
                                        <BarChart width={300} height={200} data={performanceByRegion}>
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Bar dataKey="visits" fill="#00C49F" />
                                            <Bar dataKey="receiptBooks" fill="#FFBB28" />
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Region Visits">
                                        <PieChart width={300} height={200}>
                                            <Pie data={performanceByRegion} dataKey="visits" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                                                {performanceByRegion.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Receipt Books by Region">
                                        <RadarChart width={300} height={200} data={performanceByRegion}>
                                            <PolarGrid />
                                            <PolarAngleAxis dataKey="name" />
                                            <Radar dataKey="receiptBooks" stroke="#FF8042" fill="#FF8042" fillOpacity={0.6} />
                                        </RadarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Visit Distribution">
                                        <AreaChart width={300} height={200} data={performanceByRegion}>
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Area dataKey="visits" fill="#FF6384" />
                                        </AreaChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Performance Metrics">
                                        <Treemap width={300} height={200} data={performanceByRegion}>
                                            <RechartsTooltip />
                                        </Treemap>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Region Comparison">
                                        <BarChart width={300} height={200} data={performanceByRegion}>
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Bar dataKey="visits" fill="#FFCE56" />
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Activity Spread">
                                        <ScatterChart width={300} height={200} data={performanceByRegion}>
                                            <XAxis dataKey="name" />
                                            <YAxis dataKey="visits" />
                                            <Scatter fill="#9966FF" />
                                        </ScatterChart>
                                    </Card>
                                </Col>
                            </Row>
                        </Panel>
                    </Collapse>
                </Col>
            </Row>
            <Divider />
            <Row gutter={16}>
                <Col span={4}><Statistic title="Total Regions" value={totalRegions} /></Col>
                <Col span={4}><Statistic title="Total Governorates" value={totalGovernorates} /></Col>
                <Col span={4}><Statistic title="Total Delegations" value={totalDelegations} /></Col>
                <Col span={4}><Statistic title="Avg Visits/Region" value={avgVisitsPerRegion} /></Col>
                <Col span={4}><Statistic title="Avg Books/Region" value={avgReceiptBooksPerRegion} /></Col>
                <Col span={4}><Statistic title="Performance Index" value={performanceIndex} /></Col>
            </Row>
        </div>
    );

    // User Modal
    const renderUserModal = () => (
        <Modal
            title={selectedUser ? `${selectedUser.firstname} ${selectedUser.lastname}` : 'User Details'}
            visible={isUserModalVisible}
            onCancel={() => setIsUserModalVisible(false)}
            footer={null}
        >
            {selectedUser && (
                <Descriptions column={1}>
                    <Descriptions.Item label="User ID">{selectedUser.userID}</Descriptions.Item>
                    <Descriptions.Item label="Name">{`${selectedUser.firstname} ${selectedUser.lastname}`}</Descriptions.Item>
                    <Descriptions.Item label="Roles">{selectedUser.Roles?.map(r => r.name).join(', ') || 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="Regions">{selectedUser.Regions?.map(r => r.name).join(', ') || 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="Timesheets">{timesheets.filter(ts => ts.supervisorID === selectedUser.userID).length}</Descriptions.Item>
                    <Descriptions.Item label="Visits">{timesheets.filter(ts => ts.supervisorID === selectedUser.userID).reduce((sum, ts) => sum + (ts.Visits?.length || 0), 0)}</Descriptions.Item>
                    <Descriptions.Item label="Receipt Books">{receiptBooks.filter(rb => rb.holder?.userID === selectedUser.userID).length}</Descriptions.Item>
                </Descriptions>
            )}
        </Modal>
    );

    // Activity Log
    const renderActivityLog = () => (
        <Card title="Activity Log" style={{ marginTop: 16 }}>
            <List
                dataSource={activityLogs.slice(0, 5)}
                renderItem={(item: ActivityLog) => (
                    <List.Item>
                        <List.Item.Meta
                            avatar={<Avatar icon={<FaSync />} />}
                            title={item.action}
                            description={item.timestamp}
                        />
                    </List.Item>
                )}
            />
        </Card>
    );

    return (
        <div className="hr-dashboard">
            <Spin spinning={loading}>
                <Card title="HR Dashboard" extra={<RangePicker onChange={(dates) => setGlobalFilters(prev => ({ ...prev, dateRange: dates }))} />}>
                    <Row gutter={16}>
                        <Col span={24}>
                            <Tabs defaultActiveKey="1">
                                <TabPane tab={<span><FaSitemap /> Hierarchy</span>} key="1">{renderHierarchyTab()}</TabPane>
                                <TabPane tab={<span><FaUsers /> Users</span>} key="2">{renderUsersTab()}</TabPane>
                                <TabPane tab={<span><FaClock /> Timesheets</span>} key="3">{renderTimesheetsTab()}</TabPane>
                                <TabPane tab={<span><FaBook /> Receipt Books</span>} key="4">{renderReceiptBooksTab()}</TabPane>
                                <TabPane tab={<span><FaMapMarkerAlt /> Visits</span>} key="5">{renderVisitsTab()}</TabPane>
                                <TabPane tab={<span><FaBell /> Anomalies</span>} key="6">{renderAnomaliesTab()}</TabPane>
                                <TabPane tab={<span><FaChartBar /> Performance</span>} key="7">{renderPerformanceTab()}</TabPane>
                            </Tabs>
                        </Col>
                    </Row>
                    {renderActivityLog()}
                </Card>
                {renderUserModal()}
            </Spin>
        </div>
    );
};

export default HRDashboard;

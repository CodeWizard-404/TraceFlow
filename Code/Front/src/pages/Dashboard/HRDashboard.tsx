import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Tabs, Card, Table, Select, Row, Col, Spin, Modal, Input, DatePicker, Space, Tag, Statistic, Descriptions, Popover, Divider, Tree, message, Collapse, Timeline, List, Avatar, Button } from 'antd';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, LabelList, Legend } from 'recharts';
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
import { GeneratedReport } from '../../models/Report';
import { listGeneratedReports, downloadReport, validReportTypes } from '../../apis/reportAPI';
import TimesheetStatus from '../../models/Enum/TimesheetStatus';
import { initSocket, onNotification, offNotification, joinRoom, disconnectSocket, isSocketConnected } from "../../lib/socket";

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
    const filterOption = (input: string, option: any) =>
        option.children?.toLowerCase().includes(input.toLowerCase());

    const COLORS = ['#FF8042', '#36A2EB', '#00C49F', '#FF6384', '#FFBB28', '#0088FE', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];





    // WebSocket setup for real-time updates
    const setupWebSocket = useCallback(() => {
        if (!isSocketConnected()) initSocket();

        const handleEntityEvent = async (event: string, data: unknown) => {
            console.log(`Received entity event: ${event}`, { data });
            const entity = event.split(':')[0];
            const action = event.split(':')[1];

            if (entity === 'timesheet' && (action === 'created' || action === 'validated')) {
                const updatedTimesheets = await getAllTimesheets();
                setTimesheets(Array.isArray(updatedTimesheets) ? updatedTimesheets : []);
                setVisits(Array.isArray(updatedTimesheets) ? updatedTimesheets.flatMap((ts: any) => ts.Visits || []) : []);
            } else if (entity === 'visit' && (action === 'logged' || action === 'updated' || action === 'deleted')) {
                const updatedTimesheets = await getAllTimesheets();
                setTimesheets(Array.isArray(updatedTimesheets) ? updatedTimesheets : []);
                setVisits(Array.isArray(updatedTimesheets) ? updatedTimesheets.flatMap((ts: any) => ts.Visits || []) : []);
            }
        };

        onNotification(handleEntityEvent);
        joinRoom('timesheet');
        joinRoom('visit');

        return () => {
            offNotification();
            disconnectSocket();
        };
    }, [
        getAllTimesheets,
    ]);

    useEffect(() => {
        const cleanup = setupWebSocket();
        return cleanup;
    }, [setupWebSocket]);





    // Hierarchy Tab

    const generateTreeKeys = (nodes: HierarchyNode[], level: number = 0, parentKey: string = '', keys: string[] = [], maxLevel: number = 3): string[] => {
        nodes.forEach((node, index) => {
            const nodeKey = node.userID || node.regionID || node.governorateID || node.delegationID || `${parentKey}-${index}`;
            node.key = nodeKey;
            if (level < maxLevel && node.children) {
                keys.push(nodeKey);
                generateTreeKeys(node.children, level + 2, nodeKey, keys, maxLevel);
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
    const renderHierarchyTab = () => {
        interface FlattenedNode {
            name: string;
            role: string;
            userID?: string;
            regionID?: string;
            governorateID?: string;
            delegationID?: string;
            childrenCount: number;
        }

        const flattenHierarchy = (nodes: HierarchyNode[]): FlattenedNode[] => {
            const result: FlattenedNode[] = [];
            const traverse = (node: HierarchyNode) => {
                result.push({
                    name: node.name,
                    role: node.role || 'Unknown',
                    userID: node.userID,
                    regionID: node.regionID,
                    governorateID: node.governorateID,
                    delegationID: node.delegationID,
                    childrenCount: node.children?.length || 0,
                });
                node.children?.forEach(traverse);
            };
            nodes.forEach(traverse);
            return result;
        };

        const [chartFilter, setChartFilter] = useState({
            role: '',
            region: '',
            governorate: '',
            delegation: '',
            timeRange: 'all' as 'week' | 'month' | 'year' | 'all',
        });

        const filteredFlattenedData = useMemo(() => {
            let data = flattenHierarchy(filteredHierarchyData?.children || []);
            if (chartFilter.role) {
                data = data.filter(node => node.role === chartFilter.role);
            }
            if (chartFilter.region) {
                data = data.filter(node => node.regionID === chartFilter.region);
            }
            if (chartFilter.governorate) {
                data = data.filter(node => node.governorateID === chartFilter.governorate);
            }
            if (chartFilter.delegation) {
                data = data.filter(node => node.delegationID === chartFilter.delegation);
            }
            if (chartFilter.timeRange !== 'all') {
                const now = new Date();
                const timeFilter = {
                    week: new Date(now.setDate(now.getDate() - 7)),
                    month: new Date(now.setFullYear(now.getFullYear(), now.getMonth() - 1)),
                    year: new Date(now.setFullYear(now.getFullYear() - 1)),
                }[chartFilter.timeRange];
                data = data.filter(node => {
                    const user = users.find(u => u.userID === node.userID);
                    return user && user.createdAt && new Date(user.createdAt) >= timeFilter;
                });
            }
            return data;
        }, [filteredHierarchyData, chartFilter, users]);

        const directorDistribution = useMemo(() => {
            const directors = filteredFlattenedData.filter(node => node.role === 'Director');
            return directors.map(node => ({
                name: node.name,
                value: node.childrenCount
            }));
        }, [filteredFlattenedData]);

        const regionalManagerDistribution = useMemo(() => {
            const regionalManagers = filteredFlattenedData.filter(node => node.role === 'Regional Manager');
            return regionalManagers.map(node => ({
                name: node.name,
                value: node.childrenCount
            }));
        }, [filteredFlattenedData]);

        const supervisorDistribution = useMemo(() => {
            const supervisors = filteredFlattenedData.filter(node => node.role === 'Supervisor');
            return supervisors.map(node => ({
                name: node.name,
                value: node.childrenCount
            }));
        }, [filteredFlattenedData]);



        const regionActivity = useMemo(() => {
            const regionCounts = regions.reduce((acc: Record<string, number>, r: Region) => {
                acc[r.name] = filteredFlattenedData.filter(node => node.regionID === r.regionID).length;
                return acc;
            }, {});
            return Object.entries(regionCounts)
                .map(([name, count]) => ({ name, count: Number(count) }))
                .filter(d => d.count > 0)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
        }, [filteredFlattenedData, regions]);

        const governorateActivity = useMemo(() => {
            const governorateCounts = governorates.reduce((acc: Record<string, number>, g: Governorate) => {
                acc[g.name] = filteredFlattenedData.filter(node => node.governorateID === g.governorateID).length;
                return acc;
            }, {});
            return Object.entries(governorateCounts)
                .map(([name, count]) => ({ name, count: Number(count) }))
                .filter(d => d.count > 0)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
        }, [filteredFlattenedData, governorates]);

        const delegationActivity = useMemo(() => {
            const delegationCounts = delegations.reduce((acc: Record<string, number>, d: Delegation) => {
                acc[d.name] = filteredFlattenedData.filter(node => node.delegationID === d.delegationID).length;
                return acc;
            }, {});
            return Object.entries(delegationCounts)
                .map(([name, count]) => ({ name, count: Number(count) }))
                .filter(d => d.count > 0)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
        }, [filteredFlattenedData, delegations]);

        const supervisorAgentRatio = useMemo(() => {
            const supervisorsData = filteredFlattenedData.filter(node => node.role === 'Supervisor');
            return supervisorsData
                .map(sup => {
                    const agentCount = filteredFlattenedData.filter(
                        node => node.role === 'Agent' && node.userID && agents.find(a => a.agentID === node.userID && a.supervisorID === sup.userID)
                    ).length;
                    return {
                        name: sup.name,
                        ratio: agentCount > 0 ? (sup.childrenCount / agentCount).toFixed(1) : '0'
                    };
                })
                .filter(d => Number(d.ratio) > 0)
                .sort((a: { name: string; ratio: string }, b: { name: string; ratio: string }) => parseFloat(b.ratio) - parseFloat(a.ratio))
                .slice(0, 5);
        }, [filteredFlattenedData, agents]);

        const roleDistribution = useMemo(() => {
            const roles = { Director: 0, 'Regional Manager': 0, Supervisor: 0, Agent: 0 };
            filteredFlattenedData.forEach(node => {
                if (node.role) roles[node.role as keyof typeof roles]++;
            });
            return Object.entries(roles).map(([name, value]) => ({ name, value }));
        }, [filteredFlattenedData]);



        const regionDistribution = useMemo(() => {
            const regionsCount = regions.reduce((acc: Record<string, number>, r: Region) => {
                acc[r.name] = filteredFlattenedData.filter(node => node.regionID === r.regionID).length;
                return acc;
            }, {});
            return Object.entries(regionsCount).map(([name, count]) => ({ name, count: Number(count) }));
        }, [filteredFlattenedData, regions]);

        const governorateDistribution = useMemo(() => {
            const govsCount = governorates.reduce((acc: Record<string, number>, g: Governorate) => {
                acc[g.name] = filteredFlattenedData.filter(node => node.governorateID === g.governorateID).length;
                return acc;
            }, {});
            return Object.entries(govsCount).map(([name, count]) => ({ name, count: Number(count) }));
        }, [filteredFlattenedData, governorates]);

        const delegationDistribution = useMemo(() => {
            const delsCount = delegations.reduce((acc: Record<string, number>, d: Delegation) => {
                acc[d.name] = filteredFlattenedData.filter(node => node.delegationID === d.delegationID).length;
                return acc;
            }, {});
            return Object.entries(delsCount).map(([name, count]) => ({ name, count: Number(count) }));
        }, [filteredFlattenedData, delegations]);



        const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

        const defaultExpandedKeys = useMemo(() => {
            return filteredHierarchyData?.children ? generateTreeKeys(filteredHierarchyData.children, 0, '', [], 5) : [];
        }, [filteredHierarchyData]);

        const totalDirectors = filteredHierarchyData?.children?.length || 0;
        const totalRegionalManagers = filteredHierarchyData?.children?.flatMap(d => d.children?.find(c => c.name === 'Regional Managers')?.children || []).length || 0;
        const totalSupervisors = filteredHierarchyData?.children?.flatMap(d => d.children?.find(c => c.name === 'Regional Managers')?.children?.flatMap(rm => rm.children?.find(sc => sc.name === 'Supervisors')?.children || []) || []).length || 0;
        const totalAgents = filteredFlattenedData.filter(node => node.role === 'Agent').length || 0;
        const totalRegions = regions.length;
        const totalGovernorates = governorates.length;
        const totalDelegations = delegations.length;
        const averageSubordinatesPerSupervisor = totalSupervisors > 0 ? (totalAgents / totalSupervisors).toFixed(2) : '0';

        return (
            <Card title="System Hierarchy">
                <Space style={{ marginBottom: 16 }}>
                    <Input.Search
                        placeholder="Search hierarchy"
                        onChange={(e) => debouncedSearch(e.target.value)}
                        allowClear
                    />


                    <Select
                        placeholder="Chart Role Filter"
                        onChange={(value: string | undefined) => setChartFilter(prev => ({ ...prev, role: value || '' }))}
                        allowClear
                        showSearch
                        filterOption={filterOption}
                    >
                        <Option value="">All Roles</Option>
                        <Option value="Agent">Agent</Option>
                        <Option value="Director">Director</Option>
                        <Option value="Regional Manager">Regional Manager</Option>
                        <Option value="Supervisor">Supervisor</Option>
                    </Select>
                    <Select
                        placeholder="Chart Region Filter"
                        onChange={(value: string | undefined) => setChartFilter(prev => ({ ...prev, region: value || '' }))}
                        allowClear
                        showSearch
                        filterOption={filterOption}
                    >
                        <Option value="">All Regions</Option>
                        {[...regions]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(r => (
                                <Option key={r.regionID} value={r.regionID}>
                                    {r.name}
                                </Option>
                            ))}
                    </Select>
                    <Select
                        placeholder="Chart Governorate Filter"
                        onChange={(value: string | undefined) => setChartFilter(prev => ({ ...prev, governorate: value || '' }))}
                        allowClear
                        showSearch
                        filterOption={filterOption}
                    >
                        <Option value="">All Governorates</Option>
                        {[...governorates]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(g => (
                                <Option key={g.governorateID} value={g.governorateID}>
                                    {g.name}
                                </Option>
                            ))}
                    </Select>
                    <Select
                        placeholder="Chart Delegation Filter"
                        onChange={(value: string | undefined) => setChartFilter(prev => ({ ...prev, delegation: value || '' }))}
                        allowClear
                        showSearch
                        filterOption={filterOption}
                    >
                        <Option value="">All Delegations</Option>
                        {[...delegations]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(d => (
                                <Option key={d.delegationID} value={d.delegationID}>
                                    {d.name}
                                </Option>
                            ))}
                    </Select>
                    <Select
                        placeholder="Time Range"
                        onChange={(value) => setChartFilter(prev => ({ ...prev, timeRange: value as 'week' | 'month' | 'year' | 'all' }))}
                        defaultValue="all"
                        showSearch
                        filterOption={filterOption}
                    >
                        <Option value="all">All Time</Option>
                        <Option value="month">Last Month</Option>
                        <Option value="week">Last Week</Option>
                        <Option value="year">Last Year</Option>
                    </Select>
                </Space>
                <Row gutter={16}>
                    <Col span={12}>
                        <div ref={treeContainerRef} style={{ width: '100%', height: '100%', overflow: 'auto' }}>
                            {filteredHierarchyData && filteredHierarchyData.children && filteredHierarchyData.children.length > 0 ? (
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
                                                    <p>Role: {nodeData.role || 'N/A'}</p>
                                                    <p>Subordinates: {nodeData.children?.length || 0}</p>
                                                    <p>Region: {regions.find(r => r.regionID === nodeData.regionID)?.name || 'N/A'}</p>
                                                    <p>Governorate: {governorates.find(g => g.governorateID === nodeData.governorateID)?.name || 'N/A'}</p>
                                                    <p>Delegation: {delegations.find(d => d.delegationID === nodeData.delegationID)?.name || 'N/A'}</p>
                                                </div>
                                            }
                                            title={nodeData.name}
                                        >
                                            <span>{nodeData.name}</span>
                                        </Popover>
                                    )}
                                />
                            ) : (
                                <div>No hierarchy data available</div>
                            )}
                        </div>
                    </Col>
                    <Col span={12}>
                        <Collapse defaultActiveKey={['1']} items={[
                            {
                                key: '1',
                                label: 'Hierarchy Analytics',
                                children: (
                                    <Row gutter={[16, 16]}>
                                        <Col span={12}>
                                            <Card title="Role Distribution">
                                                <p style={{ fontSize: 12, color: '#666' }}>
                                                    Distribution of roles in the hierarchy (excluding Agents).
                                                    {chartFilter.region ? ` Region: ${regions.find(r => r.regionID === chartFilter.region)?.name}.` : ''}
                                                    {chartFilter.governorate ? ` Governorate: ${governorates.find(g => g.governorateID === chartFilter.governorate)?.name}.` : ''}
                                                    {chartFilter.delegation ? ` Delegation: ${delegations.find(d => d.delegationID === chartFilter.delegation)?.name}.` : ''}
                                                    {chartFilter.timeRange !== 'all' ? ` Time: Last ${chartFilter.timeRange}.` : ''}
                                                </p>
                                                <PieChart width={250} height={200}>
                                                    <Pie data={roleDistribution.filter(item => item.name !== 'Agent')} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                                        {roleDistribution.filter(item => item.name !== 'Agent').map((_entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip />
                                                </PieChart>
                                            </Card>
                                        </Col>
                                        <Col span={12}>
                                            <Card title="Director Distribution">
                                                <p style={{ fontSize: 12, color: '#666' }}>
                                                    Number of subordinates per director.
                                                    {chartFilter.region ? ` Region: ${regions.find(r => r.regionID === chartFilter.region)?.name}.` : ''}
                                                    {chartFilter.governorate ? ` Governorate: ${governorates.find(g => g.governorateID === chartFilter.governorate)?.name}.` : ''}
                                                    {chartFilter.delegation ? ` Delegation: ${delegations.find(d => d.delegationID === chartFilter.delegation)?.name}.` : ''}
                                                    {chartFilter.timeRange !== 'all' ? ` Time: Last ${chartFilter.timeRange}.` : ''}
                                                </p>
                                                <BarChart width={250} height={200} data={directorDistribution}>
                                                    <XAxis dataKey="name" />
                                                    <YAxis />
                                                    <RechartsTooltip formatter={(value) => `${value} subordinates`} />
                                                    <Bar dataKey="value" fill="#0088FE">
                                                        <LabelList dataKey="value" position="top" fill="#000" />
                                                    </Bar>
                                                </BarChart>
                                            </Card>
                                        </Col>
                                        <Col span={12}>
                                            <Card title="Regional Manager Distribution">
                                                <p style={{ fontSize: 12, color: '#666' }}>
                                                    Number of subordinates per regional manager.
                                                    {chartFilter.region ? ` Region: ${regions.find(r => r.regionID === chartFilter.region)?.name}.` : ''}
                                                    {chartFilter.governorate ? ` Governorate: ${governorates.find(g => g.governorateID === chartFilter.governorate)?.name}.` : ''}
                                                    {chartFilter.delegation ? ` Delegation: ${delegations.find(d => d.delegationID === chartFilter.delegation)?.name}.` : ''}
                                                    {chartFilter.timeRange !== 'all' ? ` Time: Last ${chartFilter.timeRange}.` : ''}
                                                </p>
                                                <BarChart width={250} height={200} data={regionalManagerDistribution}>
                                                    <XAxis dataKey="name" />
                                                    <YAxis />
                                                    <RechartsTooltip formatter={(value) => `${value} subordinates`} />
                                                    <Bar dataKey="value" fill="#FF6384">
                                                        <LabelList dataKey="value" position="top" fill="#000" />
                                                    </Bar>
                                                </BarChart>
                                            </Card>
                                        </Col>



                                        <Col span={12}>
                                            <Card title="Region Distribution">
                                                <p style={{ fontSize: 12, color: '#666' }}>
                                                    Number of users per region.
                                                    {chartFilter.role ? ` Role: ${chartFilter.role}.` : ''}
                                                    {chartFilter.governorate ? ` Governorate: ${governorates.find(g => g.governorateID === chartFilter.governorate)?.name}.` : ''}
                                                    {chartFilter.delegation ? ` Delegation: ${delegations.find(d => d.delegationID === chartFilter.delegation)?.name}` : ''}
                                                    {chartFilter.timeRange !== 'all' ? ` Time: Last ${chartFilter.timeRange}.` : ''}
                                                </p>
                                                <BarChart width={250} height={200} data={regionDistribution}>
                                                    <XAxis dataKey="name" />
                                                    <YAxis />
                                                    <RechartsTooltip formatter={(value) => `${value} users`} />
                                                    <Bar dataKey="count" fill="#00C49F">
                                                        <LabelList dataKey="count" position="top" fill="#000" />
                                                    </Bar>
                                                </BarChart>
                                            </Card>
                                        </Col>
                                        <Col span={24}>
                                            <Card title="Supervisor Distribution">
                                                <p style={{ fontSize: 12, color: '#666' }}>
                                                    Number of subordinates per supervisor.
                                                    {chartFilter.region ? ` Region: ${regions.find(r => r.regionID === chartFilter.region)?.name}.` : ''}
                                                    {chartFilter.governorate ? ` Governorate: ${governorates.find(g => g.governorateID === chartFilter.governorate)?.name}.` : ''}
                                                    {chartFilter.delegation ? ` Delegation: ${delegations.find(d => d.delegationID === chartFilter.delegation)?.name}.` : ''}
                                                    {chartFilter.timeRange !== 'all' ? ` Time: Last ${chartFilter.timeRange}.` : ''}
                                                </p>
                                                <BarChart width={560} height={200} data={supervisorDistribution}>
                                                    <XAxis dataKey="name" />
                                                    <YAxis />
                                                    <RechartsTooltip formatter={(value) => `${value} subordinates`} />
                                                    <Bar dataKey="value" fill="#FFBB28">
                                                        <LabelList dataKey="value" position="top" fill="#000" />
                                                    </Bar>
                                                </BarChart>
                                            </Card>
                                        </Col>
                                        <Col span={24}>
                                            <Card title="Governorate Distribution">
                                                <p style={{ fontSize: 12, color: '#666' }}>
                                                    Number of users per governorate.
                                                    {chartFilter.role ? ` Role: ${chartFilter.role}.` : ''}
                                                    {chartFilter.region ? ` Region: ${regions.find(r => r.regionID === chartFilter.region)?.name}.` : ''}
                                                    {chartFilter.delegation ? ` Delegation: ${delegations.find(d => d.delegationID === chartFilter.delegation)?.name}.` : ''}
                                                    {chartFilter.timeRange !== 'all' ? ` Time: Last ${chartFilter.timeRange}.` : ''}
                                                </p>
                                                <AreaChart width={560} height={200} data={governorateDistribution}>
                                                    <XAxis dataKey="name" />
                                                    <YAxis />
                                                    <RechartsTooltip formatter={(value) => `${value} users`} />
                                                    <Area type="monotone" dataKey="count" stroke="#FFBB28" fill="#FFBB28" fillOpacity={0.3}>
                                                        <LabelList dataKey="count" position="top" fill="#000" />
                                                    </Area>
                                                </AreaChart>
                                            </Card>
                                        </Col>



                                        <Col span={12}>
                                            <Card title="Top 5 Active Regions">
                                                <p style={{ fontSize: 12, color: '#666' }}>
                                                    Number of users in top 5 most active regions.
                                                    {chartFilter.role ? ` Role: ${chartFilter.role})` : ''}
                                                    {chartFilter.governorate ? ` Governorate: ${governorates.find(g => g.governorateID === chartFilter.governorate)?.name}.` : ''}
                                                    {chartFilter.delegation ? ` Delegation: ${delegations.find(d => d.delegationID === chartFilter.delegation)?.name}.` : ''}
                                                    {chartFilter.timeRange !== 'all' ? ` Time: Last ${chartFilter.timeRange}.` : ''}
                                                </p>
                                                <BarChart width={250} height={200} data={regionActivity}>
                                                    <XAxis dataKey="name" />
                                                    <YAxis />
                                                    <RechartsTooltip formatter={(value) => `${value} users`} />
                                                    <Bar dataKey="count" fill="#00C49F">
                                                        <LabelList dataKey="count" position="top" fill="#000" />
                                                    </Bar>
                                                </BarChart>
                                            </Card>
                                        </Col>
                                        <Col span={12}>
                                            <Card title="Top 5 Active Governorates">
                                                <p style={{ fontSize: 12, color: '#666' }}>
                                                    Number of users in top 5 most active governorates.
                                                    {chartFilter.role ? ` Role: ${chartFilter.role})` : ''}
                                                    {chartFilter.region ? ` Region: ${regions.find(r => r.regionID === chartFilter.region)?.name}.` : ''}
                                                    {chartFilter.delegation ? ` Delegation: ${delegations.find(d => d.delegationID === chartFilter.delegation)?.name}.` : ''}
                                                    {chartFilter.timeRange !== 'all' ? ` Time: Last ${chartFilter.timeRange}.` : ''}
                                                </p>
                                                <BarChart width={250} height={200} data={governorateActivity}>
                                                    <XAxis dataKey="name" />
                                                    <YAxis />
                                                    <RechartsTooltip formatter={(value) => `${value} users`} />
                                                    <Bar dataKey="count" fill="#FF6384">
                                                        <LabelList dataKey="count" position="top" fill="#000" />
                                                    </Bar>
                                                </BarChart>
                                            </Card>
                                        </Col>
                                        <Col span={12}>
                                            <Card title="Top 5 Active Delegations">
                                                <p style={{ fontSize: 12, color: '#666' }}>
                                                    Number of users in top 5 most active delegations.
                                                    {chartFilter.role ? ` Role: ${chartFilter.role})` : ''}
                                                    {chartFilter.region ? ` Region: ${regions.find(r => r.regionID === chartFilter.region)?.name}.` : ''}
                                                    {chartFilter.governorate ? ` Governorate: ${governorates.find(g => g.governorateID === chartFilter.governorate)?.name}.` : ''}
                                                    {chartFilter.timeRange !== 'all' ? ` Time: Last ${chartFilter.timeRange}.` : ''}
                                                </p>
                                                <BarChart width={250} height={200} data={delegationActivity}>
                                                    <XAxis dataKey="name" />
                                                    <YAxis />
                                                    <RechartsTooltip formatter={(value) => `${value} users`} />
                                                    <Bar dataKey="count" fill="#36A2EB">
                                                        <LabelList dataKey="count" position="top" fill="#000" />
                                                    </Bar>
                                                </BarChart>
                                            </Card>
                                        </Col>
                                        <Col span={12}>
                                            <Card title="Top 5 Supervisor-Agent Ratios">
                                                <p style={{ fontSize: 12, color: '#666' }}>
                                                    Ratio of subordinates to agents for top 5 supervisors.
                                                    {chartFilter.region ? ` Region: ${regions.find(r => r.regionID === chartFilter.region)?.name}.` : ''}
                                                    {chartFilter.governorate ? ` Governorate: ${governorates.find(g => g.governorateID === chartFilter.governorate)?.name}.` : ''}
                                                    {chartFilter.delegation ? ` Delegation: ${delegations.find(d => d.delegationID === chartFilter.delegation)?.name}.` : ''}
                                                    {chartFilter.timeRange !== 'all' ? ` Time: Last ${chartFilter.timeRange}.` : ''}
                                                </p>
                                                <BarChart width={250} height={200} data={supervisorAgentRatio}>
                                                    <XAxis dataKey="name" />
                                                    <YAxis />
                                                    <RechartsTooltip formatter={(value) => `${value} ratio`} />
                                                    <Bar dataKey="ratio" fill="#FFBB28">
                                                        <LabelList dataKey="ratio" position="top" fill="#000" />
                                                    </Bar>
                                                </BarChart>
                                            </Card>
                                        </Col>
                                    </Row>
                                ),
                            },
                        ]} />
                    </Col>
                </Row>
                <Divider />
                <Row gutter={24}>
                    <Col span={3}><Statistic title="Total Directors" value={totalDirectors} /></Col>
                    <Col span={3}><Statistic title="Total Regional Managers" value={totalRegionalManagers} /></Col>
                    <Col span={3}><Statistic title="Total Supervisors" value={totalSupervisors} /></Col>
                    <Col span={3}><Statistic title="Total Agents" value={totalAgents} /></Col>
                    <Col span={3}><Statistic title="Total Regions" value={totalRegions} /></Col>
                    <Col span={3}><Statistic title="Total Governorates" value={totalGovernorates} /></Col>
                    <Col span={3}><Statistic title="Total Delegations" value={totalDelegations} /></Col>
                    <Col span={3}><Statistic title="Avg Subordinates/Supervisor" value={averageSubordinatesPerSupervisor} /></Col>
                </Row>
            </Card>
        );
    };

















    // Users Tab
    const userColumns = [
        {
            title: "Status",
            dataIndex: 'isOnline',
            key: 'isOnline',
            render: (isOnline: boolean) => isOnline ? <Tag color="green">Online</Tag> : <Tag color="red">Offline</Tag>,
            defaultSortOrder: 'ascend' as 'ascend',
            sorter: (a: User, b: User) => (a.isOnline === b.isOnline ? 0 : a.isOnline ? -1 : 1),
        },
        { title: 'Name', dataIndex: 'firstname', key: 'name', sorter: (a: User, b: User) => `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`), render: (_: any, record: User) => `${record.firstname} ${record.lastname}` },
        { title: 'Email', dataIndex: 'email', key: 'email', sorter: (a: User, b: User) => a.email.localeCompare(b.email) },
        { title: 'Phone', dataIndex: 'phone', key: 'phone', sorter: (a: User, b: User) => a.phone.localeCompare(b.phone) },
        { title: 'Roles', dataIndex: 'Roles', key: 'roles', render: (roles: any[]) => roles?.map(r => r.name).join(', ') || 'N/A', sorter: (a: User, b: User) => `${a.Roles?.map(r => r.name).join(', ') || ''}`.localeCompare(`${b.Roles?.map(r => r.name).join(', ') || ''}`), orderBy: (a: User) => a.Roles?.map(r => r.name).join(', ') || '' },
        { title: 'Regions', key: 'regions', render: (_: any, record: User) => record.Regions?.length || 0, sorter: (a: User, b: User) => a.Regions?.length! - b.Regions?.length! },
        { title: 'Agents', key: 'agents', render: (_: any, record: User) => agents.filter(a => a.supervisorID === record.userID).length, sorter: (a: User, b: User) => agents.filter(a => a.supervisorID === a.supervisorID).length - agents.filter(a => a.supervisorID === b.userID).length },
        { title: 'Visits', key: 'visits', render: (_: any, record: User) => timesheets.filter(ts => ts.supervisorID === record.userID).reduce((sum, ts) => sum + (ts.Visits?.length || 0), 0), sorter: (a: User, b: User) => timesheets.filter(ts => ts.supervisorID === a.userID).reduce((sum, ts) => sum + (ts.Visits?.length || 0), 0) - timesheets.filter(ts => ts.supervisorID === b.userID).reduce((sum, ts) => sum + (ts.Visits?.length || 0), 0) },
        { title: 'Receipt Books', key: 'receiptBooks', render: (_: any, record: User) => receiptBooks.filter(rb => rb.holder?.userID === record.userID).length, sorter: (a: User, b: User) => receiptBooks.filter(rb => rb.holder?.userID === a.userID).length - receiptBooks.filter(rb => rb.holder?.userID === b.userID).length },
        { title: 'Created At', dataIndex: 'createdAt', key: 'createdAt', sorter: (a: User, b: User) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime(), render: (createdAt: string) => <span>{new Date(createdAt).toLocaleString()}</span> },
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
    const retentionRate = 'N/A';

    const renderUsersTab = () => (
        <div>
            <Space style={{ marginBottom: 16 }}>
                <Input.Search placeholder="Search by name, email, phone" onChange={(e) => debouncedSearch(e.target.value)} />
                <Select
                    placeholder="Filter by Role"
                    onChange={(value) => setGlobalFilters(prev => ({ ...prev, role: value }))}
                    showSearch
                    filterOption={filterOption}
                >
                    <Option value="">All</Option>
                    <Option value="Director">Director</Option>
                    <Option value="Regional Manager">Regional Manager</Option>
                    <Option value="Supervisor">Supervisor</Option>
                    <Option value="Agent">HR</Option>
                    <Option value="Admin">Stock Manager</Option>
                    <Option value="Super Admin">Purchase Team</Option>
                    <Option value="Super Admin">Super Admin</Option>

                </Select>
                <Select
                    placeholder="Filter by Region"
                    onChange={(value) => setGlobalFilters(prev => ({ ...prev, region: value }))}
                    showSearch
                    filterOption={filterOption}
                >
                    <Option value="">All</Option>
                    {[...regions]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(r => (
                            <Option key={r.regionID} value={r.regionID}>
                                {r.name}
                            </Option>
                        ))}
                </Select>
                <Select
                    placeholder="Filter by Governorate"
                    onChange={(value) => setGlobalFilters(prev => ({ ...prev, governorate: value }))}
                    showSearch
                    filterOption={filterOption}
                >
                    <Option value="">All</Option>
                    {[...governorates]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(g => (
                            <Option key={g.governorateID} value={g.governorateID}>
                                {g.name}
                            </Option>
                        ))}
                </Select>
                <Select
                    placeholder="Filter by Delegation"
                    onChange={(value) => setGlobalFilters(prev => ({ ...prev, delegation: value }))}
                    showSearch
                    filterOption={filterOption}
                >
                    <Option value="">All</Option>
                    {[...delegations]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(d => (
                            <Option key={d.delegationID} value={d.delegationID}>
                                {d.name}
                            </Option>
                        ))}
                </Select>
            </Space>
            <Row gutter={10}>
                <Col >
                    <Card title="User List">
                        <Table
                            columns={userColumns}
                            dataSource={applyGlobalFilters(
                                users.filter(u => !u.Roles?.some((r: any) => r.name === 'Super Admin')),
                                'userID'
                            )}
                            rowKey="userID"
                            pagination={{ pageSize: 10 }}
                        />
                    </Card>

                    <Collapse defaultActiveKey={['1']}>
                        <Panel header="Charts" key="1">
                            <Row gutter={16}>
                                <Col span={10}>
                                    <Card title="Role Distribution">
                                        <PieChart width={500} height={300}>
                                            <Pie
                                                data={roleDistributionData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                            >
                                                {roleDistributionData.map((_entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip formatter={(value) => `${value} users`} />
                                            <Legend verticalAlign="bottom" height={50} />
                                        </PieChart>
                                    </Card>
                                </Col>
                                <Col span={14}>
                                    <Card title="Anomalies">
                                        <BarChart width={650} height={300} data={users.map(u => ({ name: `${u.firstname} ${u.lastname}`, anomalies: anomalies.filter(a => a.userID === u.userID).length }))}>
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <RechartsTooltip />
                                            <Bar dataKey="anomalies" fill="#FFCE56">
                                                <LabelList dataKey="anomalies" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="User Activity">
                                        <Timeline items={userActivityTimeline.slice(0, 5)} />
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="User Growth">
                                        <AreaChart width={550} height={250} data={userGrowthData}>
                                            <XAxis
                                                dataKey="date"
                                                angle={-45}
                                                textAnchor="end"
                                                height={60}
                                            />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} new users`} />
                                            <Area
                                                dataKey="count"
                                                stroke="#FF8042"
                                                fill="#FF8042"
                                                fillOpacity={0.3}
                                            />
                                        </AreaChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Visits by User">
                                        <BarChart
                                            width={550}
                                            height={250}
                                            data={users
                                                .map(u => ({
                                                    name: `${u.firstname} ${u.lastname}`,
                                                    visits: timesheets.filter(ts => ts.supervisorID === u.userID).reduce((sum, ts) => sum + (ts.Visits?.length || 0), 0)
                                                }))
                                                .filter(d => d.visits > 0) // Filter out users with 0 visits
                                                .slice(0, 10)}
                                        >
                                            <XAxis
                                                dataKey="name"
                                                angle={-45}
                                                textAnchor="end"
                                                height={60}
                                            />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} visits`} />
                                            <Bar dataKey="visits" fill="#FF6384">
                                                <LabelList dataKey="visits" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Timesheets by User">
                                        <BarChart
                                            width={550}
                                            height={250}
                                            data={users
                                                .map(u => ({
                                                    name: `${u.firstname} ${u.lastname}`,
                                                    timesheets: timesheets.filter(ts => ts.supervisorID === u.userID).length
                                                }))
                                                .filter(d => d.timesheets > 0) // Filter out users with 0 timesheets
                                                .slice(0, 5)}
                                        >
                                            <XAxis
                                                dataKey="name"
                                                angle={-45}
                                                textAnchor="end"
                                                height={60}
                                            />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} timesheets`} />
                                            <Bar dataKey="timesheets" fill="#36A2EB">
                                                <LabelList dataKey="timesheets" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Receipt Books by User">
                                        <BarChart
                                            width={550}
                                            height={250}
                                            data={users
                                                .map(u => ({
                                                    name: `${u.firstname} ${u.lastname}`,
                                                    value: receiptBooks.filter(rb => rb.holder?.userID === u.userID).length
                                                }))
                                                .filter(d => d.value > 0) // Already present, no change needed
                                                .slice(0, 5)}
                                        >
                                            <XAxis
                                                dataKey="name"
                                                angle={-45}
                                                textAnchor="end"
                                                height={60}
                                            />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} books`} />
                                            <Bar dataKey="value" fill="#FFCE56">
                                                <LabelList dataKey="value" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Supervisors per Governorate">
                                        <BarChart
                                            width={500}
                                            height={250}
                                            data={supervisorPerGovData.filter(d => d.count as number > 0)}
                                        >
                                            <XAxis
                                                dataKey="name"
                                                angle={-45}
                                                textAnchor="end"
                                                height={60}
                                            />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} supervisors`} />
                                            <Bar dataKey="count" fill="#9966FF">
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
        { title: 'Status', dataIndex: 'status', key: 'status', sorter: (a: Timesheet, b: Timesheet) => a.status.localeCompare(b.status), render: (status: string) => <Tag color={status === TimesheetStatus.VALIDATED ? 'green' : status === TimesheetStatus.PENDING ? 'orange' : TimesheetStatus.REJECTED ? 'red' : 'cyan'}>{status}</Tag> },
        { title: 'Visits', key: 'visits', render: (_: any, record: Timesheet) => record.Visits?.length || 0 },
        { title: 'Total Hours', key: 'hours', render: (_: any, record: Timesheet) => record.Visits?.reduce((sum: number, v: Visit) => sum + (v.duration || 0), 0) || 0 },
    ];

    const timesheetStatusData = useMemo(() => {
        const statusCounts = timesheets.reduce((acc: Record<string, number>, t) => {
            acc[t.status] = (acc[t.status] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
    }, [timesheets]);
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
        }).filter(item => item.hours > 0).slice(0, 10);
    }, [timesheets, supervisors]);

    const timesheetAnomalyData = useMemo(() => {
        const anomalyCounts = anomalies.reduce((acc: any, a: any) => {
            const date = new Date(a.createdAt).toLocaleDateString();
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(anomalyCounts).map(([date, count]) => ({ date, count }));
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
                <Select
                    placeholder="Filter by Status"
                    onChange={(value) => setGlobalFilters(prev => ({ ...prev, status: value }))}
                    showSearch
                    filterOption={filterOption}
                >
                    <Option value="">All</Option>
                    <Option value="pending">Pending</Option>
                    <Option value="validated">Validated</Option>
                </Select>
                <Select
                    placeholder="Filter by Supervisor"
                    onChange={(value) => setGlobalFilters(prev => ({ ...prev, supervisor: value }))}
                    showSearch
                    filterOption={filterOption}
                >
                    <Option value="">All</Option>
                    {[...supervisors]
                        .sort((a, b) => `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`))
                        .map(s => (
                            <Option key={s.userID} value={s.userID}>
                                {`${s.firstname} ${s.lastname}`}
                            </Option>
                        ))}
                </Select>
            </Space>
            <Row gutter={16}>
                <Col span={24}>
                    <Card title="Timesheet List">
                        <Table columns={timesheetColumns} dataSource={applyGlobalFilters(timesheets, 'timesheetID')} rowKey="timesheetID" pagination={{ pageSize: 10 }} />
                    </Card>
                    <Collapse defaultActiveKey={['1']}>
                        <Panel header="Charts" key="1">
                            <Row gutter={[16, 16]}>
                                <Col span={12}>
                                    <Card title="Timesheet Status">
                                        <PieChart width={550} height={250}>
                                            <Pie
                                                data={timesheetStatusData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                innerRadius={40}
                                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                            >
                                                {timesheetStatusData.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip formatter={(value) => `${value} timesheets`} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Timesheet Trends">
                                        <BarChart width={550} height={250} data={timesheetChartData}>
                                            <XAxis dataKey="week" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} timesheets`} />
                                            <Bar dataKey="count" fill="#00C49F">
                                                <LabelList dataKey="count" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Hours per Supervisor">
                                        <BarChart width={550} height={250} data={hoursPerSupervisor}>
                                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} hours`} />
                                            <Bar dataKey="hours" fill="#FFBB28">
                                                <LabelList dataKey="hours" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>

                                <Col span={12}>
                                    <Card title="Timesheet Count by Supervisor">
                                        <PieChart width={550} height={250}>
                                            <Pie
                                                data={supervisors.map(s => ({ name: `${s.firstname} ${s.lastname}`, value: timesheets.filter(t => t.supervisorID === s.userID).length })).filter(d => d.value > 0)}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                innerRadius={40}
                                                label
                                            >
                                                {supervisors.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip formatter={(value) => `${value} timesheets`} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Validation Status">
                                        <BarChart width={550} height={250} data={timesheetStatusData}>
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} timesheets`} />
                                            <Bar dataKey="value" fill="#FFCE56">
                                                <LabelList dataKey="value" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Weekly Visits">
                                        <BarChart width={550} height={250} data={timesheets.map(t => ({ name: `Week ${t.weekNumber}`, visits: t.Visits?.length || 0 }))}>
                                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} visits`} />
                                            <Bar dataKey="visits" fill="#9966FF">
                                                <LabelList dataKey="visits" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={24}>
                                    <Card title="Anomaly Trends">
                                        <LineChart width={1100} height={250} data={timesheetAnomalyData}>
                                            <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} anomalies`} />
                                            <Line dataKey="count" stroke="#FF8042" dot={true} />
                                        </LineChart>
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
        })).filter((h: ReceiptBookHolder) => h.books > 0).slice(0, 10); // Limit to top 10 holders
    }, [receiptBooks, users]);

    const receiptBookTypeDistribution = useMemo(() => {
        return receiptBookTypes.map(type => ({
            name: type.name,
            value: receiptBooks.filter(rb => rb.typeID === type.typeID).length,
        })).filter(item => item.value > 0); // Filter out zero values
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
                <Select
                    placeholder="Filter by Status"
                    onChange={(value) => setGlobalFilters(prev => ({ ...prev, status: value }))}
                    showSearch
                    filterOption={filterOption}
                >
                    <Option value="">All</Option>
                    <Option value={ReceiptBookStatus.Archived}>Archived</Option>
                    <Option value={ReceiptBookStatus.AssignedToAgent}>With Agents</Option>
                    <Option value={ReceiptBookStatus.InStock}>In Stock</Option>
                    <Option value={ReceiptBookStatus.WithSupervisor}>With Supervisors</Option>
                </Select>
            </Space>
            <Row gutter={16}>
                <Col span={24}>
                    <Card title="Receipt Book List">
                        <Table columns={receiptBookColumns} dataSource={applyGlobalFilters(receiptBooks, 'bookID')} rowKey="bookID" pagination={{ pageSize: 10 }} />
                    </Card>
                    <Collapse defaultActiveKey={['1']}>
                        <Panel header="Charts" key="1">
                            <Row gutter={[16, 16]}>
                                <Col span={12}>
                                    <Card title="Receipt Book Status">
                                        <PieChart width={550} height={250}>
                                            <Pie
                                                data={receiptBookStatusData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                innerRadius={40}
                                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                            >
                                                {receiptBookStatusData.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip formatter={(value) => `${value} books`} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Books per Holder">
                                        <BarChart width={550} height={250} data={receiptBooksPerHolder}>
                                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} books`} />
                                            <Bar dataKey="books" fill="#00C49F">
                                                <LabelList dataKey="books" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Type Distribution">
                                        <PieChart width={550} height={250}>
                                            <Pie
                                                data={receiptBookTypeDistribution}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                innerRadius={40}
                                                label
                                            >
                                                {receiptBookTypeDistribution.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip formatter={(value) => `${value} books`} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Status Breakdown">
                                        <BarChart width={550} height={250} data={receiptBookStatusData}>
                                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} books`} />
                                            <Bar dataKey="value" fill="#FFCE56">
                                                <LabelList dataKey="value" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Books by Type">
                                        <BarChart width={550} height={250} data={receiptBookTypeDistribution}>
                                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} books`} />
                                            <Bar dataKey="value" fill="#36A2EB">
                                                <LabelList dataKey="value" position="top" fill="#000" />
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
        const aggregated = visits.reduce((acc: any, v: any) => {
            const date = v.date.split('T')[0];
            acc[date] = (acc[date] || 0) + (v.duration || 0);
            return acc;
        }, {});
        return Object.entries(aggregated).map(([date, duration]) => ({ date, duration }));
    }, [visits]);
    const visitsBySupervisor = useMemo(() => {
        return supervisors
            .map(s => ({
                name: `${s.firstname} ${s.lastname}`,
                visits: visits.filter(v => {
                    const timesheet = timesheets.find(t => t.timesheetID === v.timesheetID);
                    return timesheet && timesheet.supervisorID === s.userID;
                }).length,
            }))
            .filter(item => item.visits > 0)
            .slice(0, 10); // Limit to top 10 supervisors
    }, [visits, timesheets, supervisors]);

    const agentVisitData = useMemo(() => {
        return agents
            .map(a => ({
                name: `${a.name} ${a.lastname || ''}`,
                visits: visits.filter(v => v.agentID === a.agentID).length,
            }))
            .filter(item => item.visits > 0)
            .slice(0, 10); // Limit to top 10 agents
    }, [visits, agents]);

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
                <Select
                    placeholder="Filter by Status"
                    onChange={(value) => setGlobalFilters(prev => ({ ...prev, status: value }))}
                    showSearch
                    filterOption={filterOption}
                >
                    <Option value="">All</Option>
                    <Option value="pending">Pending</Option>
                    <Option value="rejected">Rejected</Option>
                    <Option value="validated">Validated</Option>
                    <Option value="visited">Visited</Option>
                </Select>
                <Select
                    placeholder="Filter by Agent"
                    onChange={(value) => setGlobalFilters(prev => ({ ...prev, agent: value }))}
                    showSearch
                    filterOption={filterOption}
                >
                    <Option value="">All</Option>
                    {[...agents]
                        .sort((a, b) => `${a.name} ${a.lastname || ''}`.localeCompare(`${b.name} ${b.lastname || ''}`))
                        .map(a => (
                            <Option key={a.agentID} value={a.agentID}>
                                {`${a.name} ${a.lastname || ''}`}
                            </Option>
                        ))}
                </Select>
            </Space>
            <Row gutter={16}>
                <Col span={24}>
                    <Card title="Visit List">
                        <Table columns={visitColumns} dataSource={applyGlobalFilters(visits, 'visitID')} rowKey="visitID" pagination={{ pageSize: 10 }} />
                    </Card>
                    <Collapse defaultActiveKey={['1']}>
                        <Panel header="Charts" key="Charts">
                            <Row gutter={[16, 16]}>
                                <Col span={12}>
                                    <Card title="Status Distribution">
                                        <PieChart width={550} height={250}>
                                            <Pie
                                                data={visitStatusData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                innerRadius={40}
                                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                            >
                                                {visitStatusData.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip formatter={(value) => `${value} visits`} />
                                            <Legend verticalAlign="bottom" height={40} />
                                        </PieChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Status Breakdown">
                                        <BarChart width={550} height={250} data={visitStatusData}>
                                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} visits`} />
                                            <Bar dataKey="value" fill="#36A2EB">
                                                <LabelList dataKey="value" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Visits by Supervisor">
                                        <BarChart width={550} height={250} data={visitsBySupervisor}>
                                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} visits`} />
                                            <Bar dataKey="visits" fill="#FF8042">
                                                <LabelList dataKey="visits" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Daily Visit Trends">
                                        <LineChart width={550} height={250} data={visitChartData}>
                                            <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} visits`} />
                                            <Line dataKey="count" stroke="#00C49F" dot={true} />
                                        </LineChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Total Duration by Date">
                                        <BarChart width={550} height={250} data={visitDurationData}>
                                            <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} minutes`} />
                                            <Bar dataKey="duration" fill="#FFBB28">
                                                <LabelList dataKey="duration" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Visits by Agent">
                                        <BarChart width={550} height={250} data={agentVisitData}>
                                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} visits`} />
                                            <Bar dataKey="visits" fill="#FF6384">
                                                <LabelList dataKey="visits" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>

                            </Row>
                        </Panel>
                    </Collapse>
                    <Card title="Locations">
                        <MapComponent />
                    </Card>
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













    // Reports Tab
    const renderReportsTab = () => {
        const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
        const [loadingGenerated, setLoadingGenerated] = useState<boolean>(false);
        const [filters, setFilters] = useState({
            reportType: '',
            format: '',
            searchText: '',
        });

        useEffect(() => {
            const fetchReports = async () => {
                setLoadingGenerated(true);
                try {
                    const generatedData = await listGeneratedReports();
                    setGeneratedReports(generatedData);
                } catch (error) {
                    message.error('Failed to fetch generated reports');
                } finally {
                    setLoadingGenerated(false);
                }
            };
            fetchReports();
        }, []);

        const handleDownloadReport = async (file: string) => {
            try {
                const response = await downloadReport(file);
                const url = window.URL.createObjectURL(new Blob([response]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', file);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (error: any) {
                message.error(error.message || 'Failed to download report');
            }
        };

        const reportColumns = [
            { title: 'Report Type', dataIndex: 'reportType', key: 'reportType', sorter: (a: GeneratedReport, b: GeneratedReport) => a.reportType.localeCompare(b.reportType) },
            { title: 'Format', dataIndex: 'format', key: 'format', sorter: (a: GeneratedReport, b: GeneratedReport) => a.format.localeCompare(b.format) },
            { title: 'Generated At', dataIndex: 'generatedAt', key: 'generatedAt', render: (date: string) => new Date(date).toLocaleString(), sorter: (a: GeneratedReport, b: GeneratedReport) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime() },
            {
                title: 'Generated By', dataIndex: 'Generator', key: 'generator', render: (generator: any) => generator ? `${generator.firstname} ${generator.lastname}` : 'N/A', sorter: (a: GeneratedReport, b: GeneratedReport) => {
                    if (!a.Generator || !b.Generator) return -1;
                    return `${a.Generator.firstname} ${a.Generator.lastname}`.localeCompare(`${b.Generator.firstname} ${b.Generator.lastname}`);
                }
            },
            {
                title: 'Actions',
                key: 'actions',
                render: (_: any, record: GeneratedReport) => (
                    <Space>
                        <Button onClick={() => handleDownloadReport(record.filePath)}>Download</Button>
                    </Space>
                ),
            },
        ];

        const filterOption = (input: string, option: any) =>
            option.children?.toLowerCase().includes(input.toLowerCase());

        const debouncedSearch = debounce((value: string) => {
            setFilters(prev => ({ ...prev, searchText: value }));
        }, 300);

        // Apply filters to generated reports
        const filteredReports = useMemo(() => {
            return generatedReports.filter(report => {
                const matchesType = filters.reportType ? report.reportType.toLowerCase() === filters.reportType.toLowerCase() : true;
                const matchesFormat = filters.format ? report.format.toLowerCase() === filters.format.toLowerCase() : true;
                const matchesSearch = filters.searchText
                    ? report.reportType.toLowerCase().includes(filters.searchText.toLowerCase()) ||
                    report.format.toLowerCase().includes(filters.searchText.toLowerCase()) ||
                    (report.Generator && `${report.Generator.firstname} ${report.Generator.lastname}`.toLowerCase().includes(filters.searchText.toLowerCase()))
                    : true;
                return matchesType && matchesFormat && matchesSearch;
            });
        }, [generatedReports, filters]);

        // Chart data: Report Type Distribution
        const reportTypeDistribution = useMemo(() => {
            const typeCounts = filteredReports.reduce((acc: Record<string, number>, report) => {
                acc[report.reportType] = (acc[report.reportType] || 0) + 1;
                return acc;
            }, {});
            return Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
        }, [filteredReports]);

        // Chart data: Report Format Distribution
        const reportFormatDistribution = useMemo(() => {
            const formatCounts = filteredReports.reduce((acc: Record<string, number>, report) => {
                acc[report.format] = (acc[report.format] || 0) + 1;
                return acc;
            }, {});
            return Object.entries(formatCounts).map(([name, value]) => ({ name, value }));
        }, [filteredReports]);

        // Chart data: Reports Generated Over Time
        const reportsOverTime = useMemo(() => {
            const timeCounts = filteredReports.reduce((acc: Record<string, number>, report) => {
                const date = new Date(report.generatedAt).toLocaleDateString();
                acc[date] = (acc[date] || 0) + 1;
                return acc;
            }, {});
            return Object.entries(timeCounts).map(([date, count]) => ({ date, count }));
        }, [filteredReports]);

        // Chart data: Top Report Generators
        const topGenerators = useMemo(() => {
            const generatorCounts = filteredReports.reduce((acc: Record<string, { name: string; count: number }>, report) => {
                const generatorName = report.Generator ? `${report.Generator.firstname} ${report.Generator.lastname}` : 'Unknown';
                const key = generatorName;
                if (!acc[key]) {
                    acc[key] = { name: generatorName, count: 0 };
                }
                acc[key].count += 1;
                return acc;
            }, {});
            return Object.values(generatorCounts)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5)
                .map(item => ({ name: item.name, count: item.count }));
        }, [filteredReports]);

        return (
            <div>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Space style={{ marginBottom: 16 }}>
                        <Input.Search
                            placeholder="Search by type, format, generator"
                            onChange={(e) => debouncedSearch(e.target.value)}
                            allowClear
                        />
                        <Select
                            placeholder="Filter by Report Type"
                            value={filters.reportType || undefined}
                            onChange={(value: string | undefined) => setFilters(prev => ({ ...prev, reportType: value || '' }))}
                            allowClear
                            showSearch
                            filterOption={filterOption}
                            style={{ width: 200 }}
                        >
                            <Option value="">All Types</Option>
                            {validReportTypes.map(type => (
                                <Option key={type.toLowerCase()} value={type.toLowerCase()}>{type}</Option>
                            ))}
                        </Select>
                        <Select
                            placeholder="Filter by Format"
                            value={filters.format || undefined}
                            onChange={(value: string | undefined) => setFilters(prev => ({ ...prev, format: value || '' }))}
                            allowClear
                            showSearch
                            filterOption={filterOption}
                            style={{ width: 200 }}
                        >
                            <Option value="">All Formats</Option>
                            <Option value="pdf">PDF</Option>
                            <Option value="excel">Excel</Option>
                        </Select>
                    </Space>
                    <Card title="Generated Reports">
                        <Table
                            columns={reportColumns}
                            dataSource={filteredReports}
                            rowKey="generatedReportID"
                            loading={loadingGenerated}
                            pagination={{ pageSize: 10 }}
                        />
                    </Card>
                    <Collapse defaultActiveKey={['1']}>
                        <Panel header="Charts" key="1">
                            <div style={{ width: '100%', overflowX: 'auto' }}>
                                <Row gutter={[16, 16]}>
                                    <Col span={12}>
                                        <Card title="Report Type Distribution">
                                            <PieChart width={550} height={250}>
                                                <Pie
                                                    data={reportTypeDistribution}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={80}
                                                    innerRadius={40}
                                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                                >
                                                    {reportTypeDistribution.map((_entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip formatter={(value) => `${value} reports`} />
                                                <Legend verticalAlign="bottom" height={36} />
                                            </PieChart>
                                        </Card>
                                    </Col>
                                    <Col span={12}>
                                        <Card title="Report Format Distribution">
                                            <PieChart width={550} height={250}>
                                                <Pie
                                                    data={reportFormatDistribution}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={80}
                                                    innerRadius={40}
                                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                                >
                                                    {reportFormatDistribution.map((_entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip formatter={(value) => `${value} reports`} />
                                                <Legend verticalAlign="bottom" height={36} />
                                            </PieChart>
                                        </Card>
                                    </Col>
                                    <Col span={24}>
                                        <Card title="Reports Generated Over Time">
                                            <LineChart width={1100} height={250} data={reportsOverTime}>
                                                <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} />
                                                <YAxis />
                                                <RechartsTooltip formatter={(value) => `${value} reports`} />
                                                <Line dataKey="count" stroke="#0088FE" dot={true} />
                                            </LineChart>
                                        </Card>
                                    </Col>
                                    <Col span={12}>
                                        <Card title="Top Report Generators">
                                            <BarChart width={550} height={250} data={topGenerators}>
                                                <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                                                <YAxis />
                                                <RechartsTooltip formatter={(value) => `${value} reports`} />
                                                <Bar dataKey="count" fill="#FFBB28">
                                                    <LabelList dataKey="count" position="top" fill="#000" />
                                                </Bar>
                                            </BarChart>
                                        </Card>
                                    </Col>
                                </Row>
                            </div>
                        </Panel>
                    </Collapse>
                </Space>
            </div>
        );

    };
















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
                <Select
                    placeholder="Filter by Severity"
                    onChange={(value) => setGlobalFilters(prev => ({ ...prev, severity: value }))}
                    showSearch
                    filterOption={filterOption}
                >
                    <Option value="">All</Option>
                    <Option value="critical">Critical</Option>
                    <Option value="high">High</Option>
                    <Option value="low">Low</Option>
                    <Option value="medium">Medium</Option>
                </Select>
            </Space>
            <Row gutter={16}>
                <Col span={24}>
                    <Card title="Detected Anomalies">
                        <Table columns={anomalyColumns} dataSource={applyGlobalFilters(anomalies, 'notificationID')} rowKey="notificationID" pagination={{ pageSize: 10 }} />
                    </Card>
                    <Collapse defaultActiveKey={['1']}>
                        <Panel header="Charts" key="1">
                            <Row gutter={[16, 16]}>
                                <Col span={12}>
                                    <Card title="Trends">
                                        <LineChart width={300} height={250} data={anomalyChartData}>
                                            <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} anomalies`} />
                                            <Line dataKey="count" stroke="#0088FE" dot={true} />
                                        </LineChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Severity">
                                        <PieChart width={300} height={250}>
                                            <Pie
                                                data={anomalySeverityChartData}
                                                dataKey="count"
                                                nameKey="severity"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                innerRadius={40}
                                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                            >
                                                {anomalySeverityChartData.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip formatter={(value) => `${value} anomalies`} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Type">
                                        <BarChart width={300} height={250} data={anomalyTypeData}>
                                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} anomalies`} />
                                            <Bar dataKey="value" fill="#FFBB28">
                                                <LabelList dataKey="value" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Daily">
                                        <BarChart width={300} height={250} data={anomalyChartData}>
                                            <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} anomalies`} />
                                            <Bar dataKey="count" fill="#FF8042">
                                                <LabelList dataKey="count" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Severity Trend">
                                        <BarChart width={300} height={250} data={anomalySeverityChartData}>
                                            <XAxis dataKey="severity" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} anomalies`} />
                                            <Bar dataKey="count" fill="#FF6384">
                                                <LabelList dataKey="count" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Anomaly Types">
                                        <PieChart width={300} height={250}>
                                            <Pie
                                                data={anomalyTypeData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                innerRadius={40}
                                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                            >
                                                {anomalyTypeData.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip formatter={(value) => `${value} anomalies`} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Count">
                                        <PieChart width={300} height={250}>
                                            <Pie
                                                data={anomalySeverityChartData}
                                                dataKey="count"
                                                nameKey="severity"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                innerRadius={40}
                                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                            >
                                                {anomalySeverityChartData.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip formatter={(value) => `${value} anomalies`} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Severity Dist">
                                        <BarChart width={300} height={250} data={anomalySeverityChartData}>
                                            <XAxis dataKey="severity" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} anomalies`} />
                                            <Bar dataKey="count" fill="#FFCE56">
                                                <LabelList dataKey="count" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Anomaly Spread">
                                        <BarChart width={300} height={250} data={anomalySeverityChartData}>
                                            <XAxis dataKey="severity" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} anomalies`} />
                                            <Bar dataKey="count" fill="#9966FF">
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
                <Col span={4}><Statistic title="Total Anomalies" value={totalAnomalies} /></Col>
                <Col span={4}><Statistic title="Critical" value={criticalAnomalies} /></Col>
                <Col span={4}><Statistic title="High Severity" value={highSeverity} /></Col>
                <Col span={4}><Statistic title="Medium Severity" value={mediumSeverity} /></Col>
                <Col span={4}><Statistic title="Low Severity" value={lowSeverity} /></Col>
                <Col span={4}><Statistic title="Resolution Time" value={resolutionTime} /></Col>
            </Row>
        </div>
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
        })).filter(item => item.visits > 0 || item.receiptBooks > 0); // Filter out regions with no activity
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
                <Select
                    placeholder="Filter by Region"
                    onChange={(value) => setGlobalFilters(prev => ({ ...prev, region: value }))}
                    showSearch
                    filterOption={filterOption}
                >
                    <Option value="">All</Option>
                    {[...regions]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(r => (
                            <Option key={r.regionID} value={r.regionID}>
                                {r.name}
                            </Option>
                        ))}
                </Select>
            </Space>
            <Row gutter={16}>
                <Col span={24}>
                    <Row gutter={16}>
                        <Col span={8}><Card title="Total Users"><Statistic value={metrics.totalUsers} prefix={<FaUsers />} /></Card></Col>
                        <Col span={8}><Card title="Total Timesheets"><Statistic value={metrics.totalTimesheets} prefix={<FaClock />} /></Card></Col>
                        <Col span={8}><Card title="Total Visits"><Statistic value={metrics.totalVisits} prefix={<FaMapMarkerAlt />} /></Card></Col>
                        <Col span={8}><Card title="Total Receipt Books"><Statistic value={metrics.totalReceiptBooks} prefix={<FaBook />} /></Card></Col>
                        <Col span={8}><Card title="Anomalies Detected"><Statistic value={metrics.anomaliesDetected} prefix={<FaBell />} /></Card></Col>
                        <Col span={8}><Card title="Active Supervisors"><Statistic value={metrics.activeSupervisors} prefix={<FaUsers />} /></Card></Col>
                    </Row>

                    <Collapse defaultActiveKey={['1']}>
                        <Panel header="Charts" key="1">
                            <Row gutter={[16, 16]}>
                                <Col span={12}>
                                    <Card title="Top Supervisors">
                                        <BarChart width={550} height={250} data={topSupervisors}>
                                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value) => `${value} visits`} />
                                            <Bar dataKey="visits" fill="#0088FE">
                                                <LabelList dataKey="visits" position="top" fill="#000" />
                                            </Bar>
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Performance by Region">
                                        <BarChart width={550} height={250} data={performanceByRegion}>
                                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <RechartsTooltip formatter={(value, name) => `${value} ${name}`} />
                                            <Legend verticalAlign="bottom" height={36} />
                                            <Bar dataKey="visits" fill="#00C49F" name="Visits" />
                                            <Bar dataKey="receiptBooks" fill="#FFBB28" name="Receipt Books" />
                                        </BarChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Region Visits">
                                        <PieChart width={550} height={250}>
                                            <Pie
                                                data={performanceByRegion}
                                                dataKey="visits"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                innerRadius={40}
                                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                            >
                                                {performanceByRegion.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip formatter={(value) => `${value} visits`} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card title="Receipt Books by Region">
                                        <PieChart width={550} height={250}>
                                            <Pie
                                                data={performanceByRegion}
                                                dataKey="receiptBooks"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                innerRadius={40}
                                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                            >
                                                {performanceByRegion.map((_entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip formatter={(value) => `${value} books`} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
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
                                <TabPane tab={<span><FaChartBar /> Reports</span>} key="8">{renderReportsTab()}</TabPane>
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

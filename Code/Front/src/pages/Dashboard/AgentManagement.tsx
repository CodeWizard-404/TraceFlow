import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MapComponent from '../../components/Google/MapComponent';
import '../../components/Google/Map.css';
import {
    getAllAgents,
    updateAgent,
    deleteAgent,
    uploadAgents,
} from '../../apis/agentAPI';
import { getUsersByRole } from '../../apis/userAPI';
import {
    getAllRegions,
    getAllGovernorates,
    getAllDelegations,
    getGovernoratesByRegion,
    getDelegationsByGovernorate,
    getRegionsByUser,
    getGovernoratesByUser,
    getDelegationsByUser,
} from '../../apis/locationApi';
import { useAuth } from '../../context/AuthContext';
import {
    Table,
    Button,
    Modal,
    Form,
    Input,
    Select,
    message,
    Upload,
    Space,
    Tooltip,
    Popconfirm,
    Card,
    Row,
    Col,
} from 'antd';
import type { TableProps } from 'antd';
import {
    UploadOutlined,
    DownloadOutlined,
    EditOutlined,
    DeleteOutlined,
    PhoneOutlined,
    PlusOutlined,
} from '@ant-design/icons';
import { saveAs } from 'file-saver';
import './AgentManagement.css';
import { debounce } from 'lodash';
import { useInView } from 'react-intersection-observer';
import { Bar, Doughnut, Line, Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip as ChartTooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    RadialLinearScale,
    PolarAreaController,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
    ArcElement,
    ChartTooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    RadialLinearScale,
    PolarAreaController
);

interface Agent {
    agentID: string;
    name: string;
    lastname: string;
    email: string;
    phone: string;
    location: string | null;
    latitude?: number;
    longitude?: number;
    supervisorID?: string;
    delegationID: string;
    createdAt: string;
    updatedAt: string;
    Supervisor?: { userID: string; firstname: string; lastname: string; phone: string };
    Delegation: {
        delegationID: string;
        name: string;
        Governorate?: {
            governorateID: string;
            name: string;
            regionID?: string
        }
    };
}

interface User {
    userID: string;
    firstname: string;
    lastname: string;
    email?: string;
    role?: string;
    phone?: string;
}

interface Region {
    regionID: string;
    name: string;
    nameAr?: string;
    nameFr?: string;
}

interface Governorate {
    governorateID: string;
    name: string;
    nameAr?: string;
    nameFr?: string;
    regionID: string;
}

interface Delegation {
    delegationID: string;
    name: string;
    nameAr?: string;
    nameFr?: string;
    governorateID: string;
}

interface ActivityLog {
    id: number;
    action: string;
    timestamp: string;
}

interface Metrics {
    totalAgents: number;
    withLocations: number;
    withoutLocations: number;
    totalSupervisors: number;
}

const ROLES = {
    SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
};





const PERMSSIONS = {
    READ_AGENTS_LOCATIONS: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_LOCATIONS,
    READ_AGENTS_BY_LOCATION: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_LOCATION,
    READ_AGENTS_BY_ID: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_ID,
    READ_AGENTS_BY_PHONE: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_PHONE,
    READ_AGENTS_BY_DELEGATION: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_DELEGATION,
    READ_AGENT_SUPERVISOR: import.meta.env.VITE_PERMISSIONS_READ_AGENT_SUPERVISOR,
    READ_AGENTS_BY_USER: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_USER,
    CREATE_AGENTS: import.meta.env.VITE_PERMISSIONS_CREATE_AGENTS,
    READ_ALL_AGENTS: import.meta.env.VITE_PERMISSIONS_READ_ALL_AGENTS,
    UPDATE_AGENTS: import.meta.env.VITE_PERMISSIONS_UPDATE_AGENTS,
    UPDATE_AGENTS_LOCATION: import.meta.env.VITE_PERMISSIONS_UPDATE_AGENTS_LOCATION,
    DELETE_AGENTS: import.meta.env.VITE_PERMISSIONS_DELETE_AGENTS,
    READ_AGENT_MAP_LOCATIONS: import.meta.env.VITE_PERMISSIONS_READ_AGENT_MAP_LOCATIONS,
    READ_NEARBY_AGENTS: import.meta.env.VITE_PERMISSIONS_READ_NEARBY_AGENTS,
}




const AgentManagement: React.FC = () => {
    const { effectivePermissions } = useAuth();
    const navigate = useNavigate();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [supervisors, setSupervisors] = useState<User[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [governorates, setGovernorates] = useState<Governorate[]>([]);
    const [delegations, setDelegations] = useState<Delegation[]>([]);
    const [metrics, setMetrics] = useState<Metrics>({
        totalAgents: 0,
        withLocations: 0,
        withoutLocations: 0,
        totalSupervisors: 0,
    });
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [searchText, setSearchText] = useState('');
    const [filters, setFilters] = useState({
        region: '',
        governorate: '',
        delegation: '',
        supervisor: '',
    });
    const [chartFilters, setChartFilters] = useState({
        timeRange: 'all',
        governorate: '',
        delegation: '',
        supervisor: '',
        hasLocation: 'all',
    });
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isBulkAssignModalVisible, setIsBulkAssignModalVisible] = useState(false);
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [form] = Form.useForm();
    const [bulkForm] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [filteredGovernorates, setFilteredGovernorates] = useState<Governorate[]>([]);
    const [filteredDelegations, setFilteredDelegations] = useState<Delegation[]>([]);
    const [filteredSupervisors, setFilteredSupervisors] = useState<User[]>([]);
    const [filterDelegationIds, setFilterDelegationIds] = useState<string[]>([]);
    const [editModalDelegations, setEditModalDelegations] = useState<Delegation[]>([]);
    const { ref, inView } = useInView({ triggerOnce: false });
    const [currentView, setCurrentView] = useState<'overview' | 'agents' | 'map' | 'activityLog'>('overview');

    // Check for dark mode
    const isDarkMode = document.body.classList.contains('dark');

    const userPermissions = useMemo(
        () => ({
            readAgentsLocations: effectivePermissions?.includes(PERMSSIONS.READ_AGENTS_LOCATIONS),
            readAgentsByLocation: effectivePermissions?.includes(PERMSSIONS.READ_AGENTS_BY_LOCATION),
            readAgentsById: effectivePermissions?.includes(PERMSSIONS.READ_AGENTS_BY_ID),
            readAgentsByPhone: effectivePermissions?.includes(PERMSSIONS.READ_AGENTS_BY_PHONE),
            readAgentsByDelegation: effectivePermissions?.includes(PERMSSIONS.READ_AGENTS_BY_DELEGATION),
            readAgentSupervisor: effectivePermissions?.includes(PERMSSIONS.READ_AGENT_SUPERVISOR),
            readAgentsByUser: effectivePermissions?.includes(PERMSSIONS.READ_AGENTS_BY_USER),
            createAgents: effectivePermissions?.includes(PERMSSIONS.CREATE_AGENTS),
            readAllAgents: effectivePermissions?.includes(PERMSSIONS.READ_ALL_AGENTS),
            updateAgents: effectivePermissions?.includes(PERMSSIONS.UPDATE_AGENTS),
            updateAgentsLocation: effectivePermissions?.includes(PERMSSIONS.UPDATE_AGENTS_LOCATION),
            deleteAgents: effectivePermissions?.includes(PERMSSIONS.DELETE_AGENTS),
        }),
        [effectivePermissions]
    );

    // Chart Filter Options
    const timeRangeOptions = [
        { label: 'Last Week', value: '1w' },
        { label: 'Last Month', value: '1m' },
        { label: 'Last 3 Months', value: '3m' },
        { label: 'Last 6 Months', value: '6m' },
        { label: 'Last Year', value: '1y' },
        { label: 'All Time', value: 'all' },
    ];

    const locationFilterOptions = [
        { label: 'All', value: 'all' },
        { label: 'With Location', value: 'with' },
        { label: 'Without Location', value: 'without' },
    ];

    // Filter Agents by Chart Filters
    const FilteredChartAgents = useMemo(() => {
        return agents.filter(agent => {
            const matchesGovernorate = chartFilters.governorate ? agent.Delegation?.Governorate?.governorateID === chartFilters.governorate : true;
            const matchesDelegation = chartFilters.delegation ? agent.delegationID === chartFilters.delegation : true;
            const matchesSupervisor = chartFilters.supervisor ? agent.supervisorID === chartFilters.supervisor : true;
            const matchesLocation = chartFilters.hasLocation === 'all' ? true :
                chartFilters.hasLocation === 'with' ? agent.latitude && agent.longitude :
                    !agent.latitude || !agent.longitude;
            const matchesTimeRange = chartFilters.timeRange === 'all' ? true :
                (() => {
                    const updatedAt = new Date(agent.updatedAt);
                    const now = new Date();
                    const daysAgo = {
                        '1w': 7,
                        '1m': 30,
                        '3m': 90,
                        '6m': 180,
                        '1y': 365,
                    }[chartFilters.timeRange];
                    if (daysAgo) {
                        return updatedAt > new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
                    }
                    return true;
                })();
            return matchesGovernorate && matchesDelegation && matchesSupervisor && matchesLocation && matchesTimeRange;
        });
    }, [agents, chartFilters]);

    // Chart Data Preparations
    const agentsPerGovernorate = useMemo(() => {
        return governorates
            .map(gov => ({
                name: gov.name,
                count: FilteredChartAgents.filter(a => a.Delegation?.Governorate?.governorateID === gov.governorateID).length,
            }))
            .filter(g => g.count > 0);
    }, [FilteredChartAgents, governorates]);

    const barGovernorateData = useMemo(() => ({
        labels: agentsPerGovernorate.map(g => g.name),
        datasets: [{
            label: 'Agents per Governorate',
            data: agentsPerGovernorate.map(g => g.count),
            backgroundColor: isDarkMode ? '#63b3ed' : '#42A5F5',
        }],
    }), [agentsPerGovernorate, isDarkMode]);

    const agentsPerSupervisor = useMemo(() => {
        const supervisorCounts = supervisors.map(sup => ({
            name: `${sup.firstname} ${sup.lastname}`,
            count: FilteredChartAgents.filter(a => a.supervisorID === sup.userID).length,
        }));
        const noSupervisorCount = FilteredChartAgents.filter(a => !a.supervisorID).length;
        if (noSupervisorCount > 0) {
            supervisorCounts.push({ name: 'No Supervisor', count: noSupervisorCount });
        }
        return supervisorCounts.filter(item => item.count > 0);
    }, [FilteredChartAgents, supervisors]);

    const doughnutSupervisorData = useMemo(() => ({
        labels: agentsPerSupervisor.map(s => s.name),
        datasets: [{
            data: agentsPerSupervisor.map(s => s.count),
            backgroundColor: isDarkMode ?
                ['#ff7f7f', '#63b3ed', '#ffd700', '#66cdaa', '#ba55d3', '#ffa07a'] :
                ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
        }],
    }), [agentsPerSupervisor, isDarkMode]);

    const locationPieData = useMemo(() => {
        const withLocations = FilteredChartAgents.filter(a => a.latitude && a.longitude).length;
        const withoutLocations = FilteredChartAgents.length - withLocations;
        return {
            labels: ['With Location', 'Without Location'],
            datasets: [{
                data: [withLocations, withoutLocations],
                backgroundColor: isDarkMode ? ['#63b3ed', '#ff7f7f'] : ['#36A2EB', '#FF6384'],
            }],
        };
    }, [FilteredChartAgents, isDarkMode]);

    const agentsPerDelegation = useMemo(() => {
        return delegations
            .filter(del => chartFilters.governorate ? del.governorateID === chartFilters.governorate : true)
            .map(del => ({
                name: del.name,
                count: FilteredChartAgents.filter(a => a.delegationID === del.delegationID).length,
            }))
            .filter(d => d.count > 0);
    }, [FilteredChartAgents, delegations, chartFilters.governorate]);

    const barDelegationData = useMemo(() => ({
        labels: agentsPerDelegation.map(d => d.name),
        datasets: [{
            label: 'Agents per Delegation',
            data: agentsPerDelegation.map(d => d.count),
            backgroundColor: isDarkMode ? '#66cdaa' : '#4BC0C0',
        }],
    }), [agentsPerDelegation, isDarkMode]);

    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const staleData = useMemo(() => {
        return {
            'Last 24h': FilteredChartAgents.filter(a => new Date(a.updatedAt) > last24Hours).length,
            'Last 7d': FilteredChartAgents.filter(a => new Date(a.updatedAt) > last7Days && new Date(a.updatedAt) <= last24Hours).length,
            'Last 30d': FilteredChartAgents.filter(a => new Date(a.updatedAt) > last30Days && new Date(a.updatedAt) <= last7Days).length,
            'Older': FilteredChartAgents.filter(a => new Date(a.updatedAt) <= last30Days).length,
        };
    }, [FilteredChartAgents]);

    const staleBarData = useMemo(() => ({
        labels: Object.keys(staleData),
        datasets: [{
            label: 'Agents by Last Update',
            data: Object.values(staleData),
            backgroundColor: isDarkMode ? '#ffa07a' : '#FF9F40',
        }],
    }), [staleData, isDarkMode]);

    const updateFrequency = useMemo(() => {
        const bins = {
            'Daily': 0,
            'Weekly': 0,
            'Monthly': 0,
            'Rarely': 0,
        };
        FilteredChartAgents.forEach(agent => {
            const daysSinceUpdate = (now.getTime() - new Date(agent.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceUpdate <= 1) bins.Daily++;
            else if (daysSinceUpdate <= 7) bins.Weekly++;
            else if (daysSinceUpdate <= 30) bins.Monthly++;
            else bins.Rarely++;
        });
        return bins;
    }, [FilteredChartAgents]);

    const updateFrequencyBarData = useMemo(() => ({
        labels: Object.keys(updateFrequency),
        datasets: [{
            label: 'Agent Update Frequency',
            data: Object.values(updateFrequency),
            backgroundColor: isDarkMode ? '#ba55d3' : '#9966FF',
        }],
    }), [updateFrequency, isDarkMode]);

    const agentsByRegionAndGov = useMemo(() => {
        return regions.map(region => ({
            region: region.name,
            governorates: governorates
                .filter(gov => gov.regionID === region.regionID)
                .map(gov => ({
                    name: gov.name,
                    count: FilteredChartAgents.filter(a => a.Delegation?.Governorate?.governorateID === gov.governorateID).length,
                }))
                .filter(g => g.count > 0),
        })).filter(r => r.governorates.length > 0);
    }, [FilteredChartAgents, regions, governorates]);

    const stackedRegionGovData = useMemo(() => {
        const labels = agentsByRegionAndGov.map(r => r.region);
        const govNames = [...new Set(agentsByRegionAndGov.flatMap(r => r.governorates.map(g => g.name)))];
        const datasets = govNames.map((govName, idx) => ({
            label: govName,
            data: agentsByRegionAndGov.map(r => {
                const gov = r.governorates.find(g => g.name === govName);
                return gov ? gov.count : 0;
            }),
            backgroundColor: isDarkMode ?
                ['#ff7f7f', '#63b3ed', '#ffd700', '#66cdaa', '#ba55d3', '#ffa07a'][idx % 6] :
                ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'][idx % 6],
        }));
        return { labels, datasets };
    }, [agentsByRegionAndGov, isDarkMode]);

    const supervisorWorkload = useMemo(() => {
        return supervisors.map(sup => ({
            name: `${sup.firstname} ${sup.lastname}`,
            count: FilteredChartAgents.filter(a => a.supervisorID === sup.userID).length,
        })).filter(s => s.count > 0);
    }, [FilteredChartAgents, supervisors]);

    const workloadBarData = useMemo(() => ({
        labels: supervisorWorkload.map(s => s.name),
        datasets: [{
            label: 'Agents per Supervisor',
            data: supervisorWorkload.map(s => s.count),
            backgroundColor: isDarkMode ? '#ba55d3' : '#9966FF',
        }],
    }), [supervisorWorkload, isDarkMode]);

    useEffect(() => {
        if (inView) {
            fetchData();
        }
    }, [effectivePermissions, inView]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [agentData, supervisorData, regionData, govData, delData] = await Promise.all([
                getAllAgents(),
                getUsersByRole(ROLES.SUPERVISOR),
                getAllRegions(),
                getAllGovernorates(),
                getAllDelegations(),
            ]);

            const enrichedAgents = agentData.agents.map((agent: Agent) => {
                const supervisor = supervisorData.find((s: User) => s.userID === agent.supervisorID);
                return {
                    ...agent,
                    Supervisor: supervisor
                        ? { userID: supervisor.userID, firstname: supervisor.firstname, lastname: supervisor.lastname, phone: supervisor.phone }
                        : undefined,
                    supervisorName: supervisor ? `${supervisor.firstname} ${supervisor.lastname}` : 'N/A',
                };
            });

            setAgents(enrichedAgents);
            setSupervisors(supervisorData);
            setRegions(regionData);
            setGovernorates(govData);
            setDelegations(delData);
            setFilteredGovernorates(govData);
            setFilteredDelegations(delData);
            setFilteredSupervisors(supervisorData);
            setFilterDelegationIds(delData.map(d => d.delegationID));
            setEditModalDelegations(delData);

            updateMetrics(enrichedAgents, supervisorData.length);
            setActivityLogs([...activityLogs, {
                id: Date.now(),
                action: 'Data Fetched',
                timestamp: new Date().toLocaleString(),
            }]);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to fetch data:', error);
            message.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const updateMetrics = (agentList: Agent[], supervisorCount: number) => {
        setMetrics({
            totalAgents: agentList.length,
            withLocations: agentList.filter(a => a.latitude && a.longitude).length,
            withoutLocations: agentList.filter(a => !a.latitude || !a.longitude).length,
            totalSupervisors: supervisorCount,
        });
    };

    const handleRegionChange = async (regionId: string) => {
        setFilters(prev => ({ ...prev, region: regionId, governorate: '', delegation: '' }));
        setChartFilters(prev => ({ ...prev, governorate: '', delegation: '' }));
        try {
            let delegationIds: string[] = [];
            if (regionId) {
                const govData = await getGovernoratesByRegion(regionId);
                setFilteredGovernorates(govData);
                const delPromises = govData.map(gov => getDelegationsByGovernorate(gov.governorateID));
                const delData = (await Promise.all(delPromises)).flat();
                setFilteredDelegations(delData);
                delegationIds = delData.map(d => d.delegationID);
            } else {
                setFilteredGovernorates(governorates);
                setFilteredDelegations(delegations);
                delegationIds = delegations.map(d => d.delegationID);
            }
            setFilterDelegationIds(delegationIds);
        } catch (error) {
            message.error('Failed to fetch governorates or delegations');
        }
    };

    const handleGovernorateChange = async (governorateId: string) => {
        setFilters(prev => ({ ...prev, governorate: governorateId, delegation: '' }));
        setChartFilters(prev => ({ ...prev, governorate: governorateId, delegation: '' }));
        try {
            let delegationIds: string[] = [];
            if (governorateId) {
                const delData = await getDelegationsByGovernorate(governorateId);
                setFilteredDelegations(delData);
                delegationIds = delData.map(d => d.delegationID);
            } else {
                setFilteredDelegations(delegations);
                delegationIds = delegations.map(d => d.delegationID);
            }
            setFilterDelegationIds(delegationIds);
        } catch (error) {
            message.error('Failed to fetch delegations');
        }
    };

    const handleSupervisorChange = async (supervisorId: string) => {
        setFilters(prev => ({ ...prev, supervisor: supervisorId, region: '', governorate: '', delegation: '' }));
        setChartFilters(prev => ({ ...prev, supervisor: supervisorId, governorate: '', delegation: '' }));
        try {
            let delegationIds: string[] = [];
            if (supervisorId) {
                const [regionData, govData, delData] = await Promise.all([
                    getRegionsByUser(supervisorId),
                    getGovernoratesByUser(supervisorId),
                    getDelegationsByUser(supervisorId),
                ]);
                setFilteredSupervisors([supervisors.find(s => s.userID === supervisorId)!]);
                setRegions(regionData);
                setFilteredGovernorates(govData);
                setFilteredDelegations(delData);
                delegationIds = delData.map(d => d.delegationID);
            } else {
                setFilteredSupervisors(supervisors);
                setRegions(regions);
                setFilteredGovernorates(governorates);
                setFilteredDelegations(delegations);
                delegationIds = delegations.map(d => d.delegationID);
            }
            setFilterDelegationIds(delegationIds);
        } catch (error) {
            message.error('Failed to fetch supervisor locations');
        }
    };

    const handleEdit = async (agent: Agent) => {
        setEditingAgent(agent);
        form.setFieldsValue(agent);
        try {
            let delegationsToShow = delegations;
            if (agent.supervisorID) {
                const supervisorDelegations = await getDelegationsByUser(agent.supervisorID);
                delegationsToShow = supervisorDelegations;
            }
            setEditModalDelegations(delegationsToShow);
        } catch (error) {
            message.error('Failed to fetch supervisor delegations');
        }
        setIsEditModalVisible(true);
    };

    const handleFormSupervisorChange = async (supervisorId: string) => {
        try {
            let delegationsToShow = delegations;
            if (supervisorId) {
                const supervisorDelegations = await getDelegationsByUser(supervisorId);
                delegationsToShow = supervisorDelegations;
            }
            setEditModalDelegations(delegationsToShow);
            form.setFieldsValue({ delegationID: undefined });
        } catch (error) {
            message.error('Failed to fetch supervisor delegations');
        }
    };

    const handleDelete = async (agentId: string) => {
        try {
            await deleteAgent(agentId);
            setAgents(agents.filter(a => a.agentID !== agentId));
            setActivityLogs([...activityLogs, {
                id: Date.now(),
                action: `Agent ${agentId} Deleted`,
                timestamp: new Date().toLocaleString(),
            }]);
            message.success('Agent deleted successfully');
            updateMetrics(agents.filter(a => a.agentID !== agentId), supervisors.length);
        } catch (error) {
            message.error('Failed to delete agent');
        }
    };

    const handleUpdate = async (values: Partial<Agent>) => {
        try {
            if (editingAgent) {
                await updateAgent(editingAgent.agentID, values);
                setAgents(agents.map(a => a.agentID === editingAgent.agentID ? { ...a, ...values } : a));
                setIsEditModalVisible(false);
                setActivityLogs([...activityLogs, {
                    id: Date.now(),
                    action: `Agent ${editingAgent.agentID} Updated`,
                    timestamp: new Date().toLocaleString(),
                }]);
                message.success('Agent updated successfully');
                fetchData();
            } else {
                message.error('No agent selected for update');
            }
        } catch (error) {
            message.error('Failed to update agent');
        }
    };

    const handleBulkAssign = async (values: { supervisorID: string }) => {
        try {
            await Promise.all(selectedRowKeys.map(agentId =>
                updateAgent(agentId as string, { supervisorID: values.supervisorID })
            ));
            setIsBulkAssignModalVisible(false);
            setSelectedRowKeys([]);
            setActivityLogs([...activityLogs, {
                id: Date.now(),
                action: `Bulk Assigned ${selectedRowKeys.length} Agents`,
                timestamp: new Date().toLocaleString(),
            }]);
            message.success('Supervisors assigned successfully');
            fetchData();
        } catch (error) {
            message.error('Failed to bulk assign supervisors');
        }
    };

    const handleExportCSV = () => {
        const csv = [
            ['firstname', 'lastname', 'phone', 'email', 'delegation', 'supervisor_phone', 'governorate', 'address', 'latitude', 'longitude'],
            ...filteredAgents.map(a => [
                a.name,
                a.lastname,
                a.phone,
                a.email,
                a.Delegation?.name || a.delegationID,
                a.Supervisor?.phone || '',
                a.Delegation?.Governorate?.name || '',
                a.location || '',
                a.latitude || '',
                a.longitude || '',
            ].map(field => `"${String(field).replace(/"/g, '""')}"`)),
        ].join('\n');
        const bom = '\uFEFF';
        const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'agents_export.csv');
        setActivityLogs([...activityLogs, {
            id: Date.now(),
            action: 'Exported Agents to CSV',
            timestamp: new Date().toLocaleString(),
        }]);
    };

    const handleCSVUpload = async (file: File) => {
        try {
            const response = await uploadAgents(file);
            const { summary, detailedLog } = response;
            message.success(`Uploaded ${summary.agentsCreated} agents, updated ${summary.agentsUpdated}, skipped ${summary.recordsSkipped} records.`);
            if (summary.errorsEncountered > 0) {
                const errorDetails = detailedLog.errors.map(e => `Agent ${e.agentName} (${e.agentPhone}): ${e.reason}`).join('; ');
                message.warning(`Encountered ${summary.errorsEncountered} errors: ${errorDetails}`);
            }
            setActivityLogs([...activityLogs, {
                id: Date.now(),
                action: `Imported CSV: ${summary.agentsCreated} created, ${summary.agentsUpdated} updated, ${summary.recordsSkipped} skipped, ${summary.errorsEncountered} errors`,
                timestamp: new Date().toLocaleString(),
            }]);
            fetchData();
        } catch (error) {
            message.error('Failed to upload agents');
            setActivityLogs([...activityLogs, {
                id: Date.now(),
                action: 'Failed to import CSV',
                timestamp: new Date().toLocaleString(),
            }]);
        }
        return false;
    };

    const debouncedSearch = useCallback(
        debounce((value: string) => setSearchText(value), 300),
        []
    );

    const filteredAgents = useMemo(() => {
        return agents.filter(agent => {
            const searchTerms = searchText.toLowerCase().trim().split(/\s+/);
            const matchesSearch = searchTerms.every(term =>
                agent.name.toLowerCase().includes(term) ||
                agent.lastname.toLowerCase().includes(term) ||
                agent.phone.toLowerCase().includes(term) ||
                agent.agentID.toLowerCase().includes(term)
            );
            const matchesFilters = (
                (filterDelegationIds.length === 0 || filterDelegationIds.includes(agent.delegationID)) &&
                (!filters.supervisor || agent.supervisorID === filters.supervisor) &&
                (!filters.delegation || agent.delegationID === filters.delegation)
            );
            return matchesSearch && matchesFilters;
        });
    }, [agents, searchText, filters.supervisor, filters.delegation, filterDelegationIds]);

    const columns: TableProps<Agent>['columns'] = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            render: (_: string, record: Agent) => `${record.name} ${record.lastname}`,
            sorter: (a: Agent, b: Agent) => a.name.localeCompare(b.name),
        },
        { title: 'Email', dataIndex: 'email', key: 'email' },
        { title: 'Phone', dataIndex: 'phone', key: 'phone' },
        {
            title: 'Supervisor',
            dataIndex: 'supervisorName',
            key: 'supervisorName',
            sorter: (a: Agent, b: Agent) => (a.Supervisor?.firstname || '').localeCompare(b.Supervisor?.firstname || ''),
        },
        {
            title: 'Delegation',
            dataIndex: 'delegationID',
            key: 'delegationID',
            render: (id: string) => delegations.find(d => d.delegationID === id)?.name || id,
            sorter: (a: Agent, b: Agent) => {
                const aName = delegations.find(d => d.delegationID === a.delegationID)?.name || '';
                const bName = delegations.find(d => d.delegationID === b.delegationID)?.name || '';
                return aName.localeCompare(bName);
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: Agent) => (
                <Space size="middle">
                    {userPermissions.updateAgents && (

                        <Tooltip title="Edit"><Button icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip>
                    )}
                    {userPermissions.deleteAgents && (
                        <Popconfirm title="Sure to delete?" onConfirm={() => handleDelete(record.agentID)}>
                            <Button icon={<DeleteOutlined />} danger />
                        </Popconfirm>
                    )}
                    <Tooltip title="Call"><Button icon={<PhoneOutlined />} onClick={() => window.location.href = `tel:${record.phone}`} /></Tooltip>
                    <Tooltip title="Add Visit"><Button icon={<PlusOutlined />} onClick={() => navigate(`/timesheet-form?agentId=${record.agentID}`)} /></Tooltip>
                </Space>
            ),
        },
    ];

    const rowSelection: TableProps<Agent>['rowSelection'] = {
        selectedRowKeys,
        onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
    };

    return (
        <div className="agent-management-container" ref={ref}>

            <header className="agent-management-header">
                <h1>Agent Management Dashboard</h1>
                <div className="view-toggle">
                    <button
                        className={`toggle-btn ${currentView === 'overview' ? 'active' : ''}`}
                        onClick={() => setCurrentView('overview')}
                    >
                        Overview
                    </button>
                    <button
                        className={`toggle-btn ${currentView === 'agents' ? 'active' : ''}`}
                        onClick={() => setCurrentView('agents')}
                    >
                        Agents
                    </button>
                    <button
                        className={`toggle-btn ${currentView === 'map' ? 'active' : ''}`}
                        onClick={() => setCurrentView('map')}
                    >
                        Map
                    </button>
                    <button
                        className={`toggle-btn ${currentView === 'activityLog' ? 'active' : ''}`}
                        onClick={() => setCurrentView('activityLog')}
                    >
                        Activity Log
                    </button>
                </div>
            </header>
            {currentView === 'overview' && (
                <div className="overview-content">
                    <div className="metrics-container">
                        {Object.entries(metrics).map(([key, value]) => (
                            <Card key={key} className="metric-card">
                                <h3>{key.replace(/([A-Z])/g, ' $1').trim()}</h3>
                                <p>{value}</p>
                            </Card>
                        ))}
                    </div>
                    <div className="chart-filters" style={{ marginBottom: '1.25rem' }}>
                        <Space wrap>
                            <Select
                                placeholder="Select Time Range"
                                value={chartFilters.timeRange}
                                onChange={(value) => setChartFilters(prev => ({ ...prev, timeRange: value }))}
                                style={{ width: 150 }}
                            >
                                {timeRangeOptions.map(option => (
                                    <Select.Option key={option.value} value={option.value}>
                                        {option.label}
                                    </Select.Option>
                                ))}
                            </Select>
                            <Select
                                placeholder="Filter by Governorate"
                                value={chartFilters.governorate}
                                onChange={handleGovernorateChange}
                                style={{ width: 150 }}
                                allowClear
                            >
                                <Select.Option value="">All Governorates</Select.Option>
                                {filteredGovernorates.map(g => (
                                    <Select.Option key={g.governorateID} value={g.governorateID}>
                                        {g.name}
                                    </Select.Option>
                                ))}
                            </Select>
                            <Select
                                placeholder="Filter by Delegation"
                                value={chartFilters.delegation}
                                onChange={(value) => setChartFilters(prev => ({ ...prev, delegation: value }))}
                                style={{ width: 150 }}
                                allowClear
                            >
                                <Select.Option value="">All Delegations</Select.Option>
                                {filteredDelegations.map(d => (
                                    <Select.Option key={d.delegationID} value={d.delegationID}>
                                        {d.name}
                                    </Select.Option>
                                ))}
                            </Select>
                            <Select
                                placeholder="Filter by Supervisor"
                                value={chartFilters.supervisor}
                                onChange={(value) => setChartFilters(prev => ({ ...prev, supervisor: value }))}
                                style={{ width: 150 }}
                                allowClear
                            >
                                <Select.Option value="">All Supervisors</Select.Option>
                                {supervisors.map(s => (
                                    <Select.Option key={s.userID} value={s.userID}>
                                        {s.firstname} {s.lastname}
                                    </Select.Option>
                                ))}
                            </Select>
                            <Select
                                placeholder="Location Status"
                                value={chartFilters.hasLocation}
                                onChange={(value) => setChartFilters(prev => ({ ...prev, hasLocation: value }))}
                                style={{ width: 150 }}
                                allowClear
                            >
                                {locationFilterOptions.map(option => (
                                    <Select.Option key={option.value} value={option.value}>
                                        {option.label}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Space>
                    </div>
                    <div className="charts-container">
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <Card title="Agents per Governorate">
                                    <Bar data={barGovernorateData} options={{
                                        plugins: { legend: { labels: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } } },
                                        scales: {
                                            x: { ticks: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } },
                                            y: { ticks: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } },
                                        },
                                    }} />
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card title="Stale Agent Data">
                                    <Line data={staleBarData} options={{
                                        plugins: { legend: { labels: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } } },
                                        scales: {
                                            x: { ticks: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } },
                                            y: { ticks: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } },
                                        },
                                    }} />
                                </Card>
                            </Col>
                            <Col span={24}>
                                <Card title="Agents per Delegation">
                                    <Bar data={barDelegationData} options={{
                                        plugins: { legend: { labels: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } } },
                                        scales: {
                                            x: { ticks: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } },
                                            y: { ticks: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } },
                                        },
                                    }} />
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card title="Agent Update Frequency">
                                    <Line data={updateFrequencyBarData} options={{
                                        plugins: { legend: { labels: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } } },
                                        scales: {
                                            x: { ticks: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } },
                                            y: { ticks: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } },
                                        },
                                    }} />
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card title="Agent Distribution by Region and Governorate">
                                    <Bar data={stackedRegionGovData} options={{
                                        plugins: { legend: { labels: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } } },
                                        scales: {
                                            x: { stacked: true, ticks: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } },
                                            y: { stacked: true, ticks: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } },
                                        },
                                    }} />
                                </Card>
                            </Col>
                            <Col span={9}>
                                <Card title="Agents per Supervisor">
                                    <Doughnut data={doughnutSupervisorData} options={{
                                        plugins: { legend: { labels: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } } },
                                    }} />
                                </Card>
                            </Col>
                            <Col span={10}>
                                <Card title="Supervisor Workload Balance">
                                    <Line data={workloadBarData} options={{
                                        plugins: { legend: { labels: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } } },
                                        scales: {
                                            x: { ticks: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } },
                                            y: { ticks: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } },
                                        },
                                    }} />
                                </Card>
                            </Col>
                            <Col span={5}>
                                <Card title="Agents with/without Locations">
                                    <Pie data={locationPieData} options={{
                                        plugins: { legend: { labels: { color: isDarkMode ? '#e5e7eb' : '#1f2937' } } },
                                    }} />
                                </Card>
                            </Col>
                        </Row>
                    </div>
                </div>
            )}

            {currentView === 'agents' && (
                <div className="agents-content">
                    <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
                        <Space wrap>
                            <Input.Search
                                placeholder="Search by name, lastname, phone..."
                                onChange={(e) => debouncedSearch(e.target.value)}
                                style={{ width: 200 }}
                            />
                            <Select
                                placeholder="Filter by Region"
                                value={filters.region}
                                onChange={handleRegionChange}
                                style={{ width: 150 }}
                            >
                                <Select.Option value="">All Regions</Select.Option>
                                {regions.map(r => (
                                    <Select.Option key={r.regionID} value={r.regionID}>{r.name}</Select.Option>
                                ))}
                            </Select>
                            <Select
                                placeholder="Filter by Governorate"
                                value={filters.governorate}
                                onChange={handleGovernorateChange}
                                style={{ width: 150 }}
                            >
                                <Select.Option value="">All Governorates</Select.Option>
                                {filteredGovernorates.map(g => (
                                    <Select.Option key={g.governorateID} value={g.governorateID}>{g.name}</Select.Option>
                                ))}
                            </Select>
                            <Select
                                placeholder="Filter by Delegation"
                                value={filters.delegation}
                                onChange={(value) => setFilters({ ...filters, delegation: value })}
                                style={{ width: 150 }}
                            >
                                <Select.Option value="">All Delegations</Select.Option>
                                {filteredDelegations.map(d => (
                                    <Select.Option key={d.delegationID} value={d.delegationID}>{d.name}</Select.Option>
                                ))}
                            </Select>
                            <Select
                                placeholder="Filter by Supervisor"
                                value={filters.supervisor}
                                onChange={handleSupervisorChange}
                                style={{ width: 150 }}
                            >
                                <Select.Option value="">All Supervisors</Select.Option>
                                {filteredSupervisors.map(s => (
                                    <Select.Option key={s.userID} value={s.userID}>{s.firstname} {s.lastname}</Select.Option>
                                ))}
                            </Select>
                        </Space>
                        {userPermissions.createAgents && (
                            <Space>
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={() => setIsBulkAssignModalVisible(true)}
                                    disabled={!selectedRowKeys.length}
                                >
                                    Bulk Assign Supervisor
                                </Button>
                                <Upload beforeUpload={handleCSVUpload} showUploadList={false}>
                                    <Button icon={<UploadOutlined />}>Import CSV</Button>
                                </Upload>
                                <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
                                    Export CSV
                                </Button>
                            </Space>

                        )}

                    </Space>
                    <Table
                        rowSelection={rowSelection}
                        columns={columns}
                        dataSource={filteredAgents}
                        rowKey="agentID"
                        pagination={{ pageSize: 10 }}
                        loading={loading}
                    />
                </div>
            )}

            {currentView === 'map' && (
                <MapComponent />
            )}

            {currentView === 'activityLog' && (
                <div className="activity-log-content">
                    <Table
                        columns={[
                            { title: 'Action', dataIndex: 'action', key: 'action' },
                            { title: 'Timestamp', dataIndex: 'timestamp', key: 'timestamp' },
                        ]}
                        dataSource={activityLogs}
                        rowKey="id"
                        pagination={{ pageSize: 5 }}
                    />
                </div>
            )}

            <Modal
                title="Edit Agent"
                open={isEditModalVisible}
                onCancel={() => setIsEditModalVisible(false)}
                onOk={() => form.submit()}
            >
                <Form form={form} onFinish={handleUpdate}>
                    <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="lastname" label="Last Name" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="phone" label="Phone" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="supervisorID" label="Supervisor">
                        <Select onChange={handleFormSupervisorChange}>
                            {filteredSupervisors.map(s => (
                                <Select.Option key={s.userID} value={s.userID}>
                                    {s.firstname} {s.lastname}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item name="delegationID" label="Delegation" rules={[{ required: true }]}>
                        <Select>
                            {editModalDelegations.map(d => (
                                <Select.Option key={d.delegationID} value={d.delegationID}>
                                    {d.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Bulk Assign Supervisor"
                open={isBulkAssignModalVisible}
                onCancel={() => setIsBulkAssignModalVisible(false)}
                onOk={() => bulkForm.submit()}
            >
                <Form form={bulkForm} onFinish={handleBulkAssign}>
                    <Form.Item
                        name="supervisorID"
                        label="Supervisor"
                        rules={[{ required: true, message: 'Please select a supervisor' }]}
                    >
                        <Select placeholder="Select Supervisor">
                            {filteredSupervisors.map((s: User) => (
                                <Select.Option key={s.userID} value={s.userID}>
                                    {s.firstname} {s.lastname}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            <p className="last-updated">
                Last updated: {lastUpdated ? lastUpdated.toLocaleString() : 'Never'}
            </p>
        </div>
    );
};

export default React.memo(AgentManagement);
/* eslint-disable react-hooks/exhaustive-deps */
import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
    Suspense,
    lazy,
} from "react";
import {
    FaArrowLeft,
    FaPlus,
    FaRedo,
    FaSearch,
    FaSort,
    FaUserPlus,
    FaUpload,
} from "react-icons/fa";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { debounce } from "lodash";
import Cookies from "js-cookie";
import { useAuth } from "../../context/AuthContext";
import { useError } from "../../context/ErrorContext";
import { getAllChecklists } from "../../apis/checklistAPI";
import { getAllPermissions } from "../../apis/permissionAPI";
import { getAllReasons } from "../../apis/reasonAPI";
import { getAllRoles, resetMainRoles } from "../../apis/roleAPI";
import { getAllUsers } from "../../apis/userAPI";
import { getAllAgents } from "../../apis/agentAPI";
import { getNotificationRules } from "../../apis/notificationAPI";
import { getNotificationTypes } from "../../lib/notifEvents";
import { initSocket, onNotification, offNotification, joinRoom, disconnectSocket, isSocketConnected } from "../../lib/socket";
import { Checklist } from "../../models/Checklist";
import Permission from "../../models/Permission";
import { Reason } from "../../models/Reason";
import Role from "../../models/Role";
import User from "../../models/User";
import Agent from "../../models/Agent";
import NotificationRule from "../../models/NotificationRule";
import { SortField, SortOrder, ViewMode } from "./adminTypes";
import NotificationPanel from "../../components/ui/notificationPanel";
import Select from "react-select";
import "./AdminDashboard.css";
import AddAgent from "./Agents/AddAgent";
import EditAgent from "./Agents/EditAgent";
import AgentView from "./Agents/AgentView";
import {
    listAIConfigs,
} from "../../apis/aiAPI";
import { AIConfig } from "../../models/AI";
import { Log } from "../../models/log";
import LogsList from "./LogsList";
import { getLogs } from "../../apis/logAPI";

const AIConfigsList = lazy(() => import("./AI/AIConfigsList"));
const AIConfigAdd = lazy(() => import("./AI/AIConfigAdd"));
const AIConfigView = lazy(() => import("./AI/AIConfigView"));

const ChecklistAdd = lazy(() => import("./Items/Checklists/ChecklistAdd"));
const ChecklistView = lazy(() => import("./Items/Checklists/ChecklistView"));
const ChecklistsList = lazy(() => import("./Items/Checklists/ChecklistsList"));
const PermsList = lazy(() => import("./Permission/perms_list"));
const ReasonAdd = lazy(() => import("./Items/Reasons/ReasonAdd"));
const ReasonView = lazy(() => import("./Items/Reasons/ReasonView"));
const ReasonsList = lazy(() => import("./Items/Reasons/ReasonsList"));
const RoleAdd = lazy(() => import("./Role/role_add"));
const RolesList = lazy(() => import("./Role/roles_list"));
const UserAdd = lazy(() => import("./User/user_add"));
const UserView = lazy(() => import("./User/user_view"));
const UsersList = lazy(() => import("./User/users_list"));
const AgentsList = lazy(() => import("./Agents/Agents_List"));
const AgentBulkUploadModal = lazy(() => import("./Agents/AgentBulkUploadModal"));
const NotificationRulesList = lazy(() => import("./Notification/NotificationRulesList"));
const NotificationRuleAdd = lazy(() => import("./Notification/NotificationRuleAdd"));
const NotificationRuleView = lazy(() => import("./Notification/NotificationRuleView"));

const CACHE_DURATION = 15 * 60 * 1000;
const FALLBACK_TIMEOUT = 500;
const ITEMS_PER_PAGE = 10;
const COOKIE_NAME = "adminDashboardView";
const COOKIE_EXPIRES = 7;

const validViews: ViewMode[] = [
    "users",
    "roles",
    "permissions",
    "checklists",
    "reasons",
    "agents",
    "add-user",
    "add-role",
    "add-permission",
    "user-details",
    "checklist-details",
    "add-checklist",
    "reason-details",
    "add-reason",
    "notifications",
    "add-notification-rule",
    "notification-rule-details",
    "add-agent",
    "agent-details",
    "edit-agent",
    "ai-configs",
    "add-ai-config",
    "ai-config-details",
    "logs",
];

interface CacheData {
    data: User[] | Role[] | Permission[] | Checklist[] | Reason[] | Agent[] | NotificationRule[] | string[] | AIConfig[];
    timestamp: number;
}

interface ConfirmationState {
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}
const cache = new Map<string, CacheData>();

const AdminDashboard: React.FC = React.memo(() => {
    const [isResetting, setIsResetting] = useState(false);
    const { t } = useTranslation();
    const { effectivePermissions, userRoles } = useAuth();
    const { clearError, setError: setGlobalError } = useError();
    const [usersLoading, setUsersLoading] = useState(false);
    const [rolesLoading, setRolesLoading] = useState(false);
    const [permissionsLoading, setPermissionsLoading] = useState(false);
    const [checklistsLoading, setChecklistsLoading] = useState(false);
    const [reasonsLoading, setReasonsLoading] = useState(false);
    const [agentsLoading, setAgentsLoading] = useState(false);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [roleLoading, setRoleLoading] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [showNotificationPanel, setShowNotificationPanel] = useState(false);
    const [notificationTypes, setNotificationTypes] = useState<string[]>([]);
    const [checklists, setChecklists] = useState<Checklist[]>([]);
    const [checklistsPage, setChecklistsPage] = useState(1);
    const [error, setLocalError] = useState<string | null>(null);
    const [permissionsList, setPermissionsList] = useState<Permission[]>([]);
    const [reasons, setReasons] = useState<Reason[]>([]);
    const [reasonsPage, setReasonsPage] = useState(1);
    const [resetLoading, setResetLoading] = useState(false);
    const [roleFilter, setRoleFilter] = useState<string[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [inputValue, setInputValue] = useState("");
    const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
    const [, setSelectedPermission] = useState<Permission | null>(null);
    const [selectedReason, setSelectedReason] = useState<Reason | null>(null);
    const [, setSelectedRole] = useState<Role | null>(null);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [selectedNotificationRule, setSelectedNotificationRule] = useState<NotificationRule | null>(null);
    const [sortField, setSortField] = useState<SortField>("name");
    const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
    const [users, setUsers] = useState<User[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [agentsPage, setAgentsPage] = useState(1);
    const [usersPage, setUsersPage] = useState(1);
    const [totalReasons, setTotalReasons] = useState(0);
    const [totalChecklists, setTotalChecklists] = useState(0);
    const [notificationRules, setNotificationRules] = useState<NotificationRule[]>([]);
    const [notificationTypeFilter, setNotificationTypeFilter] = useState<string>("all");
    const [notificationChannelFilter, setNotificationChannelFilter] = useState<string>("all");
    const [notificationStatusFilter, setNotificationStatusFilter] = useState<string>("all");
    const [notificationSortField, setNotificationSortField] = useState<string>("type");
    const [notificationSortOrder, setNotificationSortOrder] = useState<string>("asc");
    const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
    const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
    const [governorateFilter, setGovernorateFilter] = useState<string>("all");
    const [delegationFilter, setDelegationFilter] = useState<string>("all");

    const [logs, setLogs] = useState<Log[]>([]);
    const [logsPage, setLogsPage] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);
    const [logSortField, setLogSortField] = useState<string>('timestamp');
    const [logSortOrder, setLogSortOrder] = useState<SortOrder>('desc');
    const [logsLoading, setLogsLoading] = useState(false);
    const [logFilters, setLogFilters] = useState<{
        level?: string;
        route?: string;
        service?: string;
        status?: number;
        method?: string;
        userId?: string;
        traceId?: string;
        startDate?: string;
        endDate?: string;
    }>({
        level: 'all',
    });

    const [aiConfigs, setAIConfigs] = useState<AIConfig[]>([]);
    const [aiConfigsLoading, setAIConfigsLoading] = useState(false);
    const [selectedAIConfig, setSelectedAIConfig] = useState<AIConfig | null>(null);
    const [aiConfigsPage, setAIConfigsPage] = useState(1);


    const initialView = useMemo(() => {
        const savedView = Cookies.get(COOKIE_NAME);
        if (savedView && validViews.includes(savedView as ViewMode)) {
            return savedView as ViewMode;
        }
        return "users";
    }, []);
    const [view, setView] = useState<ViewMode>(initialView);

    useEffect(() => {
        if (validViews.includes(view) && view !== "user-details" && view !== "agent-details") {
            Cookies.set(COOKIE_NAME, view, { expires: COOKIE_EXPIRES });
        }
    }, [view]);

    const debouncedSetSearchQuery = useCallback(debounce((value: string) => setSearchQuery(value), 300), []);

    useEffect(() => {
        setInputValue(searchQuery);
    }, [searchQuery]);

    const userPermissions = useMemo(
        () => ({
            canCreateChecklists: effectivePermissions?.some(
                (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_CHECKLISTS_ITEMS
            ),
            canCreatePermissions: effectivePermissions?.some(
                (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_PERMISSIONS
            ),
            canCreateReasons: effectivePermissions?.some(
                (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_REASON_ITEMS
            ),
            canCreateRoles: effectivePermissions?.some(
                (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_ROLES
            ),
            canCreateUsers: effectivePermissions?.some(
                (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_USERS
            ),
            canResetRoles: effectivePermissions?.some(
                (p) => p.name === import.meta.env.VITE_PERMISSIONS_RESET_MAIN_ROLES
            ),
            canViewChecklists: effectivePermissions?.some(
                (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_CHECKLISTS_ITEMS
            ),
            canViewPermissions: effectivePermissions?.some(
                (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_PERMISSIONS
            ),
            canViewReasons: effectivePermissions?.some(
                (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_REASON_ITEMS
            ),
            canViewRoles: effectivePermissions?.some(
                (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_ROLES
            ),
            canViewUsers: effectivePermissions?.some(
                (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_USERS
            ),
            canManageNotificationRules: effectivePermissions?.some(
                (p) => p.name === import.meta.env.VITE_PERMISSIONS_MANAGE_NOTIFICATION_RULES
            ),
            canViewNotificationRules: effectivePermissions?.some(
                (p) => p.name === import.meta.env.VITE_PERMISSIONS_VIEW_NOTIFICATION_RULES
            ),
            canViewAgents: effectivePermissions?.some(
                (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_ALL_AGENTS
            ),
            canCreateAgents: effectivePermissions?.some(
                (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_AGENTS
            ),
            canManageAIConfigs: effectivePermissions?.some(
                (p) => p.name === import.meta.env.VITE_PERMISSIONS_MANAGE_AI_CONFIG
            ),
            canViewLogs: effectivePermissions?.some(
                (p) => p.name === import.meta.env.VITE_PERMISSIONS_VIEW_LOGS
            ),


        }),
        [effectivePermissions]
    );

    const getCachedData = useCallback((key: string): CacheData["data"] | null => {
        const cached = cache.get(key);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.data;
        }
        return null;
    }, []);

    const setCachedData = useCallback((key: string, data: CacheData["data"]) => {
        cache.set(key, { data, timestamp: Date.now() });
    }, []);

    // Real-time update handlers
    const handleRefreshUsers = useCallback(async () => {
        if (!userPermissions.canViewUsers) return;
        cache.delete("all_users");
        try {
            setUsersLoading(true);
            const usersData = await getAllUsers();
            setUsers(usersData);
            setCachedData("all_users", usersData);
            setLocalError(null);
            clearError();
        } catch (err: unknown) {
            console.error("Failed to refresh users:", err);
            const errorMessage = t("adminDashboard.error.fetchFailed");
            setLocalError(errorMessage);
            setGlobalError(errorMessage);
        } finally {
            setUsersLoading(false);
        }
    }, [userPermissions.canViewUsers, setCachedData, t, setGlobalError, clearError]);

    const handleRefreshRoles = useCallback(async () => {
        if (!userPermissions.canViewRoles) return;
        cache.delete("all_roles");
        try {
            setRolesLoading(true);
            const rolesData = await getAllRoles();
            setRoles(rolesData);
            setCachedData("all_roles", rolesData);
            setLocalError(null);
            clearError();
        } catch (err: unknown) {
            console.error("Failed to refresh roles:", err);
            const errorMessage = t("adminDashboard.error.fetchFailed");
            setLocalError(errorMessage);
            setGlobalError(errorMessage);
        } finally {
            setRolesLoading(false);
        }
    }, [userPermissions.canViewRoles, setCachedData, t, setGlobalError, clearError]);

    const handleRefreshPermissions = useCallback(async () => {
        if (!userPermissions.canViewPermissions) return;
        cache.delete("all_permissions");
        try {
            setPermissionsLoading(true);
            const permissionsData = await getAllPermissions();
            setPermissionsList(permissionsData);
            setCachedData("all_permissions", permissionsData);
            setLocalError(null);
            clearError();
        } catch (err: unknown) {
            console.error("Failed to refresh permissions:", err);
            const errorMessage = t("adminDashboard.error.fetchFailed");
            setLocalError(errorMessage);
            setGlobalError(errorMessage);
        } finally {
            setPermissionsLoading(false);
        }
    }, [userPermissions.canViewPermissions, setCachedData, t, setGlobalError, clearError]);

    const handleRefreshChecklists = useCallback(async () => {
        if (!userPermissions.canViewChecklists) return;
        cache.delete("all_checklists");
        try {
            setChecklistsLoading(true);
            const checklistsData = await getAllChecklists();
            setTotalChecklists(checklistsData.length); // Set total items
            const startIndex = (checklistsPage - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const paginatedChecklists = checklistsData.slice(startIndex, endIndex);
            setChecklists(paginatedChecklists);
            setCachedData("all_checklists", checklistsData);
            setLocalError(null);
            clearError();
        } catch (err: unknown) {
            console.error("Failed to refresh checklists:", err);
            const errorMessage = t("adminDashboard.error.fetchFailed");
            setLocalError(errorMessage);
            setGlobalError(errorMessage);
        } finally {
            setChecklistsLoading(false);
        }
    }, [userPermissions.canViewChecklists, checklistsPage, setCachedData, t, setGlobalError, clearError]);

    const handleRefreshReasons = useCallback(async () => {
        if (!userPermissions.canViewReasons) return;
        cache.delete("all_reasons");
        try {
            setReasonsLoading(true);
            const reasonsData = await getAllReasons();
            setTotalReasons(reasonsData.length); // Set total items
            const startIndex = (reasonsPage - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const paginatedReasons = reasonsData.slice(startIndex, endIndex);
            setReasons(paginatedReasons);
            setCachedData("all_reasons", reasonsData);
            setLocalError(null);
            clearError();
        } catch (err: unknown) {
            console.error("Failed to refresh reasons:", err);
            const errorMessage = t("adminDashboard.error.fetchFailed");
            setLocalError(errorMessage);
            setGlobalError(errorMessage);
        } finally {
            setReasonsLoading(false);
        }
    }, [userPermissions.canViewReasons, reasonsPage, setCachedData, t, setGlobalError, clearError]);
    const handleRefreshAgents = useCallback(async () => {
        if (!userPermissions.canViewAgents) return;
        cache.delete("all_agents");
        try {
            setAgentsLoading(true);
            const agentsResponse = await getAllAgents();
            setAgents(agentsResponse.agents);
            setCachedData("all_agents", agentsResponse.agents);
            setLocalError(null);
            clearError();
        } catch (err: unknown) {
            console.error("Failed to refresh agents:", err);
            const errorMessage = t("adminDashboard.error.fetchFailed");
            setLocalError(errorMessage);
            setGlobalError(errorMessage);
        } finally {
            setAgentsLoading(false);
        }
    }, [userPermissions.canViewAgents, setCachedData, t, setGlobalError, clearError]);

    const handleRefreshNotifications = useCallback(async () => {
        if (!userPermissions.canViewNotificationRules) return;
        cache.delete("all_notification_rules");
        cache.delete("notification_types");
        try {
            setNotificationsLoading(true);
            const rulesData = await getNotificationRules();
            setNotificationRules(rulesData);
            setCachedData("all_notification_rules", rulesData);
            const typesData = await getNotificationTypes();
            setNotificationTypes(typesData);
            setCachedData("notification_types", typesData);
            setLocalError(null);
            clearError();
        } catch (err: unknown) {
            console.error("Failed to refresh notifications:", err);
            const errorMessage = t("adminDashboard.error.fetchFailed");
            setLocalError(errorMessage);
            setGlobalError(errorMessage);
        } finally {
            setNotificationsLoading(false);
        }
    }, [userPermissions.canViewNotificationRules, setCachedData, t, setGlobalError, clearError]);

    const handleRefreshAIConfigs = useCallback(async () => {
        if (!userPermissions.canManageAIConfigs) return;
        cache.delete("all_ai_configs");
        try {
            setAIConfigsLoading(true);
            const configsData = await listAIConfigs({});
            setAIConfigs(configsData);
            setCachedData("all_ai_configs", configsData);
            setLocalError(null);
            clearError();
        } catch (err: unknown) {
            console.error("Failed to refresh AI configs:", err);
            const errorMessage = t("adminDashboard.error.fetchFailed");
            setLocalError(errorMessage);
            setGlobalError(errorMessage);
        } finally {
            setAIConfigsLoading(false);
        }
    }, [userPermissions.canManageAIConfigs, setCachedData, t, setGlobalError, clearError]);

    const handleRefreshLogs = useCallback(async () => {
        try {
            setLogsLoading(true);
            const params = {
                page: logsPage,
                pageSize: ITEMS_PER_PAGE,
                search: searchQuery,
                sortBy: logSortField,
                sortOrder: logSortOrder,
                ...logFilters,
                status: logFilters.status ? Number(logFilters.status) : undefined,
            };
            const response = await getLogs(params);
            setLogs(response.data);
            setTotalLogs(response.total);
            setLocalError(null);
            clearError();
        } catch (err: unknown) {
            console.error('Failed to refresh logs:', err);
            const errorMessage = t('adminDashboard.error.fetchFailed');
            setLocalError(errorMessage);
            setGlobalError(errorMessage);
        } finally {
            setLogsLoading(false);
        }
    }, [logsPage, searchQuery, logSortField, logSortOrder, logFilters, t, setGlobalError, clearError]);

    const handleResetConfirm = async () => {
        if (isResetting) return; // Prevent multiple resets
        setIsResetting(true);
        try {
            setResetLoading(true);
            await resetMainRoles();
            const updatedRoles = await getAllRoles();
            setCachedData("all_roles", updatedRoles);
            setRoles(updatedRoles);
            setLocalError(null);
            clearError();
        } catch (err: unknown) {
            console.error("Failed to reset main roles:", err);
            const errorMessage = t("adminDashboard.error.resetRolesFailed");
            setLocalError(errorMessage);
            setGlobalError(errorMessage);
        } finally {
            setResetLoading(false);
            setIsResetting(false);
            setConfirmation(null);
        }
    };

    const debouncedShowResetConfirmation = useCallback(
        debounce(() => {
            if (isResetting || resetLoading) return; // Prevent modal if resetting
            setConfirmation({
                isOpen: true,
                message: t("adminDashboard.actions.resetRolesConfirm"),
                onConfirm: () => {
                    debouncedShowResetConfirmation.cancel();
                    handleResetConfirm();
                },
                onCancel: () => {
                    debouncedShowResetConfirmation.cancel();
                    setConfirmation(null);
                },
            });
        }, 300),
        [handleResetConfirm, t, isResetting, resetLoading]
    );

    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            debouncedShowResetConfirmation.cancel();
        };
    }, [debouncedShowResetConfirmation]);



    // Cleanup debounce on component unmount
    useEffect(() => {
        return () => {
            debouncedShowResetConfirmation.cancel();
        };
    }, [debouncedShowResetConfirmation]);

    // WebSocket setup for real-time updates
    const setupWebSocket = useCallback(() => {
        if (!isSocketConnected()) initSocket();

        const handleEntityEvent = async (event: string, data: unknown) => {
            console.log(`Received entity event: ${event}`, { data });
            const entity = event.split(':')[0];
            const action = event.split(':')[1];

            // Handle user events
            if (entity === 'user') {
                if (!userPermissions.canViewUsers) return;
                if (action === 'created' || action === 'updated' || action === 'deleted') {
                    await handleRefreshUsers();
                }
            }
            // Handle role events
            else if (entity === 'role') {
                if (!userPermissions.canViewRoles) return;
                if (action === 'created' || action === 'updated' || action === 'deleted') {
                    await handleRefreshRoles();
                } else if (action === 'assigned' || action === 'revoked') {
                    console.warn(`Invalid data for ${event}:`, data);
                    await handleRefreshUsers();
                    const updatedUser = data as User;
                    setUsers((prev) =>
                        prev.map((user) =>
                            user.userID === updatedUser.userID
                                ? { ...user, Roles: updatedUser.Roles || [] }
                                : user
                        )
                    );
                    setRoles((prev) => {
                        return prev;
                    });
                }
            }
            // Handle permission events
            else if (entity === 'permission') {
                if (!userPermissions.canViewPermissions) return;
                if (action === 'updated') {
                    await handleRefreshPermissions();
                }
            }
            // Handle checklist events
            else if (entity === 'checklist') {
                if (!userPermissions.canViewChecklists) return;
                if (action === 'created' || action === 'updated' || action === 'deleted') {
                    await handleRefreshChecklists();
                }
            }
            // Handle reason events
            else if (entity === 'reason') {
                if (!userPermissions.canViewReasons) return;
                if (action === 'created' || action === 'updated' || action === 'deleted') {
                    await handleRefreshReasons();
                }
            }
            // Handle agent events
            else if (entity === 'agent') {
                if (!userPermissions.canViewAgents) return;
                if (action === 'created' || action === 'updated' || action === 'deleted') {
                    await handleRefreshAgents();
                }
            }
            // Handle notification rule events
            else if (entity === 'notification') {
                if (!userPermissions.canViewNotificationRules) return;
                if (action === 'created' || action === 'updated' || action === 'read') {
                    await handleRefreshNotifications();
                }
            }

            // Handle log events
            else if (entity === 'log') {
                if (!userPermissions.canViewLogs) return;
                if (action === 'created' || action === 'deleted' || action === 'archived') {
                    await handleRefreshLogs();
                }
            }
        };

        onNotification(handleEntityEvent);

        // Join rooms based on view and permissions
        const joinEntityRooms = () => {
            if (userPermissions.canViewUsers) joinRoom('user');
            if (userPermissions.canViewRoles) joinRoom('role');
            if (userPermissions.canViewPermissions) joinRoom('permission');
            if (userPermissions.canViewChecklists) joinRoom('checklist');
            if (userPermissions.canViewReasons) joinRoom('reason');
            if (userPermissions.canViewAgents) joinRoom('agent');
            if (userPermissions.canViewNotificationRules) joinRoom('notification');
            if (userPermissions.canViewLogs) joinRoom('log');
        };

        joinEntityRooms();

        return () => {
            offNotification();
            disconnectSocket();
        };
    }, [
        userPermissions,
        handleRefreshUsers,
        handleRefreshRoles,
        handleRefreshPermissions,
        handleRefreshChecklists,
        handleRefreshReasons,
        handleRefreshAgents,
        handleRefreshNotifications,
    ]);

    useEffect(() => {
        const cleanup = setupWebSocket();
        return cleanup;
    }, [setupWebSocket]);

    const defaultSortConfig: Partial<Record<ViewMode, { sortField: SortField; sortOrder: SortOrder }>> = {
        users: { sortField: "role", sortOrder: "asc" },
        agents: { sortField: "date", sortOrder: "desc" },
        checklists: { sortField: "name", sortOrder: "asc" },
        reasons: { sortField: "name", sortOrder: "asc" },
        roles: { sortField: "name", sortOrder: "asc" },
        permissions: { sortField: "name", sortOrder: "asc" },
    };

    const handleViewChange = useCallback((newView: ViewMode) => {
        console.log("Changing view to:", newView);
        setView(newView);
        setSelectedUser(null);
        setSelectedRole(null);
        setSelectedPermission(null);
        setSelectedChecklist(null);
        setSelectedReason(null);
        setSelectedAgent(null);
        setSelectedNotificationRule(null);
        setSelectedAIConfig(null);


        if (newView === "users") setUsersPage(1);
        else if (newView === "checklists") setChecklistsPage(1);
        else if (newView === "reasons") setReasonsPage(1);
        else if (newView === "agents") setAgentsPage(1);
        else if (newView === "ai-configs") setAIConfigsPage(1);
        else if (newView === "logs") {
            setLogsPage(1);
            setLogSortField('timestamp');
            setLogSortOrder('desc');
        }

        const sortConfig = defaultSortConfig[newView];
        if (sortConfig) {
            setSortField(sortConfig.sortField);
            setSortOrder(sortConfig.sortOrder);
        }

        if (newView === "notifications") {
            setNotificationSortField("type");
            setNotificationSortOrder("asc");
        }

        if (newView === "ai-configs") {
            setNotificationSortField("modelName");
        }

        localStorage.setItem("adminView", newView);
        if (newView !== "user-details" && newView !== "agent-details") {
            localStorage.removeItem("selectedUserId");
            localStorage.removeItem("selectedAgentId");
        }
    }, []);

    const handleSetSelectedAgent = useCallback((agent: Agent | null) => {
        setSelectedAgent(agent);
        if (agent) {
            setView("agent-details");
            localStorage.setItem("selectedAgentId", agent.agentID);
        }
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (
                !userPermissions.canViewUsers &&
                !userPermissions.canViewRoles &&
                !userPermissions.canViewPermissions &&
                !userPermissions.canViewChecklists &&
                !userPermissions.canViewReasons &&
                !userPermissions.canViewAgents &&
                !userPermissions.canViewNotificationRules
            ) {
                const errorMessage = t("adminDashboard.error.noToken");
                setLocalError(errorMessage);
                setGlobalError(errorMessage);
                return;
            }

            try {
                if (view === "users" && userPermissions.canViewUsers) {
                    setUsersLoading(true);
                    let usersData = getCachedData("all_users");
                    if (!usersData) {
                        const timeout = setTimeout(() => {
                            if (!usersData) setUsers([]);
                        }, FALLBACK_TIMEOUT);
                        usersData = await getAllUsers();
                        clearTimeout(timeout);
                        setCachedData("all_users", usersData);
                    }
                    setUsers(usersData as User[]);
                    setRoleLoading(true);
                    let rolesData = getCachedData("all_roles");
                    if (!rolesData) {
                        rolesData = await getAllRoles();
                        setCachedData("all_roles", rolesData);
                    }
                    setRoles(rolesData as Role[]);
                    setRoleLoading(false);
                } else if (view === "roles" && userPermissions.canViewRoles) {
                    setRolesLoading(true);
                    let rolesData = getCachedData("all_roles");
                    if (!rolesData) {
                        rolesData = await getAllRoles();
                        setCachedData("all_roles", rolesData);
                    }
                    setRoles(rolesData as Role[]);
                } else if (view === "permissions" && userPermissions.canViewPermissions) {
                    setPermissionsLoading(true);
                    let permissionsData = getCachedData("all_permissions");
                    if (!permissionsData) {
                        permissionsData = await getAllPermissions();
                        setCachedData("all_permissions", permissionsData);
                    }
                    setPermissionsList(permissionsData as Permission[]);
                } else if (view === "checklists" && userPermissions.canViewChecklists) {
                    setChecklistsLoading(true);
                    let checklistsData = getCachedData("all_checklists");
                    if (!checklistsData) {
                        checklistsData = await getAllChecklists();
                        setCachedData("all_checklists", checklistsData);
                    }
                    setTotalChecklists((checklistsData as Checklist[]).length); // Set total items
                    const startIndex = (checklistsPage - 1) * ITEMS_PER_PAGE;
                    const endIndex = startIndex + ITEMS_PER_PAGE;
                    const paginatedChecklists = (checklistsData as Checklist[]).slice(startIndex, endIndex);
                    setChecklists(paginatedChecklists);
                } else if (view === "reasons" && userPermissions.canViewReasons) {
                    setReasonsLoading(true);
                    let reasonsData = getCachedData("all_reasons");
                    if (!reasonsData) {
                        reasonsData = await getAllReasons();
                        setCachedData("all_reasons", reasonsData);
                    }
                    setTotalReasons((reasonsData as Reason[]).length); // Set total items
                    const startIndex = (reasonsPage - 1) * ITEMS_PER_PAGE;
                    const endIndex = startIndex + ITEMS_PER_PAGE;
                    const paginatedReasons = (reasonsData as Reason[]).slice(startIndex, endIndex);
                    setReasons(paginatedReasons);
                } else if (view === "agents" && userPermissions.canViewAgents) {
                    setAgentsLoading(true);
                    let agentsData = getCachedData("all_agents");
                    if (!agentsData) {
                        const agentsResponse = await getAllAgents();
                        agentsData = agentsResponse.agents;
                        setCachedData("all_agents", agentsData);
                    }
                    setAgents(agentsData as Agent[]);
                } else if (view === "notifications" && userPermissions.canViewNotificationRules) {
                    setNotificationsLoading(true);
                    let rulesData = getCachedData("all_notification_rules");
                    if (!rulesData) {
                        rulesData = await getNotificationRules();
                        setCachedData("all_notification_rules", rulesData);
                    }
                    setNotificationRules(rulesData as NotificationRule[]);
                    let typesData = getCachedData("notification_types");
                    if (!typesData) {
                        typesData = await getNotificationTypes();
                        setCachedData("notification_types", typesData);
                    }
                    setNotificationTypes(typesData as string[]);
                } else if (view === "ai-configs" && userPermissions.canManageAIConfigs) {
                    setAIConfigsLoading(true);
                    let configsData = getCachedData("all_ai_configs");
                    if (!configsData) {
                        const timeout = setTimeout(() => {
                            if (!configsData) setAIConfigs([]);
                        }, FALLBACK_TIMEOUT);
                        configsData = await listAIConfigs({});
                        clearTimeout(timeout);
                        setCachedData("all_ai_configs", configsData);
                    }
                    setAIConfigs(configsData as AIConfig[]);
                } else if (view === "logs") {
                    setLogsLoading(true);
                    const params = {
                        page: logsPage,
                        pageSize: ITEMS_PER_PAGE,
                        search: searchQuery,
                        sortBy: logSortField,
                        sortOrder: logSortOrder,
                    };
                    const response = await getLogs(params);
                    setLogs(response.data);
                    setTotalLogs(response.total);
                    setLocalError(null);
                    clearError();
                }
                clearError();
            } catch (err: unknown) {
                console.error("Failed to fetch data:", err);
                const errorMessage = t("adminDashboard.error.fetchFailed");
                setLocalError(errorMessage);
                setGlobalError(errorMessage);
            } finally {
                setUsersLoading(false);
                setRolesLoading(false);
                setPermissionsLoading(false);
                setChecklistsLoading(false);
                setReasonsLoading(false);
                setAgentsLoading(false);
                setNotificationsLoading(false);
                setRoleLoading(false);
                setAIConfigsLoading(false);
                setLogsLoading(false);
            }
        };

        fetchData();
    }, [
        view,
        usersPage,
        checklistsPage,
        reasonsPage,
        agentsPage,
        userPermissions,
        aiConfigsPage,
        logsPage,
        searchQuery,
        logSortField,
        logSortOrder,
        t,
        setGlobalError,
        clearError,
        getCachedData,
        setCachedData,
    ]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                setLocalError(null);
                clearError();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [error, clearError]);

    const roleOptions = useMemo(
        () => [
            { value: "No Roles", label: t("adminDashboard.sidebar.noRoles") },
            ...roles.map((role) => ({
                value: role.name,
                label: role.name,
            })),
        ],
        [roles, t]
    );

    const governorateOptions = useMemo(() => {
        const governorates = Array.from(
            new Set(agents.map((agent) => agent.Delegation?.Governorate?.name).filter(Boolean))
        ).sort();
        return [
            { value: "all", label: t("adminDashboard.sidebar.allGovernorates") },
            ...governorates.map((gov) => ({ value: gov, label: gov })),
        ];
    }, [agents, t]);

    const delegationOptions = useMemo(() => {
        const delegations = Array.from(
            new Set(
                agents
                    .filter(
                        (agent) =>
                            !governorateFilter ||
                            governorateFilter === "all" ||
                            agent.Delegation?.Governorate?.name === governorateFilter
                    )
                    .map((agent) => agent.Delegation?.name)
                    .filter(Boolean)
            )
        ).sort();
        return [
            { value: "all", label: t("adminDashboard.sidebar.allDelegations") },
            ...delegations.map((del) => ({ value: del, label: del })),
        ];
    }, [agents, governorateFilter, t]);

    const ConfirmationModal: React.FC<{
        message: string;
        onConfirm: () => void;
        onCancel: () => void;
    }> = ({ message, onConfirm, onCancel }) => {
        const { t } = useTranslation();
        const [isFadingOut, setIsFadingOut] = useState(false);

        const handleConfirm = () => {
            setIsFadingOut(true);
            setTimeout(() => {
                setIsFadingOut(false);
                onConfirm();
            }, 300); // Match animation duration
        };

        const handleCancel = () => {
            setIsFadingOut(true);
            setTimeout(() => {
                setIsFadingOut(false);
                onCancel();
            }, 300);
        };

        return (
            <motion.div
                className={`confirmation-modal-overlay ${isFadingOut ? "fade-out" : "fade-in"}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: isFadingOut ? 0 : 1 }}
                transition={{ duration: 0.3 }}
            >
                <div className="confirmation-modal">
                    <p>{message}</p>
                    <div className="confirmation-actions">
                        <button className="confirm-button" onClick={handleConfirm}>
                            {t("adminDashboard.actions.confirm")}
                        </button>
                        <button className="cancel-button" onClick={handleCancel}>
                            {t("adminDashboard.actions.cancel")}
                        </button>
                    </div>
                </div>
            </motion.div>
        );
    };

    return (
        <div className="admin-dashboard" role="main">
            {confirmation && (
                <ConfirmationModal
                    key="central-confirmation"
                    message={confirmation.message}
                    onConfirm={confirmation.onConfirm}
                    onCancel={confirmation.onCancel}
                />
            )}
            <header className="dashboard-header">
                <h1 id="dashboard-title">
                    {view === "users" && t("adminDashboard.header.users")}
                    {view === "roles" && t("adminDashboard.header.roles")}
                    {view === "permissions" && t("adminDashboard.header.permissions")}
                    {view === "add-user" && t("adminDashboard.header.addUser")}
                    {view === "add-role" && t("adminDashboard.header.addRole")}
                    {view === "add-permission" && t("adminDashboard.header.addPermission")}
                    {view === "user-details" &&
                        selectedUser &&
                        t("adminDashboard.header.userDetails", {
                            firstName: selectedUser.firstname,
                            lastName: selectedUser.lastname,
                        })}
                    {view === "checklists" && t("adminDashboard.header.checklists")}
                    {view === "add-checklist" && t("adminDashboard.header.addChecklist")}
                    {view === "checklist-details" &&
                        selectedChecklist &&
                        t("adminDashboard.header.checklistDetails", {
                            item: selectedChecklist.item,
                        })}
                    {view === "reasons" && t("adminDashboard.header.reasons")}
                    {view === "add-reason" && t("adminDashboard.header.addReason")}
                    {view === "reason-details" &&
                        selectedReason &&
                        t("adminDashboard.header.reasonDetails", {
                            item: selectedReason.item,
                        })}
                    {view === "agents" && t("adminDashboard.header.agents")}
                    {view === "add-agent" && t("adminDashboard.header.addAgent")}
                    {view === "agent-details" &&
                        selectedAgent &&
                        t("adminDashboard.header.agentDetails", {
                            name: `${selectedAgent.name} ${selectedAgent.lastname}`,
                        })}
                    {view === "notifications" && t("adminDashboard.header.notifications")}
                    {view === "add-notification-rule" && t("adminDashboard.header.addNotificationRule")}
                    {view === "notification-rule-details" &&
                        selectedNotificationRule &&
                        t("adminDashboard.header.notificationRuleDetails", {
                            event: selectedNotificationRule.event,
                        })}
                    {view === "ai-configs" && t("adminDashboard.header.aiConfigs")}
                    {view === "add-ai-config" && t("adminDashboard.header.addAIConfig")}
                    {view === "ai-config-details" &&
                        selectedAIConfig &&
                        t("adminDashboard.header.aiConfigDetails", {
                            modelName: selectedAIConfig.modelName,
                        })}
                    {view === "logs" && t("adminDashboard.header.logs")}

                </h1>
                {(view === "users" ||
                    view === "roles" ||
                    view === "permissions" ||
                    view === "checklists" ||
                    view === "reasons" ||
                    view === "agents" ||
                    view === "notifications" ||
                    view === "ai-configs" ||
                    view === "logs"
                ) && (
                        <div className="search-container">
                            <FaSearch className="search-icon" aria-hidden="true" />
                            <input
                                type="text"
                                placeholder={t("adminDashboard.search.placeholder", { view })}
                                value={inputValue}
                                onChange={(e) => {
                                    setInputValue(e.target.value);
                                    debouncedSetSearchQuery(e.target.value);
                                }}
                                className="search-input input-0"
                                aria-label={t("adminDashboard.search.placeholder", { view })}
                            />
                        </div>
                    )}
                {(view === "add-user" ||
                    view === "add-role" ||
                    view === "add-permission" ||
                    view === "user-details" ||
                    view === "add-checklist" ||
                    view === "checklist-details" ||
                    view === "add-reason" ||
                    view === "reason-details" ||
                    view === "add-agent" ||
                    view === "agent-details" ||
                    view === "add-notification-rule" ||
                    view === "notification-rule-details" ||
                    view === "add-ai-config" ||
                    view === "ai-config-details"
                ) && (
                        <motion.button
                            className="back-button"
                            onClick={() =>
                                handleViewChange(
                                    view.includes("user")
                                        ? "users"
                                        : view.includes("role") && !view.includes("notification")
                                            ? "roles"
                                            : view.includes("permission")
                                                ? "permissions"
                                                : view.includes("checklist")
                                                    ? "checklists"
                                                    : view.includes("reason")
                                                        ? "reasons"
                                                        : view.includes("agent")
                                                            ? "agents"
                                                            : view.includes("notification")
                                                                ? "notifications"
                                                                : "ai-configs"
                                )
                            }
                            aria-label={t("adminDashboard.actions.back")}
                        >
                            <FaArrowLeft aria-hidden="true" />{" "}
                            {t("adminDashboard.actions.back")}
                        </motion.button>
                    )}
            </header>
            <section className="dashboard-content">
                <aside className="sidebar" role="navigation">
                    <div className="filter-card">
                        <h3>{t("adminDashboard.sidebar.view")}</h3>
                        <div className="view-category">
                            <h4>{t("adminDashboard.sidebar.management")}</h4>
                            {userPermissions.canViewUsers && (
                                <button
                                    className={
                                        view === "users" || view === "add-user" || view === "user-details"
                                            ? "active"
                                            : ""
                                    }
                                    onClick={() => handleViewChange("users")}
                                    aria-current={view === "users" ? "page" : undefined}
                                >
                                    {t("adminDashboard.sidebar.users")}
                                </button>
                            )}
                            {userPermissions.canViewRoles && (
                                <button
                                    className={
                                        view === "roles" || view === "add-role" ? "active" : ""
                                    }
                                    onClick={() => handleViewChange("roles")}
                                    aria-current={view === "roles" ? "page" : undefined}
                                >
                                    {t("adminDashboard.sidebar.roles")}
                                </button>
                            )}
                            {userPermissions.canViewPermissions && (
                                <button
                                    className={
                                        view === "permissions" || view === "add-permission" ? "active" : ""
                                    }
                                    onClick={() => handleViewChange("permissions")}
                                    aria-current={view === "permissions" ? "page" : undefined}
                                >
                                    {t("adminDashboard.sidebar.permissions")}
                                </button>
                            )}

                        </div>
                        <div className="view-category">
                            <h4>{t("adminDashboard.sidebar.data")}</h4>
                            {userPermissions.canViewChecklists && (
                                <button
                                    className={
                                        view === "checklists" ||
                                            view === "add-checklist" ||
                                            view === "checklist-details"
                                            ? "active"
                                            : ""
                                    }
                                    onClick={() => handleViewChange("checklists")}
                                    aria-current={view === "checklists" ? "page" : undefined}
                                >
                                    {t("adminDashboard.sidebar.checklists")}
                                </button>
                            )}
                            {userPermissions.canViewReasons && (
                                <button
                                    className={
                                        view === "reasons" || view === "add-reason" || view === "reason-details"
                                            ? "active"
                                            : ""
                                    }
                                    onClick={() => handleViewChange("reasons")}
                                    aria-current={view === "reasons" ? "page" : undefined}
                                >
                                    {t("adminDashboard.sidebar.reasons")}
                                </button>
                            )}
                            {userPermissions.canViewAgents && (
                                <button
                                    className={
                                        view === "agents" || view === "add-agent" || view === "agent-details"
                                            ? "active"
                                            : ""
                                    }
                                    onClick={() => handleViewChange("agents")}
                                    aria-current={view === "agents" ? "page" : undefined}
                                >
                                    {t("adminDashboard.sidebar.agents")}
                                </button>
                            )}
                        </div>
                        <div className="view-category">
                            <h4>{t("adminDashboard.sidebar.system")}</h4>
                            {userPermissions.canViewNotificationRules && (
                                <button
                                    className={
                                        view === "notifications" ||
                                            view === "add-notification-rule" ||
                                            view === "notification-rule-details"
                                            ? "active"
                                            : ""
                                    }
                                    onClick={() => handleViewChange("notifications")}
                                    aria-current={view === "notifications" ? "page" : undefined}
                                >
                                    {t("adminDashboard.sidebar.notifications")}
                                </button>
                            )}
                            {userPermissions.canManageAIConfigs && (
                                <button
                                    className={
                                        view === "ai-configs" || view === "add-ai-config" || view === "ai-config-details"
                                            ? "active"
                                            : ""
                                    }
                                    onClick={() => handleViewChange("ai-configs")}
                                    aria-current={view === "ai-configs" ? "page" : undefined}
                                >
                                    {t("adminDashboard.sidebar.aiConfigs")}
                                </button>
                            )}
                            <button
                                className={view === "logs" ? "active" : ""}
                                onClick={() => handleViewChange("logs")}
                                aria-current={view === "logs" ? "page" : undefined}
                            >
                                {t("adminDashboard.sidebar.logs")}
                            </button>
                        </div>
                    </div>
                    {userPermissions.canViewUsers && view === "users" && (
                        <>
                            <div className="sort-card">
                                <h3>{t("adminDashboard.sidebar.sortUsersBy")}</h3>
                                <select
                                    value={sortField}
                                    onChange={(e) => setSortField(e.target.value as SortField)}
                                    aria-label={t("adminDashboard.sidebar.sortUsersBy")}
                                >
                                    <option value="name">{t("adminDashboard.sidebar.sortOptions.name")}</option>
                                    <option value="email">{t("adminDashboard.sidebar.sortOptions.email")}</option>
                                    <option value="role">{t("adminDashboard.sidebar.sortOptions.role")}</option>
                                </select>
                                <motion.button
                                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                                    aria-label={t("adminDashboard.sidebar.sortOrder", {
                                        order: sortOrder === "asc" ? t("adminDashboard.sidebar.sortOrder.asc") : t("adminDashboard.sidebar.sortOrder.desc"),
                                    })}
                                >
                                    <FaSort aria-hidden="true" />{" "}
                                    {sortOrder === "asc" ? t("adminDashboard.sidebar.sortOrder.asc") : t("adminDashboard.sidebar.sortOrder.desc")}
                                </motion.button>
                            </div>
                            <div className="role-filter-card">
                                <h3>{t("adminDashboard.sidebar.filterByRole")}</h3>
                                <Select
                                    isMulti
                                    options={roleOptions}
                                    value={roleOptions.filter((option) => roleFilter.includes(option.value))}
                                    onChange={(selectedOptions) =>
                                        setRoleFilter(selectedOptions ? selectedOptions.map((option) => option.value) : [])
                                    }
                                    placeholder={t("adminDashboard.sidebar.allRoles")}
                                    isDisabled={roleLoading || roles.length === 0}
                                    aria-label={t("adminDashboard.sidebar.filterByRole")}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                />
                            </div>
                            <motion.button
                                className="action-button"
                                onClick={handleRefreshUsers}
                                disabled={usersLoading}
                                aria-label={usersLoading ? t("adminDashboard.actions.loading") : t("adminDashboard.actions.refreshUsers")}
                            >
                                <FaRedo aria-hidden="true" /> {usersLoading ? t("adminDashboard.actions.loading") : t("adminDashboard.actions.refreshUsers")}
                            </motion.button>
                        </>
                    )}
                    {userPermissions.canViewRoles && view === "roles" && (
                        <>
                            <motion.button
                                className="action-button"
                                onClick={handleRefreshRoles}
                                disabled={rolesLoading}
                                aria-label={rolesLoading ? t("adminDashboard.actions.loading") : t("adminDashboard.actions.refreshRoles")}
                            >
                                <FaRedo aria-hidden="true" /> {rolesLoading ? t("adminDashboard.actions.loading") : t("adminDashboard.actions.refreshRoles")}
                            </motion.button>
                        </>
                    )}
                    {userPermissions.canViewPermissions && view === "permissions" && (
                        <>
                            <motion.button
                                className="action-button"
                                onClick={handleRefreshPermissions}
                                disabled={permissionsLoading}
                                aria-label={permissionsLoading ? t("adminDashboard.actions.loading") : t("adminDashboard.actions.refreshPermissions")}
                            >
                                <FaRedo aria-hidden="true" /> {permissionsLoading ? t("adminDashboard.actions.loading") : t("adminDashboard.actions.refreshPermissions")}
                            </motion.button>
                        </>
                    )}
                    {userPermissions.canViewChecklists && view === "checklists" && (
                        <>
                            <motion.button
                                className="action-button"
                                onClick={handleRefreshChecklists}
                                disabled={checklistsLoading}
                                aria-label={checklistsLoading ? t("adminDashboard.actions.loading") : t("adminDashboard.actions.refreshChecklists")}
                            >
                                <FaRedo aria-hidden="true" /> {checklistsLoading ? t("adminDashboard.actions.loading") : t("adminDashboard.actions.refreshChecklists")}
                            </motion.button>
                        </>
                    )}
                    {userPermissions.canViewReasons && view === "reasons" && (
                        <>
                            <motion.button
                                className="action-button"
                                onClick={handleRefreshReasons}
                                disabled={reasonsLoading}
                                aria-label={reasonsLoading ? t("adminDashboard.actions.loading") : t("adminDashboard.actions.refreshReasons")}
                            >
                                <FaRedo aria-hidden="true" /> {reasonsLoading ? t("adminDashboard.actions.loading") : t("adminDashboard.actions.refreshReasons")}
                            </motion.button>
                        </>
                    )}
                    {userPermissions.canViewAgents && (view === "agents" || view === "agent-details") && (
                        <>
                            <div className="sort-card">
                                <h3>{t("adminDashboard.sidebar.sortAgentsBy")}</h3>
                                <select
                                    value={sortField}
                                    onChange={(e) => setSortField(e.target.value as SortField)}
                                    aria-label={t("adminDashboard.sidebar.sortAgentsBy")}
                                >
                                    <option value="name">{t("adminDashboard.sidebar.sortOptions.name")}</option>
                                    <option value="lastname">{t("adminDashboard.sidebar.sortOptions.lastname")}</option>
                                    <option value="email">{t("adminDashboard.sidebar.sortOptions.email")}</option>
                                    <option value="phone">{t("adminDashboard.sidebar.sortOptions.phone")}</option>
                                    <option value="supervisor">{t("adminDashboard.sidebar.sortOptions.supervisor")}</option>
                                    <option value="location">{t("adminDashboard.sidebar.sortOptions.location")}</option>
                                    <option value="date">{t("adminDashboard.sidebar.sortOptions.date")}</option>
                                </select>
                                <motion.button
                                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                                    aria-label={t("adminDashboard.sidebar.sortOrder", {
                                        order: sortOrder === "asc" ? t("adminDashboard.sidebar.sortOrder.asc") : t("adminDashboard.sidebar.sortOrder.desc"),
                                    })}
                                >
                                    <FaSort aria-hidden="true" />{" "}
                                    {sortOrder === "asc" ? t("adminDashboard.sidebar.sortOrder.asc") : t("adminDashboard.sidebar.sortOrder.desc")}
                                </motion.button>
                            </div>
                            <div className="filter-card">
                                <h3>{t("adminDashboard.sidebar.filterAgents")}</h3>
                                <select
                                    value={governorateFilter}
                                    onChange={(e) => {
                                        setGovernorateFilter(e.target.value);
                                        setDelegationFilter("all");
                                    }}
                                    aria-label={t("adminDashboard.sidebar.filterByGovernorate")}
                                >
                                    {governorateOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    style={{ marginTop: "0.5rem" }}
                                    value={delegationFilter}
                                    onChange={(e) => setDelegationFilter(e.target.value)}
                                    disabled={governorateFilter === "all"}
                                    aria-label={t("adminDashboard.sidebar.filterByDelegation")}
                                >
                                    {delegationOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <motion.button
                                className="action-button"
                                onClick={handleRefreshAgents}
                                disabled={agentsLoading}
                                aria-label={agentsLoading ? t("adminDashboard.actions.loading") : t("adminDashboard.actions.refreshAgents")}
                            >
                                <FaRedo aria-hidden="true" /> {agentsLoading ? t("adminDashboard.actions.loading") : t("adminDashboard.actions.refreshAgents")}
                            </motion.button>
                            {userPermissions.canCreateAgents && (
                                <>
                                    <motion.button
                                        className="action-button"
                                        onClick={() => handleViewChange("add-agent")}
                                        aria-label={t("adminDashboard.sidebar.addAgent")}
                                    >
                                        <FaPlus aria-hidden="true" />{" "}
                                        {t("adminDashboard.sidebar.addAgent")}
                                    </motion.button>
                                    <motion.button
                                        className="action-button"
                                        onClick={() => setIsBulkUploadModalOpen(true)}
                                        aria-label={t("adminDashboard.sidebar.importAgents")}
                                    >
                                        <FaUpload aria-hidden="true" />{" "}
                                        {t("adminDashboard.sidebar.importAgents")}
                                    </motion.button>
                                </>
                            )}
                        </>
                    )}
                    {userPermissions.canViewNotificationRules && view === "notifications" && (
                        <>
                            <div className="sort-card">
                                <h3>{t("adminDashboard.sidebar.sortNotificationsBy")}</h3>
                                <select
                                    value={notificationSortField}
                                    onChange={(e) => setNotificationSortField(e.target.value)}
                                    aria-label={t("adminDashboard.sidebar.sortNotificationsBy")}
                                >
                                    <option value="event">{t("adminDashboard.sidebar.sortOptions.event")}</option>
                                    <option value="type">{t("adminDashboard.sidebar.sortOptions.type")}</option>
                                    <option value="enabled">{t("adminDashboard.sidebar.sortOptions.status")}</option>
                                </select>
                                <motion.button
                                    onClick={() => setNotificationSortOrder(notificationSortOrder === "asc" ? "desc" : "asc")}
                                    aria-label={t("adminDashboard.sidebar.sortOrder", {
                                        order: notificationSortOrder === "asc" ? t("adminDashboard.sidebar.sortOrder.asc") : t("adminDashboard.sidebar.sortOrder.desc"),
                                    })}
                                >
                                    <FaSort aria-hidden="true" />{" "}
                                    {notificationSortOrder === "asc" ? t("adminDashboard.sidebar.sortOrder.asc") : t("adminDashboard.sidebar.sortOrder.desc")}
                                </motion.button>
                            </div>
                            <div className="filter-card">
                                <h3>{t("adminDashboard.sidebar.filterNotifications")}</h3>
                                <select
                                    value={notificationTypeFilter}
                                    onChange={(e) => setNotificationTypeFilter(e.target.value)}
                                    aria-label={t("adminDashboard.sidebar.filterByNotificationType")}
                                >
                                    <option value="all">{t("adminDashboard.sidebar.allTypes")}</option>
                                    {notificationTypes.map((type) => (
                                        <option key={type} value={type}>
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    style={{ marginTop: "0.5rem" }}
                                    value={notificationChannelFilter}
                                    onChange={(e) => setNotificationChannelFilter(e.target.value)}
                                    aria-label={t("adminDashboard.sidebar.filterByNotificationChannel")}
                                >
                                    <option value="all">{t("adminDashboard.sidebar.allChannels")}</option>
                                    <option value="websocket">{t("adminDashboard.sidebar.websocket")}</option>
                                    <option value="email">{t("adminDashboard.sidebar.email")}</option>
                                    <option value="sms">{t("adminDashboard.sidebar.sms")}</option>
                                    <option value="inApp">{t("adminDashboard.sidebar.inApp")}</option>
                                </select>
                                <select
                                    style={{ marginTop: "0.5rem" }}
                                    value={notificationStatusFilter}
                                    onChange={(e) => setNotificationStatusFilter(e.target.value)}
                                    aria-label={t("adminDashboard.sidebar.filterByNotificationStatus")}
                                >
                                    <option value="all">{t("adminDashboard.sidebar.allStatuses")}</option>
                                    <option value="enabled">{t("adminDashboard.sidebar.enabled")}</option>
                                    <option value="disabled">{t("adminDashboard.sidebar.disabled")}</option>
                                </select>
                            </div>
                            <motion.button
                                className="action-button"
                                onClick={handleRefreshNotifications}
                                disabled={notificationsLoading}
                                aria-label={notificationsLoading ? t("adminDashboard.actions.loading") : t("adminDashboard.actions.refreshNotifications")}
                            >
                                <FaRedo aria-hidden="true" /> {notificationsLoading ? t("adminDashboard.actions.loading") : t("adminDashboard.actions.refreshNotifications")}
                            </motion.button>
                        </>
                    )}
                    {userPermissions.canCreateUsers && (view === "users" || view === "add-user" || view === "user-details") && (
                        <motion.button
                            className="action-button"
                            onClick={() => handleViewChange("add-user")}
                            aria-label={t("adminDashboard.sidebar.addUser")}
                        >
                            <FaUserPlus aria-hidden="true" />{" "}
                            {t("adminDashboard.sidebar.addUser")}
                        </motion.button>
                    )}
                    {userPermissions.canViewRoles && view === "roles" && (
                        <>
                            {userPermissions.canCreateRoles && (
                                <motion.button
                                    className="action-button"
                                    onClick={() => handleViewChange("add-role")}
                                    aria-label={t("adminDashboard.sidebar.addRole")}
                                >
                                    <FaPlus aria-hidden="true" />{" "}
                                    {t("adminDashboard.sidebar.addRole")}
                                </motion.button>
                            )}
                            {userPermissions.canResetRoles && (
                                <motion.button
                                    className="action-button reset-button"
                                    onClick={debouncedShowResetConfirmation}
                                    disabled={resetLoading}
                                    aria-label={resetLoading ? t("adminDashboard.sidebar.resetting") : t("adminDashboard.sidebar.resetRoles")}
                                >
                                    {resetLoading ? t("adminDashboard.sidebar.resetting") : t("adminDashboard.sidebar.resetRoles")}
                                </motion.button>
                            )}
                        </>
                    )}
                    {userPermissions.canViewChecklists && view === "checklists" && userPermissions.canCreateChecklists && (
                        <motion.button
                            className="action-button"
                            onClick={() => handleViewChange("add-checklist")}
                            aria-label={t("adminDashboard.sidebar.addChecklist")}
                        >
                            <FaPlus aria-hidden="true" />{" "}
                            {t("adminDashboard.sidebar.addChecklist")}
                        </motion.button>
                    )}
                    {userPermissions.canViewReasons && view === "reasons" && userPermissions.canCreateReasons && (
                        <motion.button
                            className="action-button"
                            onClick={() => handleViewChange("add-reason")}
                            aria-label={t("adminDashboard.sidebar.addReason")}
                        >
                            <FaPlus aria-hidden="true" />{" "}
                            {t("adminDashboard.sidebar.addReason")}
                        </motion.button>
                    )}
                    {userPermissions.canViewNotificationRules && view === "notifications" && userPermissions.canManageNotificationRules && (
                        <motion.button
                            className="action-button"
                            onClick={() => handleViewChange("add-notification-rule")}
                            aria-label={t("adminDashboard.sidebar.addNotificationRule")}
                        >
                            <FaPlus aria-hidden="true" /> {t("adminDashboard.sidebar.addNotificationRule")}
                        </motion.button>
                    )}
                    {userPermissions.canManageAIConfigs && view === "ai-configs" && (
                        <>
                            <div className="sort-card">
                                <h3>{t("adminDashboard.sidebar.sortAIConfigsBy")}</h3>
                                <select
                                    value={sortField}
                                    onChange={(e) => setSortField(e.target.value as SortField)}
                                    aria-label={t("adminDashboard.sidebar.sortAIConfigsBy")}
                                >
                                    <option value="modelName">{t("adminDashboard.sidebar.sortOptions.modelName")}</option>
                                </select>
                                <motion.button
                                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                                    aria-label={t("adminDashboard.sidebar.sortOrder", {
                                        order: sortOrder === "asc" ? t("adminDashboard.sidebar.sortOrder.asc") : t("adminDashboard.sidebar.sortOrder.desc"),
                                    })}
                                >
                                    <FaSort aria-hidden="true" />{" "}
                                    {sortOrder === "asc" ? t("adminDashboard.sidebar.sortOrder.asc") : t("adminDashboard.sidebar.sortOrder.desc")}
                                </motion.button>
                            </div>
                            <motion.button
                                className="action-button"
                                onClick={handleRefreshAIConfigs}
                                disabled={aiConfigsLoading}
                                aria-label={aiConfigsLoading ? t("adminDashboard.actions.loading") : t("adminDashboard.actions.refreshAIConfigs")}
                            >
                                <FaRedo aria-hidden="true" /> {aiConfigsLoading ? t("adminDashboard.actions.loading") : t("adminDashboard.actions.refreshAIConfigs")}
                            </motion.button>
                            <motion.button
                                className="action-button"
                                onClick={() => handleViewChange("add-ai-config")}
                                aria-label={t("adminDashboard.sidebar.addAIConfig")}
                            >
                                <FaPlus aria-hidden="true" /> {t("adminDashboard.sidebar.addAIConfig")}
                            </motion.button>
                        </>
                    )}
                    {userPermissions.canViewLogs && view === 'logs' && (
                        <motion.button
                            className="action-button"
                            onClick={handleRefreshLogs}
                            disabled={logsLoading}
                            aria-label={logsLoading ? t('adminDashboard.actions.loading') : t('logs.refreshLogs')}
                        >
                            <FaRedo aria-hidden="true" /> {logsLoading ? t('adminDashboard.actions.loading') : t('logs.refreshLogs')}
                        </motion.button>

                    )}

                </aside>
                <main className="main-content" role="region" aria-labelledby="dashboard-title">
                    {showNotificationPanel && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="notification-panel-container"
                        >
                            <NotificationPanel
                                className="absolute top-12 right-4"
                                onClose={() => setShowNotificationPanel(false)}
                            />
                        </motion.div>
                    )}
                    <Suspense>
                        {isBulkUploadModalOpen && (
                            <AgentBulkUploadModal
                                isOpen={isBulkUploadModalOpen}
                                onClose={() => setIsBulkUploadModalOpen(false)}
                                setError={setLocalError}
                            />
                        )}
                        {isTransitioning && view === "user-details" && (
                            <div>{t("adminDashboard.loading.userDetails")}</div>
                        )}
                        {!isTransitioning && view === "users" && (
                            <UsersList
                                users={users}
                                setUsers={setUsers}
                                view={view}
                                setView={setView}
                                setSelectedUser={setSelectedUser}
                                setError={setLocalError}
                                searchQuery={searchQuery}
                                sortField={sortField}
                                sortOrder={sortOrder}
                                userRoles={userRoles || []}
                                roleFilter={roleFilter}
                                currentPage={usersPage}
                                setCurrentPage={setUsersPage}
                                itemsPerPage={ITEMS_PER_PAGE}
                                isTransitioning={isTransitioning}
                                setIsTransitioning={setIsTransitioning}
                            />
                        )}
                        {!isTransitioning && view === "user-details" && (
                            <UserView
                                selectedUser={selectedUser}
                                setSelectedUser={setSelectedUser}
                                setRoles={setRoles}
                                setPermissionsList={setPermissionsList}
                                users={users}
                                setUsers={setUsers}
                                roles={roles}
                                permissionsList={permissionsList}
                                view={view}
                                effectivePermissions={effectivePermissions || []}
                                userRoles={userRoles || []}
                                setView={(view: string) => setView(view as ViewMode)}
                                setError={setLocalError}
                            />
                        )}
                        {view === "add-user" && (
                            <UserAdd
                                setRoles={setRoles}
                                users={users}
                                setUsers={setUsers}
                                roles={roles}
                                view={view}
                                setView={setView}
                                setError={setLocalError}
                            />
                        )}
                        {view === "roles" && (
                            <RolesList
                                roles={roles}
                                setRoles={setRoles}
                                view={view}
                                setView={(view: string) => setView(view as ViewMode)}
                                setSelectedRole={setSelectedRole}
                                setError={setLocalError}
                                userRoles={userRoles || []}
                                searchQuery={searchQuery}
                                setConfirmation={setConfirmation}
                            />
                        )}
                        {view === "add-role" && (
                            <RoleAdd
                                roles={roles}
                                setRoles={setRoles}
                                permissionsList={permissionsList}
                                view={view}
                                setView={setView}
                                setError={setLocalError}
                            />
                        )}
                        {view === "permissions" && (
                            <PermsList
                                permissionsList={permissionsList}
                                view={view}
                                setView={(view: string) => setView(view as ViewMode)}
                                setSelectedPermission={setSelectedPermission}
                                searchQuery={searchQuery}
                                setError={setLocalError}
                            />
                        )}
                        {view === "checklists" && (
                            <ChecklistsList
                                checklists={checklists}
                                setChecklists={setChecklists}
                                view={view}
                                setSelectedChecklist={setSelectedChecklist}
                                setError={setLocalError}
                                searchQuery={searchQuery}
                                currentPage={checklistsPage}
                                setCurrentPage={setChecklistsPage}
                                itemsPerPage={ITEMS_PER_PAGE}
                                totalItems={totalChecklists}
                            />
                        )}
                        {view === "checklist-details" && (
                            <ChecklistView
                                selectedChecklist={selectedChecklist}
                                setSelectedChecklist={setSelectedChecklist}
                                checklists={checklists}
                                setChecklists={setChecklists}
                                view={view}
                                setError={setLocalError}
                            />
                        )}
                        {view === "add-checklist" && (
                            <ChecklistAdd
                                checklists={checklists}
                                setChecklists={setChecklists}
                                view={view}
                                setView={setView}
                                setError={setLocalError}
                            />
                        )}
                        {view === "reasons" && (
                            <ReasonsList
                                reasons={reasons}
                                setReasons={setReasons}
                                view={view}
                                setSelectedReason={setSelectedReason}
                                setError={setLocalError}
                                searchQuery={searchQuery}
                                currentPage={reasonsPage}
                                setCurrentPage={setReasonsPage}
                                itemsPerPage={ITEMS_PER_PAGE}
                                totalItems={totalReasons} // Pass total items
                            />
                        )}
                        {view === "reason-details" && (
                            <ReasonView
                                selectedReason={selectedReason}
                                setSelectedReason={setSelectedReason}
                                reasons={reasons}
                                setReasons={setReasons}
                                view={view}
                                setError={setLocalError}
                            />
                        )}
                        {view === "add-reason" && (
                            <ReasonAdd
                                reasons={reasons}
                                setReasons={setReasons}
                                view={view}
                                setView={setView}
                                setError={setLocalError}
                            />
                        )}
                        {view === "agents" && (
                            <AgentsList
                                agents={agents}
                                setAgents={setAgents}
                                view={view}
                                setView={(view: string) => setView(view as ViewMode)}
                                setSelectedAgent={handleSetSelectedAgent}
                                setError={setLocalError}
                                searchQuery={searchQuery}
                                sortField={sortField}
                                setSortField={setSortField}
                                sortOrder={sortOrder}
                                setSortOrder={setSortOrder}
                                currentPage={agentsPage}
                                setCurrentPage={setAgentsPage}
                                itemsPerPage={ITEMS_PER_PAGE}
                                governorateFilter={governorateFilter}
                                delegationFilter={delegationFilter}
                            />
                        )}
                        {view === "add-agent" && (
                            <AddAgent
                                setAgents={setAgents}
                                setError={setLocalError}
                                setView={(view: string) => setView(view as ViewMode)}
                            />
                        )}
                        {view === "edit-agent" && (
                            <EditAgent
                                selectedAgent={selectedAgent}
                                setAgents={setAgents}
                                setSelectedAgent={setSelectedAgent}
                                setView={(view: string) => setView(view as ViewMode)}
                            />
                        )}
                        {view === "agent-details" && selectedAgent && (
                            <AgentView
                                selectedAgent={selectedAgent}
                                setSelectedAgent={setSelectedAgent}
                                agents={agents}
                                setAgents={setAgents}
                                view={view}
                                setView={(view: string) => setView(view as ViewMode)}
                            />
                        )}
                        {view === "notifications" && (
                            <NotificationRulesList
                                rules={notificationRules}
                                setRules={setNotificationRules}
                                view={view}
                                setView={setView}
                                setSelectedRule={setSelectedNotificationRule}
                                setError={setLocalError}
                                searchQuery={searchQuery}
                                typeFilter={notificationTypeFilter}
                                channelFilter={notificationChannelFilter}
                                statusFilter={notificationStatusFilter}
                                sortField={notificationSortField}
                                sortOrder={notificationSortOrder}
                            />
                        )}
                        {view === "notification-rule-details" && (
                            <NotificationRuleView
                                selectedRule={selectedNotificationRule}
                                setSelectedRule={setSelectedNotificationRule}
                                rules={notificationRules}
                                setRules={setNotificationRules}
                                view={view}
                                setView={setView}
                                setError={setLocalError}
                            />
                        )}
                        {view === "add-notification-rule" && (
                            <NotificationRuleAdd
                                rules={notificationRules}
                                setRules={setNotificationRules}
                                view={view}
                                setView={setView}
                                setError={setLocalError}
                            />
                        )}
                        {view === "ai-configs" && (
                            <AIConfigsList
                                configs={aiConfigs}
                                setConfigs={setAIConfigs}
                                view={view}
                                setView={setView}
                                setSelectedConfig={setSelectedAIConfig}
                                setError={setLocalError}
                                searchQuery={searchQuery}
                                sortField={sortField}
                                sortOrder={sortOrder}
                                currentPage={aiConfigsPage}
                                setCurrentPage={setAIConfigsPage}
                                itemsPerPage={ITEMS_PER_PAGE}
                            />
                        )}
                        {view === "add-ai-config" && (
                            <AIConfigAdd
                                configs={aiConfigs}
                                setConfigs={setAIConfigs}
                                view={view}
                                setView={setView}
                                setError={setLocalError}
                            />
                        )}
                        {view === "ai-config-details" && (
                            <AIConfigView
                                selectedConfig={selectedAIConfig}
                                setSelectedConfig={setSelectedAIConfig}
                                configs={aiConfigs}
                                setConfigs={setAIConfigs}
                                view={view}
                                setView={setView}
                                setError={setLocalError}
                            />
                        )}
                        {view === 'logs' && (
                            <LogsList
                                logs={logs}
                                totalLogs={totalLogs}
                                logsPage={logsPage}
                                setLogsPage={setLogsPage}
                                logSortField={logSortField}
                                setLogSortField={setLogSortField}
                                logSortOrder={logSortOrder}
                                setLogSortOrder={setLogSortOrder}
                                itemsPerPage={ITEMS_PER_PAGE}
                                logsLoading={logsLoading}
                                logFilters={{ ...logFilters, route: logFilters.route ?? "" }}
                                setLogFilters={setLogFilters}
                                refreshLogs={handleRefreshLogs}
                            />
                        )}
                    </Suspense>
                </main>
            </section>
        </div>
    );
});

export default AdminDashboard;
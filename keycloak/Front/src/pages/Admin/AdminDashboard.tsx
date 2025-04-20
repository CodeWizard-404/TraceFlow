import React, { useCallback, useEffect, useMemo, useState, Suspense, lazy } from "react";
import { FaArrowLeft, FaPlus, FaRedo, FaSearch, FaSort, FaTimes, FaUserPlus } from "react-icons/fa";
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
import { getAllUsers, getUserById } from "../../apis/userAPI";
import { Checklist } from "../../models/Checklist";
import Permission from "../../models/Permission";
import { Reason } from "../../models/Reason";
import Role from "../../models/Role";
import User from "../../models/User";
import { SortField, SortOrder, ViewMode } from "./adminTypes";
import "./AdminDashboard.css";

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

const CACHE_DURATION = 15 * 60 * 1000;
const FALLBACK_TIMEOUT = 500;
const ITEMS_PER_PAGE = 10;
const COOKIE_NAME = "adminDashboardView";
const COOKIE_EXPIRES = 7;

const validViews: ViewMode[] = [
    "users", "roles", "permissions", "checklists", "reasons",
    "add-user", "add-role", "add-permission", "user-details",
    "checklist-details", "add-checklist", "reason-details", "add-reason",
];

interface CacheData {
    data: User[] | Role[] | Permission[] | Checklist[] | Reason[];
    timestamp: number;
}

const cache = new Map<string, CacheData>();

const AdminDashboard: React.FC = React.memo(() => {
    const { t } = useTranslation();
    const { effectivePermissions, userRoles } = useAuth();
    const { clearError, setError: setGlobalError } = useError();
    const [, setLoading] = useState(false);
    const [roleLoading, setRoleLoading] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const initialView = useMemo(() => {
        const savedView = Cookies.get(COOKIE_NAME);
        console.log("Read cookie", { cookieName: COOKIE_NAME, savedView });
        if (savedView && validViews.includes(savedView as ViewMode)) {
            return savedView as ViewMode;
        }
        return "users";
    }, []);

    const [checklists, setChecklists] = useState<Checklist[]>([]);
    const [checklistsPage, setChecklistsPage] = useState(1);
    const [error, setLocalError] = useState<string | null>(null);
    const [permissionsList, setPermissionsList] = useState<Permission[]>([]);
    const [reasons, setReasons] = useState<Reason[]>([]);
    const [reasonsPage, setReasonsPage] = useState(1);
    const [resetLoading, setResetLoading] = useState(false);
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [roles, setRoles] = useState<Role[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
    const [, setSelectedPermission] = useState<Permission | null>(null);
    const [selectedReason, setSelectedReason] = useState<Reason | null>(null);
    const [, setSelectedRole] = useState<Role | null>(null);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [sortField, setSortField] = useState<SortField>("role");
    const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
    const [users, setUsers] = useState<User[]>([]);
    const [usersPage, setUsersPage] = useState(1);
    const [view, setView] = useState<ViewMode>(initialView);

    useEffect(() => {
        const savedView = localStorage.getItem("adminView");
        const savedUserId = localStorage.getItem("selectedUserId");
        if (savedView === "user-details" && savedUserId) {
            const loadUser = async () => {
                try {
                    setLoading(true);
                    const user = await getUserById(savedUserId);
                    setSelectedUser(user);
                    setView("user-details");
                } catch {
                    setGlobalError("Failed to restore user view.");
                    setView("users");
                    localStorage.removeItem("adminView");
                    localStorage.removeItem("selectedUserId");
                } finally {
                    setLoading(false);
                }
            };
            loadUser();
        }
    }, [setSelectedUser, setView, setGlobalError]);

    useEffect(() => {
        if (validViews.includes(view)) {
            Cookies.set(COOKIE_NAME, view, { expires: COOKIE_EXPIRES });
            console.log("Saved cookie", { cookieName: COOKIE_NAME, view, expires: COOKIE_EXPIRES });
        }
    }, [view]);

    const debouncedSetSearchQuery = useCallback(
        debounce((value: string) => setSearchQuery(value), 300),
        []
    );

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
        }),
        [effectivePermissions]
    );

    const getCachedData = useCallback(
        (key: string): CacheData["data"] | null => {
            const cached = cache.get(key);
            if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
                return cached.data;
            }
            return null;
        },
        []
    );

    const setCachedData = useCallback(
        (key: string, data: CacheData["data"]) => {
            cache.set(key, { data, timestamp: Date.now() });
        },
        []
    );

    const handleRefreshUsers = useCallback(async () => {
        if (!userPermissions.canViewUsers) return;
        cache.delete("all_users");
        try {
            setLoading(true);
            const usersData = await getAllUsers();
            console.log("Fetched users:", usersData.map(u => ({ email: u.email, roles: u.Roles })));
            const startIndex = (usersPage - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const paginatedUsers = usersData.slice(startIndex, endIndex);
            setUsers(paginatedUsers);
            setCachedData("all_users", usersData);
            setLocalError(null);
            clearError();
        } catch (err: unknown) {
            console.error("Failed to refresh users:", err);
            const errorMessage = t("adminDashboard.error.fetchFailed");
            setLocalError(errorMessage);
            setGlobalError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [
        userPermissions.canViewUsers,
        usersPage,
        setCachedData,
        t,
        setGlobalError,
        clearError,
    ]);

    const handleResetMainRoles = useCallback(async () => {
        if (!window.confirm(t("adminDashboard.actions.resetRolesConfirm"))) return;
        setResetLoading(true);
        try {
            const response = await resetMainRoles();
            const updatedRoles = await getAllRoles();
            console.log("Fetched roles:", updatedRoles.map(r => ({ roleID: r.roleID, name: r.name, fullRole: r })));
            setCachedData("all_roles", updatedRoles);
            setRoles(updatedRoles);
            setLocalError(null);
            clearError();
            const resetDetails = (
                response.details as Array<{
                    roleName: string;
                    permissionsAssigned: number;
                    permissionsRevoked: number;
                    totalPermissions: number;
                }>
            )
                .map((detail) =>
                    t("adminDashboard.success.resetRolesDetail", {
                        roleName: detail.roleName,
                        permissionsAssigned: detail.permissionsAssigned,
                        permissionsRevoked: detail.permissionsRevoked,
                        totalPermissions: detail.totalPermissions,
                    })
                )
                .join(", ");
            setTimeout(() => {
                const successMessage = t("adminDashboard.success.resetRoles", {
                    details: resetDetails,
                });
                setLocalError(successMessage);
            }, 500);
        } catch (err: unknown) {
            console.error("Failed to reset main roles:", err);
            const errorMessage = t("adminDashboard.error.resetRolesFailed");
            setLocalError(errorMessage);
            setGlobalError(errorMessage);
        } finally {
            setResetLoading(false);
        }
    }, [t, setGlobalError, clearError, setCachedData]);

    const handleViewChange = useCallback(
        (newView: ViewMode) => {
            setView(newView);
            setSelectedUser(null);
            setSelectedRole(null);
            setSelectedPermission(null);
            setSelectedChecklist(null);
            setSelectedReason(null);
            if (newView === "users") setUsersPage(1);
            else if (newView === "checklists") setChecklistsPage(1);
            else if (newView === "reasons") setReasonsPage(1);
            localStorage.setItem("adminView", newView);
            if (newView !== "user-details") localStorage.removeItem("selectedUserId");
        },
        []
    );

    useEffect(() => {
        const fetchData = async () => {
            if (
                !userPermissions.canViewUsers &&
                !userPermissions.canViewRoles &&
                !userPermissions.canViewPermissions &&
                !userPermissions.canViewChecklists &&
                !userPermissions.canViewReasons
            ) {
                const errorMessage = t("adminDashboard.error.noToken");
                setLocalError(errorMessage);
                setGlobalError(errorMessage);
                return;
            }

            try {
                setLoading(true);
                if (view === "users" && userPermissions.canViewUsers) {
                    let usersData = getCachedData("all_users");
                    if (!usersData) {
                        const timeout = setTimeout(() => {
                            if (!usersData) setUsers([]);
                        }, FALLBACK_TIMEOUT);
                        usersData = await getAllUsers();
                        clearTimeout(timeout);
                        setCachedData("all_users", usersData);
                    }
                    const startIndex = (usersPage - 1) * ITEMS_PER_PAGE;
                    const endIndex = startIndex + ITEMS_PER_PAGE;
                    const paginatedUsers = (usersData as User[]).slice(startIndex, endIndex);
                    setUsers(paginatedUsers);
                    console.log("Set users:", paginatedUsers.map(u => ({ email: u.email, roles: u.Roles })));

                    setRoleLoading(true);
                    let rolesData = getCachedData("all_roles");
                    if (!rolesData) {
                        rolesData = await getAllRoles();
                        setCachedData("all_roles", rolesData);
                    }
                    setRoles(rolesData as Role[]);
                    setRoleLoading(false);
                } else if (view === "roles" && userPermissions.canViewRoles) {
                    let rolesData = getCachedData("all_roles");
                    if (!rolesData) {
                        rolesData = await getAllRoles();
                        setCachedData("all_roles", rolesData);
                    }
                    setRoles(rolesData as Role[]);
                } else if (view === "permissions" && userPermissions.canViewPermissions) {
                    let permissionsData = getCachedData("all_permissions");
                    if (!permissionsData) {
                        permissionsData = await getAllPermissions();
                        setCachedData("all_permissions", permissionsData);
                    }
                    setPermissionsList(permissionsData as Permission[]);
                } else if (view === "checklists" && userPermissions.canViewChecklists) {
                    let checklistsData = getCachedData("all_checklists");
                    if (!checklistsData) {
                        checklistsData = await getAllChecklists();
                        setCachedData("all_checklists", checklistsData);
                    }
                    setChecklists(checklistsData as Checklist[]);
                } else if (view === "reasons" && userPermissions.canViewReasons) {
                    let reasonsData = getCachedData("all_reasons");
                    if (!reasonsData) {
                        reasonsData = await getAllReasons();
                        setCachedData("all_reasons", reasonsData);
                    }
                    setReasons(reasonsData as Reason[]);
                }
                clearError();
            } catch (err: unknown) {
                console.error("Failed to fetch data:", err);
                const errorMessage = t("adminDashboard.error.fetchFailed");
                setLocalError(errorMessage);
                setGlobalError(errorMessage);
            } finally {
                setLoading(false);
                setRoleLoading(false);
            }
        };

        fetchData();
    }, [
        view,
        usersPage,
        userPermissions,
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

    return (
        <div className="admin-dashboard" role="main">
            {error && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="error-message"
                    role="alert"
                >
                    <span>{error}</span>
                    <button
                        className="close-error"
                        onClick={() => {
                            setLocalError(null);
                            clearError();
                        }}
                        aria-label={t("errorDisplay.actions.dismiss")}
                    >
                        <FaTimes aria-hidden="true" />
                    </button>
                </motion.div>
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
                </h1>
                {(view === "users" ||
                    view === "roles" ||
                    view === "permissions" ||
                    view === "checklists" ||
                    view === "reasons") && (
                        <div className="search-container">
                            <FaSearch className="search-icon" aria-hidden="true" />
                            <input
                                type="text"
                                placeholder={t("adminDashboard.search.placeholder", { view })}
                                value={searchQuery}
                                onChange={(e) => debouncedSetSearchQuery(e.target.value)}
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
                    view === "reason-details") && (
                        <motion.button
                            className="back-button"
                            onClick={() =>
                                handleViewChange(
                                    view.includes("user")
                                        ? "users"
                                        : view.includes("role")
                                            ? "roles"
                                            : view.includes("permission")
                                                ? "permissions"
                                                : view.includes("checklist")
                                                    ? "checklists"
                                                    : "reasons"
                                )
                            }
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            aria-label={t("adminDashboard.actions.back")}
                        >
                            <FaArrowLeft aria-hidden="true" /> {t("adminDashboard.actions.back")}
                        </motion.button>
                    )}
            </header>
            <section className="dashboard-content">
                <aside className="sidebar" role="navigation">
                    <div className="filter-card">
                        <h3>{t("adminDashboard.sidebar.view")}</h3>
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
                                className={view === "roles" || view === "add-role" ? "active" : ""}
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
                                    view === "reasons" ||
                                        view === "add-reason" ||
                                        view === "reason-details"
                                        ? "active"
                                        : ""
                                }
                                onClick={() => handleViewChange("reasons")}
                                aria-current={view === "reasons" ? "page" : undefined}
                            >
                                {t("adminDashboard.sidebar.reasons")}
                            </button>
                        )}
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
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    aria-label={t("adminDashboard.sidebar.sortOrder", {
                                        order:
                                            sortOrder === "asc"
                                                ? t("adminDashboard.sidebar.sortOrder.asc")
                                                : t("adminDashboard.sidebar.sortOrder.desc"),
                                    })}
                                >
                                    <FaSort aria-hidden="true" />{" "}
                                    {sortOrder === "asc"
                                        ? t("adminDashboard.sidebar.sortOrder.asc")
                                        : t("adminDashboard.sidebar.sortOrder.desc")}
                                </motion.button>
                            </div>
                            <div className="role-filter-card">
                                <h3>{t("adminDashboard.sidebar.filterByRole")}</h3>
                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    aria-label={t("adminDashboard.sidebar.filterByRole")}
                                    disabled={roleLoading || roles.length === 0}
                                >
                                    <option value="all">{t("adminDashboard.sidebar.allRoles")}</option>
                                    {roles.map((role) => (
                                        <option key={role.roleID} value={role.roleID}>
                                            {role.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <motion.button
                                className="action-button"
                                onClick={handleRefreshUsers}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                aria-label="Refresh Users"
                            >
                                <FaRedo aria-hidden="true" /> Refresh Users
                            </motion.button>
                        </>
                    )}
                    {userPermissions.canCreateUsers &&
                        (view === "users" || view === "add-user" || view === "user-details") && (
                            <motion.button
                                className="action-button"
                                onClick={() => handleViewChange("add-user")}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                aria-label={t("adminDashboard.sidebar.addUser")}
                            >
                                <FaUserPlus aria-hidden="true" /> {t("adminDashboard.sidebar.addUser")}
                            </motion.button>
                        )}
                    {userPermissions.canViewRoles && view === "roles" && (
                        <>
                            {userPermissions.canCreateRoles && (
                                <motion.button
                                    className="action-button"
                                    onClick={() => handleViewChange("add-role")}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    aria-label={t("adminDashboard.sidebar.addRole")}
                                >
                                    <FaPlus aria-hidden="true" /> {t("adminDashboard.sidebar.addRole")}
                                </motion.button>
                            )}
                            {userPermissions.canResetRoles && (
                                <motion.button
                                    className="action-button reset-button"
                                    onClick={handleResetMainRoles}
                                    disabled={resetLoading}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    aria-label={t("adminDashboard.actions.resetRoles")}
                                >
                                    {resetLoading
                                        ? t("adminDashboard.actions.resetting")
                                        : t("adminDashboard.actions.resetRoles")}
                                </motion.button>
                            )}
                        </>
                    )}
                    {userPermissions.canViewChecklists &&
                        view === "checklists" &&
                        userPermissions.canCreateChecklists && (
                            <motion.button
                                className="action-button"
                                onClick={() => handleViewChange("add-checklist")}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                aria-label={t("adminDashboard.sidebar.addChecklist")}
                            >
                                <FaPlus aria-hidden="true" /> {t("adminDashboard.sidebar.addChecklist")}
                            </motion.button>
                        )}
                    {userPermissions.canViewReasons &&
                        view === "reasons" &&
                        userPermissions.canCreateReasons && (
                            <motion.button
                                className="action-button"
                                onClick={() => handleViewChange("add-reason")}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                aria-label={t("adminDashboard.sidebar.addReason")}
                            >
                                <FaPlus aria-hidden="true" /> {t("adminDashboard.sidebar.addReason")}
                            </motion.button>
                        )}
                </aside>
                <main className="main-content" role="region" aria-labelledby="dashboard-title">
                    <Suspense fallback={<div>Loading...</div>}>
                        {isTransitioning && view === "user-details" && <div>Loading user details...</div>}
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
                                roles={roles}
                                currentPage={usersPage}
                                setCurrentPage={setUsersPage}
                                itemsPerPage={ITEMS_PER_PAGE}
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
                                setView={setView}
                                setError={setLocalError}
                            />
                        )}
                        {view === "add-user" && (
                            <UserAdd
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
                    </Suspense>
                </main>
            </section>
        </div>
    );
});

export default AdminDashboard;
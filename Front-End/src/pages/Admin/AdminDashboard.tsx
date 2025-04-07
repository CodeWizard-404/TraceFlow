import React, { useState, useEffect, useMemo } from "react";
import {
    FaSearch, FaSort, FaUserPlus, FaArrowLeft,
    FaPlus,
    FaTimes
} from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { getAllUsers } from "../../apis/userAPI";
import { getAllRoles } from "../../apis/roleAPI";
import { getAllPermissions } from "../../apis/permissionAPI";
import { getRolesByUser } from "../../apis/roleAPI";
import { getAllChecklists } from "../../apis/checklistAPI";
import { getAllReasons } from "../../apis/reasonAPI";
import User from "../../models/User";
import Role from "../../models/Role";
import Permission from "../../models/Permission";
import { Checklist } from "../../models/Checklist";
import { Reason } from "../../models/Reason";
import UserView from "./User/user_view";
import UserAdd from "./User/user_add";
import UsersList from "./User/users_list";
import RoleView from "./Role/roles_view";
import RoleAdd from "./Role/role_add";
import RolesList from "./Role/roles_list";
import PermView from "./Permission/perm_view";
import PermAdd from "./Permission/perm_add";
import PermsList from "./Permission/perms_list";
import ChecklistView from "./Items/Checklists/ChecklistView";
import { SortField, SortOrder, ViewMode } from "./adminTypes";
import ChecklistAdd from "./Items/Checklists/ChecklistAdd";
import ChecklistsList from "./Items/Checklists/ChecklistsList";
import ReasonAdd from "./Items/Reasons/ReasonAdd";
import ReasonsList from "./Items/Reasons/ReasonsList";
import ReasonView from "./Items/Reasons/ReasonView";
import "./AdminDashboard.css";

const ITEMS_PER_PAGE = 10;

const AdminDashboard: React.FC = () => {
    const { token, effectivePermissions, userRoles } = useAuth();

    // State
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissionsList, setPermissionsList] = useState<Permission[]>([]);
    const [checklists, setChecklists] = useState<Checklist[]>([]);
    const [reasons, setReasons] = useState<Reason[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
    const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
    const [selectedReason, setSelectedReason] = useState<Reason | null>(null);
    const [view, setView] = useState<ViewMode>("users");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortField, setSortField] = useState<SortField>("role");
    const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [usersPage, setUsersPage] = useState(1); // Separate page for UsersList
    const [checklistsPage, setChecklistsPage] = useState(1); // Separate page for ChecklistsList
    const [reasonsPage, setReasonsPage] = useState(1); // Separate page for ReasonsList
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Permission Checks
    const userPermissions = useMemo(() => ({
        canViewUsers: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_READ_USERS),
        canCreateUsers: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_USERS),
        canViewRoles: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_READ_ROLES),
        canCreateRoles: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_ROLES),
        canViewPermissions: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_READ_PERMISSIONS),
        canCreatePermissions: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_PERMISSIONS),
        canViewChecklists: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_READ_CHECKLISTS_ITEMS),
        canCreateChecklists: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_CHECKLISTS_ITEMS),
        canViewReasons: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_READ_REASON_ITEMS),
        canCreateReasons: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_REASON_ITEMS),
    }), [effectivePermissions]);

    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [usersData, rolesData, permissionsData, checklistsData, reasonsData] = await Promise.all([
                    userPermissions.canViewUsers ? getAllUsers(token!) : Promise.resolve([]),
                    userPermissions.canViewRoles ? getAllRoles(token!) : Promise.resolve([]),
                    userPermissions.canViewPermissions ? getAllPermissions(token!) : Promise.resolve([]),
                    userPermissions.canViewChecklists ? getAllChecklists(token!) : Promise.resolve([]),
                    userPermissions.canViewReasons ? getAllReasons(token!) : Promise.resolve([]),
                ]);
                const usersWithRoles = await Promise.all(
                    usersData.map(async (user) => {
                        const userRoles = await getRolesByUser(user.userID, token!);
                        return { ...user, Roles: userRoles };
                    })
                );

                setUsers(usersWithRoles);
                setRoles(rolesData);
                setPermissionsList(permissionsData);
                setChecklists(checklistsData);
                setReasons(reasonsData);
            } catch (err) {
                console.error("Failed to fetch initial data:", err);
                setError("Failed to load dashboard data.");
            } finally {
                setLoading(false);
            }
        };
        if (token) fetchData();
    }, [token, userPermissions]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                setError(null);
            }, 3000); // Closes after 3 seconds
            return () => clearTimeout(timer);
        }
    }, [error, setError]);

    // Handlers
    const handleViewChange = (newView: ViewMode) => {
        setView(newView);
        setSelectedUser(null);
        setSelectedRole(null);
        setSelectedPermission(null);
        setSelectedChecklist(null);
        setSelectedReason(null);
        // Reset page based on view
        if (newView === "users") setUsersPage(1);
        else if (newView === "checklists") setChecklistsPage(1);
        else if (newView === "reasons") setReasonsPage(1);
    };

    // Render
    if (!token) return <div>Please log in to access the dashboard.</div>;

    return (
        <div className="admin-dashboard">
            {error && (
                <div className="error-message">
                    <span>{error}</span>
                    <button className="close-error" onClick={() => setError(null)}>
                        <FaTimes />
                    </button>
                </div>
            )}

            <header className="dashboard-header">
                <h1>
                    {view === "users" && "Users Management"}
                    {view === "roles" && "Roles Management"}
                    {view === "permissions" && "Permissions Management"}
                    {view === "add-user" && "Add New User"}
                    {view === "add-role" && "Create New Role"}
                    {view === "add-permission" && "Create New Permission"}
                    {view === "user-details" && selectedUser && `${selectedUser.firstname} ${selectedUser.lastname}`}
                    {view === "checklists" && "Checklists Management"}
                    {view === "add-checklist" && "Add New Checklist"}
                    {view === "checklist-details" && selectedChecklist && `Checklist: ${selectedChecklist.item}`}
                    {view === "reasons" && "Reasons Management"}
                    {view === "add-reason" && "Add New Reason"}
                    {view === "reason-details" && selectedReason && `Reason: ${selectedReason.item}`}
                </h1>
                {(view === "users" || view === "roles" || view === "permissions" || view === "checklists" || view === "reasons") && (
                    <div className="search-container">
                        <FaSearch className="search-icon" />
                        <input
                            type="text"
                            placeholder={`Search ${view}...`}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="search-input input-0"
                        />
                    </div>
                )}
                {(view === "add-user" || view === "add-role" || view === "add-permission" || view === "user-details" ||
                    view === "add-checklist" || view === "checklist-details" || view === "add-reason" || view === "reason-details") && (
                        <button className="back-button" onClick={() => handleViewChange(view.includes("user") ? "users" : view.includes("role") ? "roles" : view.includes("permission") ? "permissions" : view.includes("checklist") ? "checklists" : "reasons")}>
                            <FaArrowLeft /> Back
                        </button>
                    )}
            </header>

            <section className="dashboard-content">
                <aside className="sidebar">
                    <div className="filter-card">
                        <h3>View</h3>
                        {userPermissions.canViewUsers && (
                            <button className={view === "users" || view === "add-user" || view === "user-details" ? "active" : ""} onClick={() => handleViewChange("users")}>
                                Users
                            </button>
                        )}
                        {userPermissions.canViewRoles && (
                            <button className={view === "roles" || view === "add-role" ? "active" : ""} onClick={() => handleViewChange("roles")}>
                                Roles
                            </button>
                        )}
                        {userPermissions.canViewPermissions && (
                            <button className={view === "permissions" || view === "add-permission" ? "active" : ""} onClick={() => handleViewChange("permissions")}>
                                Permissions
                            </button>
                        )}
                        {userPermissions.canViewChecklists && (
                            <button className={view === "checklists" || view === "add-checklist" || view === "checklist-details" ? "active" : ""} onClick={() => handleViewChange("checklists")}>
                                Checklists
                            </button>
                        )}
                        {userPermissions.canViewReasons && (
                            <button className={view === "reasons" || view === "add-reason" || view === "reason-details" ? "active" : ""} onClick={() => handleViewChange("reasons")}>
                                Reasons
                            </button>
                        )}
                    </div>
                    {(view === "users") && userPermissions.canViewUsers && (
                        <>
                            <div className="sort-card">
                                <h3>Sort Users By</h3>
                                <select value={sortField} onChange={e => setSortField(e.target.value as SortField)}>
                                    <option value="name">Name</option>
                                    <option value="email">Email</option>
                                    <option value="role">Role</option>
                                </select>
                                <button onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}>
                                    <FaSort /> {sortOrder === "asc" ? "Asc" : "Desc"}
                                </button>
                            </div>
                            <div className="role-filter-card">
                                <h3>Filter by Role</h3>
                                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                                    <option value="all">All Roles</option>
                                    {roles.map(role => (
                                        <option key={role.roleID} value={role.roleID}>{role.name}</option>
                                    ))}
                                </select>
                            </div>
                            {userPermissions.canCreateUsers && (
                                <button className="action-button" onClick={() => handleViewChange("add-user")}>
                                    <FaUserPlus /> Add User
                                </button>
                            )}
                        </>
                    )}
                    {(view === "roles") && userPermissions.canViewRoles && (
                        <button className="action-button" onClick={() => handleViewChange("add-role")}>
                            <FaPlus /> Add Role
                        </button>
                    )}
                    {(view === "permissions") && userPermissions.canViewPermissions && (
                        <button className="action-button" onClick={() => handleViewChange("add-permission")}>
                            <FaPlus /> Add Permission
                        </button>
                    )}
                    {(view === "checklists") && userPermissions.canViewChecklists && (
                        <button className="action-button" onClick={() => handleViewChange("add-checklist")}>
                            <FaPlus /> Add Checklist
                        </button>
                    )}
                    {(view === "reasons") && userPermissions.canViewReasons && (
                        <button className="action-button" onClick={() => handleViewChange("add-reason")}>
                            <FaPlus /> Add Reason
                        </button>
                    )}
                </aside>

                <main className="main-content">
                    {loading && <div className="spinner" style={{ marginBottom: '-1rem' }}></div>}
                    <UsersList
                        users={users}
                        setUsers={setUsers}
                        view={view}
                        token={token!}
                        setView={setView}
                        setSelectedUser={setSelectedUser}
                        setError={setError}
                        searchQuery={searchQuery}
                        sortField={sortField}
                        sortOrder={sortOrder}
                        userRoles={userRoles || []}
                        roleFilter={roleFilter}
                        currentPage={usersPage}
                        setCurrentPage={setUsersPage}
                        itemsPerPage={ITEMS_PER_PAGE}
                    />
                    <UserView
                        selectedUser={selectedUser}
                        setSelectedUser={setSelectedUser}
                        users={users}
                        setUsers={setUsers}
                        roles={roles}
                        permissionsList={permissionsList}
                        view={view}
                        effectivePermissions={effectivePermissions || []}
                        userRoles={userRoles || []}
                        token={token!}
                        setView={setView}
                        setError={setError}
                    />
                    <UserAdd
                        users={users}
                        setUsers={setUsers}
                        roles={roles}
                        view={view}
                        token={token!}
                        setView={setView}
                        setError={setError}
                    />
                    <RolesList
                        roles={roles}
                        setRoles={setRoles}
                        view={view}
                        token={token!}
                        setSelectedRole={setSelectedRole}
                        setError={setError}
                        userRoles={userRoles || []}
                        searchQuery={searchQuery}
                    />
                    <RoleView
                        selectedRole={selectedRole}
                        setSelectedRole={setSelectedRole}
                        roles={roles}
                        setRoles={setRoles}
                        permissionsList={permissionsList}
                        view={view}
                        userRoles={userRoles || []}
                        setError={setError}
                    />
                    <RoleAdd
                        roles={roles}
                        setRoles={setRoles}
                        permissionsList={permissionsList}
                        view={view}
                        token={token!}
                        setView={setView}
                        setError={setError}
                    />
                    <PermsList
                        permissionsList={permissionsList}
                        view={view}
                        setSelectedPermission={setSelectedPermission}
                        searchQuery={searchQuery}
                    />
                    <PermView
                        selectedPermission={selectedPermission}
                        setSelectedPermission={setSelectedPermission}
                        permissionsList={permissionsList}
                        setPermissionsList={setPermissionsList}
                        view={view}
                        setError={setError}
                    />
                    <PermAdd
                        permissionsList={permissionsList}
                        setPermissionsList={setPermissionsList}
                        view={view}
                        token={token!}
                        setView={setView}
                        setError={setError}
                    />
                    <ChecklistsList
                        checklists={checklists}
                        setChecklists={setChecklists}
                        view={view}
                        token={token!}
                        setSelectedChecklist={setSelectedChecklist}
                        setError={setError}
                        searchQuery={searchQuery}
                        currentPage={checklistsPage}
                        setCurrentPage={setChecklistsPage}
                        itemsPerPage={ITEMS_PER_PAGE}
                    />
                    <ChecklistView
                        selectedChecklist={selectedChecklist}
                        setSelectedChecklist={setSelectedChecklist}
                        checklists={checklists}
                        setChecklists={setChecklists}
                        view={view}
                        token={token!}
                        setError={setError}
                    />
                    <ChecklistAdd
                        checklists={checklists}
                        setChecklists={setChecklists}
                        view={view}
                        token={token!}
                        setView={setView}
                        setError={setError}
                    />
                    <ReasonsList
                        reasons={reasons}
                        setReasons={setReasons}
                        view={view}
                        token={token!}
                        setSelectedReason={setSelectedReason}
                        setError={setError}
                        searchQuery={searchQuery}
                        currentPage={reasonsPage}
                        setCurrentPage={setReasonsPage}
                        itemsPerPage={ITEMS_PER_PAGE}
                    />
                    <ReasonView
                        selectedReason={selectedReason}
                        setSelectedReason={setSelectedReason}
                        reasons={reasons}
                        setReasons={setReasons}
                        view={view}
                        token={token!}
                        setError={setError}
                    />
                    <ReasonAdd
                        reasons={reasons}
                        setReasons={setReasons}
                        view={view}
                        token={token!}
                        setView={setView}
                        setError={setError}
                    />
                </main>
            </section>
        </div >
    );
};

export default AdminDashboard;
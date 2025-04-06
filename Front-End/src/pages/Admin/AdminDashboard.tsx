import React, { useState, useEffect, useMemo } from "react";
import {
    FaSearch, FaSort, FaUserPlus, FaArrowLeft, FaSignOutAlt
} from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { getAllUsers } from "../../apis/userAPI";
import { getAllRoles } from "../../apis/roleAPI";
import { getAllPermissions } from "../../apis/permissionAPI";
import { getRolesByUser } from "../../apis/roleAPI";
import User from "../../models/User";
import Role from "../../models/Role";
import Permission from "../../models/Permission";
import UserView from "./User/user_view";
import UserAdd from "./User/user_add";
import UsersList from "./User/users_list";
import "./AdminDashboard.css";

type ViewMode = "users" | "roles" | "permissions" | "add-user" | "add-role" | "add-permission" | "user-details";
type SortField = "name" | "email" | "role";
type SortOrder = "asc" | "desc";

const ITEMS_PER_PAGE = 10;

const AdminDashboard: React.FC = () => {
    const { token, effectivePermissions, userRoles } = useAuth();

    // State
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissionsList, setPermissionsList] = useState<Permission[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [view, setView] = useState<ViewMode>("users");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortField, setSortField] = useState<SortField>("role");
    const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
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
    }), [effectivePermissions]);

    //const isSuperAdmin = useMemo(() => userRoles?.some(r => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN), [userRoles]);

    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [usersData, rolesData, permissionsData] = await Promise.all([
                    userPermissions.canViewUsers ? getAllUsers(token!) : Promise.resolve([]),
                    userPermissions.canViewRoles ? getAllRoles(token!) : Promise.resolve([]),
                    userPermissions.canViewPermissions ? getAllPermissions(token!) : Promise.resolve([])
                ]);
                // Fetch roles for each user
                const usersWithRoles = await Promise.all(
                    usersData.map(async (user) => {
                        const userRoles = await getRolesByUser(user.userID, token!);
                        return { ...user, Roles: userRoles };
                    })
                );

                setUsers(usersWithRoles);
                setRoles(rolesData);
                setPermissionsList(permissionsData);
            } catch (err) {
                console.error("Failed to fetch initial data:", err);
                setError("Failed to load dashboard data.");
            } finally {
                setLoading(false);
            }
        };
        if (token) fetchData();
    }, [token, userPermissions]);

    // Handlers
    const handleViewChange = (newView: ViewMode) => {
        setView(newView);
        setSelectedUser(null);
        setCurrentPage(1); // Reset pagination when view changes
    };

    // Render
    if (!token) return <div>Please log in to access the dashboard.</div>;

    return (
        <div className="admin-dashboard">
            {error && (
                <div className="error-message">
                    <span>{error}</span>
                    <button className="close-error" onClick={() => setError(null)}>
                        <FaSignOutAlt />
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
                </h1>
                {(view === "users" || view === "roles" || view === "permissions") && (
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
                {(view === "add-user" || view === "add-role" || view === "add-permission" || view === "user-details") && (
                    <button className="back-button" onClick={() => handleViewChange(view === "user-details" || view === "add-user" ? "users" : view === "add-role" ? "roles" : "permissions")}>
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
                    </div>
                    {(view === "users" || view === "add-user" || view === "user-details") && userPermissions.canViewUsers && (
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
                </aside>

                <main className="main-content">
                    {loading && <div className="loading-overlay">Loading...</div>}

                    <UsersList
                        users={users}
                        setUsers={setUsers}
                        view={view}
                        token={token}
                        setView={setView}
                        setSelectedUser={setSelectedUser}
                        setError={setError}
                        searchQuery={searchQuery}
                        sortField={sortField}
                        sortOrder={sortOrder}
                        userRoles={userRoles || []}
                        roleFilter={roleFilter}
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
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
                        token={token}
                        setView={setView}
                        setError={setError}
                    />
                    <UserAdd
                        users={users}
                        setUsers={setUsers}
                        roles={roles}
                        view={view}
                        token={token}
                        setView={setView}
                        setError={setError}
                    />
                </main>
            </section>
        </div>
    );
};

export default AdminDashboard;
import React, { useState, useEffect, useMemo } from "react";
import { FaSearch, FaFilter, FaSort, FaUserPlus, FaPlus, FaArrowLeft, FaInfoCircle, FaAngleDown } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import {
    getAllUsers,
    createUser,
    assignRolesToUser,
    getRolesByUser,
    assignSupervisorsToManager,
    getSupervisorsByUser,
    getManagersByUser,
} from "../../apis/userAPI";
import { getAllRoles, createRole, assignPermissionsToRole, getPermissionsByRole } from "../../apis/roleAPI";
import { getAllPermissions } from "../../apis/permissionAPI";
import User from "../../models/User";
import Role from "../../models/Role";
import Permission from "../../models/Permission";
import "./AdminDashboard.css";

const ITEMS_PER_PAGE = 10; // Pagination: 10 items per page

const AdminDashboard: React.FC = () => {
    const { token } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [view, setView] = useState<"users" | "roles" | "add-user" | "add-role" | "user-details">("users");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortField, setSortField] = useState<"name" | "email" | "roleCount">("name");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [newUser, setNewUser] = useState<Partial<User>>({});
    const [newRole, setNewRole] = useState<Partial<Role>>({});
    const [selectedRolesForNewUser, setSelectedRolesForNewUser] = useState<string[]>([]);
    const [selectedPermissionsForNewRole, setSelectedPermissionsForNewRole] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [tempPermissions, setTempPermissions] = useState<Permission[]>([]);
    const [tempRoles, setTempRoles] = useState<Role[]>([]);
    const [hasUnsavedUserChanges, setHasUnsavedUserChanges] = useState(false);
    const [permissionSearch, setPermissionSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [activeRolePopup, setActiveRolePopup] = useState<string | null>(null);
    const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [tempSupervisors, setTempSupervisors] = useState<User[]>([]);
    const [tempManagers, setTempManagers] = useState<User[]>([]);
    const [hasUnsavedSupervisorChanges, setHasUnsavedSupervisorChanges] = useState(false);
    const [supervisorSearch, setSupervisorSearch] = useState("");
    const [managerSearch, setManagerSearch] = useState("");
    const [supervisorPage, setSupervisorPage] = useState(1);
    const [managerPage, setManagerPage] = useState(1);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [usersData, rolesData, permissionsData] = await Promise.all([
                    getAllUsers(token!),
                    getAllRoles(token!),
                    getAllPermissions(token!),
                ]);
                const usersWithDetails = await Promise.all(usersData.map(async (user) => {
                    const [userRoles, supervisors, managers] = await Promise.all([
                        getRolesByUser(user.userID, token!),
                        getSupervisorsByUser(user.userID, token!),
                        getManagersByUser(user.userID, token!),
                    ]);
                    return { ...user, roles: userRoles, supervisors, managers };
                }));
                setUsers(usersWithDetails);
                const rolesWithPermissions = await Promise.all(rolesData.map(async (role) => {
                    const rolePermissions = await getPermissionsByRole(role.roleID, token!);
                    return { ...role, permissions: rolePermissions };
                }));
                setRoles(rolesWithPermissions);
                setPermissions(permissionsData);
            } catch (error) {
                console.error("Failed to fetch data:", error);
            } finally {
                setLoading(false);
            }
        };
        if (token) fetchData();
    }, [token]);

    const filteredUsers = useMemo(() => {
        let result = users.filter((user) =>
            `${user.firstname} ${user.lastname}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (roleFilter !== "all") {
            result = result.filter((user) => user.roles?.some((role) => role.roleID === roleFilter));
        }
        result.sort((a, b) => {
            const fieldA = sortField === "name" ? `${a.firstname} ${a.lastname}` : sortField === "email" ? a.email : (a.roles?.length || 0);
            const fieldB = sortField === "name" ? `${b.firstname} ${b.lastname}` : sortField === "email" ? b.email : (b.roles?.length || 0);
            return sortOrder === "asc" ? (fieldA > fieldB ? 1 : -1) : (fieldA < fieldB ? 1 : -1);
        });
        return result;
    }, [users, searchQuery, sortField, sortOrder, roleFilter]);

    const filteredRoles = useMemo(() => {
        return roles.filter((role) =>
            role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            role.description?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [roles, searchQuery]);

    const categorizedPermissions = useMemo(() => {
        const byClass: { [key: string]: { [key: string]: Permission[] } } = {};
        permissions.forEach((perm) => {
            const formattedName = perm.name.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
            if (!byClass[perm.class]) byClass[perm.class] = {};
            if (!byClass[perm.class][perm.type]) byClass[perm.class][perm.type] = [];
            byClass[perm.class][perm.type].push({ ...perm, name: formattedName });
        });
        return byClass;
    }, [permissions]);

    const filteredPermissions = useMemo(() => {
        let result = permissions;
        if (permissionSearch) {
            result = result.filter((perm) =>
                perm.name.toLowerCase().includes(permissionSearch.toLowerCase()) ||
                perm.class.toLowerCase().includes(permissionSearch.toLowerCase()) ||
                perm.type.toLowerCase().includes(permissionSearch.toLowerCase())
            );
        }
        if (selectedCategory !== "all") {
            result = result.filter((perm) => perm.class === selectedCategory);
        }
        return result.reduce((acc, perm) => {
            const formattedName = perm.name.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
            if (!acc[perm.class]) acc[perm.class] = {};
            if (!acc[perm.class][perm.type]) acc[perm.class][perm.type] = [];
            acc[perm.class][perm.type].push({ ...perm, name: formattedName });
            return acc;
        }, {} as { [key: string]: { [key: string]: Permission[] } });
    }, [permissions, permissionSearch, selectedCategory]);

    // Memoized Supervisor/Manager Filters with Search
    const supervisorUsers = useMemo(() => {
        return users.filter(u => u.roles?.some(r => r.name === "Supervisor")).filter(s =>
            `${s.firstname} ${s.lastname}`.toLowerCase().includes(supervisorSearch.toLowerCase()) ||
            s.email.toLowerCase().includes(supervisorSearch.toLowerCase())
        );
    }, [users, supervisorSearch]);

    const managerUsers = useMemo(() => {
        return users.filter(u => u.roles?.some(r => r.name === "Manager")).filter(m =>
            `${m.firstname} ${m.lastname}`.toLowerCase().includes(managerSearch.toLowerCase()) ||
            m.email.toLowerCase().includes(managerSearch.toLowerCase())
        );
    }, [users, managerSearch]);

    // Paginated Supervisors and Managers
    const paginatedSupervisors = useMemo(() => {
        const start = (supervisorPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return supervisorUsers.slice(start, end);
    }, [supervisorUsers, supervisorPage]);

    const paginatedManagers = useMemo(() => {
        const start = (managerPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return managerUsers.slice(start, end);
    }, [managerUsers, managerPage]);

    const handleUserSelect = async (user: User) => {
        if ((hasUnsavedUserChanges || hasUnsavedSupervisorChanges) && !window.confirm('You have unsaved changes. Are you sure you want to proceed?')) return;
        setSelectedUser(user);
        try {
            const [userRoles, supervisors, managers] = await Promise.all([
                getRolesByUser(user.userID, token!),
                getSupervisorsByUser(user.userID, token!),
                getManagersByUser(user.userID, token!),
            ]);
            setUsers(users.map(u => u.userID === user.userID ? { ...u, roles: userRoles, supervisors, managers } : u));
            setTempRoles(userRoles);
            setTempSupervisors(supervisors || []);
            setTempManagers(managers || []);
            setHasUnsavedUserChanges(false);
            setHasUnsavedSupervisorChanges(false);
            setSupervisorSearch("");
            setManagerSearch("");
            setSupervisorPage(1);
            setManagerPage(1);
            setView("user-details");
        } catch (error) {
            console.error("Failed to fetch user details:", error);
        }
    };

    const handleRoleSelect = async (role: Role) => {
        if (role.name === 'Admin' || role.name === 'Super Admin') {
            alert('Fixed roles cannot be modified.');
            return;
        }
        const fixedRoles = ['Manager', 'Supervisor', 'Purchase', 'Regional Manager', 'Stock Manager'];
        if (fixedRoles.includes(role.name) && !window.confirm('Warning: Modifying pre-made roles may affect system functionality. Are you sure you want to proceed?')) {
            return;
        }
        if (hasUnsavedChanges && !window.confirm('You have unsaved changes. Are you sure you want to switch roles?')) return;

        setSelectedRole(role);
        try {
            const rolePermissions = await getPermissionsByRole(role.roleID, token!);
            setRoles(roles.map(r => r.roleID === role.roleID ? { ...r, permissions: rolePermissions } : r));
            setTempPermissions(rolePermissions);
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error("Failed to fetch role permissions:", error);
        }
    };

    const handleTogglePermission = (permissionID: string) => {
        const hasPermission = tempPermissions.some(perm => perm.permissionID === permissionID);
        if (hasPermission) {
            setTempPermissions(tempPermissions.filter(p => p.permissionID !== permissionID));
        } else {
            const newPermission = permissions.find(p => p.permissionID === permissionID);
            if (newPermission) setTempPermissions([...tempPermissions, newPermission]);
        }
        setHasUnsavedChanges(true);
    };

    const handleSavePermissions = async () => {
        if (!selectedRole) return;
        setLoading(true);
        try {
            const currentPermissionIds = selectedRole.permissions?.map(p => p.permissionID) || [];
            const newPermissionIds = tempPermissions.map(p => p.permissionID);
            const toAdd = newPermissionIds.filter(id => !currentPermissionIds.includes(id));
            if (toAdd.length > 0) await assignPermissionsToRole(selectedRole.roleID, toAdd, token!);
            setRoles(roles.map(r => r.roleID === selectedRole.roleID ? { ...r, permissions: tempPermissions } : r));
            setSelectedRole({ ...selectedRole, permissions: tempPermissions });
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error("Failed to save permissions:", error);
            setTempPermissions(selectedRole.permissions || []);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleRole = (role: Role) => {
        const hasRole = tempRoles.some(r => r.roleID === role.roleID);
        if (hasRole) {
            setTempRoles(tempRoles.filter(r => r.roleID !== role.roleID));
        } else {
            setTempRoles([...tempRoles, role]);
        }
        setHasUnsavedUserChanges(true);
    };

    const handleSaveUserRoles = async () => {
        if (!selectedUser) return;
        setLoading(true);
        try {
            const currentRoleIds = selectedUser.roles?.map(r => r.roleID) || [];
            const newRoleIds = tempRoles.map(r => r.roleID);
            const toAdd = newRoleIds.filter(id => !currentRoleIds.includes(id));
            if (toAdd.length > 0) await assignRolesToUser(selectedUser.userID, toAdd, token!);
            setUsers(users.map(u => u.userID === selectedUser.userID ? { ...u, roles: tempRoles } : u));
            setSelectedUser({ ...selectedUser, roles: tempRoles });
            setHasUnsavedUserChanges(false);
        } catch (error) {
            console.error("Failed to save roles:", error);
            setTempRoles(selectedUser.roles || []);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSupervisor = (supervisor: User) => {
        const hasSupervisor = tempSupervisors.some(s => s.userID === supervisor.userID);
        if (hasSupervisor) {
            setTempSupervisors(tempSupervisors.filter(s => s.userID !== supervisor.userID));
        } else {
            setTempSupervisors([...tempSupervisors, supervisor]);
        }
        setHasUnsavedSupervisorChanges(true);
    };

    const handleToggleManager = (manager: User) => {
        const hasManager = tempManagers.some(m => m.userID === manager.userID);
        if (hasManager) {
            setTempManagers(tempManagers.filter(m => m.userID !== manager.userID));
        } else {
            setTempManagers([...tempManagers, manager]);
        }
        setHasUnsavedSupervisorChanges(true);
    };

    const handleSaveSupervisorsAndManagers = async () => {
        if (!selectedUser) return;
        setLoading(true);
        try {
            const supervisorIds = tempSupervisors.map(s => s.userID);
            const managerIds = tempManagers.map(m => m.userID);

            const isManager = selectedUser.roles?.some(r => r.name === "Manager");
            if (isManager && supervisorIds.length > 0) {
                await assignSupervisorsToManager(selectedUser.userID, supervisorIds, token!);
            }

            const isSupervisor = selectedUser.roles?.some(r => r.name === "Supervisor");
            if (isSupervisor && managerIds.length > 0) {
                await Promise.all(managerIds.map(managerId =>
                    assignSupervisorsToManager(managerId, [selectedUser.userID], token!)
                ));
            }

            setUsers(users.map(u => u.userID === selectedUser.userID ? { ...u, supervisors: tempSupervisors, managers: tempManagers } : u));
            setSelectedUser({ ...selectedUser, supervisors: tempSupervisors, managers: tempManagers });
            setHasUnsavedSupervisorChanges(false);
        } catch (error) {
            console.error("Failed to save supervisors/managers:", error);
            setTempSupervisors(selectedUser.supervisors || []);
            setTempManagers(selectedUser.managers || []);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async () => {
        if (newUser.password !== passwordConfirm) {
            alert("Passwords do not match!");
            return;
        }
        try {
            const createdUser = await createUser({ ...newUser }, token!);
            if (selectedRolesForNewUser.length > 0) {
                await assignRolesToUser(createdUser.userID, selectedRolesForNewUser, token!);
                createdUser.roles = await getRolesByUser(createdUser.userID, token!);
            }
            setUsers([...users, createdUser]);
            setNewUser({});
            setPasswordConfirm("");
            setSelectedRolesForNewUser([]);
            setView("users");
        } catch (error) {
            console.error("Failed to create user:", error);
        }
    };

    const handleCreateRole = async () => {
        try {
            const createdRole = await createRole({ name: newRole.name, description: newRole.description }, token!);
            if (selectedPermissionsForNewRole.length > 0) {
                await assignPermissionsToRole(createdRole.roleID, selectedPermissionsForNewRole, token!);
                createdRole.permissions = await getPermissionsByRole(createdRole.roleID, token!);
            }
            setRoles([...roles, createdRole]);
            setNewRole({});
            setSelectedPermissionsForNewRole([]);
            setView("roles");
        } catch (error) {
            console.error("Failed to create role:", error);
        }
    };

    const handleBack = () => {
        setSelectedUser(null);
        setSelectedRole(null);
        setView(view === "user-details" || view === "add-user" ? "users" : "roles");
    };

    useEffect(() => {
        if (selectedRole) setTempPermissions(selectedRole.permissions || []);
    }, [selectedRole]);

    useEffect(() => {
        if (selectedUser) setTempRoles(selectedUser.roles || []);
    }, [selectedUser]);

    const toggleRolePopup = (roleID: string) => {
        setActiveRolePopup(activeRolePopup === roleID ? null : roleID);
        setExpandedClasses(new Set());
    };

    const toggleClassExpansion = (className: string) => {
        setExpandedClasses(prev => {
            const newSet = new Set(prev);
            if (newSet.has(className)) newSet.delete(className);
            else newSet.add(className);
            return newSet;
        });
    };

    const getCategorizedPermissionsForRole = (role: Role) => {
        const byClass: { [key: string]: Permission[] } = {};
        role.permissions?.forEach(perm => {
            const formattedName = perm.name.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
            if (!byClass[perm.class]) byClass[perm.class] = [];
            byClass[perm.class].push({ ...perm, name: formattedName });
        });
        return byClass;
    };

    if (loading) return <div className="loading-text">Loading Admin Dashboard...</div>;

    return (
        <div className="admin-dashboard">
            <header className="dashboard-header">
                <h1>
                    {view === "users" && "Users Management"}
                    {view === "roles" && "Roles Management"}
                    {view === "add-user" && (newUser.userID ? "Edit User" : "Add New User")}
                    {view === "add-role" && "Create New Role"}
                    {view === "user-details" && selectedUser && `${selectedUser.firstname} ${selectedUser.lastname}`}
                </h1>
                {(view === "users" || view === "roles") && (
                    <div className="search-container">
                        <FaSearch className="search-icon" />
                        <input
                            type="text"
                            placeholder={view === "roles" ? "Search roles..." : "Search users..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                    </div>
                )}
                {(view === "add-user" || view === "add-role" || view === "user-details") && (
                    <button className="back-button" onClick={handleBack}>
                        <FaArrowLeft /> Back
                    </button>
                )}
            </header>

            <section className="dashboard-content">
                <aside className="sidebar">
                    <div className="filter-card">
                        <h3>View</h3>
                        <button className={view === "users" || view === "add-user" || view === "user-details" ? "active" : ""} onClick={() => setView("users")}>
                            Users Management
                        </button>
                        <button className={view === "roles" || view === "add-role" ? "active" : ""} onClick={() => setView("roles")}>
                            Roles Management
                        </button>
                    </div>
                    {(view === "users" || view === "add-user" || view === "user-details") && (
                        <>
                            <div className="sort-card">
                                <h3>Sort Users By</h3>
                                <select value={sortField} onChange={(e) => setSortField(e.target.value as "name" | "email" | "roleCount")}>
                                    <option value="name">Name</option>
                                    <option value="email">Email</option>
                                    <option value="roleCount">Role Count</option>
                                </select>
                                <button onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}>
                                    <FaSort /> {sortOrder === "asc" ? "Asc" : "Desc"}
                                </button>
                            </div>
                            <div className="role-filter-card">
                                <h3>Filter by Role</h3>
                                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                                    <option value="all">All Roles</option>
                                    {roles.map((role) => (
                                        <option key={role.roleID} value={role.roleID}>{role.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button className="action-button" onClick={() => { setNewUser({}); setView("add-user"); }}>
                                <FaUserPlus /> Add User
                            </button>
                        </>
                    )}
                    {(view === "roles" || view === "add-role") && (
                        <button className="action-button" onClick={() => { setNewRole({}); setView("add-role"); }}>
                            <FaPlus /> Create Role
                        </button>
                    )}
                </aside>

                <main className="main-content">
                    {view === "users" && (
                        <div className="users-list">
                            <div className="table-card">
                                <h2>Users</h2>
                                <div className="table-container">
                                    <div className="table-head">
                                        <div className="table-row">
                                            <div className="table-cell">Name</div>
                                            <div className="table-cell">Email</div>
                                            <div className="table-cell">Phone</div>
                                            <div className="table-cell">Roles</div>
                                        </div>
                                    </div>
                                    <div className="table-body">
                                        {filteredUsers.map((user) => (
                                            <div
                                                key={user.userID}
                                                className="table-row user-row"
                                                onClick={() => handleUserSelect(user)}
                                            >
                                                <div className="table-cell">{`${user.firstname} ${user.lastname}`}</div>
                                                <div className="table-cell">{user.email}</div>
                                                <div className="table-cell">{user.phone}</div>
                                                <div className="table-cell">{user.roles?.length || 0}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {view === "roles" && (
                        <div className="roles-management">
                            {/* ... (unchanged roles management section) ... */}
                            {(() => {
                                const fixedRoles = filteredRoles.filter(role =>
                                    ['Admin', 'Super Admin'].includes(role.name)
                                );
                                if (fixedRoles.length > 0) {
                                    return (
                                        <div className="role-category-section">
                                            <h2 className="role-category-header">Fixed Roles</h2>
                                            <div className="roles-grid">
                                                {fixedRoles.map((role) => (
                                                    <div
                                                        key={role.roleID}
                                                        className={`role-card fix ${selectedRole?.roleID === role.roleID ? "selected" : ""}`}
                                                        onClick={() => handleRoleSelect(role)}
                                                    >
                                                        <div className="role-card-header">
                                                            <h3>{role.name}</h3>
                                                            <FaInfoCircle
                                                                className="role-info-icon"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleRolePopup(role.roleID);
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="permission-count">
                                                            {role.permissions?.length || 0} Permissions
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {(() => {
                                const premadeRoles = filteredRoles.filter(role =>
                                    ['Manager', 'Supervisor', 'Purchase', 'Regional Manager', 'Stock Manager'].includes(role.name)
                                );
                                if (premadeRoles.length > 0) {
                                    return (
                                        <div className="role-category-section">
                                            <h2 className="role-category-header">Pre-made Roles</h2>
                                            <div className="roles-grid">
                                                {premadeRoles.map((role) => (
                                                    <div
                                                        key={role.roleID}
                                                        className={`role-card premade ${selectedRole?.roleID === role.roleID ? "selected" : ""}`}
                                                        onClick={() => handleRoleSelect(role)}
                                                    >
                                                        <h3>{role.name}</h3>
                                                        <span className="permission-count">
                                                            {role.permissions?.length || 0} Permissions
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {(() => {
                                const customRoles = filteredRoles.filter(role =>
                                    !['Admin', 'Super Admin', 'Manager', 'Supervisor', 'Purchase', 'Regional Manager', 'Stock Manager'].includes(role.name)
                                );
                                if (customRoles.length > 0) {
                                    return (
                                        <div className="role-category-section">
                                            <h2 className="role-category-header">Custom Roles</h2>
                                            <div className="roles-grid">
                                                {customRoles.map((role) => (
                                                    <div
                                                        key={role.roleID}
                                                        className={`role-card ${selectedRole?.roleID === role.roleID ? "selected" : ""}`}
                                                        onClick={() => handleRoleSelect(role)}
                                                    >
                                                        <h3>{role.name}</h3>
                                                        <span className="permission-count">
                                                            {role.permissions?.length || 0} Permissions
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {activeRolePopup && (
                                <div className="role-info-popup-overlay" onClick={() => setActiveRolePopup(null)}>
                                    <div className="role-info-popup" onClick={(e) => e.stopPropagation()}>
                                        {roles.find(role => role.roleID === activeRolePopup) && (
                                            <>
                                                <h4>{roles.find(role => role.roleID === activeRolePopup)!.name}</h4>
                                                <p>{roles.find(role => role.roleID === activeRolePopup)!.description || 'No description available'}</p>
                                                <h5>Permissions by Class:</h5>
                                                {Object.entries(getCategorizedPermissionsForRole(roles.find(role => role.roleID === activeRolePopup)!)).length > 0 ? (
                                                    Object.entries(getCategorizedPermissionsForRole(roles.find(role => role.roleID === activeRolePopup)!)).map(([className, perms]) => (
                                                        <div key={className} className="permission-class-item">
                                                            <button
                                                                className="class-toggle"
                                                                onClick={() => toggleClassExpansion(className)}
                                                            >
                                                                {className} ({perms.length})
                                                                <FaAngleDown className={`toggle-icon ${expandedClasses.has(className) ? 'expanded' : ''}`} />
                                                            </button>
                                                            <ul className={`permission-list ${expandedClasses.has(className) ? 'expanded' : ''}`}>
                                                                {perms.map(perm => (
                                                                    <li key={perm.permissionID}>{perm.name}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p>No permissions assigned</p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {selectedRole && (
                                <div className="details-card">
                                    <div className="card-header">
                                        <h2>{selectedRole.name}</h2>
                                        {hasUnsavedChanges && (
                                            <button className="action-button" onClick={handleSavePermissions} disabled={loading}>
                                                {loading ? 'Saving...' : 'Save Changes'}
                                            </button>
                                        )}
                                    </div>
                                    <p>{selectedRole.description}</p>
                                    <h3>Permissions</h3>
                                    <div className="permissions-list">
                                        {Object.entries(categorizedPermissions).map(([className, types]) => (
                                            <div key={className} className="permission-class">
                                                <h4>{className}</h4>
                                                {Object.entries(types).map(([type, perms]) => (
                                                    <div key={type} className="permission-type">
                                                        <h5>{type}</h5>
                                                        {perms.map((perm) => (
                                                            <button
                                                                key={perm.permissionID}
                                                                className={`permission-button ${tempPermissions.some(p => p.permissionID === perm.permissionID) ? "assigned" : ""}`}
                                                                onClick={() => handleTogglePermission(perm.permissionID)}
                                                                disabled={loading}
                                                            >
                                                                {perm.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {view === "add-user" && (
                        <div className="form-card form-card-0">
                            {/* ... (unchanged add-user section) ... */}
                            <div className="form-section">
                                <h3>Personal Information</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>First Name *</label>
                                        <input
                                            type="text"
                                            value={newUser.firstname || ""}
                                            onChange={(e) => setNewUser({ ...newUser, firstname: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Last Name *</label>
                                        <input
                                            type="text"
                                            value={newUser.lastname || ""}
                                            onChange={(e) => setNewUser({ ...newUser, lastname: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="form-section">
                                <h3>Contact Information</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Email *</label>
                                        <input
                                            type="email"
                                            value={newUser.email || ""}
                                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Phone *</label>
                                        <input
                                            type="text"
                                            value={newUser.phone || ""}
                                            onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="form-section">
                                <h3>Credentials</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Password *</label>
                                        <input
                                            type="password"
                                            value={newUser.password || ""}
                                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Confirm Password *</label>
                                        <input
                                            type="password"
                                            value={passwordConfirm}
                                            onChange={(e) => setPasswordConfirm(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="form-section">
                                <h3>Financial Information</h3>
                                <div className="form-group">
                                    <label>Wallet *</label>
                                    <input
                                        type="text"
                                        value={newUser.wallet || ""}
                                        onChange={(e) => setNewUser({ ...newUser, wallet: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-section">
                                <h3>Role Assignment</h3>
                                <div className="form-group">
                                    <label>Assign Roles *</label>
                                    <div className="roles-grid">
                                        {roles.map((role) => (
                                            <div key={role.roleID} className="role-toggle-container">
                                                <button
                                                    className={`role-toggle-button ${selectedRolesForNewUser.includes(role.roleID) ? "active" : ""}`}
                                                    onClick={() => {
                                                        setSelectedRolesForNewUser(prev =>
                                                            prev.includes(role.roleID)
                                                                ? prev.filter(id => id !== role.roleID)
                                                                : [...prev, role.roleID]
                                                        );
                                                    }}
                                                >
                                                    <span>{role.name}</span>
                                                    <FaInfoCircle
                                                        className="role-info-icon"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleRolePopup(role.roleID);
                                                        }}
                                                    />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button className="action-button" onClick={handleCreateUser}>
                                {newUser.userID ? "Update User" : "Create User"}
                            </button>
                            {activeRolePopup && (
                                <div className="role-info-popup-overlay" onClick={() => setActiveRolePopup(null)}>
                                    <div className="role-info-popup" onClick={(e) => e.stopPropagation()}>
                                        {roles.find(role => role.roleID === activeRolePopup) && (
                                            <>
                                                <h4>{roles.find(role => role.roleID === activeRolePopup)!.name}</h4>
                                                <p>{roles.find(role => role.roleID === activeRolePopup)!.description || 'No description available'}</p>
                                                <h5>Permissions by Class:</h5>
                                                {Object.entries(getCategorizedPermissionsForRole(roles.find(role => role.roleID === activeRolePopup)!)).length > 0 ? (
                                                    Object.entries(getCategorizedPermissionsForRole(roles.find(role => role.roleID === activeRolePopup)!)).map(([className, perms]) => (
                                                        <div key={className} className="permission-class-item">
                                                            <button
                                                                className="class-toggle"
                                                                onClick={() => toggleClassExpansion(className)}
                                                            >
                                                                {className} ({perms.length})
                                                                <FaAngleDown className={`toggle-icon ${expandedClasses.has(className) ? 'expanded' : ''}`} />
                                                            </button>
                                                            <ul className={`permission-list ${expandedClasses.has(className) ? 'expanded' : ''}`}>
                                                                {perms.map(perm => (
                                                                    <li key={perm.permissionID}>{perm.name}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p>No permissions assigned</p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {view === "add-role" && (
                        <div className="form-card form-card-0">
                            {/* ... (unchanged add-role section) ... */}
                            <div className="form-section">
                                <h3>Role Details</h3>
                                <div className="form-group">
                                    <label>Name</label>
                                    <input
                                        type="text"
                                        value={newRole.name || ""}
                                        onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                        value={newRole.description || ""}
                                        onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-section">
                                <h3>Permissions</h3>
                                <div className="form-group">
                                    <label>Assign Permissions</label>
                                    <div className="permissions-filter-section">
                                        <div className="permissions-filter-header">
                                            <FaFilter />
                                            <label>Filter Permissions</label>
                                        </div>
                                        <div className="permissions-filter-controls">
                                            <div className="permissions-search">
                                                <input
                                                    type="text"
                                                    placeholder="Search permissions..."
                                                    value={permissionSearch}
                                                    onChange={(e) => setPermissionSearch(e.target.value)}
                                                />
                                            </div>
                                            <div className="permissions-category">
                                                <select
                                                    value={selectedCategory}
                                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                                >
                                                    <option value="all">All Categories</option>
                                                    {Object.keys(categorizedPermissions).map((category) => (
                                                        <option key={category} value={category}>
                                                            {category.charAt(0).toUpperCase() + category.slice(1)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="permissions-grid">
                                        {Object.entries(filteredPermissions).map(([className, types]) => (
                                            <div key={className} className="permission-class">
                                                <h4>{className}</h4>
                                                {Object.entries(types).map(([type, perms]) => (
                                                    <div key={type} className="permission-type">
                                                        <h5>{type}</h5>
                                                        {perms.map((perm) => (
                                                            <button
                                                                key={perm.permissionID}
                                                                className={`permission-button ${selectedPermissionsForNewRole.includes(perm.permissionID) ? "assigned" : ""}`}
                                                                onClick={() => {
                                                                    setSelectedPermissionsForNewRole(prev =>
                                                                        prev.includes(perm.permissionID)
                                                                            ? prev.filter(id => id !== perm.permissionID)
                                                                            : [...prev, perm.permissionID]
                                                                    );
                                                                }}
                                                            >
                                                                {perm.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button className="action-button" onClick={handleCreateRole}>Create Role</button>
                        </div>
                    )}

                    {view === "user-details" && selectedUser && (
                        <div className="details-card">
                            <div className="card-header">
                                <h2>User Details</h2>
                            </div>
                            <hr />
                            <div className="form-section">
                                <h3>Basic Information</h3>
                                <div className="info-grid">
                                    <p><strong>Email:</strong> {selectedUser.email}</p>
                                    <p><strong>Phone:</strong> {selectedUser.phone}</p>
                                    <p><strong>Wallet:</strong> {selectedUser.wallet}</p>
                                </div>
                            </div>
                            <div className="form-section">
                                <div className="group-header">
                                    <h3>Role Management</h3>
                                    {hasUnsavedUserChanges && (
                                        <button className="action-button" onClick={handleSaveUserRoles} disabled={loading}>
                                            {loading ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    )}
                                </div>
                                <div className="roles-grid">
                                    {roles.map((role) => (
                                        <div key={role.roleID} className="role-toggle-container">
                                            <button
                                                className={`role-toggle-button ${tempRoles.some(r => r.roleID === role.roleID) ? "active" : ""}`}
                                                onClick={() => handleToggleRole(role)}
                                                disabled={loading}
                                            >
                                                <span>{role.name}</span>
                                                <FaInfoCircle
                                                    className="role-info-icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleRolePopup(role.roleID);
                                                    }}
                                                />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {(selectedUser.roles?.some(r => r.name === "Manager") || selectedUser.roles?.some(r => r.name === "Supervisor")) && (
                                <div className="form-section">
                                    <div className="group-header">
                                        <h3>Supervisor/Manager Assignments</h3>
                                        {hasUnsavedSupervisorChanges && (
                                            <button className="action-button" onClick={handleSaveSupervisorsAndManagers} disabled={loading}>
                                                {loading ? 'Saving...' : 'Save Assignments'}
                                            </button>
                                        )}
                                    </div>
                                    {selectedUser.roles?.some(r => r.name === "Manager") && (
                                        <div className="assignment-list">
                                            <h4>Supervisors Assigned to This Manager</h4>
                                            <div className="search-container assignment-search">
                                                <FaSearch className="search-icon" />
                                                <input
                                                    type="text"
                                                    placeholder="Search supervisors..."
                                                    value={supervisorSearch}
                                                    onChange={(e) => setSupervisorSearch(e.target.value)}
                                                    className="search-input"
                                                />
                                            </div>
                                            <div className="list-container">
                                                {paginatedSupervisors.map((supervisor) => (
                                                    <div key={supervisor.userID} className="list-item">
                                                        <label>
                                                            <input
                                                                type="checkbox"
                                                                checked={tempSupervisors.some(s => s.userID === supervisor.userID)}
                                                                onChange={() => handleToggleSupervisor(supervisor)}
                                                                disabled={loading}
                                                            />
                                                            {`${supervisor.firstname} ${supervisor.lastname} (${supervisor.email})`}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="pagination">
                                                <button
                                                    onClick={() => setSupervisorPage(p => Math.max(1, p - 1))}
                                                    disabled={supervisorPage === 1}
                                                >
                                                    Previous
                                                </button>
                                                <span>Page {supervisorPage} of {Math.ceil(supervisorUsers.length / ITEMS_PER_PAGE)}</span>
                                                <button
                                                    onClick={() => setSupervisorPage(p => p + 1)}
                                                    disabled={supervisorPage >= Math.ceil(supervisorUsers.length / ITEMS_PER_PAGE)}
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {selectedUser.roles?.some(r => r.name === "Supervisor") && (
                                        <div className="assignment-list">
                                            <h4>Managers Assigned to This Supervisor</h4>
                                            <div className="search-container assignment-search">
                                                <FaSearch className="search-icon" />
                                                <input
                                                    type="text"
                                                    placeholder="Search managers..."
                                                    value={managerSearch}
                                                    onChange={(e) => setManagerSearch(e.target.value)}
                                                    className="search-input"
                                                />
                                            </div>
                                            <div className="list-container">
                                                {paginatedManagers.map((manager) => (
                                                    <div key={manager.userID} className="list-item">
                                                        <label>
                                                            <input
                                                                type="checkbox"
                                                                checked={tempManagers.some(m => m.userID === manager.userID)}
                                                                onChange={() => handleToggleManager(manager)}
                                                                disabled={loading}
                                                            />
                                                            {`${manager.firstname} ${manager.lastname} (${manager.email})`}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="pagination">
                                                <button
                                                    onClick={() => setManagerPage(p => Math.max(1, p - 1))}
                                                    disabled={managerPage === 1}
                                                >
                                                    Previous
                                                </button>
                                                <span>Page {managerPage} of {Math.ceil(managerUsers.length / ITEMS_PER_PAGE)}</span>
                                                <button
                                                    onClick={() => setManagerPage(p => p + 1)}
                                                    disabled={managerPage >= Math.ceil(managerUsers.length / ITEMS_PER_PAGE)}
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {activeRolePopup && (
                                <div className="role-info-popup-overlay" onClick={() => setActiveRolePopup(null)}>
                                    <div className="role-info-popup" onClick={(e) => e.stopPropagation()}>
                                        {roles.find(role => role.roleID === activeRolePopup) && (
                                            <>
                                                <h4>{roles.find(role => role.roleID === activeRolePopup)!.name}</h4>
                                                <p>{roles.find(role => role.roleID === activeRolePopup)!.description || 'No description available'}</p>
                                                <h5>Permissions by Class:</h5>
                                                {Object.entries(getCategorizedPermissionsForRole(roles.find(role => role.roleID === activeRolePopup)!)).length > 0 ? (
                                                    Object.entries(getCategorizedPermissionsForRole(roles.find(role => role.roleID === activeRolePopup)!)).map(([className, perms]) => (
                                                        <div key={className} className="permission-class-item">
                                                            <button
                                                                className="class-toggle"
                                                                onClick={() => toggleClassExpansion(className)}
                                                            >
                                                                {className} ({perms.length})
                                                                <FaAngleDown className={`toggle-icon ${expandedClasses.has(className) ? 'expanded' : ''}`} />
                                                            </button>
                                                            <ul className={`permission-list ${expandedClasses.has(className) ? 'expanded' : ''}`}>
                                                                {perms.map(perm => (
                                                                    <li key={perm.permissionID}>{perm.name}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p>No permissions assigned</p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </section>
        </div>
    );
};

export default AdminDashboard;
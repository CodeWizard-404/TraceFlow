// src/pages/AdminDashboard.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
    getAllUsers,
    createUser,
    getUserById,
    assignRolesToUser,
    getRolesByUser,
} from "../../apis/userAPI";
import {
    getAllRoles,
    createRole,
    getRoleById,
    assignPermissionsToRole,
    getPermissionsByRole,
} from "../../apis/roleAPI";
import { getAllPermissions } from "../../apis/permissionAPI";
import User from "../../models/User";
import Role from "../../models/Role";
import Permission from "../../models/Permission";
import "./AdminDashboard.css";

const AdminDashboard: React.FC = () => {
    const { user, token, logout } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [activeTab, setActiveTab] = useState<"users" | "roles">("users");
    const [modal, setModal] = useState<{ type: "user" | "role" | null; data?: User | Role | null }>({ type: null, data: null });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            navigate("/login");
            return;
        }
        const fetchData = async () => {
            setLoading(true);
            try {
                const [usersData, rolesData, permissionsData] = await Promise.all([
                    getAllUsers(token),
                    getAllRoles(token),
                    getAllPermissions(token),
                ]);
                setUsers(usersData);
                setRoles(rolesData);
                setPermissions(permissionsData);
            } catch (err) {
                setError("Failed to load data.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token, navigate]);

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const openModal = (type: "user" | "role", data?: User | Role | null) => setModal({ type, data });
    const closeModal = () => setModal({ type: null });

    if (!token) return null;

    return (
        <div className="admin-dashboard-container">
            <header className="dashboard-header">
                <h1>Admin Dashboard</h1>
                <div className="header-actions">
                    <span>Welcome, {user?.firstname} {user?.lastname}</span>
                    <button className="logout-btn" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </header>
            <nav className="tab-nav">
                <button
                    className={`tab-btn ${activeTab === "users" ? "active" : ""}`}
                    onClick={() => setActiveTab("users")}
                >
                    Users
                </button>
                <button
                    className={`tab-btn ${activeTab === "roles" ? "active" : ""}`}
                    onClick={() => setActiveTab("roles")}
                >
                    Roles
                </button>
            </nav>
            <main className="dashboard-content">
                {loading ? (
                    <div className="loading">Loading...</div>
                ) : (
                    <>
                        {error && <p className="error">{error}</p>}
                        {activeTab === "users" && (
                            <UsersTab
                                users={users}
                                roles={roles}
                                token={token!}
                                setUsers={setUsers}
                                openModal={openModal}
                            />
                        )}
                        {activeTab === "roles" && (
                            <RolesTab
                                roles={roles}
                                permissions={permissions}
                                token={token!}
                                setRoles={setRoles}
                                openModal={openModal}
                            />
                        )}
                    </>
                )}
            </main>
            {modal.type && (
                <Modal
                    type={modal.type}
                    data={modal.data}
                    token={token!}
                    roles={roles}
                    permissions={permissions}
                    onClose={closeModal}
                    onSave={(data) => {
                        if (modal.type === "user") setUsers((prev) => [...prev, data as User]);
                        else if (modal.type === "role") setRoles((prev) => [...prev, data as Role]);
                        closeModal();
                    }}
                />
            )}
        </div>
    );
};

// Users Tab
const UsersTab: React.FC<{
    users: User[];
    roles: Role[];
    token: string;
    setUsers: (users: User[]) => void;
    openModal: (type: "user", data?: User | null) => void;
}> = ({ users, roles, token, setUsers, openModal }) => {
    const handleAssignRoles = async (userId: string, roleIds: string[]) => {
        try {
            await assignRolesToUser(userId, roleIds, token);
            const updatedUser = await getUserById(userId, token);
            setUsers(users.map((u) => (u.userID === userId ? updatedUser : u)));
        } catch (err) {
            console.error("Failed to assign roles:", err);
        }
    };

    return (
        <div className="tab-content">
            <div className="tab-header">
                <h2>Users</h2>
                <button className="action-btn" onClick={() => openModal("user")}>
                    + Add User
                </button>
            </div>
            <div className="list-container">
                {users.map((user) => (
                    <UserItem key={user.userID} user={user} roles={roles} token={token} onAssignRoles={handleAssignRoles} />
                ))}
            </div>
        </div>
    );
};

// Roles Tab
const RolesTab: React.FC<{
    roles: Role[];
    permissions: Permission[];
    token: string;
    setRoles: (roles: Role[]) => void;
    openModal: (type: "role", data?: Role | null) => void;
}> = ({ roles, permissions, token, setRoles, openModal }) => {
    const handleAssignPermissions = async (roleId: string, permissionIds: string[]) => {
        try {
            await assignPermissionsToRole(roleId, permissionIds, token);
            const updatedRole = await getRoleById(roleId, token);
            setRoles(roles.map((r) => (r.roleID === roleId ? updatedRole : r)));
        } catch (err) {
            console.error("Failed to assign permissions:", err);
        }
    };

    return (
        <div className="tab-content">
            <div className="tab-header">
                <h2>Roles</h2>
                <button className="action-btn" onClick={() => openModal("role")}>
                    + Add Role
                </button>
            </div>
            <div className="list-container">
                {roles.map((role) => (
                    <RoleItem
                        key={role.roleID}
                        role={role}
                        permissions={permissions}
                        token={token}
                        onAssignPermissions={handleAssignPermissions}
                    />
                ))}
            </div>
        </div>
    );
};

// User Item
const UserItem: React.FC<{
    user: User;
    roles: Role[];
    token: string;
    onAssignRoles: (userId: string, roleIds: string[]) => void;
}> = ({ user, roles, token, onAssignRoles }) => {
    const [userRoles, setUserRoles] = useState<Role[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const fetchRoles = async () => {
            const rolesData = await getRolesByUser(user.userID, token);
            setUserRoles(rolesData);
        };
        fetchRoles();
    }, [user.userID, token]);

    const handleChange = (roleId: string, checked: boolean) => {
        const updatedRoles = checked
            ? [...userRoles.map((r) => r.roleID), roleId]
            : userRoles.map((r) => r.roleID).filter((id) => id !== roleId);
        onAssignRoles(user.userID, updatedRoles);
    };

    return (
        <div className="list-item">
            <div className="item-header" onClick={() => setIsOpen(!isOpen)}>
                <span>{user.firstname} {user.lastname} ({user.email})</span>
                <span className="toggle-icon">{isOpen ? "−" : "+"}</span>
            </div>
            {isOpen && (
                <div className="item-details">
                    <p>Phone: {user.phone}</p>
                    <h3>Roles</h3>
                    <div className="assignment-list">
                        {roles.map((role) => (
                            <label key={role.roleID} className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={userRoles.some((r) => r.roleID === role.roleID)}
                                    onChange={(e) => handleChange(role.roleID, e.target.checked)}
                                />
                                {role.name}
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Role Item
const RoleItem: React.FC<{
    role: Role;
    permissions: Permission[];
    token: string;
    onAssignPermissions: (roleId: string, permissionIds: string[]) => void;
}> = ({ role, permissions, token, onAssignPermissions }) => {
    const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const fetchPermissions = async () => {
            const permissionsData = await getPermissionsByRole(role.roleID, token);
            setRolePermissions(permissionsData);
        };
        fetchPermissions();
    }, [role.roleID, token]);

    const handleChange = (permissionId: string, checked: boolean) => {
        const updatedPermissions = checked
            ? [...rolePermissions.map((p) => p.permissionID), permissionId]
            : rolePermissions.map((p) => p.permissionID).filter((id) => id !== permissionId);
        onAssignPermissions(role.roleID, updatedPermissions);
    };

    return (
        <div className="list-item">
            <div className="item-header" onClick={() => setIsOpen(!isOpen)}>
                <span>{role.name}</span>
                <span className="toggle-icon">{isOpen ? "−" : "+"}</span>
            </div>
            {isOpen && (
                <div className="item-details">
                    <p>{role.description || "No description"}</p>
                    <h3>Permissions</h3>
                    <div className="assignment-list">
                        {permissions.map((permission) => (
                            <label key={permission.permissionID} className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={rolePermissions.some((p) => p.permissionID === permission.permissionID)}
                                    onChange={(e) => handleChange(permission.permissionID, e.target.checked)}
                                />
                                {permission.name} ({permission.type})
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Modal for Creating Users/Roles
const Modal: React.FC<{
    type: "user" | "role";
    data?: User | Role | null;
    token: string;
    roles: Role[];
    permissions: Permission[];
    onClose: () => void;
    onSave: (data: User | Role) => void;
}> = ({ type, token, onClose, onSave }) => {
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        try {
            if (type === "user") {
                const userData: Partial<User> = {
                    firstname: formData.get("firstname") as string,
                    lastname: formData.get("lastname") as string,
                    email: formData.get("email") as string,
                    phone: formData.get("phone") as string,
                    wallet: formData.get("wallet") as string,
                };
                const newUser = await createUser(userData, token);
                onSave(newUser);
            } else if (type === "role") {
                const roleData: Partial<Role> = {
                    name: formData.get("name") as string,
                    description: formData.get("description") as string,
                };
                const newRole = await createRole(roleData, token);
                onSave(newRole);
            }
        } catch (err) {
            console.error(`Failed to create ${type}:`, err);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Create {type === "user" ? "User" : "Role"}</h2>
                <form onSubmit={handleSubmit}>
                    {type === "user" ? (
                        <>
                            <input name="firstname" placeholder="First Name" required className="form-control" />
                            <input name="lastname" placeholder="Last Name" required className="form-control" />
                            <input name="email" type="email" placeholder="Email" required className="form-control" />
                            <input name="phone" placeholder="Phone" required className="form-control" />
                            <input name="wallet" placeholder="Wallet" required className="form-control" />
                        </>
                    ) : (
                        <>
                            <input name="name" placeholder="Role Name" required className="form-control" />
                            <input name="description" placeholder="Description" className="form-control" />
                        </>
                    )}
                    <div className="modal-actions">
                        <button type="button" className="cancel-btn" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="submit-btn">
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminDashboard;
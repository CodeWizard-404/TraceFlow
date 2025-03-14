// src/pages/AdminDashboard.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";
import { getAllPermissions } from "../../apis/permissionAPI";
import { getAllRoles } from "../../apis/roleAPI";
import { getAllUsers, createUser } from "../../apis/userAPI";
import { useAuth } from "../../context/AuthContext";
import Permission from "../../models/Permission";
import Role from "../../models/Role";
import User from "../../models/User";

const AdminDashboard: React.FC = () => {
    const { user, token, logout } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            navigate("/login");
        }
    }, [token, navigate]);

    useEffect(() => {
        const fetchData = async () => {
            if (!token) return;
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
                skeletons
                setLoading(false);
            }
        };
        fetchData();
    }, [token]);

    const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const userData: Partial<User> = {
            firstname: formData.get("firstname") as string,
            lastname: formData.get("lastname") as string,
            email: formData.get("email") as string,
            phone: formData.get("phone") as string,
            wallet: formData.get("wallet") as string,
        };
        try {
            if (token) {
                const newUser = await createUser(userData, token);
                setUsers([...users, newUser]);
            }
        } catch (err) {
            setError("Failed to create user.");
            console.error(err);
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    if (!token) return null;

    return (
        <div className="admin-dashboard-container">
            <header className="admin-header">
                <h1>Admin Dashboard</h1>
                <p>Welcome, {user?.firstname} {user?.lastname}</p>
                <button onClick={handleLogout} className="logout-btn">
                    Logout
                </button>
            </header>
            <section className="admin-content">
                {error && <p className="error">{error}</p>}
                {loading ? (
                    <div className="loading">Loading...</div>
                ) : (
                    <>
                        {/* Users Section */}
                        <div className="section-card">
                            <h2>Users</h2>
                            <form onSubmit={handleCreateUser} className="user-form">
                                <input
                                    name="firstname"
                                    placeholder="First Name"
                                    required
                                    className="form-control"
                                />
                                <input
                                    name="lastname"
                                    placeholder="Last Name"
                                    required
                                    className="form-control"
                                />
                                <input
                                    name="email"
                                    type="email"
                                    placeholder="Email"
                                    required
                                    className="form-control"
                                />
                                <input
                                    name="phone"
                                    placeholder="Phone"
                                    required
                                    className="form-control"
                                />
                                <input
                                    name="wallet"
                                    placeholder="Wallet"
                                    required
                                    className="form-control"
                                />
                                <button type="submit" className="submit-btn">
                                    Add User
                                </button>
                            </form>
                            <ul className="item-list">
                                {users.map((u) => (
                                    <li key={u.userID}>
                                        {u.firstname} {u.lastname} ({u.email})
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Roles Section */}
                        <div className="section-card">
                            <h2>Roles</h2>
                            <ul className="item-list">
                                {roles.map((r) => (
                                    <li key={r.roleID}>
                                        {r.name} - {r.description || "No description"}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Permissions Section */}
                        <div className="section-card">
                            <h2>Permissions</h2>
                            <ul className="item-list">
                                {permissions.map((p) => (
                                    <li key={p.permissionID}>
                                        {p.name} ({p.type}) - {p.class}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
};

export default AdminDashboard;
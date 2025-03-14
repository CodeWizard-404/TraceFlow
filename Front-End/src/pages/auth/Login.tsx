// src/pages/LoginPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import "./Login.css"; // New CSS file
import { login } from "../../apis/authAPI";
import { useAuth } from "../../context/AuthContext";

const LoginPage: React.FC = () => {
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { login: authLogin } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await login(identifier, password);
            authLogin(response.token, response.user);

            // Role-based redirect
            const userRoles = response.user.roles || [];
            if (userRoles.some((role) => role.name === "Admin")) {
                navigate("/admin");
            } else if (userRoles.some((role) => role.name === "Manager")) {
                navigate("/manager-dashboard"); 
            } else if (userRoles.some((role) => role.name === "Supervisor")) {
                navigate("/timesheet");
            } else {
                navigate("/dashboard"); // Placeholder; adjust as needed
            }
        } catch (err) {
            setError("Invalid credentials. Please try again.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <header className="login-header">
                <h1>Login</h1>
            </header>
            <section className="login-card">
                {error && <p className="error">{error}</p>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="identifier">Email or Phone</label>
                        <input
                            type="text"
                            id="identifier"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            required
                            disabled={loading}
                            className="form-control"
                            placeholder="Enter email or phone"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                            className="form-control"
                            placeholder="Enter password"
                        />
                    </div>
                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? "Logging in..." : "Login"}
                    </button>
                </form>
            </section>
        </div>
    );
};

export default LoginPage;
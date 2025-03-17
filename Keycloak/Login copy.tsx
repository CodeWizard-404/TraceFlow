import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../Front-End/src/context/AuthContext";
import "./Login.css";

const LoginPage: React.FC = () => {
    const { login, isAuthenticated, user } = useAuth();
    const navigate = useNavigate();

    // Redirect if already authenticated
    if (isAuthenticated && user) {
        const userRoles = user.roles || [];
        if (userRoles.some((role) => role.name === "Super Admin")) {
            navigate("/admin");
        } else if (userRoles.some((role) => role.name === "Manager")) {
            navigate("/manager-dashboard");
        } else if (userRoles.some((role) => role.name === "Supervisor")) {
            navigate("/timesheet");
        } else {
            navigate("/dashboard");
        }
        return null; // Prevent rendering while redirecting
    }

    const handleLogin = () => {
        login(); // Redirects to Keycloak login
    };

    return (
        <div className="login-container">
            <header className="login-header">
                <h1>Login</h1>
            </header>
            <section className="login-card">
                <button onClick={handleLogin} className="submit-btn">
                    Login with Keycloak
                </button>
            </section>
        </div>
    );
};

export default LoginPage;
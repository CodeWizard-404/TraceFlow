// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { login } from "../apis/authAPI";
import User from "../models/User";
import { setupAxiosInterceptors } from "../apis/axiosConfig";

interface AuthContextType {
    user: User | null;
    token: string | null;
    loginUser: (identifier: string, password: string, redirectTo?: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const storedUser = localStorage.getItem("user");
        const parsedUser = storedUser ? JSON.parse(storedUser) : null;
        console.log("Initial User from localStorage:", parsedUser);
        return parsedUser;
    });
    const [token, setToken] = useState<string | null>(() => {
        const storedToken = localStorage.getItem("token");
        console.log("Initial Token from localStorage:", storedToken);
        return storedToken;
    });
    const [hasLoggedIn, setHasLoggedIn] = useState(false); // New flag to control useEffect
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        setupAxiosInterceptors(() => token);
        console.log("Axios interceptor updated with token:", token);
    }, [token]);

    useEffect(() => {
        if (user && token && !hasLoggedIn) { // Only run once after login
            const userPermissions = user.roles?.flatMap(role =>
                Array.isArray(role.permissions) ? role.permissions : []
            ) || [];

            console.log("User:", user);
            console.log("User Roles:", user.roles);
            console.log("Extracted Permissions:", userPermissions);
            console.log("location.state?.from:", location.state?.from);

            let targetRoute = "/admin"; // Default route
            if (userPermissions.includes("access_timesheets")) {
                targetRoute = "/timesheet";
                console.log("Redirecting to /timesheet due to access_timesheets");
            } else if (userPermissions.includes("log_visits")) {
                targetRoute = "/timesheet";
                console.log("Redirecting to /timesheet due to log_visits");
            } else if (userPermissions.includes("create_users") || userPermissions.includes("update_users")) {
                targetRoute = "/admin";
                console.log("Redirecting to /admin due to create_users or update_users");
            } else {
                console.log("No matching permissions, using default /admin");
            }

            const finalRoute = location.state?.from && !userPermissions.length ? location.state?.from : targetRoute;
            console.log("Final Navigation Route:", finalRoute);
            navigate(finalRoute, { replace: true });
            setHasLoggedIn(true); // Prevent re-running after navigation
        }
    }, [user, token, navigate, location.state, hasLoggedIn]);

    const loginUser = async (identifier: string, password: string, redirectTo?: string) => {
        try {
            console.log("Attempting login...");
            const response = await login(identifier, password);
            console.log("Login response:", response);

            setUser(response.user);
            setToken(response.token);
            localStorage.setItem("token", response.token);
            localStorage.setItem("user", JSON.stringify(response.user));
            console.log("Saved to localStorage. User:", response.user, "Token:", response.token);
            setHasLoggedIn(false); // Reset flag for new login
        } catch (error) {
            console.error("Login failed:", error);
            throw error;
        }
    };

    const logout = async () => {
        console.log("Logging out...");
        setUser(null);
        setToken(null);
        setHasLoggedIn(false);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

    return (
        <AuthContext.Provider value={{ user, token, loginUser, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};
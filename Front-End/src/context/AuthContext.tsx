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
        return parsedUser;
    });
    const [token, setToken] = useState<string | null>(() => {
        const storedToken = localStorage.getItem("token");
        return storedToken;
    });
    const [hasLoggedIn, setHasLoggedIn] = useState(false); 
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        setupAxiosInterceptors(() => token);
    }, [token]);

    useEffect(() => {
        if (user && token && !hasLoggedIn) { 
            const userPermissions = user.roles?.flatMap(role =>
                Array.isArray(role.permissions) ? role.permissions : []
            ) || [];


            let targetRoute = "/"; // Default route
            if (userPermissions.includes("create_users") || userPermissions.includes("update_users")) {
                targetRoute = "/admin";
            } else if (userPermissions.includes("access_timesheets")) {
                targetRoute = "/timesheet";
            } 

            const finalRoute = location.state?.from && !userPermissions.length ? location.state?.from : targetRoute;
            navigate(finalRoute, { replace: true });
            setHasLoggedIn(true); 
        }
    }, [user, token, navigate, location.state, hasLoggedIn]);

    const loginUser = async (identifier: string, password: string) => {
        try {
            const response = await login(identifier, password);

            setUser(response.user);
            setToken(response.token);
            localStorage.setItem("token", response.token);
            localStorage.setItem("user", JSON.stringify(response.user));
            setHasLoggedIn(false);
        } catch (error) {
            console.error("Login failed:", error);
            throw error;
        }
    };

    const logout = async () => {
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

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};
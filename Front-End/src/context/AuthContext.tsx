import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { login } from "../apis/authAPI";
import User from "../models/User";
import { setupAxiosInterceptors } from "../apis/axiosConfig"; // Import the interceptor setup

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
    const navigate = useNavigate();
    const location = useLocation();

    // Set up Axios interceptor when token changes
    useEffect(() => {
        setupAxiosInterceptors(() => token); // Pass a function to get the current token
        console.log("Axios interceptor updated with token:", token);
    }, [token]);

    useEffect(() => {
        console.log("AuthProvider mounted. User:", user, "Token:", token);
    }, []); // Log only on mount

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

            const intendedRoute = redirectTo || location.state?.from || "/admin";
            console.log("Navigating to:", intendedRoute);
            navigate(intendedRoute, { replace: true });
        } catch (error) {
            console.error("Login failed:", error);
            throw error;
        }
    };

    const logout = async () => {
        console.log("Logging out...");
        setUser(null);
        setToken(null);
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
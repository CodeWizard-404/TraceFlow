import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { login } from "../apis/authAPI";
import { getEffectivePermissions } from "../apis/permissionAPI";
import { getRolesByUser } from "../apis/roleAPI";
import { setupAxiosInterceptors } from "../apis/axiosConfig";
import User from "../models/User";
import Permission from "../models/Permission";
import Role from "../models/Role";

// Define roles from environment variables
const ROLES = {
    ADMIN: import.meta.env.VITE_ROLES_ADMIN,
    SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
    MANAGER: import.meta.env.VITE_ROLES_MANAGER,
    SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
    PURCHASE_TEAM: import.meta.env.VITE_ROLES_PURCHASE_TEAM,
    REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
    STOCK_MANAGER: import.meta.env.VITE_ROLES_STOCK_MANAGER,
};

// Interface for the authentication context shape
interface AuthContextType {
    user: User | null;
    token: string | null;
    userRoles: Role[] | null;
    effectivePermissions: Permission[] | null;
    permissionsLoaded: boolean;
    loginUser: (identifier: string, password: string) => Promise<void>;
    logout: () => void;
}

// Create the authentication context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider component to manage authentication state and provide context
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // State for user, initialized from localStorage if available
    const [user, setUser] = useState<User | null>(() => {
        const storedUser = localStorage.getItem("user");
        return storedUser ? JSON.parse(storedUser) : null;
    });

    // State for token, initialized from localStorage if available
    const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));

    // State for user roles and permissions
    const [userRoles, setUserRoles] = useState<Role[] | null>(null);
    const [effectivePermissions, setEffectivePermissions] = useState<Permission[] | null>(null);
    const [permissionsLoaded, setPermissionsLoaded] = useState(false); // Tracks if permissions are loaded

    const navigate = useNavigate();
    const location = useLocation();

    // Effect to setup Axios interceptors once on mount
    useEffect(() => {
        setupAxiosInterceptors();
    }, []);

    // Effect to handle redirection based on user roles and permissions
    useEffect(() => {
        // Exit early if no user or permissions aren't loaded
        if (!user || !permissionsLoaded) {
            return;
        }

        // Determine the target route based on user roles
        const targetRoute = determineTargetRoute(userRoles || []);
        // Use location.state.from only if it's a valid protected route (not /login)
        const fromRoute = location.state?.from && location.state.from !== "/login" 
            ? location.state.from 
            : null;
        const finalRoute = fromRoute || targetRoute;

        // Prevent redundant navigation if already on the target route
        if (location.pathname === finalRoute) {
            return;
        }

        // Navigate to the determined route
        navigate(finalRoute, { replace: true });
    }, [user, permissionsLoaded, userRoles, navigate, location]);

    // Effect to fetch roles and permissions for persisted sessions
    useEffect(() => {
        const fetchPermissions = async () => {
            if (!user || !token || permissionsLoaded) return;

            try {
                setPermissionsLoaded(false); // Reset loading state
                const [perms, roles] = await Promise.all([
                    getEffectivePermissions(user.userID, token),
                    getRolesByUser(user.userID, token),
                ]);
                setEffectivePermissions(perms);
                setUserRoles(roles);
            } catch (error) {
                console.error("Failed to fetch permissions on mount:", error);
            } finally {
                setPermissionsLoaded(true); // Mark permissions as loaded
            }
        };

        fetchPermissions();
    }, [user, token, permissionsLoaded]);

    // Determines the target route based on user roles
    const determineTargetRoute = (roles: Role[]): string => {
        if (!roles || roles.length === 0) {
            console.warn("No roles provided, defaulting to /");
            return "/"; // Default route if no roles are present
        }

        if (roles.some((r) => [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(r.name))) {
            return "/admin";
        }
        if (roles.some((r) => [ROLES.MANAGER, ROLES.SUPERVISOR].includes(r.name))) {
            return "/timesheet";
        }
        if (roles.some((r) => [ROLES.PURCHASE_TEAM, ROLES.REGIONAL_MANAGER, ROLES.STOCK_MANAGER].includes(r.name))) {
            return "/receipt-books";
        }

        console.warn("No matching role found, defaulting to /");
        return "/"; // Fallback route
    };

    // Logs in a user and fetches their roles and permissions
    const loginUser = async (identifier: string, password: string) => {
        const response = await login(identifier, password);
        const newToken = response.token;
        const newUser = response.user;

        // Store token and user in localStorage
        localStorage.setItem("token", newToken);
        localStorage.setItem("user", JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);

        try {
            setPermissionsLoaded(false); // Reset loading state
            const [perms, roles] = await Promise.all([
                getEffectivePermissions(newUser.userID, newToken),
                getRolesByUser(newUser.userID, newToken),
            ]);
            setEffectivePermissions(perms);
            setUserRoles(roles);
        } catch (error) {
            console.error("Failed to fetch permissions after login:", error);
        } finally {
            setPermissionsLoaded(true); // Mark permissions as loaded
        }
    };

    // Logs out the user and clears all state
    const logout = () => {
        setUser(null);
        setToken(null);
        setUserRoles(null);
        setEffectivePermissions(null);
        setPermissionsLoaded(false);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true, state: null }); // Clear state and redirect
    };

    // Context value to provide to consumers
    const value: AuthContextType = {
        user,
        token,
        userRoles,
        effectivePermissions,
        permissionsLoaded,
        loginUser,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to access the authentication context
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
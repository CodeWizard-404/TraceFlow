import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { login } from "../apis/authAPI";
import { getEffectivePermissions } from "../apis/permissionAPI";
import { getRolesByUser } from "../apis/roleAPI";
import { setupAxiosInterceptors } from "../apis/axiosConfig";
import User from "../models/User";
import Permission from "../models/Permission";
import Role from "../models/Role";

// Define the shape of the authentication context
interface AuthContextType {
    user: User | null;
    token: string | null;
    userRoles: Role[] | null;
    effectivePermissions: Permission[] | null;
    permissionsLoaded: boolean;
    loginUser: (identifier: string, password: string) => Promise<void>;
    logout: () => void;
}

// Create the context with an undefined initial value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider component to manage authentication state and logic
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const storedUser = localStorage.getItem("user");
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const refreshUserRoles = async (token: string) => {
        try {
            const userResponse = await fetch(`${process.env.REACT_APP_BASE_URL}/users/me/roles`, {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!userResponse.ok) throw new Error('Failed to fetch user roles');
            const roles = await userResponse.json();
            setUserRoles(roles);
        } catch (error) {
            console.error('Failed to refresh user roles:', error);
        }
    };
    const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
    const [userRoles, setUserRoles] = useState<Role[] | null>(null);
    const [effectivePermissions, setEffectivePermissions] = useState<Permission[] | null>(null);
    const [permissionsLoaded, setPermissionsLoaded] = useState(false);
    const [isInitialLogin, setIsInitialLogin] = useState(false); // New flag

    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (token) {
            refreshUserRoles(token);
        }
    }, [token]);

    useEffect(() => {
        setupAxiosInterceptors();
    }, []);

    useEffect(() => {
        const fetchPermissions = async () => {
            if (!user || !token) return;
            try {
                const [perms, roles] = await Promise.all([
                    getEffectivePermissions(user.userID, token),
                    getRolesByUser(user.userID, token),
                ]);
                setEffectivePermissions(perms);
                setUserRoles(roles);
            } catch (error) {
                console.error("Failed to fetch permissions:", error);
            } finally {
                setPermissionsLoaded(true);
            }
        };
        fetchPermissions();
    }, [user, token]);

    // Redirect only on initial login
    useEffect(() => {
        if (user && token && permissionsLoaded && userRoles && isInitialLogin) {
            const targetRoute = determineTargetRoute(userRoles);
            const finalRoute = location.state?.from || targetRoute;
            navigate(finalRoute, { replace: true });
            setIsInitialLogin(false); 
        }
    }, [user, token, permissionsLoaded, userRoles, location.state, navigate, isInitialLogin]);

    const determineTargetRoute = (roles: Role[]): string => {
        if (roles.some((r) => ["Admin", "Super Admin"].includes(r.name))) return "/admin";
        if (roles.some((r) => ["Manager", "Supervisor"].includes(r.name))) return "/timesheet";
        return "/";
    };

    const loginUser = async (identifier: string, password: string) => {
        const response = await login(identifier, password);
        setUser(response.user);
        setToken(response.token);
        localStorage.setItem("token", response.token);
        localStorage.setItem("user", JSON.stringify(response.user));
        setPermissionsLoaded(false);
        setIsInitialLogin(true); // Set flag on login
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        setUserRoles(null);
        setEffectivePermissions(null);
        setPermissionsLoaded(false);
        setIsInitialLogin(false); // Reset flag on logout
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

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

// Custom hook to access the auth context
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
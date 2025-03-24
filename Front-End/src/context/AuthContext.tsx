// AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { login } from "../apis/authAPI";
import { getEffectivePermissions } from "../apis/permissionAPI";
import { getRolesByUser } from "../apis/roleAPI";
import { setupAxiosInterceptors } from "../apis/axiosConfig";
import User from "../models/User";
import Permission from "../models/Permission";
import Role from "../models/Role";

const ROLES = {
    ADMIN: import.meta.env.VITE_ROLES_ADMIN,
    SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
    MANAGER: import.meta.env.VITE_ROLES_MANAGER,
    SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
    PURCHASE_TEAM: import.meta.env.VITE_ROLES_PURCHASE_TEAM,
    REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
    STOCK_MANAGER: import.meta.env.VITE_ROLES_STOCK_MANAGER,
};

interface AuthContextType {
    user: User | null;
    token: string | null;
    userRoles: Role[] | null;
    effectivePermissions: Permission[] | null;
    permissionsLoaded: boolean;
    loginUser: (identifier: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const storedUser = localStorage.getItem("user");
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
    const [userRoles, setUserRoles] = useState<Role[] | null>(null);
    const [effectivePermissions, setEffectivePermissions] = useState<Permission[] | null>(null);
    const [permissionsLoaded, setPermissionsLoaded] = useState(false);
    const [noAccess, setNoAccess] = useState(false); // New state for no access message

    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        setupAxiosInterceptors();
    }, []);

    const protectedRoutes: { [key: string]: string[] } = {
        "/admin": [ROLES.ADMIN, ROLES.SUPER_ADMIN],
        "/timesheet": [import.meta.env.VITE_PERMISSIONS_ACCESS_SUPERVISOR_TIMESHEETS],
        "/timesheet-form": [import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS],
        "/qr-scan": [import.meta.env.VITE_PERMISSIONS_SCAN_VISITS],
        "/visit/:idVisit": [import.meta.env.VITE_PERMISSIONS_ACCESS_VISIT_DETAILS],
        "/visit/:idVisit/validate-checklist": [import.meta.env.VITE_PERMISSIONS_LOG_VISITS],
        "/receipt-books": [import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOKS],
        "/receipt-book/:bookID/history": [import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOK_HISTORY],
        "/transfer-receipt-books": [import.meta.env.VITE_PERMISSIONS_TRANSFER_RECEIPT_BOOKS],
    };

    const hasPermissionForRoute = (pathname: string): boolean => {
        if (!effectivePermissions || !userRoles) return false;

        const routeKey = Object.keys(protectedRoutes).find(key => {
            if (key.includes(":")) {
                const regex = new RegExp(`^${key.replace(/:[^/]+/g, "[^/]+")}$`);
                return regex.test(pathname);
            }
            return key === pathname;
        });

        if (!routeKey) return true;

        const required = protectedRoutes[routeKey];
        if (routeKey === "/admin") {
            return userRoles.some(role => required.includes(role.name));
        }
        return effectivePermissions.some(perm => required.includes(perm.name));
    };

    useEffect(() => {
        if (!user || !token) {
            if (location.pathname !== "/login") {
                navigate("/login", { replace: true, state: { from: location.pathname } });
            }
            return;
        }

        if (!permissionsLoaded) return;

        // Check if user has no roles or permissions
        if ((!userRoles || userRoles.length === 0) && 
            (!effectivePermissions || effectivePermissions.length === 0)) {
            setNoAccess(true); // Show no access message
            return;
        }

        setNoAccess(false); // Reset no access state if user has roles/permissions

        const targetRoute = determineTargetRoute(userRoles || []);
        const currentPath = location.pathname;

        if (currentPath === "/login") {
            const fromRoute = location.state?.from && hasPermissionForRoute(location.state.from)
                ? location.state.from
                : targetRoute;
            navigate(fromRoute, { replace: true });
            return;
        }

        if (hasPermissionForRoute(currentPath)) {
            return;
        }

        if (currentPath === "/" || !hasPermissionForRoute(currentPath)) {
            const fromRoute = location.state?.from && location.state.from !== "/login" && hasPermissionForRoute(location.state.from)
                ? location.state.from
                : targetRoute;
            navigate(fromRoute, { replace: true });
        }
    }, [user, token, permissionsLoaded, userRoles, effectivePermissions, navigate, location]);

    useEffect(() => {
        const fetchPermissions = async () => {
            if (!user || !token || permissionsLoaded) return;

            try {
                setPermissionsLoaded(false);
                const [perms, roles] = await Promise.all([
                    getEffectivePermissions(user.userID, token),
                    getRolesByUser(user.userID, token),
                ]);
                setEffectivePermissions(perms);
                setUserRoles(roles);
            } catch (error) {
                console.error("Failed to fetch permissions on mount:", error);
            } finally {
                setPermissionsLoaded(true);
            }
        };

        fetchPermissions();
    }, [user, token, permissionsLoaded]);

    const determineTargetRoute = (roles: Role[]): string => {
        if (!roles || roles.length === 0) return "/";
        if (roles.some((r) => [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(r.name))) return "/admin";
        if (roles.some((r) => [ROLES.MANAGER, ROLES.SUPERVISOR].includes(r.name))) return "/timesheet";
        if (roles.some((r) => [ROLES.PURCHASE_TEAM, ROLES.REGIONAL_MANAGER, ROLES.STOCK_MANAGER].includes(r.name))) return "/receipt-books";
        return "/";
    };

    const loginUser = async (identifier: string, password: string) => {
        const response = await login(identifier, password);
        const newToken = response.token;
        const newUser = response.user;

        localStorage.setItem("token", newToken);
        localStorage.setItem("user", JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);

        try {
            setPermissionsLoaded(false);
            const [perms, roles] = await Promise.all([
                getEffectivePermissions(newUser.userID, newToken),
                getRolesByUser(newUser.userID, newToken),
            ]);
            setEffectivePermissions(perms);
            setUserRoles(roles);
        } catch (error) {
            console.error("Failed to fetch permissions after login:", error);
        } finally {
            setPermissionsLoaded(true);
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        setUserRoles(null);
        setEffectivePermissions(null);
        setPermissionsLoaded(false);
        setNoAccess(false);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true, state: null });
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

    // Render children or no access message
    return (
        <AuthContext.Provider value={value}>
            {noAccess ? (
                <div style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100vh",
                    flexDirection: "column",
                    textAlign: "center",
                    padding: "20px"
                }}>
                    <h2>No Access</h2>
                    <p>You don't have any roles or permissions assigned. Please contact an administrator.</p>
                    <button
                        onClick={logout}
                        style={{
                            padding: "10px 20px",
                            fontSize: "16px",
                            cursor: "pointer",
                            backgroundColor: "#ff4444",
                            color: "white",
                            border: "none",
                            borderRadius: "5px"
                        }}
                    >
                        Logout
                    </button>
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
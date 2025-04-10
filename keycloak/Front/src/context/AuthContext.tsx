import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { login } from "../apis/authAPI";
import { getEffectivePermissions } from "../apis/permissionAPI";
import { getRolesByUser } from "../apis/roleAPI";
import { setupAxiosInterceptors } from "../apis/axiosConfig";
import User from "../models/User";
import Permission from "../models/Permission";
import Role from "../models/Role";
import { protectedRoutes, determineTargetRoute } from "../lib/authUtils";

interface AuthContextType {
    user: User | null;
    token: string | null;
    userRoles: Role[] | null;
    effectivePermissions: Permission[] | null;
    permissionsLoaded: boolean;
    loginUser: (identifier: string, password: string, deviceIdentifier: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const storedUser = localStorage.getItem("user");
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
    const [userRoles, setUserRoles] = useState<Role[] | null>(null);
    const [effectivePermissions, setEffectivePermissions] = useState<Permission[] | null>(null);
    const [permissionsLoaded, setPermissionsLoaded] = useState(false);
    const [noAccess, setNoAccess] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        setupAxiosInterceptors();
    }, []);

    const hasPermissionForRoute = React.useCallback(
        (pathname: string): boolean => {
            if (!effectivePermissions || !userRoles) return false;

            const routeKey = Object.keys(protectedRoutes).find((key) => {
                if (key.includes(":")) {
                    const regex = new RegExp(`^${key.replace(/:[^/]+/g, "[^/]+")}$`);
                    return regex.test(pathname);
                }
                return key === pathname;
            });

            if (!routeKey) return true;

            const required = protectedRoutes[routeKey as keyof typeof protectedRoutes];
            if (routeKey === "/admin") {
                return userRoles.some((role) => required.includes(role.name));
            }
            return effectivePermissions.some((perm) => required.includes(perm.name));
        },
        [effectivePermissions, userRoles]
    );

    useEffect(() => {
        if (!user || !token) {
            if (location.pathname !== "/login") {
                navigate("/login", { replace: true, state: { from: location.pathname } });
            }
            return;
        }

        if (!permissionsLoaded) return;

        if ((!userRoles || userRoles.length === 0) && (!effectivePermissions || effectivePermissions.length === 0)) {
            setNoAccess(true);
            return;
        }

        setNoAccess(false);

        const targetRoute = determineTargetRoute(userRoles || []);
        const currentPath = location.pathname;

        if (currentPath === "/login") {
            const fromRoute =
                location.state?.from && hasPermissionForRoute(location.state.from)
                    ? location.state.from
                    : targetRoute;
            navigate(fromRoute, { replace: true });
            return;
        }

        if (hasPermissionForRoute(currentPath)) return;

        if (currentPath === "/" || !hasPermissionForRoute(currentPath)) {
            const fromRoute =
                location.state?.from &&
                    location.state.from !== "/login" &&
                    hasPermissionForRoute(location.state.from)
                    ? location.state.from
                    : targetRoute;
            navigate(fromRoute, { replace: true });
        }
    }, [user, token, permissionsLoaded, userRoles, effectivePermissions, navigate, location, hasPermissionForRoute]);

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

    const loginUser = async (identifier: string, password: string, deviceIdentifier: string) => {
        const response = await login(identifier, password, deviceIdentifier);
        if ("requires2FA" in response) {
            return;
        }

        if (!response.token || !response.user) {
            throw new Error("Login failed: Token or user data missing");
        }

        const newToken: string = response.token;
        const newUser: User = response.user;

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

    return (
        <AuthContext.Provider value={value}>
            {noAccess ? (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "100vh",
                        flexDirection: "column",
                        textAlign: "center",
                        padding: "20px",
                    }}
                >
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
                            borderRadius: "5px",
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

export default AuthProvider;
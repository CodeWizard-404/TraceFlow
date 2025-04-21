/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { login, verify2FA, logout, refreshToken } from '../apis/authAPI';
import { getEffectivePermissions } from '../apis/permissionAPI';
import { getRolesByUser } from '../apis/roleAPI';
import { setupAxiosInterceptors } from '../apis/axiosConfig';
import User from '../models/User';
import Permission from '../models/Permission';
import Role from '../models/Role';
import { protectedRoutes, determineTargetRoute } from '../lib/authUtils';

interface AuthContextType {
    user: User | null;
    userRoles: Role[] | null;
    effectivePermissions: Permission[] | null;
    permissionsLoaded: boolean;
    loginUser: (
        identifier: string,
        password: string,
        deviceIdentifier: string,
        otpCode?: string,
        trustDevice?: boolean,
        tempToken?: string,
        refreshToken?: string,
        userID?: string
    ) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const storedUser = localStorage.getItem('user');
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const [userRoles, setUserRoles] = useState<Role[] | null>(null);
    const [effectivePermissions, setEffectivePermissions] = useState<Permission[] | null>(null);
    const [permissionsLoaded, setPermissionsLoaded] = useState(false);
    const [noAccess, setNoAccess] = useState(false);
    const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);

    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        setupAxiosInterceptors();
    }, []);

    // Automatic token refresh
    useEffect(() => {
        if (!user || !tokenExpiry) {
            return;
        }

        const refreshBuffer = 30 * 1000; // Refresh 30 seconds before expiry
        const timeUntilRefresh = tokenExpiry - Date.now() - refreshBuffer;

        if (timeUntilRefresh <= 0) {
            handleRefresh();
            return;
        }

        const timer = setTimeout(handleRefresh, timeUntilRefresh);
        return () => {
            clearTimeout(timer);
        };
    }, [tokenExpiry, user]);

    const handleRefresh = async (retries = 3) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const { expiresIn } = await refreshToken();
                const newExpiry = Date.now() + expiresIn;
                setTokenExpiry(newExpiry);
                return;
            } catch (error) {
                console.error(`Refresh attempt ${attempt} failed:`, error);
                if (attempt === retries) {
                    await handleLogout();
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
    };

    const hasPermissionForRoute = React.useCallback(
        (pathname: string): boolean => {
            if (!effectivePermissions || !userRoles) return false;

            const routeKey = Object.keys(protectedRoutes).find((key) => {
                if (key.includes(':')) {
                    const regex = new RegExp(`^${key.replace(/:[^/]+/g, '[^/]+')}$`);
                    return regex.test(pathname);
                }
                return key === pathname;
            });

            if (!routeKey) return true;

            const required = protectedRoutes[routeKey as keyof typeof protectedRoutes];
            if (routeKey === '/admin') {
                return userRoles.some((role) => required.includes(role.name));
            }
            return effectivePermissions.some((perm) => required.includes(perm.name));
        },
        [effectivePermissions, userRoles]
    );

    useEffect(() => {
        if (!user) {
            if (location.pathname !== '/login' && location.pathname !== '/reset-password') {
                navigate('/login', { replace: true, state: { from: location.pathname } });
            }
            return;
        }

        if (!permissionsLoaded) {
            return;
        }

        if (!userRoles?.length && !effectivePermissions?.length) {
            setNoAccess(true);
            return;
        }

        setNoAccess(false);

        const targetRoute = determineTargetRoute(userRoles || []);
        const currentPath = location.pathname;

        if (currentPath === '/login' || currentPath === '/reset-password') {
            const fromRoute =
                location.state?.from && hasPermissionForRoute(location.state.from)
                    ? location.state.from
                    : targetRoute;
            navigate(fromRoute, { replace: true });
            return;
        }

        if (hasPermissionForRoute(currentPath)) {
            return;
        }

        if (currentPath === '/' || !hasPermissionForRoute(currentPath)) {
            const fromRoute =
                location.state?.from &&
                    location.state.from !== '/login' &&
                    location.state.from !== '/reset-password' &&
                    hasPermissionForRoute(location.state.from)
                    ? location.state.from
                    : targetRoute;
            navigate(fromRoute, { replace: true });
        }
    }, [user, permissionsLoaded, userRoles, effectivePermissions, navigate, location, hasPermissionForRoute]);

    useEffect(() => {
        const fetchPermissions = async () => {
            if (!user || permissionsLoaded) return;

            try {
                setPermissionsLoaded(false);
                let perms, roles;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        [perms, roles] = await Promise.all([
                            getEffectivePermissions(user.userID),
                            getRolesByUser(user.userID),
                        ]);
                        break;
                    } catch (error) {
                        console.error(`Permission fetch attempt ${attempt} failed:`, error);
                        if (attempt === 3) throw error;
                        await new Promise((resolve) => setTimeout(resolve, 1000));
                    }
                }
                setEffectivePermissions(perms || null);
                setUserRoles(roles || null);
            } catch (error) {
                console.error('Failed to load permissions, logging out:', error);
                await handleLogout();
            } finally {
                setPermissionsLoaded(true);
            }
        };

        fetchPermissions();
    }, [user, permissionsLoaded]);

    const loginUser = async (
        identifier: string,
        password: string,
        deviceIdentifier: string,
        otpCode?: string,
        trustDevice: boolean = false,
        tempToken?: string,
        refreshToken?: string,
        userID?: string
    ) => {
        try {
            let response;
            if (otpCode && userID && tempToken && refreshToken) {
                response = await verify2FA(userID, otpCode, deviceIdentifier, trustDevice, tempToken, refreshToken);
                if (response.requires2FA) {
                    throw new Error('Unexpected requires2FA: true after verification');
                }
                if (!response.user) {
                    throw new Error('User data missing in verify2FA response');
                }
            } else {
                response = await login(identifier, password, deviceIdentifier, 'phone');
                if (response.requires2FA) {
                    throw new Error(
                        JSON.stringify({
                            requires2FA: true,
                            userID: response.userID,
                            deviceIdentifier: response.deviceIdentifier,
                            tempToken: response.tempToken,
                            refreshToken: response.refreshToken,
                        })
                    );
                }
                if (!response.user) {
                    throw new Error('Login failed: User data missing');
                }
            }

            // Validate user and roles
            if (!response.user.userID || !response.user.email || !response.user.phone) {
                throw new Error('Incomplete user data in response');
            }

            // Default to empty roles array if undefined
            const roles = Array.isArray(response.user.roles) ? response.user.roles : [];

            const newUser: User = {
                userID: response.user.userID,
                email: response.user.email,
                phone: response.user.phone,
                firstname: '',
                lastname: '',
                wallet: '',
                password: '',
                keycloakId: '',
                Roles: roles.map((role) => ({
                    roleID: role.roleID,
                    name: role.name,
                    description: role.description,
                    permissions: Array.isArray(role.Permissions)
                        ? role.Permissions.map((perm) => ({
                            permissionID: perm.permissionID,
                            name: perm.name,
                            class: perm.class,
                            description: perm.description,
                        }))
                        : [],
                })),
            };

            localStorage.setItem('user', JSON.stringify(newUser));
            const sameSite = import.meta.env.VITE_ENV === 'development' ? 'Lax' : 'Strict';
            document.cookie = `accessToken=${response.accessToken}; path=/; SameSite=${sameSite}; max-age=${response.expiresIn! / 1000}`;
            setUser(newUser);
            setTokenExpiry(
                Date.now() +
                (response.expiresIn || parseInt(import.meta.env.VITE_ACCESS_TOKEN_MAX_AGE) || 900000)
            );

            try {
                setPermissionsLoaded(false);
                let perms, roles;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        [perms, roles] = await Promise.all([
                            getEffectivePermissions(newUser.userID),
                            getRolesByUser(newUser.userID),
                        ]);
                        break;
                    } catch (error) {
                        console.error(`Post-login permission fetch attempt ${attempt} failed:`, error);
                        if (attempt === 3) throw error;
                        await new Promise((resolve) => setTimeout(resolve, 1000));
                    }
                }
                setEffectivePermissions(perms || null);
                setUserRoles(roles || null);
            } catch (error) {
                console.error('Failed to load permissions after login, logging out:', error);
                await handleLogout();
                throw new Error('Failed to load user permissions');
            } finally {
                setPermissionsLoaded(true);
            }
        } catch (error) {
            console.error('Login failed:', error);
            if (error instanceof Error && error.message.startsWith('{')) {
                throw error;
            }
            throw new Error(error instanceof Error ? error.message : 'Login failed');
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUser(null);
            setUserRoles(null);
            setEffectivePermissions(null);
            setPermissionsLoaded(false);
            setNoAccess(false);
            setTokenExpiry(null);
            localStorage.removeItem('user');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('supervisorFilter');
            document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            navigate('/login', { replace: true, state: null });
        }
    };

    const value: AuthContextType = {
        user,
        userRoles,
        effectivePermissions,
        permissionsLoaded,
        loginUser,
        logout: handleLogout,
    };

    return (
        <AuthContext.Provider value={value}>
            {noAccess ? (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100vh',
                        flexDirection: 'column',
                        textAlign: 'center',
                        padding: '20px',
                    }}
                >
                    <h2>No Access</h2>
                    <p>You don't have any roles or permissions assigned. Please contact an administrator.</p>
                    <button
                        onClick={handleLogout}
                        style={{
                            padding: '10px 20px',
                            fontSize: '16px',
                            cursor: 'pointer',
                            backgroundColor: '#ff4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
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
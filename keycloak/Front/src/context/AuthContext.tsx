/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { login, verify2FA, logout, refreshToken } from '../apis/authAPI';
import { getEffectivePermissions } from '../apis/permissionAPI';
import { getRolesByUser } from '../apis/roleAPI';
import { setupAxiosInterceptors } from '../apis/axiosConfig';
import User from '../models/User';
import Permission from '../models/Permission';
import Role from '../models/Role';
import { protectedRoutes, determineTargetRoute } from '../lib/authUtils';
import { debounce } from 'lodash';

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

/**
 * Hook to access authentication context
 * @throws Error if used outside AuthProvider
 */
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

/**
 * Utility to get user from cookies
 * @returns User object or null if not found
 */
const getUserFromCookie = (): User | null => {
    const cookies = document.cookie.split(';').map(cookie => cookie.trim());
    const userCookie = cookies.find(cookie => cookie.startsWith('userData='));
    if (!userCookie) return null;
    try {
        return JSON.parse(decodeURIComponent(userCookie.split('=')[1])) as User;
    } catch {
        return null;
    }
};

/**
 * Utility to set user in cookies
 * @param user User object to store
 * @param maxAge Cookie expiration in seconds
 */
const setUserCookie = (user: User, maxAge: number) => {
    const encodedUser = encodeURIComponent(JSON.stringify(user));
    const sameSite = import.meta.env.VITE_ENV === 'development' ? 'Lax' : 'Strict';
    document.cookie = `userData=${encodedUser}; path=/; SameSite=${sameSite}; max-age=${maxAge}`;
};

/**
 * Utility to clear authentication cookies
 */
const clearAuthCookies = () => {
    document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'userData=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
};

const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(getUserFromCookie());
    const [userRoles, setUserRoles] = useState<Role[] | null>(null);
    const [effectivePermissions, setEffectivePermissions] = useState<Permission[] | null>(null);
    const [permissionsLoaded, setPermissionsLoaded] = useState(false);
    const [noAccess, setNoAccess] = useState(false);
    const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
    const isNavigating = useRef(false);
    const lastNavigatedPath = useRef<string | null>(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Initialize Axios interceptors on mount
    useEffect(() => {
        setupAxiosInterceptors();
    }, []);

    // Debounced navigation with cancellation
    const debouncedNavigate = useCallback(
        debounce(
            (to: string, options: { replace?: boolean; state?: unknown }) => {
                if (isNavigating.current || lastNavigatedPath.current === to) return;
                isNavigating.current = true;
                lastNavigatedPath.current = to;
                navigate(to, options);
                setTimeout(() => {
                    isNavigating.current = false;
                }, 100);
            },
            100,
            { leading: true, trailing: false }
        ),
        [navigate]
    );

    // Clean up debounced navigation on unmount
    useEffect(() => {
        return () => {
            debouncedNavigate.cancel();
        };
    }, [debouncedNavigate]);

    // Token refresh logic
    useEffect(() => {
        if (!user || !tokenExpiry) return;

        const refreshBuffer = 30 * 1000;
        const timeUntilRefresh = tokenExpiry - Date.now() - refreshBuffer;

        if (timeUntilRefresh <= 0) {
            handleRefresh();
            return;
        }

        const timer = setTimeout(handleRefresh, timeUntilRefresh);
        return () => clearTimeout(timer);
    }, [tokenExpiry, user]);

    /**
     * Refreshes the access token with retry logic
     * @param retries Number of retry attempts
     */
    const handleRefresh = async (retries = 3) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const { accessToken, expiresIn } = await refreshToken();
                const newExpiry = Date.now() + expiresIn;
                const sameSite = import.meta.env.VITE_ENV === 'development' ? 'Lax' : 'Strict';
                document.cookie = `accessToken=${accessToken}; path=/; SameSite=${sameSite}; max-age=${expiresIn / 1000}`;
                setTokenExpiry(newExpiry);
                window.dispatchEvent(new Event('tokenRefreshed'));
                return;
            } catch (error) {
                console.error(`Refresh attempt ${attempt} failed:`, error);
                if (attempt === retries) {
                    await handleLogout();
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    };

    /**
     * Checks if the user has permission for a given route
     * @param pathname Route to check
     * @returns True if user has permission
     */
    const hasPermissionForRoute = useCallback(
        (pathname: string): boolean => {
            if (!effectivePermissions || !userRoles) return false;

            const routeKey = Object.keys(protectedRoutes).find(key => {
                if (key.includes(':')) {
                    const regex = new RegExp(`^${key.replace(/:[^/]+/g, '[^/]+')}$`);
                    return regex.test(pathname);
                }
                return key === pathname;
            });

            if (!routeKey) return true;

            const required = protectedRoutes[routeKey as keyof typeof protectedRoutes];
            if (routeKey === '/admin') {
                return userRoles.some(role => required.includes(role.name));
            }
            return effectivePermissions.some(perm => required.includes(perm.name));
        },
        [effectivePermissions, userRoles]
    );

    // Navigation and permission check
    useEffect(() => {
        if (isNavigating.current) return;

        const currentPath = location.pathname;

        // Redirect unauthenticated users to login
        if (!user && !['/login', '/reset-password'].includes(currentPath)) {
            debouncedNavigate('/login', { replace: true, state: { from: currentPath } });
            return;
        }

        // Wait for permissions to load
        if (user && !permissionsLoaded) return;

        // Check for no roles or permissions
        if (user && (!userRoles?.length && !effectivePermissions?.length)) {
            setNoAccess(true);
            return;
        }

        setNoAccess(false);

        // Determine target route based on roles
        const targetRoute = determineTargetRoute(userRoles || []);

        // Skip navigation if already on target or permitted route
        if (
            currentPath === targetRoute ||
            (currentPath !== '/login' && currentPath !== '/reset-password' && hasPermissionForRoute(currentPath))
        ) {
            lastNavigatedPath.current = currentPath;
            return;
        }

        // Navigate to the intended route or target route
        const fromRoute =
            location.state?.from &&
                location.state.from !== '/login' &&
                location.state.from !== '/reset-password' &&
                hasPermissionForRoute(location.state.from)
                ? location.state.from
                : targetRoute;

        debouncedNavigate(fromRoute, { replace: true });
    }, [user, permissionsLoaded, userRoles, effectivePermissions, location.pathname, hasPermissionForRoute, debouncedNavigate]);

    // Fetch permissions and roles after login
    useEffect(() => {
        const fetchPermissions = async () => {
            if (!user || permissionsLoaded) return;

            try {
                setPermissionsLoaded(false);
                let perms: Permission[] | null = null;
                let roles: Role[] | null = null;
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
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
                // Batch state updates to prevent multiple renders
                setEffectivePermissions(perms);
                setUserRoles(roles);
                setPermissionsLoaded(true);
            } catch (error) {
                console.error('Failed to load permissions, logging out:', error);
                await handleLogout();
            }
        };

        fetchPermissions();
    }, [user]);

    /**
     * Logs in a user, handling both direct login and 2FA verification
     */
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

            const newUser: User = {
                userID: response.user.userID,
                email: response.user.email,
                phone: response.user.phone,
                firstname: '',
                lastname: '',
                wallet: '',
                password: '',
                keycloakId: '',
                Roles: (response.user.roles || []).map(role => ({
                    roleID: role.roleID,
                    name: role.name,
                    description: role.description,
                    permissions: (role.Permissions || []).map(perm => ({
                        permissionID: perm.permissionID,
                        name: perm.name,
                        class: perm.class,
                        description: perm.description,
                    })),
                })),
            };

            const sameSite = import.meta.env.VITE_ENV === 'development' ? 'Lax' : 'Strict';
            const expiresIn = response.expiresIn || parseInt(import.meta.env.VITE_ACCESS_TOKEN_MAX_AGE) || 900000;
            document.cookie = `accessToken=${response.accessToken}; path=/; SameSite=${sameSite}; max-age=${expiresIn / 1000}`;
            setUserCookie(newUser, expiresIn / 1000);

            // Batch state updates
            setUser(newUser);
            setTokenExpiry(Date.now() + expiresIn);
            setPermissionsLoaded(false);
        } catch (error) {
            console.error('Login failed:', error);
            if (error instanceof Error && error.message.startsWith('{')) {
                throw error;
            }
            throw new Error(error instanceof Error ? error.message : 'Login failed');
        }
    };

    /**
     * Logs out the user, clearing state and cookies
     */
    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Batch state resets
            setUser(null);
            setUserRoles(null);
            setEffectivePermissions(null);
            setPermissionsLoaded(false);
            setNoAccess(false);
            setTokenExpiry(null);
            clearAuthCookies();
            lastNavigatedPath.current = null;
            debouncedNavigate.cancel(); // Cancel any pending navigations

            if (location.pathname !== '/login') {
                debouncedNavigate('/login', { replace: true, state: { logout: true } });
            }
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
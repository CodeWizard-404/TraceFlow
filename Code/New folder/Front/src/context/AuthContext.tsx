import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { login, verify2FA, logout, refreshToken } from '../apis/authAPI';
import { getEffectivePermissions } from '../apis/permissionAPI';
import { getRolesByUser } from '../apis/roleAPI';
import { setupAxiosInterceptors } from '../apis/axiosConfig';
import { initSocket, reconnectSocket, disconnectSocket } from '../lib/socket';
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
    redirectLoading: boolean;
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

const getUserFromCookie = (): User | null => {
    const cookies = document.cookie.split(';').map(cookie => cookie.trim());
    console.debug('Available cookies:', { cookies, rawCookieString: document.cookie, timestamp: new Date().toISOString() });
    const userCookie = cookies.find(cookie => cookie.startsWith('userData='));
    if (!userCookie) {
        console.debug('No userData cookie found', { timestamp: new Date().toISOString() });
        return null;
    }
    try {
        let cookieValue = userCookie.split('=')[1];
        let decodedValue = decodeURIComponent(cookieValue);
        let user = JSON.parse(decodedValue) as User;
        console.debug('User loaded from cookie (single decode):', { userID: user.userID, email: user.email, roles: user.Roles?.map(r => r.name), timestamp: new Date().toISOString() });
        return user;
    } catch (error) {
        console.warn('Single decode failed, attempting double decode:', error, { cookieValue: userCookie, timestamp: new Date().toISOString() });
        try {
            let cookieValue = userCookie.split('=')[1];
            let decodedValue = decodeURIComponent(decodeURIComponent(cookieValue));
            let user = JSON.parse(decodedValue) as User;
            console.debug('User loaded from cookie (double decode):', { userID: user.userID, email: user.email, roles: user.Roles?.map(r => r.name), timestamp: new Date().toISOString() });
            return user;
        } catch (doubleError) {
            console.error('Failed to parse userData cookie:', doubleError, { cookieValue: userCookie, timestamp: new Date().toISOString() });
            return null;
        }
    }
};

const setUserCookie = (user: User, maxAge: number) => {
    const encodedUser = encodeURIComponent(JSON.stringify(user));
    const sameSite = import.meta.env.VITE_ENV === 'development' ? 'Lax' : 'Strict';
    document.cookie = `userData=${encodedUser}; path=/; SameSite=${sameSite}; max-age=${maxAge}`;
};

const clearAuthCookies = () => {
    document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'userData=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    console.debug('Auth cookies cleared', { timestamp: new Date().toISOString() });
};

const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(getUserFromCookie());
    const [userRoles, setUserRoles] = useState<Role[] | null>(null);
    const [effectivePermissions, setEffectivePermissions] = useState<Permission[] | null>(null);
    const [permissionsLoaded, setPermissionsLoaded] = useState(false);
    const [noAccess, setNoAccess] = useState(false);
    const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
    const [redirectLoading, setRedirectLoading] = useState(false);
    const isNavigating = useRef(false);
    const lastNavigatedPath = useRef<string | null>(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        setupAxiosInterceptors();
    }, []);

    const loadPermissionsWithRetry = async (userID: string, retries = 3, delay = 2000): Promise<boolean> => {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const [perms, roles] = await Promise.all([
                    getEffectivePermissions(userID),
                    getRolesByUser(userID),
                ]);
                setEffectivePermissions(perms);
                setUserRoles(roles);
                setPermissionsLoaded(true);
                console.debug('Permissions and roles loaded:', {
                    permissions: perms.map(p => p.name),
                    roles: roles.map(r => r.name),
                    timestamp: new Date().toISOString(),
                });
                return true;
            } catch (error) {
                console.error(`Permission load attempt ${attempt} failed:`, error);
                if (attempt < retries) {
                    console.debug(`Retrying permission load in ${delay}ms`, { attempt: attempt + 1 });
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        console.error('Failed to load permissions after retries');
        return false;
    };

    useEffect(() => {
        const loadPermissions = async () => {
            if (!user || permissionsLoaded) {
                console.debug('Skipping permission load: no user or permissions already loaded', {
                    user: !!user,
                    permissionsLoaded,
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            setPermissionsLoaded(false);
            const success = await loadPermissionsWithRetry(user.userID);
            if (!success) {
                await handleLogout();
                debouncedNavigate('/login', {
                    replace: true,
                    state: { error: 'Session expired. Please log in again.' },
                });
            }
        };

        loadPermissions();
    }, [user, permissionsLoaded]);

    useEffect(() => {
        if (user && !permissionsLoaded) {
            const timeout = setTimeout(() => {
                if (!permissionsLoaded) {
                    console.error('Permission loading timed out', { timestamp: new Date().toISOString() });
                    handleLogout();
                    debouncedNavigate('/login', {
                        replace: true,
                        state: { error: 'Failed to load permissions. Please log in again.' },
                    });
                }
            }, 15000);
            return () => clearTimeout(timeout);
        }
    }, [user, permissionsLoaded]);

    const debouncedNavigate = useCallback(
        debounce(
            (to: string, options: { replace?: boolean; state?: unknown }) => {
                if (isNavigating.current || lastNavigatedPath.current === to) {
                    console.debug('Skipping navigation: already navigating or same path', {
                        to,
                        lastNavigatedPath: lastNavigatedPath.current,
                        timestamp: new Date().toISOString(),
                    });
                    return;
                }
                console.debug('Executing navigation:', { to, options, timestamp: new Date().toISOString() });
                isNavigating.current = true;
                lastNavigatedPath.current = to;
                navigate(to, options);
                setRedirectLoading(false);
                setTimeout(() => {
                    isNavigating.current = false;
                }, 100);
            },
            100,
            { leading: true, trailing: false }
        ),
        [navigate]
    );

    useEffect(() => {
        return () => {
            debouncedNavigate.cancel();
        };
    }, [debouncedNavigate]);

    useEffect(() => {
        if (!user || !tokenExpiry || ['/login', '/verify-2fa', '/reset-password'].includes(location.pathname)) return;

        const refreshBuffer = 30 * 1000;
        const timeUntilRefresh = tokenExpiry - Date.now() - refreshBuffer;

        if (timeUntilRefresh <= 0) {
            handleRefresh();
            return;
        }

        const timer = setTimeout(handleRefresh, timeUntilRefresh);
        return () => clearTimeout(timer);
    }, [tokenExpiry, user, location.pathname]);

    const handleRefresh = async (retries = 3) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const { accessToken, expiresIn } = await refreshToken();
                const newExpiry = Date.now() + expiresIn;
                const sameSite = import.meta.env.VITE_ENV === 'development' ? 'Lax' : 'Strict';
                document.cookie = `accessToken=${accessToken}; path=/; SameSite=${sameSite}; max-age=${expiresIn / 1000}; HttpOnly`;
                setTokenExpiry(newExpiry);
                window.dispatchEvent(new Event('tokenRefreshed'));
                reconnectSocket();
                console.debug('Token refreshed successfully', { newExpiry, attempt, timestamp: new Date().toISOString() });
                return;
            } catch (error) {
                console.error(`Refresh attempt ${attempt} failed:`, error);
                if (
                    typeof error === 'object' &&
                    error !== null &&
                    'message' in error &&
                    typeof (error as { message?: string }).message === 'string' &&
                    (error as { message: string }).message.includes('Session not found')
                ) {
                    console.warn('Session not found in Redis, logging out', { attempt, timestamp: new Date().toISOString() });
                    await handleLogout();
                    debouncedNavigate('/login', {
                        replace: true,
                        state: { error: 'Session expired. Please log in again.' },
                    });
                    return;
                }
                if (attempt === retries) {
                    console.error('Max refresh attempts reached, logging out', { timestamp: new Date().toISOString() });
                    await handleLogout();
                    debouncedNavigate('/login', {
                        replace: true,
                        state: { error: 'Session expired. Please log in again.' },
                    });
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    };

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

    useEffect(() => {
        const query = new URLSearchParams(location.search);
        const loginStatus = query.get('login');
        if (loginStatus === 'success' && !user) {
            console.debug('Google login redirect detected, checking cookies', { timestamp: new Date().toISOString() });
            const tryLoadUser = (attempt: number, maxAttempts: number) => {
                const userFromCookie = getUserFromCookie();
                if (userFromCookie) {
                    setUser(userFromCookie);
                    setTokenExpiry(Date.now() + (parseInt(import.meta.env.VITE_ACCESS_TOKEN_MAX_AGE) || 900000));
                    setPermissionsLoaded(false);
                    console.debug('User set from cookie after Google login', { userID: userFromCookie.userID, attempt });
                    initSocket();
                } else if (attempt < maxAttempts) {
                    console.debug('No userData cookie found, retrying...', { attempt, timestamp: new Date().toISOString() });
                    setTimeout(() => tryLoadUser(attempt + 1, maxAttempts), 200);
                } else {
                    console.error('No userData cookie found after retries', { timestamp: new Date().toISOString() });
                    debouncedNavigate('/login', {
                        replace: true,
                        state: { error: 'Failed to load user data. Please log in again.' },
                    });
                }
            };
            tryLoadUser(1, 3);
        }
    }, [location.search, user, debouncedNavigate]);

    useEffect(() => {
        if (isNavigating.current || !permissionsLoaded) {
            console.debug('Skipping navigation: isNavigating or permissions not loaded', {
                isNavigating: isNavigating.current,
                permissionsLoaded,
                timestamp: new Date().toISOString(),
            });
            return;
        }

        const currentPath = location.pathname;

        if (!user) {
            if (!['/login', '/reset-password', '/verify-2fa'].includes(currentPath)) {
                console.debug('Redirecting to /login: user not authenticated', {
                    currentPath,
                    timestamp: new Date().toISOString(),
                });
                debouncedNavigate('/login', { replace: true, state: { from: currentPath } });
            }
            return;
        }

        if (!userRoles?.length && !effectivePermissions?.length) {
            console.debug('Setting noAccess: no roles or permissions', { timestamp: new Date().toISOString() });
            setNoAccess(true);
            return;
        }

        setNoAccess(false);

        const targetRoute = determineTargetRoute(userRoles || []);
        console.debug('Determined target route:', {
            targetRoute,
            roles: userRoles?.map(r => r.name),
            timestamp: new Date().toISOString(),
        });

        if (['/login', '/verify-2fa', '/reset-password'].includes(currentPath)) {
            console.debug('Redirecting authenticated user from login-related page to:', targetRoute, {
                timestamp: new Date().toISOString(),
            });
            debouncedNavigate(targetRoute, { replace: true });
            return;
        }

        if (currentPath === targetRoute || hasPermissionForRoute(currentPath)) {
            console.debug('Skipping navigation: already on target or permitted route', {
                currentPath,
                targetRoute,
                timestamp: new Date().toISOString(),
            });
            lastNavigatedPath.current = currentPath;
            return;
        }

        const fromRoute =
            location.state?.from &&
                location.state.from !== '/login' &&
                location.state.from !== '/reset-password' &&
                location.state.from !== '/verify-2fa' &&
                hasPermissionForRoute(location.state.from)
                ? location.state.from
                : targetRoute;
        console.debug('Navigating to:', {
            fromRoute,
            locationStateFrom: location.state?.from,
            timestamp: new Date().toISOString(),
        });

        debouncedNavigate(fromRoute, { replace: true });
    }, [user, permissionsLoaded, userRoles, effectivePermissions, location.pathname, hasPermissionForRoute, debouncedNavigate]);

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
        setRedirectLoading(true);
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
                    setRedirectLoading(false);
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
                phone: response.user.phone || '',
                firstname: '',
                lastname: '',
                password: '',
                keycloakId: '',
                isOnline: false,
                hasGoogleAuth: false,
                hasCalendarAccess: false,
                Roles: (response.user.roles || []).map(role => ({
                    roleID: role.roleID,
                    name: role.name,
                    description: role.description || '',
                    permissions: (role.Permissions || []).map(perm => ({
                        permissionID: perm.permissionID,
                        name: perm.name,
                        class: perm.class || '',
                        description: perm.description || '',
                    })),
                })),
            };

            const sameSite = import.meta.env.VITE_ENV === 'development' ? 'Lax' : 'Strict';
            const expiresIn = response.expiresIn || parseInt(import.meta.env.VITE_ACCESS_TOKEN_MAX_AGE) || 900000;
            document.cookie = `accessToken=${response.accessToken}; path=/; SameSite=${sameSite}; max-age=${expiresIn / 1000}; HttpOnly`;
            setUserCookie(newUser, expiresIn / 1000);

            console.debug('Cookies set after login:', {
                accessToken: 'Set (HttpOnly)',
                userData: newUser.userID,
                sameSite,
                maxAge: expiresIn / 1000,
                cookieString: `accessToken=...; path=/; SameSite=${sameSite}; max-age=${expiresIn / 1000}; HttpOnly`,
                timestamp: new Date().toISOString(),
            });

            setUser(newUser);
            setTokenExpiry(Date.now() + expiresIn);
            setPermissionsLoaded(false);

            initSocket();

            try {
                const success = await loadPermissionsWithRetry(newUser.userID);
                if (!success) {
                    throw new Error('Failed to load permissions');
                }
            } catch (error) {
                console.error('Failed to load permissions after login:', error);
                throw new Error('Failed to load permissions');
            }
        } catch (error) {
            setRedirectLoading(false);
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
            disconnectSocket();
            setUser(null);
            setUserRoles(null);
            setEffectivePermissions(null);
            setPermissionsLoaded(false);
            setNoAccess(false);
            setTokenExpiry(null);
            setRedirectLoading(false);
            clearAuthCookies();
            lastNavigatedPath.current = null;
            debouncedNavigate.cancel();

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
        redirectLoading,
        loginUser,
        logout: handleLogout,
    };

    return (
        <AuthContext.Provider value={value}>
            {redirectLoading ? (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100vh',
                        flexDirection: 'column',
                        textAlign: 'center',
                        backgroundColor: '#222',
                    }}
                >
                    <div className="spinner" style={{
                        border: '4px solid #f3f3f3',
                        borderTop: '4px solid #3498db',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        animation: 'spin 1s linear infinite',
                    }} />
                    <p style={{ marginTop: '20px', fontSize: '16px', color: '#fff' }}>Redirecting...</p>
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            ) : noAccess ? (
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
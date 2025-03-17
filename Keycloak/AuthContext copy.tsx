import { createContext, useState, useContext, ReactNode, useEffect } from "react";
import keycloak, { initializeKeycloak } from "./keycloak";
import User from "../Front-End/src/models/User";

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: () => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        initializeKeycloak()
            .then((authenticated) => {
                console.log('AuthContext: Keycloak authenticated:', authenticated);
                setIsAuthenticated(authenticated);
                if (authenticated) {
                    setToken(keycloak.token || null);
                    console.log('Token set:', keycloak.token);
                    setUser({
                        userID: keycloak.tokenParsed?.sub || '',
                        email: keycloak.tokenParsed?.email || '',
                        phone: keycloak.tokenParsed?.phone || '',
                        wallet: keycloak.tokenParsed?.wallet || '',
                        roles: keycloak.tokenParsed?.realm_access?.roles.map((role: string) => ({ name: role })) || [],
                        permissions: keycloak.tokenParsed?.resource_access?.['traceflow-backend']?.roles || [],
                    });
                    keycloak.onTokenExpired = () => {
                        console.log('Token expired, refreshing...');
                        keycloak.updateToken(30)
                            .then((refreshed) => {
                                if (refreshed) {
                                    console.log('Token refreshed:', keycloak.token);
                                    setToken(keycloak.token || null);
                                }
                            })
                            .catch((error) => {
                                console.error('Token refresh failed:', error);
                                logout();
                            });
                    };
                } else {
                    console.log('User not authenticated, should redirect to login');
                }
                setIsInitialized(true);
            })
            .catch((error) => {
                console.error('AuthContext: Keycloak initialization failed:', error);
                setIsInitialized(true); // Allow rendering even on failure
            });

        return () => {
            keycloak.onTokenExpired = null;
        };
    }, []);

    const login = () => {
        keycloak.login();
    };

    const logout = () => {
        keycloak.logout({ redirectUri: 'http://localhost:5173/login' });
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
    };

    if (!isInitialized) {
        return <div>Loading authentication...</div>;
    }

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
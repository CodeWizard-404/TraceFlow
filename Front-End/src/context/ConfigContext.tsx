// src/context/ConfigContext.tsx
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import Permission from '../models/Permission';
import Role from '../models/Role';
import { Checklist } from '../models/Checklist';
import { Reason } from '../models/Reason';


interface Config {
    permissions: Permission[];
    roles: Role[];
    checklistItems: Checklist[];
    reasonItems: Reason[];
    visitStatuses: string[];
}

const ConfigContext = createContext<Config | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { token, effectivePermissions } = useAuth();
    const [config, setConfig] = useState<Config>({
        permissions: [],
        roles: [],
        checklistItems: [],
        reasonItems: [],
        visitStatuses: [],
    });

    // Check if user has 'read_config' permission
    const canReadConfig = useMemo(
        () => effectivePermissions?.some(p => p.name === 'read_config'),
        [effectivePermissions]
    );

    const fetchConfig = async () => {
        if (!token) return;

        // If user lacks read_config permission, log warning and use fallback
        if (!canReadConfig) {
            console.warn('User lacks read_config permission');
            const cached = localStorage.getItem('appConfig');
            if (cached) {
                setConfig(JSON.parse(cached));
            } 
            // else {
            //     setConfig({
            //         permissions: [{ id: 'perm_default', name: 'read_users', type: 'feature', class: 'User', description: 'Default' }],
            //         roles: [{ id: 'role_default', name: 'User', description: 'Default role', permissions: ['read_users'] }],
            //         checklistItems: [{ id: 'cl_default', item: 'Default checklist' }],
            //         reasonItems: [{ id: 'rs_default', item: 'Default reason' }],
            //         visitStatuses: ['pending', 'validated', 'rejected', 'visited'],
            //     });
            // }
            return;
        }

        try {
            const response = await fetch(`${process.env.REACT_APP_BASE_URL}/api/config`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) throw new Error('Failed to fetch config');
            const data: Config = await response.json();
            setConfig(data);
            localStorage.setItem('appConfig', JSON.stringify(data)); // Cache it
        } catch (error) {
            console.error('Failed to fetch config:', error);
            const cached = localStorage.getItem('appConfig');
            if (cached) {
                setConfig(JSON.parse(cached));
            } 
            // else {
            //     setConfig({
            //         permissions: [{ id: 'perm_default', name: 'read_users', type: 'feature', class: 'User', description: 'Default' }],
            //         roles: [{ id: 'role_default', name: 'User', description: 'Default role', permissions: ['read_users'] }],
            //         checklistItems: [{ id: 'cl_default', item: 'Default checklist' }],
            //         reasonItems: [{ id: 'rs_default', item: 'Default reason' }],
            //         visitStatuses: ['pending', 'validated', 'rejected', 'visited'],
            //     });
            // }
        }
    };

    useEffect(() => {
        fetchConfig();
        const interval = setInterval(fetchConfig, 600000); // Refresh every 10 minutes
        return () => clearInterval(interval);
    }, [token, canReadConfig]); // Add canReadConfig as dependency

    return (
        <ConfigContext.Provider value={config}>
            {children}
        </ConfigContext.Provider>
    );
};

export const useConfig = () => {
    const context = useContext(ConfigContext);
    if (!context) throw new Error('useConfig must be used within a ConfigProvider');
    return context;
};
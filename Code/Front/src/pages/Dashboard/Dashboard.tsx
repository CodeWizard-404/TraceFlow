import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Dashboard.css';

// Import all widgets


const ROLES = {
    SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
    REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
    SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
    ADMIN: import.meta.env.VITE_ROLES_ADMIN,
    HR: import.meta.env.VITE_ROLES_HR,
    PURCHASE_TEAM: import.meta.env.VITE_ROLES_PURCHASE_TEAM,
    STOCK_MANAGER: import.meta.env.VITE_ROLES_STOCK_MANAGER,
    DIRECTOR: import.meta.env.VITE_ROLES_DIRECTOR,
};




const Dashboard: React.FC = () => {
    const { user, userRoles, permissionsLoaded } = useAuth();

    useEffect(() => {
        if (user && userRoles && permissionsLoaded) {

        }
    }, [user, userRoles, permissionsLoaded]);



    if (!user || !userRoles || !permissionsLoaded) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <h1>Welcome, {user.firstname} {user.lastname}</h1>

        </div>
    );
};

export default Dashboard;